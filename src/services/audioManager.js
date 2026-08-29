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
  }

  async inicializar(onPcmData, onSilenceDetected) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

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
    // O DETECTOR DE SILÊNCIO (Recalibrado para ignorar chiados)
    // =====================================================================
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.minDecibels = -50; 
    this.analyser.smoothingTimeConstant = 0.2; // Reage mais rápido quando o senhor para de falar
    this.source.connect(this.analyser);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const monitorarVolume = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);
      
      let soma = 0;
      for (let i = 0; i < dataArray.length; i++) soma += dataArray[i];
      let volumeMedio = soma / dataArray.length;

      // Aumentamos o limite para 15 (antes era 5). Ele vai ignorar estática e ventiladores pequenos.
      const LIMITE_DE_RUIDO = 15;

      if (volumeMedio > LIMITE_DE_RUIDO) { 
        // O SENHOR ESTÁ FALANDO (O volume superou o ruído de fundo)
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        this.isTalking = true;
      } else { 
        // SILÊNCIO DETECTADO (O volume caiu para o nível do ruído de fundo)
        if (this.isTalking && !this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.isTalking = false;
            console.log("[Bastian Core] Silêncio detectado. Forçando resposta da IA...");
            if (onSilenceDetected) onSilenceDetected(); // Dispara o "Câmbio" invisível
          }, 1500); // Exatos 1.5s após o senhor parar de falar
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
    if (tempoAtual < this.nextPlayTime) {
       reprodutor.start(this.nextPlayTime);
       this.nextPlayTime += audioBuffer.duration;
    } else {
       reprodutor.start(tempoAtual);
       this.nextPlayTime = tempoAtual + audioBuffer.duration;
    }
  }

  parar() {
    if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    if (this.workletNode) this.workletNode.disconnect();
    if (this.analyser) this.analyser.disconnect();
    if (this.audioContext) this.audioContext.close();
    
    this.analyser = null;
    this.nextPlayTime = 0;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
  }
}