self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();
  
  // Aceita tanto em português (do cron) quanto em inglês (padrão)
  const title = data.titulo || data.title || 'Bastian';
  
  const options = {
    body: data.corpo || data.body || 'Você tem uma nova notificação executiva.',
    icon: '/icon-192x192.png', // O orbe perfeitamente redondo
    badge: '/icon-192x192.png', // Ícone da barra de status
    vibrate: [200, 100, 200], // Vibração padrão de alerta
    data: { url: data.url || '/' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});