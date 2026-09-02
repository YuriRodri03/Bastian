// supabase/functions/bastian-cron/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

// 1. Configuração do Web Push
webpush.setVapidDetails(
  'mailto:seu-email@dominio.com', // IMPORTANTE: Coloque o seu e-mail real aqui
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const hoje = new Date().toISOString().split('T')[0];

    // 2. Busca Finanças Pendentes (Contas a pagar ou receber até hoje)
    const { data: financas } = await supabase
      .from('transactions')
      .select('*')
      .lte('date', hoje)
      .eq('status', 'pendente');

    // 3. Busca Agenda do Dia (Compromissos não concluídos de hoje)
    const { data: agenda } = await supabase
      .from('agenda_items')
      .select('*')
      .eq('date', hoje)
      .eq('is_completed', false);

    const totalFinancas = financas?.length || 0;
    const totalAgenda = agenda?.length || 0;

    // Se o dia estiver livre, encerra silenciosamente
    if (totalFinancas === 0 && totalAgenda === 0) {
      return new Response(JSON.stringify({ message: 'Tudo limpo para hoje.' }), { status: 200 });
    }

    // 4. Busca os celulares/PCs cadastrados para receber notificação
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum dispositivo.' }), { status: 200 });
    }

    // 5. Monta o Briefing para a tela do celular
    let bodyMsg = '';
    if (totalAgenda > 0) bodyMsg += `Tem ${totalAgenda} compromisso(s) na agenda. `;
    if (totalFinancas > 0) bodyMsg += `Atenção: ${totalFinancas} movimentação(ões) pendente(s).`;

    const notificationPayload = JSON.stringify({
      title: 'Bastian Executivo',
      body: bodyMsg.trim(),
      url: '/' // Abre a home do PWA ao clicar
    });

    // 6. Dispara o choque para o Service Worker do celular
    const promessas = subscriptions.map(async (sub) => {
      // Pega o objeto JSON inteiro que o frontend salvou
      const pushSubscription = sub.subscription; 
      
      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
      } catch (err: any) {
        // Erro 410 ou 404 significa que o aplicativo foi desinstalado do celular
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error("Erro no WebPush:", err);
        }
      }
    });

    await Promise.all(promessas);

    return new Response(JSON.stringify({ message: 'Notificações disparadas com sucesso.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});