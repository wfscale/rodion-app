import type { ReactNode } from 'react';
import { AppProvider } from '@/components/AppProvider';
import { BottomNav, Sidebar } from '@/components/BottomNav';
import { SessionProvider } from '@/components/session/SessionProvider';

/**
 * Оболочка авторизованной части приложения.
 * Группа (app) не влияет на URL — страницы остаются на /, /outreach и т.д.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <SessionProvider>
      <Sidebar />

      {/*
        Сайдбар на десктопе фиксирован — контент отодвигается на его ширину.

        Ширина колонки задана двумя разными правилами намеренно. На телефоне
        это приложение: одна колонка max-w-lg, как в любом нативном экране.
        На большом мониторе это уже сайт, и жёсткий max-w-5xl оставлял по
        краям пустые полосы шире самого контента — экран не заполнен, а всё
        уезжает вниз бесконечной лентой. Поэтому от md ограничение снимается,
        а потолок появляется только на очень широких экранах: строка длиннее
        ~1700px читается хуже, сколько бы места ни было.
      */}
      <main className="md:pl-[240px]">
        <div className="pb-content mx-auto w-full max-w-lg px-4 pt-[calc(16px+env(safe-area-inset-top))] md:max-w-none md:px-8 md:pb-6 md:pt-10 xl:px-10 2xl:max-w-[1720px]">
          {children}
        </div>
      </main>

      <BottomNav />
      </SessionProvider>
    </AppProvider>
  );
}
