// src/services/audioManager.js

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
    
    this.activeSources = []; 
    this.framesDeRuido = 0; // NOVO: Filtro contra falsos positivos
  }

  async inicializar(onPcmData, onSilenceDetected, onStartTalking) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    
    // NOVO (Trava 1): Força o navegador a desbloquear a saída de áudio
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
    // DETECTOR DE VOZ (VAD) COM ANTIRRUÍDO
    // =====================================================================
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.minDecibels = -50; 
    this.analyser.smoothingTimeConstant = 0.2; 
    this.source.connect(this.analyser);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const monitorarVolume = () => {
      if (!this.analyser) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      let soma = 0;
      for (let i = 0; i < dataArray.length; i++) soma += dataArray[i];
      let volumeMedio = soma / dataArray.length;
      
      const isPlaying = this.isPlaying();
      
      // NOVO (Trava 2): Se a IA estiver falando, o volume precisa ser muito mais alto (45) para cortá-la
      const limiteDinamico = isPlaying ? 45 : 15;

      if (volumeMedio > limiteDinamico) { 
        this.framesDeRuido++;
        
        // NOVO (Trava 3): Exige 5 frames (fração de seg) para interromper a IA, para ignorar estalos e ecos
        const framesNecessarios = isPlaying ? 5 : 1;

        if (this.framesDeRuido >= framesNecessarios) {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
          
          if (!this.isTalking) {
            this.isTalking = true;
            if (onStartTalking) onStartTalking();
          }
        }
      } else { 
        this.framesDeRuido = 0; // Zera o contador de ruído se ficou silêncio
        
        if (this.isTalking && !this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.isTalking = false;
            if (onSilenceDetected) onSilenceDetected(); 
          }, 800); 
        }
      }
      
      requestAnimationFrame(monitorarVolume);
    };
    monitorarVolume();
    // =====================================================================

    this.workletNode.port.onmessage = (event) => {
      const pcmBuffer = event.data;
      const base64Audio = this.arrayBufferToBase64(pcmBuffer);
      onPcmData(base64Audio);
    };

    this.source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination); 
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
      this.activeSources = this.activeSources.filter(src => src !== reprodutor);
    };
  }

  isPlaying() {
    return this.audioContext && (this.audioContext.currentTime < this.nextPlayTime);
  }

  pararAudioAtual() {
    if (!this.audioContext) return;
    
    this.activeSources.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    this.activeSources = [];
    
    this.nextPlayTime = this.audioContext.currentTime;
  }

  parar() {
    this.pararAudioAtual(); 
    if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    if (this.workletNode) this.workletNode.disconnect();
    if (this.analyser) this.analyser.disconnect();
    if (this.audioContext) this.audioContext.close();
    
    this.analyser = null;
    this.nextPlayTime = 0;
    this.framesDeRuido = 0;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
  }
}