// src/services/audioManager.js

const VOICE_PROFILE_KEY = 'bastian_yuri_voice_profile';

export class GerenciadorDeAudio {
  constructor() {
    this.audioContext = null;
    this.stream = null;
    this.source = null;
    this.workletNode = null;
    this.analyser = null;

    this.nextPlayTime = 0;
    this.isTalking = false;
    this.silenceTimer = null;
    this.rafId = null;

    this.activeSources = [];
    this.framesDeRuido = 0;

    // =====================================================================
    // ESTADO DE BIOMETRIA VOCAL (Identificação Yuri vs. Terceiros)
    // =====================================================================
    this.voiceProfile = this.carregarPerfilVocal();
    this.amostrasFalaAtual = []; // Guarda { pitch, centroid, energy } durante a frase
    this.forcarCalibracaoNaProximaFala = false;
  }

  carregarPerfilVocal() {
    try {
      const saved = localStorage.getItem(VOICE_PROFILE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  salvarPerfilVocal(perfil) {
    try {
      this.voiceProfile = perfil;
      localStorage.setItem(VOICE_PROFILE_KEY, JSON.stringify(perfil));
    } catch (e) {}
  }

  resetarPerfilVocal() {
    this.voiceProfile = null;
    this.forcarCalibracaoNaProximaFala = true;
    localStorage.removeItem(VOICE_PROFILE_KEY);
  }

  // Extrai Frequência Fundamental (Pitch Hz) e Centroide Espectral (Timbre Hz) do frame atual
  extrairAssinaturaVocal(dataArray) {
    if (!this.audioContext || !this.analyser) return null;
    const sampleRate = this.audioContext.sampleRate; // 16000 Hz
    const binSize = sampleRate / this.analyser.fftSize; // ~15.625 Hz por bin

    // Faixa fundamental da voz humana: ~80 Hz (bin 5) até ~320 Hz (bin 20)
    const minVocalBin = Math.max(1, Math.floor(80 / binSize));
    const maxVocalBin = Math.floor(320 / binSize);

    let maxVal = 0;
    let peakBin = minVocalBin;
    for (let i = minVocalBin; i <= maxVocalBin; i++) {
      if (dataArray[i] > maxVal) {
        maxVal = dataArray[i];
        peakBin = i;
      }
    }

    // Só considera frame com energia vocal real (ignora ruído de ventilador/teclado)
    if (maxVal < 75) return null;

    // Interpolação parabólica simples para refinar o pico de Pitch em Hz
    const prev = dataArray[peakBin - 1] || maxVal;
    const next = dataArray[peakBin + 1] || maxVal;
    const denom = prev - 2 * maxVal + next;
    const delta = denom !== 0 ? (0.5 * (prev - next)) / denom : 0;
    const pitchHz = (peakBin + delta) * binSize;

    // Centroide Espectral (Timbre vocal de 80 Hz a 2600 Hz)
    const maxTimbreBin = Math.min(dataArray.length - 1, Math.floor(2600 / binSize));
    let weightedSum = 0;
    let totalEnergy = 0;
    for (let i = minVocalBin; i <= maxTimbreBin; i++) {
      weightedSum += i * binSize * dataArray[i];
      totalEnergy += dataArray[i];
    }
    const centroidHz = totalEnergy > 0 ? weightedSum / totalEnergy : 0;

    return { pitchHz, centroidHz, energy: maxVal };
  }

  // Consolida todas as amostras colhidas durante a frase e compara com o perfil do Yuri
  avaliarLocutorDaFrase() {
    const amostras = this.amostrasFalaAtual;
    this.amostrasFalaAtual = [];

    // Se a fala foi muito curta (< 5 frames vocais limpos), assume Yuri por segurança
    if (amostras.length < 5) {
      return { locutor: 'Yuri', confianca: 100, calibrado: Boolean(this.voiceProfile) };
    }

    const avgPitch = amostras.reduce((acc, a) => acc + a.pitchHz, 0) / amostras.length;
    const avgCentroid = amostras.reduce((acc, a) => acc + a.centroidHz, 0) / amostras.length;
    const avgEnergy = amostras.reduce((acc, a) => acc + a.energy, 0) / amostras.length;

    // 1. Se ainda não existe perfil do Yuri (ou se pediu recalibração), registra esta fala como âncora!
    if (!this.voiceProfile || this.forcarCalibracaoNaProximaFala) {
      const novoPerfil = {
        pitchHz: Math.round(avgPitch),
        centroidHz: Math.round(avgCentroid),
        energy: Math.round(avgEnergy),
        samplesCount: 1,
        updatedAt: new Date().toISOString()
      };
      this.salvarPerfilVocal(novoPerfil);
      this.forcarCalibracaoNaProximaFala = false;
      return {
        locutor: 'Yuri',
        confianca: 100,
        recemCalibrado: true,
        pitchHz: Math.round(avgPitch)
      };
    }

    // 2. Calcula a distância acústica em relação à assinatura vocal do Yuri
    const pitchDiff = Math.abs(avgPitch - this.voiceProfile.pitchHz);
    const centroidDiff = Math.abs(avgCentroid - this.voiceProfile.centroidHz);
    const energyRatio = avgEnergy / (this.voiceProfile.energy || avgEnergy);

    // Penalidades:
    // - Diferença de Pitch > 32 Hz ou Timbre > 280 Hz ou volume muito distante (< 55% da energia normal)
    const normPitchError = pitchDiff / 45; // > 1.0 indica tom vocal bem diferente
    const normCentroidError = centroidDiff / 320;
    const distancePenalty = energyRatio < 0.55 ? 0.35 : 0; // Pessoa falando longe do microfone

    const distanciaTotal = normPitchError * 0.55 + normCentroidError * 0.35 + distancePenalty;
    const similaridade = Math.max(0, Math.min(100, Math.round((1 - distanciaTotal * 0.45) * 100)));

    const isYuri = similaridade >= 68;

    // Aprendizado contínuo suave (Média Móvel Exponencial) quando a certeza de ser o Yuri é alta
    if (isYuri && similaridade >= 82) {
      this.salvarPerfilVocal({
        pitchHz: Math.round(this.voiceProfile.pitchHz * 0.85 + avgPitch * 0.15),
        centroidHz: Math.round(this.voiceProfile.centroidHz * 0.85 + avgCentroid * 0.15),
        energy: Math.round(this.voiceProfile.energy * 0.85 + avgEnergy * 0.15),
        samplesCount: (this.voiceProfile.samplesCount || 1) + 1,
        updatedAt: new Date().toISOString()
      });
    }

    return {
      locutor: isYuri ? 'Yuri' : 'Visitante',
      confianca: similaridade,
      pitchHz: Math.round(avgPitch),
      perfilPitchHz: this.voiceProfile.pitchHz,
      longeDoMic: energyRatio < 0.55
    };
  }

  async inicializar(onPcmData, onSilenceDetected, onStartTalking) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const codigoDoProcessador = `
      class PcmProcessor extends AudioWorkletProcessor {
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input.length > 0) {
            const canal = input[0];
            const pcm16 = new Int16Array(canal.length);
            for (let i = 0; i < canal.length; i++) {
              let s = Math.max(-1, Math.min(1, canal[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.port.postMessage(pcm16.buffer);
          }
          return true; 
        }
      }
      registerProcessor('pcm-processor', PcmProcessor);
    `;

    const blob = new Blob([codigoDoProcessador], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    await this.audioContext.audioWorklet.addModule(workletUrl);

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true }
    });

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

    // =====================================================================
    // DETECTOR DE VOZ (VAD) + COLETOR BIOMÉTRICO (FFT 1024)
    // =====================================================================
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.minDecibels = -55;
    this.analyser.smoothingTimeConstant = 0.25;
    this.source.connect(this.analyser);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const monitorarVolume = () => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      let soma = 0;
      for (let i = 0; i < dataArray.length; i++) soma += dataArray[i];
      const volumeMedio = soma / dataArray.length;

      const isPlaying = this.isPlaying();
      const limiteDinamico = isPlaying ? 45 : 14;

      if (volumeMedio > limiteDinamico) {
        this.framesDeRuido++;
        const framesNecessarios = isPlaying ? 5 : 2;

        if (this.framesDeRuido >= framesNecessarios) {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }

          if (!this.isTalking) {
            this.isTalking = true;
            this.amostrasFalaAtual = [];
            if (onStartTalking) onStartTalking();
          }

          // Coleta amostra biométrica da voz apenas quando a IA está calada (para não medir a voz do próprio Bastian)
          if (!isPlaying) {
            const assinatura = this.extrairAssinaturaVocal(dataArray);
            if (assinatura) {
              this.amostrasFalaAtual.push(assinatura);
            }
          }
        }
      } else {
        this.framesDeRuido = 0;

        if (this.isTalking && !this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.isTalking = false;
            const analiseLocutor = this.avaliarLocutorDaFrase();
            if (onSilenceDetected) onSilenceDetected(analiseLocutor);
          }, 800);
        }
      }

      this.rafId = requestAnimationFrame(monitorarVolume);
    };
    monitorarVolume();

    this.workletNode.port.onmessage = (event) => {
      const pcmBuffer = event.data;
      const base64Audio = this.arrayBufferToBase64(pcmBuffer);
      onPcmData(base64Audio);
    };

    this.source.connect(this.workletNode);
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  tocarAudio(base64Audio) {
    if (!this.audioContext) return;

    const stringBinaria = window.atob(base64Audio);
    const bytes = new Uint8Array(stringBinaria.length);
    for (let i = 0; i < stringBinaria.length; i++) bytes[i] = stringBinaria.charCodeAt(i);

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) float32Array[i] = int16Array[i] / 32768.0;

    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const reprodutor = this.audioContext.createBufferSource();
    reprodutor.buffer = audioBuffer;
    reprodutor.connect(this.audioContext.destination);

    const tempoAtual = this.audioContext.currentTime;

    if (tempoAtual >= this.nextPlayTime) {
      this.nextPlayTime = tempoAtual + 0.1;
    }

    reprodutor.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;

    this.activeSources.push(reprodutor);
    reprodutor.onended = () => {
      this.activeSources = this.activeSources.filter((src) => src !== reprodutor);
    };
  }

  isPlaying() {
    return this.audioContext && this.audioContext.currentTime < this.nextPlayTime;
  }

  pararAudioAtual() {
    if (!this.audioContext) return;

    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    this.activeSources = [];
    this.nextPlayTime = this.audioContext.currentTime;
  }

  parar() {
    this.pararAudioAtual();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop());
    if (this.workletNode) this.workletNode.disconnect();
    if (this.analyser) this.analyser.disconnect();
    if (this.audioContext) this.audioContext.close();

    this.analyser = null;
    this.nextPlayTime = 0;
    this.framesDeRuido = 0;
    this.amostrasFalaAtual = [];
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
  }
}