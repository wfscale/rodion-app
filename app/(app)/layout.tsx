import type { ReactNode } from 'react';
import { AppProvider } from '@/components/AppProvider';
import { BottomNav, Sidebar } from '@/components/BottomNav';

/**
 * Оболочка авторизованной части приложения.
 * Группа (app) не влияет на URL — страницы остаются на /, /outreach и т.д.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Sidebar />

      {/* Сайдбар на десктопе фиксирован — контент отодвигается на его ширину. */}
      <main className="md:pl-[240px]">
        <div className="pb-content mx-auto w-full max-w-lg px-4 pt-[calc(16px+env(safe-area-inset-top))] md:max-w-4xl md:px-8 md:pb-16 md:pt-10">
          {children}
        </div>
      </main>

      <BottomNav />
    </AppProvider>
  );
}
