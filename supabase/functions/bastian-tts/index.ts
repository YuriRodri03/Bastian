import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { EdgeTTS } from "npm:node-edge-tts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 
};

// CORREÇÃO AQUI: Tipamos o req como Request
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Corpo da requisição inválido ou ausente.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { texto } = body;

    if (!texto) {
      return new Response(JSON.stringify({ error: 'Texto não fornecido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tts = new EdgeTTS({
      voice: 'pt-BR-AntonioNeural', 
      lang: 'pt-BR',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    });

    const tempFilePath = `/tmp/temp_audio_${crypto.randomUUID()}.mp3`; 
    
    await tts.ttsPromise(texto, tempFilePath);
    const audioBuffer = await Deno.readFile(tempFilePath);
    await Deno.remove(tempFilePath).catch(() => {});

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(), 
      },
    });

  } catch (error: any) {
    console.error('Erro no Edge TTS:', error);
    return new Response(JSON.stringify({ error: 'Falha ao processar o áudio.', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});