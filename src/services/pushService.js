// src/services/pushService.js
import { supabase } from '../lib/supabase';

// Chave PÚBLICA (pode ficar no front). A chave PRIVADA fica só no servidor que envia os pushes
// e precisa ser o par exato desta. Se você rotacionar o par, as inscrições antigas são refeitas sozinhas.
const PUBLIC_VAPID_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BFI_Qf2yMbQBijHgLJKP-89Ik9JwfmQWAQKIhB9WZKYwYzjjkXq6FOyXdZL4rYWigCeNSB3f0nd8j4dOJYOMgrI';

const SW_TIMEOUT_MS = 10000;

// Converte a chave VAPID (base64url) para os bytes que o PushManager exige
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const suportaPush = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window; // no iOS fora do app instalado, "Notification" nem existe

// serviceWorker.ready nunca resolve se nenhum SW foi registrado (comum em dev): sem isto a função travava calada
const aguardarServiceWorker = () =>
  Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('O service worker não ficou pronto. Ele está registrado neste ambiente?')), SW_TIMEOUT_MS)
    )
  ]);

const mesmaChave = (subscription, chaveBytes) => {
  const atual = subscription.options?.applicationServerKey;
  if (!atual) return true; // não dá para comparar: assume igual
  const a = new Uint8Array(atual);
  return a.length === chaveBytes.length && a.every((v, i) => v === chaveBytes[i]);
};

// Reaproveita a inscrição existente. Se ela foi criada com outra chave VAPID, subscribe() lançaria
// InvalidStateError: então cancela a antiga e cria de novo.
async function obterOuCriarInscricao(registration) {
  const chave = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription && !mesmaChave(subscription, chave)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  return subscription ?? registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
}

// Chave do upsert: (user_id, endpoint). O endpoint é único por aparelho/navegador.
// Veja push_subscriptions_migration.sql (coluna endpoint + índice único + RLS).
async function salvarInscricao(subscription, userId) {
  const json = subscription.toJSON();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint: json.endpoint, subscription: json }, { onConflict: 'user_id,endpoint' });
  if (error) throw error;
}

/**
 * Ativa as notificações neste aparelho.
 * Chame a partir de um CLIQUE (botão "Ativar notificações"): navegadores, e principalmente o Safari/iOS,
 * ignoram ou bloqueiam pedidos de permissão que não vêm de um gesto do usuário.
 * No iPhone o push só funciona com o app instalado na Tela de Início (iOS 16.4+).
 *
 * @returns {Promise<{ ok: boolean, motivo?: 'nao_suportado'|'sem_login'|'bloqueado'|'negado'|'erro', erro?: unknown }>}
 */
export async function registrarPushNoCelular() {
  try {
    if (!suportaPush()) return { ok: false, motivo: 'nao_suportado' };

    // Confere o login ANTES de pedir permissão (antes, o usuário aceitava e nada era salvo)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, motivo: 'sem_login' };

    if (Notification.permission === 'denied') return { ok: false, motivo: 'bloqueado' }; // só o usuário desfaz, nas configurações do navegador
    if (Notification.permission !== 'granted') {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') return { ok: false, motivo: 'negado' };
    }

    const registration = await aguardarServiceWorker();
    const subscription = await obterOuCriarInscricao(registration);
    await salvarInscricao(subscription, user.id);

    console.log('[Bastian] Aparelho registrado para receber notificações em background.');
    return { ok: true };
  } catch (erro) {
    console.error('Erro ao registrar push notification:', erro);
    return { ok: false, motivo: 'erro', erro };
  }
}

/**
 * Chame ao abrir o app (depois do login): renova a inscrição, que pode ter expirado ou mudado,
 * sem exibir nenhum pedido de permissão. Se o usuário nunca ativou, não faz nada.
 */
export async function sincronizarPushSeJaPermitido() {
  if (!suportaPush() || Notification.permission !== 'granted') return { ok: false, motivo: 'sem_permissao' };
  return registrarPushNoCelular();
}

/**
 * Chame ANTES de supabase.auth.signOut(). Sem isto, o aparelho continua cadastrado para o usuário
 * anterior e, em um celular compartilhado, as notificações dele apareceriam para quem entrar depois.
 */
export async function removerPushDoCelular() {
  try {
    if (!suportaPush()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    if (error) console.error('Erro ao remover inscrição do banco:', error);

    await subscription.unsubscribe();
  } catch (erro) {
    console.error('Erro ao remover push notification:', erro);
  }
}
