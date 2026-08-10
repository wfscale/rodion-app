'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getDict, pluralDays, interpolate, type Dict } from '@/lib/i18n';
import type { Language } from '@/lib/types';

const STORAGE_KEY = 'rodion.lang';

type LanguageContextValue = {
  lang: Language;
  t: Dict;
  /** Меняет язык локально (localStorage). Запись в профиль — на стороне настроек. */
  setLang: (lang: Language) => void;
  /** Подставляет переменные: tf(t.progress.streakHint, { n: 70 }) */
  tf: (template: string, vars: Record<string, string | number>) => string;
  /** «3 дня» / «3 days» */
  days: (n: number) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Стартуем всегда с 'ru', чтобы серверный и первый клиентский рендер совпали.
  // Реальный язык подхватывается в useEffect — гидратация не ломается.
  const [lang, setLangState] = useState<Language>('ru');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'ru' || stored === 'en') setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // приватный режим — язык просто не переживёт перезагрузку
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const t = getDict(lang);
    return {
      lang,
      t,
      setLang,
      tf: interpolate,
      days: (n: number) => pluralDays(n, lang, t),
    };
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
