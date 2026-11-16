// src/services/audioManager.js

const VOICE_PROFILE_KEY = 'bastian_yuri_voice_profile';
const PROFILE_VERSION = 2; // perfis antigos (pitch por pico espectral) não são comparáveis: recalibra uma vez

const VAD_INTERVAL_MS = 16; // ~60 vezes por segundo, como o requestAnimationFrame antigo
const SILENCE_MS = 800; // pausa que encerra uma fala
const CHUNK_SAMPLES = 512; // 32 ms por pacote enviado (antes: 8 ms, ~125 mensagens/s)

const MIN_FRAMES_AVALIACAO = 5; // menos que isso: fala curta demais para julgar
const MIN_FRAMES_CALIBRACAO = 15; // calibrar exige uma fala de verdade, não um ruído ou um "ok"
const CONTINUIDADE_MS = 6000; // fala curta logo após um visitante continua sendo tratada como dele

const LIMITE_SIMILARIDADE = 68;
const LIMITE_APRENDIZADO = 82;

/* ------------------------------------------------------------------ */
/* Helpers de sinal                                                    */
/* ------------------------------------------------------------------ */

const mediana = (valores) => {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
};

// Pitch por autocorrelação normalizada (70 a 400 Hz).
// O método antigo pegava o bin mais forte entre 80 e 320 Hz, que muitas vezes é o 2º harmônico:
// o pitch pulava uma oitava de um quadro para outro e vozes agudas ficavam fora da faixa.
export const estimarPitch = (buf, sampleRate) => {
  const N = buf.length;
  let soma = 0;
  for (let i = 0; i < N; i++) soma += buf[i] * buf[i];
  const rms = Math.sqrt(soma / N);
  if (rms < 0.015) return null; // quase silêncio

  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.floor(sampleRate / 70);
  const corr = new Float32Array(maxLag + 2);
  let melhor = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i < N - lag; i++) {
      c += buf[i] * buf[i + lag];
      e1 += buf[i] * buf[i];
      e2 += buf[i + lag] * buf[i + lag];
    }
    const n = c / (Math.sqrt(e1 * e2) || 1);
    corr[lag] = n;
    if (n > melhor) melhor = n;
  }

  if (melhor < 0.55) return null; // ruído ou som sem vozeamento (s, f, teclado, ventilador)

  // Menor período com correlação quase tão boa quanto a melhor: evita escolher múltiplos do período
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] >= 0.85 * melhor && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
      const a = corr[lag - 1];
      const b = corr[lag];
      const c = corr[lag + 1];
      const den = a - 2 * b + c;
      const delta = den !== 0 ? (0.5 * (a - c)) / den : 0;
      return { pitchHz: sampleRate / (lag + delta), rms };
    }
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Gerenciador                                                         */
/* ------------------------------------------------------------------ */

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
    this.vadTimer = null;
    this.encerrado = false; // vira true em parar(): impede que uma inicialização em andamento reabra o microfone

    this.activeSources = [];
    this.framesDeRuido = 0;

    // Biometria vocal (Yuri vs. terceiros)
    this.voiceProfile = this.carregarPerfilVocal();
    this.amostrasFalaAtual = []; // { pitchHz, centroidHz, energy } por quadro vozeado
    this.forcarCalibracaoNaProximaFala = false;
    this.ultimoResultado = null; // { locutor, confianca, pitchHz, t } da última avaliação conclusiva
  }

  /* --------------------------- Perfil vocal --------------------------- */

  carregarPerfilVocal() {
    try {
      const saved = localStorage.getItem(VOICE_PROFILE_KEY);
      if (!saved) return null;
      const p = JSON.parse(saved);
      const valido =
        p && p.version === PROFILE_VERSION &&
        Number.isFinite(p.pitchHz) && p.pitchHz >= 70 && p.pitchHz <= 400 &&
        Number.isFinite(p.centroidHz) && Number.isFinite(p.energy);
      return valido ? p : null;
    } catch {
      return null;
    }
  }

  salvarPerfilVocal(perfil) {
    this.voiceProfile = { ...perfil, version: PROFILE_VERSION };
    try {
      localStorage.setItem(VOICE_PROFILE_KEY, JSON.stringify(this.voiceProfile));
    } catch { /* storage indisponível: o perfil vale só nesta sessão */ }
  }

  resetarPerfilVocal() {
    this.voiceProfile = null;
    this.ultimoResultado = null;
    this.forcarCalibracaoNaProximaFala = true;
    try {
      localStorage.removeItem(VOICE_PROFILE_KEY);
    } catch { /* ignora */ }
  }

  // Assinatura de um quadro: pitch (autocorrelação), timbre (centroide espectral) e energia (RMS)
  extrairAssinaturaVocal(freqData, timeData) {
    if (!this.audioContext || !this.analyser) return null;

    const sampleRate = this.audioContext.sampleRate;
    const pitch = estimarPitch(timeData, sampleRate);
    if (!pitch) return null; // só quadros realmente vozeados entram no perfil

    const binSize = sampleRate / this.analyser.fftSize;
    const minBin = Math.max(1, Math.floor(80 / binSize));
    const maxBin = Math.min(freqData.length - 1, Math.floor(2600 / binSize));

    let somaPonderada = 0;
    let energiaTotal = 0;
    for (let i = minBin; i <= maxBin; i++) {
      somaPonderada += i * binSize * freqData[i];
      energiaTotal += freqData[i];
    }
    const centroidHz = energiaTotal > 0 ? somaPonderada / energiaTotal : 0;

    return { pitchHz: pitch.pitchHz, centroidHz, energy: pitch.rms * 1000 };
  }

  // Resultado "sem opinião formada": mantém o último locutor por alguns segundos
  resultadoInconclusivo() {
    const agora = Date.now();
    const ultimo = this.ultimoResultado;
    if (ultimo && agora - ultimo.t < CONTINUIDADE_MS) {
      return {
        locutor: ultimo.locutor,
        confianca: ultimo.confianca,
        pitchHz: ultimo.pitchHz,
        perfilPitchHz: this.voiceProfile?.pitchHz,
        inconclusivo: true
      };
    }
    return { locutor: 'Yuri', confianca: 0, inconclusivo: true, calibrado: Boolean(this.voiceProfile) };
  }

  registrarResultado(resultado) {
    this.ultimoResultado = {
      locutor: resultado.locutor,
      confianca: resultado.confianca,
      pitchHz: resultado.pitchHz,
      t: Date.now()
    };
    return resultado;
  }

  // Consolida as amostras da frase e compara com o perfil do Yuri.
  // ATENÇÃO: pitch + timbre dão uma boa pista, não uma prova de identidade. Vozes parecidas passam,
  // e uma gravação da voz dele também. Trate como conveniência, não como autenticação.
  avaliarLocutorDaFrase() {
    const amostras = this.amostrasFalaAtual;
    this.amostrasFalaAtual = [];

    const precisaCalibrar = !this.voiceProfile || this.forcarCalibracaoNaProximaFala;
    if (amostras.length < (precisaCalibrar ? MIN_FRAMES_CALIBRACAO : MIN_FRAMES_AVALIACAO)) {
      return this.resultadoInconclusivo();
    }

    const avgPitch = mediana(amostras.map((a) => a.pitchHz)); // mediana: robusta a quadros fora do padrão
    const avgCentroid = amostras.reduce((acc, a) => acc + a.centroidHz, 0) / amostras.length;
    const avgEnergy = amostras.reduce((acc, a) => acc + a.energy, 0) / amostras.length;

    // Sem perfil (ou recalibração pedida): esta fala vira a âncora
    if (precisaCalibrar) {
      this.salvarPerfilVocal({
        pitchHz: Math.round(avgPitch),
        centroidHz: Math.round(avgCentroid),
        energy: Math.round(avgEnergy),
        samplesCount: 1,
        updatedAt: new Date().toISOString()
      });
      this.forcarCalibracaoNaProximaFala = false;
      return this.registrarResultado({
        locutor: 'Yuri',
        confianca: 100,
        recemCalibrado: true,
        pitchHz: Math.round(avgPitch)
      });
    }

    const perfil = this.voiceProfile;
    const pitchDiff = Math.abs(avgPitch - perfil.pitchHz);
    const centroidDiff = Math.abs(avgCentroid - perfil.centroidHz);
    const energyRatio = avgEnergy / (perfil.energy || avgEnergy);

    const normPitchError = pitchDiff / 45; // > 1.0: tom bem diferente
    const normCentroidError = centroidDiff / 320;
    const distancePenalty = energyRatio < 0.55 ? 0.35 : 0; // falando longe do microfone

    const distanciaTotal = normPitchError * 0.55 + normCentroidError * 0.35 + distancePenalty;
    const similaridade = Math.max(0, Math.min(100, Math.round((1 - distanciaTotal * 0.45) * 100)));
    const isYuri = similaridade >= LIMITE_SIMILARIDADE;

    // Aprendizado contínuo suave (média móvel) só quando há bastante certeza
    if (isYuri && similaridade >= LIMITE_APRENDIZADO) {
      this.salvarPerfilVocal({
        pitchHz: Math.round(perfil.pitchHz * 0.85 + avgPitch * 0.15),
        centroidHz: Math.round(perfil.centroidHz * 0.85 + avgCentroid * 0.15),
        energy: Math.round(perfil.energy * 0.85 + avgEnergy * 0.15),
        samplesCount: (perfil.samplesCount || 1) + 1,
        updatedAt: new Date().toISOString()
      });
    }

    return this.registrarResultado({
      locutor: isYuri ? 'Yuri' : 'Visitante',
      confianca: similaridade,
      pitchHz: Math.round(avgPitch),
      perfilPitchHz: perfil.pitchHz,
      longeDoMic: energyRatio < 0.55
    });
  }

  /* ----------------------------- Captura ------------------------------ */

  async inicializar(onPcmData, onSilenceDetected, onStartTalking) {
    this.encerrado = false;

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    this.audioContext = ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    // Junta 512 amostras por pacote antes de enviar
    const codigoDoProcessador = `
      class PcmProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.buffer = new Int16Array(${CHUNK_SAMPLES});
          this.offset = 0;
        }
        process(inputs) {
          const canal = inputs[0] && inputs[0][0];
          if (canal) {
            for (let i = 0; i < canal.length; i++) {
              const s = Math.max(-1, Math.min(1, canal[i]));
              this.buffer[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              if (this.offset === this.buffer.length) {
                this.port.postMessage(this.buffer.buffer.slice(0));
                this.offset = 0;
              }
            }
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PcmProcessor);
    `;

    const workletUrl = URL.createObjectURL(new Blob([codigoDoProcessador], { type: 'application/javascript' }));
    try {
      await ctx.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }
    if (this.encerrado) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true }
    });
    // Se parar() rodou enquanto o navegador pedia permissão do microfone, fecha o stream recém-aberto
    if (this.encerrado) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;

    this.source = ctx.createMediaStreamSource(stream);
    this.workletNode = new AudioWorkletNode(ctx, 'pcm-processor');

    // VAD + coleta biométrica (FFT de 1024 pontos = 64 ms de sinal)
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.minDecibels = -55;
    this.analyser.smoothingTimeConstant = 0.25;
    this.source.connect(this.analyser);

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    const timeData = new Float32Array(this.analyser.fftSize);

    const monitorarVolume = () => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(freqData);
      let soma = 0;
      for (let i = 0; i < freqData.length; i++) soma += freqData[i];
      const volumeMedio = soma / freqData.length;

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

          // Só mede a voz quando a IA está calada (para não medir a voz do próprio Bastian)
          if (!isPlaying) {
            this.analyser.getFloatTimeDomainData(timeData);
            const assinatura = this.extrairAssinaturaVocal(freqData, timeData);
            if (assinatura) this.amostrasFalaAtual.push(assinatura);
          }
        }
      } else {
        this.framesDeRuido = 0;

        if (this.isTalking && !this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.silenceTimer = null;
            this.isTalking = false;
            const analiseLocutor = this.avaliarLocutorDaFrase();
            if (onSilenceDetected) onSilenceDetected(analiseLocutor);
          }, SILENCE_MS);
        }
      }
    };

    // setInterval em vez de requestAnimationFrame: o rAF para quando a aba fica em segundo plano,
    // e com ele o detector de silêncio (o Bastian deixava de responder com a aba escondida)
    this.vadTimer = setInterval(monitorarVolume, VAD_INTERVAL_MS);

    this.workletNode.port.onmessage = (event) => onPcmData(this.arrayBufferToBase64(event.data));

    this.source.connect(this.workletNode);
    // Saída muda até o destino: alguns navegadores só processam o worklet se ele chegar ao destino
    const mudo = ctx.createGain();
    mudo.gain.value = 0;
    this.workletNode.connect(mudo);
    mudo.connect(ctx.destination);
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const TAMANHO = 0x8000; // em blocos: evita concatenar byte a byte
    for (let i = 0; i < bytes.length; i += TAMANHO) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + TAMANHO));
    }
    return window.btoa(binary);
  }

  /* ---------------------------- Reprodução ---------------------------- */

  tocarAudio(base64Audio) {
    if (!this.audioContext || this.encerrado) return;

    const stringBinaria = window.atob(base64Audio);
    const bytesUteis = stringBinaria.length - (stringBinaria.length % 2); // Int16Array exige tamanho par
    if (bytesUteis === 0) return;

    const bytes = new Uint8Array(bytesUteis);
    for (let i = 0; i < bytesUteis; i++) bytes[i] = stringBinaria.charCodeAt(i);

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) float32Array[i] = int16Array[i] / 32768.0;

    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const reprodutor = this.audioContext.createBufferSource();
    reprodutor.buffer = audioBuffer;
    reprodutor.connect(this.audioContext.destination);

    const tempoAtual = this.audioContext.currentTime;
    if (tempoAtual >= this.nextPlayTime) this.nextPlayTime = tempoAtual + 0.1;

    reprodutor.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;

    this.activeSources.push(reprodutor);
    reprodutor.onended = () => {
      this.activeSources = this.activeSources.filter((src) => src !== reprodutor);
    };
  }

  isPlaying() {
    return Boolean(this.audioContext && this.audioContext.currentTime < this.nextPlayTime);
  }

  pararAudioAtual() {
    if (!this.audioContext) return;

    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch { /* já tinha terminado */ }
    });
    this.activeSources = [];
    this.nextPlayTime = this.audioContext.currentTime;
  }

  /* ----------------------------- Encerrar ----------------------------- */

  // Pode ser chamado mais de uma vez: o segundo close() de um AudioContext rejeitava a promise sem tratamento
  parar() {
    this.encerrado = true;
    this.pararAudioAtual();

    clearInterval(this.vadTimer);
    clearTimeout(this.silenceTimer);
    this.vadTimer = null;
    this.silenceTimer = null;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    try {
      if (this.workletNode) {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
      }
      if (this.analyser) this.analyser.disconnect();
      if (this.source) this.source.disconnect();
    } catch { /* nós já desconectados */ }

    const ctx = this.audioContext;
    this.audioContext = null; // tocarAudio e isPlaying deixam de usar um contexto fechado
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});

    this.workletNode = null;
    this.analyser = null;
    this.source = null;
    this.activeSources = [];
    this.nextPlayTime = 0;
    this.framesDeRuido = 0;
    this.isTalking = false;
    this.amostrasFalaAtual = [];
  }
}