'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Pause, Play, Shield } from 'lucide-react';
import { useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Switch } from '@/components/ui';
import { formatTimeLeft } from '@/lib/date';
import { SHIELD_MAX, type BurnLevel, type GuardView } from '@/lib/shield';

type ShieldCardProps = {
  guard: GuardView;
  sent: number;
  quota: number;
  /** Серия закрытых дней — то, что защищается. */
  streak: number;
  onArm: () => void;
  onDisarm: () => void;
  onPause: (on: boolean) => void;
  onAuto: (value: boolean) => void;
  delay?: number;
};

const BURN_TEXT: Record<BurnLevel, string> = {
  safe: 'text-white/60',
  warn: 'text-warn',
  danger: 'text-danger',
};

/** Заряды щита — три ячейки, потраченные гаснут. */
function Charges({ charges, label }: { charges: number; label: string }) {
  return (
    <span
      role="img"
      aria-label={`${label}: ${charges} / ${SHIELD_MAX}`}
      className="flex shrink-0 items-center gap-1"
    >
      {Array.from({ length: SHIELD_MAX }, (_, i) => (
        <motion.span
          key={i}
          // initial={false}: заряды это состояние, а не событие. Анимация при
          // каждой отрисовке обесценила бы ту единственную, что важна, —
          // когда заряд действительно потратился.
          initial={false}
          animate={{ scale: i < charges ? 1 : 0.82, opacity: i < charges ? 1 : 0.25 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={i < charges ? 'text-white' : 'text-white/30'}
        >
          <Shield size={15} strokeWidth={2.2} fill={i < charges ? 'currentColor' : 'none'} />
        </motion.span>
      ))}
    </span>
  );
}

/**
 * Полная карточка страховки — на странице рассылок, сразу под квотой дня.
 *
 * Здесь и только здесь собраны все три рычага: взвести щит, уйти на привал,
 * переключить автосейв. На главной остаётся один аварийный выход под вечер —
 * рычаги, разложенные по всем экранам, читались бы как приглашение ими
 * пользоваться.
 */
export function ShieldCard({
  guard,
  sent,
  quota,
  streak,
  onArm,
  onDisarm,
  onPause,
  onAuto,
  delay = 0,
}: ShieldCardProps) {
  const { t, tf, days, lang } = useLanguage();
  const [confirmPause, setConfirmPause] = useState(false);

  // Пока миграция не прогнана, колонок щита в профиле нет. Это не поломка
  // приложения, а невыполненный шаг установки — так и говорим.
  if (!guard.ready) {
    return (
      <GlassCard delay={delay}>
        <CardTitle>{t.guard.title}</CardTitle>
        <p className="text-sm leading-relaxed text-muted">{t.guard.notReady}</p>
      </GlassCard>
    );
  }

  const left = Math.max(0, quota - sent);
  const closed = left === 0;
  const paused = guard.today === 'pause';
  const armed = guard.today === 'shield';

  return (
    <GlassCard delay={delay}>
      <CardTitle right={<Charges charges={guard.charges} label={t.guard.charges} />}>
        {t.guard.title}
      </CardTitle>

      {/* Состояние дня. Ровно один блок — три сразу превратили бы карточку
          в справку по механике. */}
      {paused ? (
        <div className="rounded-2xl border border-glass-border bg-white/[0.05] p-3.5">
          <div className="flex items-center gap-2.5">
            <Pause size={17} className="shrink-0 text-white/50" />
            <p className="text-base font-bold">{tf(t.guard.paused, { n: guard.pauseDay })}</p>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {tf(t.guard.pausedHint, { n: streak })}
          </p>
        </div>
      ) : armed ? (
        <div className="rounded-2xl border border-[rgba(100,255,140,0.28)] bg-[rgba(100,255,140,0.07)] p-3.5">
          <div className="flex items-center gap-2.5">
            <Shield size={17} className="shrink-0 text-success" fill="currentColor" />
            <p className="text-base font-bold text-success">{t.guard.armed}</p>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.guard.armedHint}</p>
        </div>
      ) : closed ? (
        <p className="text-base font-bold text-success">{t.guard.burnDone}</p>
      ) : (
        <div className="flex items-baseline justify-between gap-3">
          <p className={`min-w-0 text-base font-bold ${BURN_TEXT[guard.burn]}`}>
            <Clock size={15} className="mr-1.5 inline-block align-[-2px]" />
            {tf(t.guard.burn, { t: formatTimeLeft(guard.minutesLeft, lang) })}
          </p>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-white/45">
            {tf(t.guard.burnLeft, { n: left })}
          </span>
        </div>
      )}

      {/* Рычаги */}
      <div className="mt-4 space-y-2">
        {paused ? (
          <Button full onClick={() => onPause(false)}>
            <Play size={16} />
            {t.guard.pauseOff}
          </Button>
        ) : (
          <>
            {/* Закрытый день щитом не спасают: спасать уже нечего. */}
            {armed ? (
              <Button variant="ghost" full onClick={onDisarm}>
                {t.guard.disarm}
              </Button>
            ) : (
              !closed && (
                <Button variant="ghost" full onClick={onArm} disabled={!guard.canArm}>
                  <Shield size={16} />
                  {guard.charges > 0 ? t.guard.arm : t.guard.empty}
                </Button>
              )
            )}

            <AnimatePresence initial={false} mode="wait">
              {confirmPause ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex gap-2"
                >
                  {/* Подпись короткая намеренно: на 375px две кнопки в ряд
                      делят 311px, и «Уйти на привал» перенеслось бы. */}
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setConfirmPause(false);
                      onPause(true);
                    }}
                  >
                    {t.guard.pauseConfirm}
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setConfirmPause(false)}
                  >
                    {t.common.cancel}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="ask"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button variant="ghost" full onClick={() => setConfirmPause(true)}>
                    <Pause size={16} />
                    {t.guard.pauseOn}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Цена запаса: сколько работы стоит следующий заряд. */}
      <p className="mt-3 text-sm text-white/35">
        {guard.regenIn === 0
          ? t.guard.regenFull
          : tf(t.guard.regen, { n: guard.regenIn, unit: days(guard.regenIn) })}
      </p>

      <p className="mt-2 text-sm leading-relaxed text-white/30">
        {paused
          ? t.guard.keepsWorking
          : guard.charges === 0 && !armed
            ? t.guard.emptyHint
            : t.guard.idleHint}
      </p>

      <div className="mt-4 border-t border-divider pt-4">
        <Switch
          label={t.guard.auto}
          hint={guard.auto ? t.guard.autoHint : t.guard.autoOffHint}
          checked={guard.auto}
          onChange={onAuto}
        />
      </div>
    </GlassCard>
  );
}
