// src/services/audioManager.js

export class GerenciadorDeAudio {
  constructor() {
    this.audioContext = null;
    this.stream = null;
    this.source = null;
    this.workletNode = null;
    
    // Fila de reprodução para juntar os pedaços de voz perfeitamente
    this.nextPlayTime = 0; 
  }

  async inicializar(onPcmData) {
    // 1. Inicia o motor de áudio na frequência exata exigida pelo Google (16kHz)
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

    // 2. Criamos o Processador de Áudio na memória (Evita erros de arquivo no Vite)
    // Ele converte as ondas Float32 nativas do navegador para Int16 PCM (formato do Gemini)
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
            // Envia o bloco de áudio para a thread principal
            this.port.postMessage(pcm16.buffer);
          }
          return true; // Mantém o processador vivo
        }
      }
      registerProcessor('pcm-processor', PcmProcessor);
    `;
    
    const blob = new Blob([codigoDoProcessador], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    
    await this.audioContext.audioWorklet.addModule(workletUrl);
    
    // 3. Captura o microfone com cancelamento de ruído ativado
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        channelCount: 1, 
        echoCancellation: true, 
        autoGainControl: true, 
        noiseSuppression: true 
      } 
    });
    
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
    
    // 4. Recebe os pacotes do microfone e envia para o WebSocket
    this.workletNode.port.onmessage = (event) => {
      const pcmBuffer = event.data;
      const base64Audio = this.arrayBufferToBase64(pcmBuffer);
      onPcmData(base64Audio);
    };

    // Conecta o circuito (Sem conectar na saída de som para o senhor não ouvir a própria voz)
    this.source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination); 
  }

  // Conversor ultrarrápido de Buffer para Base64
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // =========================================================================
  // GERAÇÃO DE VOZ (Toca os pacotes que chegam do Gemini em Tempo Real)
  // =========================================================================
  tocarAudio(base64Audio) {
    if (!this.audioContext) return;
    
    const stringBinaria = window.atob(base64Audio);
    const len = stringBinaria.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = stringBinaria.charCodeAt(i);
    }
    
    // O Gemini responde em PCM16, precisamos converter de volta para Float32 pro Alto-falante
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    // O Gemini fala na frequência de 24kHz (qualidade de estúdio)
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const reprodutor = this.audioContext.createBufferSource();
    reprodutor.buffer = audioBuffer;
    reprodutor.connect(this.audioContext.destination);
    
    // FILA DE REPRODUÇÃO: Toca o áudio colado no anterior, sem engasgos
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
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.nextPlayTime = 0;
  }
}