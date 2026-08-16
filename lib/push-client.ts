'use client';

/**
 * Подписка на push со стороны браузера.
 *
 * На iPhone это работает только у приложения, добавленного на экран «Домой»:
 * в обычной вкладке Safari Web Push недоступен. Поэтому статус
 * 'needs-install' — не ошибка, а инструкция.
 */

export type PushStatus =
  | 'unsupported'
  | 'needs-install'
  | 'denied'
  | 'granted'
  | 'default';

/** Запущено ли приложение как установленное (с домашнего экрана). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari на iOS не поддерживает display-mode, у него своё свойство.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushStatus(): PushStatus {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    // iOS до 16.4 и обычная вкладка Safari: API просто нет.
    return isStandalone() ? 'unsupported' : 'needs-install';
  }
  if (!('Notification' in window)) return 'unsupported';

  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return 'default';
}

/** base64url → Uint8Array: applicationServerKey принимает только байты. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function subscribeToPush(vapidPublicKey: string): Promise<
  { ok: true } | { ok: false; reason: PushStatus | 'failed' }
> {
  const status = pushStatus();
  if (status === 'unsupported' || status === 'needs-install' || status === 'denied') {
    return { ok: false, reason: status };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // Существующая подписка переиспользуется: повторный subscribe с тем же
  // ключом вернёт её же, но лишний запрос к push-сервису не нужен.
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));

  const json = subscription.toJSON();
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  });

  return response.ok ? { ok: true } : { ok: false, reason: 'failed' };
}

/**
 * Локальное уведомление прямо из вкладки.
 *
 * Нужно напоминаниям: их время наступает, пока приложение открыто, и гонять
 * ради этого сервер с web-push бессмысленно. Если разрешения нет — молча
 * ничего не делаем: тост в интерфейсе всё равно покажется.
 */
export async function showLocalNotification(title: string, body: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    // Через service worker — на Android и в установленном PWA обычный
    // конструктор Notification не работает.
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'rodion-reminder',
          data: { url: '/notes' },
        });
        return;
      }
    }
    new Notification(title, { body, icon: '/icon-192.png' });
  } catch {
    // Уведомление — приятное дополнение, ронять из-за него ничего нельзя.
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}
