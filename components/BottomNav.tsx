'use client';

import { motion } from 'framer-motion';
import { BarChart2, FileText, Home, Rocket, Send, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppOptional } from '@/components/AppProvider';
import { useLanguage } from '@/components/LanguageProvider';

const ITEMS = [
  { href: '/', icon: Home, key: 'home' },
  { href: '/outreach', icon: Send, key: 'outreach' },
  { href: '/progress', icon: BarChart2, key: 'progress' },
  { href: '/notes', icon: FileText, key: 'notes' },
  { href: '/settings', icon: Settings, key: 'settings' },
] as const;

/* «Проект» живёт только в сайдбаре: шестая иконка внизу на 375px
   съедает подписи, а раздел всё равно открывается лишь на 5-м уровне. */
const DESKTOP_ONLY = [{ href: '/project', icon: Rocket, key: 'project' }] as const;

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** Мобильная навигация — фиксирована снизу, стеклянная, с учётом выреза iPhone. */
export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  // Сработавшее напоминание должно быть видно с любого экрана, иначе оно
  // сработает в пустоту: человек в этот момент смотрит на рассылки.
  const due = useAppOptional()?.remindersDue ?? 0;

  return (
    <nav className="glass-flat fixed inset-x-0 bottom-0 z-50 rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex h-nav max-w-lg items-stretch justify-around">
        {ITEMS.map(({ href, icon: Icon, key }) => {
          const active = isActive(pathname, href);
          const badge = key === 'notes' ? due : 0;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="relative flex h-full min-w-[44px] flex-col items-center justify-center gap-1"
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-white"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative">
                  <Icon
                    size={21}
                    strokeWidth={active ? 2.4 : 1.8}
                    className={active ? 'text-white' : 'text-white/40'}
                  />
                  {badge > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warn px-1 text-[10px] font-extrabold text-ink">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10px] font-semibold leading-none ${
                    active ? 'text-white' : 'text-white/40'
                  }`}
                >
                  {t.nav[key]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Десктопный сайдбар — 240px слева. */
export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[240px] border-r border-divider bg-white/[0.02] p-4 backdrop-blur-glass md:block">
      <div className="mb-8 px-3 pt-4">
        <p className="text-lg font-extrabold tracking-tight">{t.auth.title}</p>
        <p className="mt-1 text-xs text-muted">{t.auth.subtitle}</p>
      </div>

      <ul className="space-y-1">
        {[...ITEMS, ...DESKTOP_ONLY].map(({ href, icon: Icon, key }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-2xl px-3 text-base transition-colors ${
                  active
                    ? 'bg-white/10 font-bold text-white'
                    : 'text-white/45 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
                {t.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
