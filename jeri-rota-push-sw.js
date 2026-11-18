/* Service Worker isolado: apenas notificações, sem cache/offline de dados privados. */
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  const title = payload.title === 'Jeri Rota — teste' ? payload.title : 'Jeri Rota — nova mensagem';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 160) : 'Abra a Central para consultar o atendimento.';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: typeof payload.tag === 'string' ? payload.tag : 'jeri-rota-message',
    icon: '/jeri-rota-mark.svg',
    badge: '/jeri-rota-mark.svg',
    data: { url: '/atendimento.html' },
    renotify: true,
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL('/atendimento.html', self.location.origin).href;
  event.waitUntil((async () => {
    const clientsFound = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clientsFound.find(c => c.url.startsWith(self.location.origin) && c.url.includes('/atendimento.html'));
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});
