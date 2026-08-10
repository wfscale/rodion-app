import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { LanguageProvider } from '@/components/LanguageProvider';
import './globals.css';

// Единственный шрифт во всём приложении.
const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Твой рост',
  description: 'Дисциплина, тело и рассылки — один трекер на каждый день.',
  applicationName: 'Твой рост',
  // Запуск с домашнего экрана без интерфейса браузера.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Твой рост',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // iOS берёт именно apple-touch-icon; без него на ярлык попадёт скриншот.
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  // Без этого env(safe-area-inset-*) на iPhone всегда равен нулю.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="bg-ink text-white antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
