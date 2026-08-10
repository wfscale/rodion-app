'use client';

import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Кнопки внизу, приклеенные к краю (например «Сохранить»). */
  footer?: ReactNode;
};

/**
 * Универсальная шторка снизу.
 * — выезжает снизу вверх, закрывается свайпом вниз (drag) или тапом по фону;
 * — высота ограничена 88dvh, содержимое скроллится внутри;
 * — на десктопе центрируется и не растягивается шире 520px.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: BottomSheetProps) {
  // Пока шторка открыта — фон под ней не скроллится.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape закрывает — привычно на десктопе.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // Закрываем, если утянули достаточно далеко ИЛИ дёрнули резко вниз.
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="glass-flat relative flex max-h-[88dvh] w-full flex-col rounded-t-sheet border-b-0 sm:max-w-[520px] sm:rounded-sheet sm:border-b"
          >
            {/* Ручка для свайпа */}
            <div className="flex shrink-0 cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing">
              <div className="h-1 w-10 rounded-full bg-white/25" />
            </div>

            {title && (
              <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-1">
                <h2 className="text-lg font-extrabold">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-divider px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
