// Notificações push. Carregado pelo service worker da app (ver workbox.importScripts no vite.config.ts).
// A mensagem vem cifrada do servidor (functions/api/notificar.ts): { titulo, corpo, url, etiqueta }.

self.addEventListener('push', (evento) => {
  let m = {};
  try {
    m = evento.data ? evento.data.json() : {};
  } catch {
    m = { titulo: 'Bola do Bairro', corpo: evento.data ? evento.data.text() : '' };
  }
  evento.waitUntil(
    self.registration.showNotification(m.titulo || 'Bola do Bairro', {
      body: m.corpo || '',
      icon: '/pwa-192.png',
      badge: '/badge-96.png',
      lang: 'pt',
      // Avisos do mesmo jogo substituem-se em vez de se acumularem, mas voltam a tocar
      tag: m.etiqueta || undefined,
      renotify: Boolean(m.etiqueta),
      data: { url: m.url || '/' },
    }),
  );
});

// Tocar na notificação abre a página do jogo (ou foca a app, se já estiver aberta)
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL((evento.notification.data && evento.notification.data.url) || '/', self.location.origin).href;
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const janela of janelas) {
      if (new URL(janela.url).origin === self.location.origin && 'focus' in janela) {
        await janela.focus();
        if ('navigate' in janela) await janela.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
