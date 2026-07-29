import { supabase } from '../lib/supabase'; // Ajuste o caminho conforme o seu projeto

// 1. O navegador exige que a chave VAPID pública seja convertida para um formato específico (Uint8Array)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 2. Função principal para ativar notificações
export async function ativarNotificacoes(user) {
  if (!user) {
    console.error('Usuário não autenticado.');
    return;
  }

  try {
    // Solicita permissão ao usuário
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Permissão de notificação negada pelo usuário.');
      return;
    }

    // Pega o Service Worker que registramos no App.jsx
    const registration = await navigator.serviceWorker.ready;

    // A Chave Pública VAPID vai aqui:
    const publicVapidKey = 'BKMMuasrjHLy29Qb_ZOOzyVtdrFzZXO2q9AGgIlVDfNhiKE4V7_KIITECERT2Pxp1kphlCfQ8btv2y3uPpH7RkQ'; 
    const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

    // Cria a subscrição no navegador
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    // Converte a subscrição para JSON para extrair as chaves de segurança
    const subJson = subscription.toJSON();

    // 3. Salva a subscrição no Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        auth_key: subJson.keys.auth,
        p256dh_key: subJson.keys.p256dh
      }, { onConflict: 'endpoint' }); // Evita duplicar o mesmo dispositivo

    if (error) {
      console.error('Erro ao salvar subscrição no banco:', error);
    } else {
      console.log('Notificações ativadas e salvas com sucesso, senhor!');
    }

  } catch (error) {
    console.error('Erro ao configurar notificações Web Push:', error);
  }
}