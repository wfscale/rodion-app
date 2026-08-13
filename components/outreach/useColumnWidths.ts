'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/** Ключ в localStorage — общий для всех таблиц приложения. */
const STORAGE_KEY = 'table_column_widths';

export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 400;

export type ColumnWidths<K extends string = string> = Record<K, number>;

function clampWidth(px: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(px)));
}

/**
 * Ширины колонок с ресайзом за правый край заголовка.
 *
 * `defaults` берётся один раз при монтировании: колонки описаны константой
 * модуля, а пересоздание объекта на каждом рендере иначе сбрасывало бы сброс
 * к дефолту.
 */
export function useColumnWidths<K extends string>(defaults: ColumnWidths<K>) {
  const defaultsRef = useRef(defaults);
  const [widths, setWidths] = useState<ColumnWidths<K>>(defaults);
  const [resizing, setResizing] = useState<K | null>(null);

  // Актуальные ширины для обработчиков drag: они живут вне рендера.
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  // localStorage читаем только после монтирования: на сервере его нет, и
  // разошедшийся первый рендер сломал бы гидратацию.
  useEffect(() => {
    let saved: Record<string, unknown> | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') saved = parsed as Record<string, unknown>;
    } catch {
      return; // битый JSON — просто остаёмся на дефолтах
    }
    if (!saved) return;

    const stored = saved;
    setWidths((current) => {
      const next = { ...current };
      let changed = false;
      for (const key of Object.keys(defaultsRef.current) as K[]) {
        const value = stored[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          next[key] = clampWidth(value);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);

  const persist = useCallback((next: ColumnWidths<K>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // приватный режим — ширины просто не переживут перезагрузку
    }
  }, []);

  /** Тянем за resizer: слушатели на window, палец уходит далеко за 4px зону. */
  const startResize = useCallback(
    (key: K, event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = widthsRef.current[key] ?? defaultsRef.current[key];
      setResizing(key);

      const onMove = (e: PointerEvent) => {
        const next = clampWidth(startWidth + (e.clientX - startX));
        setWidths((current) =>
          current[key] === next
            ? current
            : ({ ...current, [key]: next } as ColumnWidths<K>),
        );
      };

      const finish = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
        setResizing(null);
        persist(widthsRef.current);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);

      // Курсор и запрет выделения держим на body: указатель во время drag
      // ходит по всей странице, а не по самому resizer'у.
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [persist],
  );

  /** Двойной клик по resizer — вернуть колонке дефолтную ширину. */
  const resetColumn = useCallback(
    (key: K) => {
      setWidths((current) => {
        const next = {
          ...current,
          [key]: defaultsRef.current[key],
        } as ColumnWidths<K>;
        persist(next);
        return next;
      });
    },
    [persist],
  );

  /** Сброс всей таблицы — на случай кнопки «вернуть как было». */
  const resetAll = useCallback(() => {
    setWidths(defaultsRef.current);
    persist(defaultsRef.current);
  }, [persist]);

  return { widths, resizing, startResize, resetColumn, resetAll };
}
