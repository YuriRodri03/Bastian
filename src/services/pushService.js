// src/services/pushService.js
import { supabase } from '../lib/supabase';

// Substitua pela Public Key que o comando do terminal gerou
const PUBLIC_VAPID_KEY = "BFI_Qf2yMbQBijHgLJKP-89Ik9JwfmQWAQKIhB9WZKYwYzjjkXq6FOyXdZL4rYWigCeNSB3f0nd8j4dOJYOMgrI"; 

// Função auxiliar obrigatória para converter a chave
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registrarPushNoCelular() {
  try {
    // 1. Verifica se o navegador suporta
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications não são suportadas neste navegador.');
      return;
    }

    // 2. Pede permissão ao usuário
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
      console.log('Permissão de notificação negada.');
      return;
    }

    // 3. Aguarda o Service Worker (seu sw.js) estar pronto
    const registration = await navigator.serviceWorker.ready;

    // 4. Inscreve o aparelho para receber notificações
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });

    // 5. Pega o usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 6. Salva o "Endereço" (subscription) no banco de dados
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ 
        user_id: user.id, 
        subscription: subscription.toJSON() 
      }, { onConflict: 'user_id, subscription' });

    if (error) throw error;
    console.log('[Bastian] Aparelho registrado para receber notificações em background!');

  } catch (erro) {
    console.error('Erro ao registrar push notification:', erro);
  }
}