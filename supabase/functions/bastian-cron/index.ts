// supabase/functions/bastian-cron/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

// 1. Configuração do Web Push usando as chaves secretas que salvamos
webpush.setVapidDetails(
  'mailto:seu-email@dominio.com', // Coloque seu e-mail aqui
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
);

serve(async (req) => {
  // Impede requisições de métodos não autorizados (opcional, mas recomendado)
  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 });
  }

  // 2. Inicia o Supabase com poderes de administrador (Service Role Key)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 3. Pega a data de hoje (Formato YYYY-MM-DD)
    const hoje = new Date().toISOString().split('T')[0];

    // 4. Consulta exemplo: Contas vencendo hoje
    const { data: contas } = await supabase
      .from('transactions')
      .select('*')
      .eq('tipo', 'despesa') // Ajuste de acordo com a coluna do seu banco
      .eq('data', hoje);     // Ajuste de acordo com a coluna do seu banco

    const totalContas = contas?.length || 0;

    // Se não houver nada, encerra a função silenciosamente
    if (totalContas === 0) {
      return new Response(JSON.stringify({ message: 'Tudo limpo para hoje.' }), { status: 200 });
    }

    // 5. Busca as inscrições ativas dos seus dispositivos
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum dispositivo cadastrado.' }), { status: 200 });
    }

    // A mensagem que vai aparecer no seu celular/PC
    const notificationPayload = JSON.stringify({
      title: 'Bastian AI',
      body: `Senhor, temos ${totalContas} despesa(s) agendada(s) para hoje.`,
      url: '/financeiro'
    });

    // 6. Dispara para todos os seus dispositivos cadastrados
    const promessas = subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: { auth: sub.auth_key, p256dh: sub.p256dh_key }
      };

      try {
        await webpush.sendNotification(pushConfig, notificationPayload);
      } catch (err) {
        // Erro 410 significa que a permissão foi revogada no dispositivo
        if (err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    });

    await Promise.all(promessas);

    return new Response(JSON.stringify({ message: 'Notificações disparadas com sucesso.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});