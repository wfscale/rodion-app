'use client';

import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

type SoberModeProps = {
  open: boolean;
  /** Дней до дедлайна. 0 и меньше — срок прошёл. */
  daysLeft: number;
  onClose: () => void;
  /** Кнопка последнего экрана: закрыть оверлей и уйти на рассылки. */
  onOpenOutreach: () => void;
};

/** Сколько нужно утянуть по горизонтали, чтобы экран перелистнулся. */
const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 450;

/**
 * Трезвый режим — три экрана, которые человек открывает в момент тяги.
 *
 * Тексты берутся из словаря целиком и не режутся на куски: они написаны
 * лично под Родиона, любая правка формулировки ломает их действие.
 * Никаких иконок и картинок внутри — только слова: картинка отвлекает
 * от чтения, а читать нужно медленно.
 */
export function SoberMode({ open, daysLeft, onClose, onOpenOutreach }: SoberModeProps) {
  const { t, tf } = useLanguage();

  const [index, setIndex] = useState(0);
  // 1 — листаем вперёд, -1 — назад. От знака зависит, с какой стороны
  // выезжает следующий экран, иначе движение спорит с жестом.
  const [direction, setDirection] = useState(1);

  // Каждый вход — снова с первого экрана: оверлей открывают в момент тяги,
  // а не продолжают с того места, где закрыли в прошлый раз.
  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setDirection(1);
  }, [open]);

  // Пока оверлей открыт, страница под ним не скроллится.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Срок прошёл — счётчик дней врёт, поэтому вместо него прямая строка.
  const deadlinePassed = daysLeft <= 0;

  const screens = [
    { title: t.sober.s1Title, body: t.sober.s1 },
    { title: t.sober.s2Title, body: t.sober.s2 },
    {
      title: deadlinePassed ? t.sober.deadlinePassed : tf(t.sober.s3Title, { n: daysLeft }),
      body: t.sober.s3,
    },
  ];

  const last = screens.length - 1;

  function go(step: number) {
    const next = index + step;
    if (next < 0 || next > last) return;
    setDirection(step > 0 ? 1 : -1);
    setIndex(next);
  }

  // Свайп вправо листает вперёд (так задано в спецификации), влево — назад.
  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) go(1);
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) go(-1);
  }

  const screen = screens[index];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[95] flex flex-col bg-[#0A0A0A] text-white"
        >
          {/* Закрытие — единственный элемент управления сверху */}
          <div className="safe-top flex shrink-0 justify-end px-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={22} />
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                drag="x"
                dragDirectionLock
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={handleDragEnd}
                className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain px-6 pb-8 pt-2"
              >
                {/* Ширина строки ограничена: длинные абзацы иначе не читаются */}
                <div className="mx-auto w-full max-w-[520px]">
                  <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                    {screen.title}
                  </h2>

                  <div className="mt-6 space-y-5">
                    {/*
                      Абзацы разделены пустой строкой, а внутри абзаца перенос
                      строки тоже смысловой («Не десять. Одна.») — поэтому
                      whitespace-pre-line, а не простой join.
                    */}
                    {screen.body.split('\n\n').map((paragraph, i) => (
                      <p
                        key={i}
                        className="whitespace-pre-line text-lg font-medium leading-[1.65] text-white/90"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {index === last && (
                    <>
                      {/* Второй блок третьего экрана — мельче и отбит сверху */}
                      <div className="mt-10 space-y-4 border-t border-white/10 pt-6">
                        {t.sober.s3Extra.split('\n\n').map((paragraph, i) => (
                          <p
                            key={i}
                            className="whitespace-pre-line text-[15px] leading-[1.7] text-white/60"
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={onOpenOutreach}
                        className="mt-9 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-white px-5 text-base font-extrabold tracking-wide text-ink"
                      >
                        {t.sober.cta}
                      </button>
                    </>
                  )}

                  {index < last && (
                    <button
                      type="button"
                      onClick={() => go(1)}
                      className="mt-9 flex min-h-[56px] w-full items-center justify-center rounded-2xl border border-white/20 px-5 text-base font-bold text-white"
                    >
                      {t.sober.next}
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Индикатор из трёх точек */}
          <div className="safe-bottom flex shrink-0 items-center justify-center gap-2 pb-4 pt-3">
            {screens.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setDirection(i > index ? 1 : -1);
                  setIndex(i);
                }}
                aria-label={`${i + 1}`}
                aria-current={i === index}
                className="flex h-11 w-8 items-center justify-center"
              >
                <span
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/25'
                  }`}
                />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
