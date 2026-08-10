'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  /** Индекс для staggered появления карточек при загрузке страницы. */
  delay?: number;
  /** Мягкое зелёное свечение — блок дисциплины, когда всё выполнено. */
  glow?: boolean;
  onClick?: () => void;
} & Omit<HTMLMotionProps<'div'>, 'children' | 'onClick' | 'ref'>;

/**
 * Стеклянная поверхность. Базовый строительный блок всего интерфейса:
 * полупрозрачный фон + blur + светлая рамка. Непрозрачных карточек в
 * приложении нет вообще.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { children, className = '', delay = 0, glow = false, onClick, ...rest },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.06, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={[
        'glass p-4 transition-shadow duration-500',
        glow ? 'shadow-glow-green border-[rgba(100,255,100,0.22)]' : '',
        onClick ? 'cursor-pointer active:scale-[0.99]' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </motion.div>
  );
});

/** Заголовок секции внутри карточки. */
export function CardTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold tracking-wide text-white">{children}</h2>
      {right}
    </div>
  );
}
