// supabase/functions/gemini-live-token/index.ts
//
// Gera um token efêmero (uso único, curta duração) para o navegador falar com a Gemini Live
// sem precisar conhecer a chave de API real.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=SUA_CHAVE_NOVA
//   supabase functions deploy gemini-live-token
//
// O Supabase injeta SUPABASE_URL e SUPABASE_ANON_KEY automaticamente.

import { GoogleGenAI } from 'npm:@google/genai';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // em produção, troque pelo domínio do seu app
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // A chave "anon" também é um JWT válido e é pública. Por isso a verificação padrão do Supabase
    // não basta: aqui exigimos um usuário realmente logado.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Não autenticado' }, 401);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

    const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const agora = Date.now();

    const token = await client.authTokens.create({
      config: {
        uses: 1, // um token = uma sessão
        expireTime: new Date(agora + 30 * 60 * 1000).toISOString(), // tempo para trocar mensagens
        newSessionExpireTime: new Date(agora + 60 * 1000).toISOString(), // 1 min para abrir a sessão
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return json({ token: token.name });
  } catch (erro) {
    console.error('[gemini-live-token]', erro);
    return json({ error: 'Falha ao gerar token' }, 500);
  }
});