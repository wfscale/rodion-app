import type { MetadataRoute } from 'next';

/**
 * Веб-манифест — то, что делает сайт «приложением» на телефоне.
 *
 * Ключевое поле здесь — scope. Без него iOS считает приложением только тот
 * адрес, с которого ярлык был создан, и любой переход на /outreach или
 * /progress выбрасывает обратно в браузер с адресной строкой и панелью
 * кнопок. scope: '/' говорит системе, что весь сайт — это одно приложение.
 *
 * Next отдаёт этот файл по адресу /manifest.webmanifest и сам подставляет
 * <link rel="manifest"> в разметку.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Твой рост',
    short_name: 'Твой рост',
    description: 'Дисциплина, тело и рассылки — один трекер на каждый день.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0A0A0A',
    theme_color: '#0A0A0A',
    lang: 'ru',
    categories: ['productivity', 'lifestyle'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Android обрезает иконку под свою форму — этой версии оставлены поля.
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
