/*
 * Service worker для push-уведомлений.
 *
 * Намеренно минимальный: кэширования нет. Приложение полностью зависит от
 * свежих данных Supabase, и офлайн-кэш показывал бы вчерашние цифры — хуже,
 * чем честное отсутствие сети.
 */

self.addEventListener('install', () => {
  // Новый воркер начинает работать сразу, не дожидаясь закрытия вкладок.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Твой рост';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'rodion',
    // Уведомление одного типа заменяет предыдущее: три висящих напоминания
    // про квоту раздражают и обесценивают каждое следующее.
    renotify: true,
    data: { url: payload.url || '/' },
    actions: payload.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Если приложение уже открыто — не плодим вкладки, а поднимаем его.
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
