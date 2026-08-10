'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Откладывает вызов до паузы во вводе. Используется для автосохранения
 * заметок дня и полей, которые пишутся посимвольно.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void | Promise<void>,
  delay = 500,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (...args: Args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void latest.current(...args);
      }, delay);
    },
    [delay],
  );
}
