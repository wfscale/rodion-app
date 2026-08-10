'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Sunrise } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Label, Segmented, TextArea } from '@/components/ui';
import { toTimeInput } from '@/lib/date';
import type { DailyLog, WakeQuality } from '@/lib/types';

type MorningCheckinProps = {
  log: DailyLog;
  done: boolean;
  onSave: (input: {
    sleep_time: string | null;
    wake_time: string | null;
    wake_quality: WakeQuality | null;
    morning_comment: string | null;
  }) => Promise<void>;
  delay?: number;
};

/**
 * Утренний чекин. После заполнения схлопывается в одну строку со сводкой —
 * чтобы не занимать пол-экрана весь оставшийся день.
 */
export function MorningCheckin({ log, done, onSave, delay = 0 }: MorningCheckinProps) {
  const { t } = useLanguage();

  const [expanded, setExpanded] = useState(!done);
  const [sleep, setSleep] = useState(toTimeInput(log.sleep_time));
  const [wake, setWake] = useState(toTimeInput(log.wake_time));
  const [quality, setQuality] = useState<WakeQuality | null>(log.wake_quality);
  const [comment, setComment] = useState(log.morning_comment ?? '');
  const [busy, setBusy] = useState(false);

  // Данные могли приехать с сервера уже после первого рендера.
  useEffect(() => {
    setSleep(toTimeInput(log.sleep_time));
    setWake(toTimeInput(log.wake_time));
    setQuality(log.wake_quality);
    setComment(log.morning_comment ?? '');
  }, [log.sleep_time, log.wake_time, log.wake_quality, log.morning_comment]);

  useEffect(() => {
    if (done) setExpanded(false);
  }, [done]);

  async function handleSave() {
    setBusy(true);
    try {
      await onSave({
        sleep_time: sleep || null,
        wake_time: wake || null,
        wake_quality: quality,
        morning_comment: comment.trim() || null,
      });
      setExpanded(false);
    } finally {
      setBusy(false);
    }
  }

  const qualityLabel =
    quality === 'easy'
      ? t.home.wakeEasy
      : quality === 'normal'
        ? t.home.wakeNormal
        : quality === 'hard'
          ? t.home.wakeHard
          : null;

  return (
    <GlassCard delay={delay} className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className={done ? 'text-warn' : 'text-white/40'}>
          <Sunrise size={20} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">
            {done ? t.home.checkinDone : t.home.checkinTitle}
          </span>
          {done && !expanded && (
            <span className="mt-0.5 block truncate text-sm text-muted">
              {[
                sleep && `${t.home.sleepTime.toLowerCase()} ${sleep}`,
                wake && `${t.home.wakeTime.toLowerCase()} ${wake}`,
                qualityLabel,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>

        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-white/35"
        >
          <ChevronDown size={20} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-divider px-4 pb-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label>{t.home.sleepTime}</Label>
                  <input
                    type="time"
                    value={sleep}
                    onChange={(e) => setSleep(e.target.value)}
                    className="field"
                  />
                </label>

                <label className="block">
                  <Label>{t.home.wakeTime}</Label>
                  <input
                    type="time"
                    value={wake}
                    onChange={(e) => setWake(e.target.value)}
                    className="field"
                  />
                </label>
              </div>

              <div>
                <Label>{t.home.wakeQuality}</Label>
                <Segmented<WakeQuality>
                  value={quality}
                  onChange={setQuality}
                  options={[
                    { value: 'easy', label: t.home.wakeEasy },
                    { value: 'normal', label: t.home.wakeNormal },
                    { value: 'hard', label: t.home.wakeHard },
                  ]}
                />
              </div>

              <TextArea
                label={t.home.checkinComment}
                hint={t.common.optional}
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.home.checkinCommentPh}
              />

              <Button full onClick={handleSave} disabled={busy}>
                {busy ? t.common.saving : done ? t.common.save : t.home.saveCheckin}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
