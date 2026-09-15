// api/cron.js
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: Aqui usamos a chave SERVICE ROLE para o servidor poder ler tudo passando por cima do RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

webpush.setVapidDetails(
  'mailto:seu-email@exemplo.com',
  process.env.VITE_VAPID_PUBLIC_KEY, 
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  // Medida de Segurança da Vercel para impedir acessos externos
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Acesso Negado' });
  }

  const horaAtual = new Date();
  // Ajuste para o fuso horário de Fortaleza (UTC-3)
  horaAtual.setHours(horaAtual.getHours() - 3); 
  
  const horaFormatada = horaAtual.getHours();
  const dataHoje = horaAtual.toISOString().split('T')[0];

  try {
    // 1. Puxa todos os aparelhos registrados
    const { data: inscricoes } = await supabase.from('push_subscriptions').select('*');
    if (!inscricoes || inscricoes.length === 0) return res.status(200).json({ status: 'Nenhum aparelho.' });

    // 2. Dispara o Resumo Matinal (07h)
    if (horaFormatada === 7) {
      for (const sub of inscricoes) {
        const { count: tarefasCount } = await supabase.from('inbox_tasks').select('*', { count: 'exact' }).eq('user_id', sub.user_id).eq('date', dataHoje).eq('completed', false);
        const payload = JSON.stringify({ titulo: 'Bom dia, senhor', corpo: `O senhor tem ${tarefasCount || 0} tarefas pendentes para hoje.` });
        
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth_key, p256dh: sub.p256dh_key } }, payload).catch(() => {});
      }
    }

    // 3. Dispara o Resumo Noturno (18h)
    if (horaFormatada === 18) {
      for (const sub of inscricoes) {
        const payload = JSON.stringify({ titulo: 'Fechamento do Dia', corpo: 'O expediente principal encerrou. Não se esqueça de checar seu fluxo de caixa de hoje.' });
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth_key, p256dh: sub.p256dh_key } }, payload).catch(() => {});
      }
    }

    // 4. Verificação de Eventos em 30 minutos
    const limite30Min = new Date(horaAtual.getTime() + 30 * 60000);
    const horaLimiteString = limite30Min.toISOString().substring(11, 16); // Formato HH:MM
    const horaAtualString = horaAtual.toISOString().substring(11, 16);

    // Busca eventos marcados para os próximos 30 minutos exatos
    const { data: eventosProximos } = await supabase
      .from('agenda_items')
      .select('*')
      .eq('date', dataHoje)
      .gte('time', horaAtualString)
      .lte('time', horaLimiteString)
      .eq('is_completed', false);

    if (eventosProximos && eventosProximos.length > 0) {
      for (const evento of eventosProximos) {
        // Acha o celular do dono do evento
        const aparelhosDoUsuario = inscricoes.filter(i => i.user_id === evento.user_id);
        const payload = JSON.stringify({ 
          titulo: 'Compromisso Iminente', 
          corpo: `${evento.title} começará às ${evento.time.substring(0,5)}.` 
        });

        for (const sub of aparelhosDoUsuario) {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth_key, p256dh: sub.p256dh_key } }, payload).catch(() => {});
        }
      }
    }

    return res.status(200).json({ status: 'Ronda de Notificações concluída.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}