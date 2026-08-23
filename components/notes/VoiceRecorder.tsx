'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Mic, X } from 'lucide-react';
import { useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui';
import {
  formatDuration,
  MAX_RECORDING_SECONDS,
  RECORDING_WARN_SECONDS,
} from '@/lib/audio';
import { canTranscribe, useVoiceRecorder, type Recording } from '@/hooks/useVoiceRecorder';
import { vibrate } from '@/lib/feedback';

type VoiceRecorderProps = {
  /** Сохранить запись. Возвращает true, если получилось. */
  onSave: (recording: Recording) => Promise<boolean>;
};

/**
 * Захват мысли голосом.
 *
 * Одно нажатие начинает запись, второе — сохраняет. Между ними нет ни выбора
 * метки, ни поля описания, ни подтверждения: мысль живёт секунд десять, и
 * любой лишний экран на этом пути означает, что она не запишется вообще.
 * Всё остальное — текст, метка, правка — делается потом, по готовой заметке.
 */
export function VoiceRecorder({ onSave }: VoiceRecorderProps) {
  const { t, tf, lang } = useLanguage();
  const recorder = useVoiceRecorder(lang);

  const [transcribes] = useState(() => canTranscribe());

  const recording = recorder.state === 'recording';
  const saving = recorder.state === 'saving';
  const left = MAX_RECORDING_SECONDS - recorder.seconds;
  const nearLimit = recorder.seconds >= RECORDING_WARN_SECONDS;

  async function start() {
    vibrate(18);
    await recorder.start();
  }

  async function stop() {
    const result = await recorder.stop();
    if (!result) {
      recorder.reset();
      return;
    }

    const ok = await onSave(result);
    recorder.reset();
    if (ok) vibrate([12, 40, 12]);
  }

  async function cancel() {
    await recorder.cancel();
    recorder.reset();
  }

  return (
    <GlassCard className="p-3">
      <AnimatePresence mode="wait" initial={false}>
        {recording || saving ? (
          <motion.div
            key="live"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center gap-3 px-1">
              {/* Пульсирующая точка — единственный признак, что микрофон
                  действительно слушает. Без неё запись в тишину неотличима
                  от неработающей кнопки. */}
              <motion.span
                animate={{ opacity: saving ? 0.4 : [1, 0.25, 1] }}
                transition={{ duration: 1.4, repeat: saving ? 0 : Infinity, ease: 'easeInOut' }}
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-danger"
              />

              <span className="text-sm font-bold">
                {saving ? t.voice.saving : t.voice.recording}
              </span>

              <span
                className={`ml-auto text-base font-extrabold tabular-nums ${
                  nearLimit ? 'text-warn' : 'text-white'
                }`}
              >
                {formatDuration(recorder.seconds)}
              </span>
            </div>

            {nearLimit && !saving && (
              <p className="mt-2 px-1 text-xs text-warn">
                {tf(t.voice.almostDone, { n: Math.max(0, left) })}
              </p>
            )}

            {/* Живая расшифровка. Она же станет текстом заметки — значит
                видно заранее, что именно сохранится. */}
            {transcribes && recorder.transcript && (
              <p className="mt-2 max-h-24 overflow-y-auto px-1 text-sm leading-snug text-white/55">
                {recorder.transcript}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <Button
                variant="ghost"
                className="w-14 shrink-0"
                aria-label={t.voice.cancel}
                onClick={() => void cancel()}
                disabled={saving}
              >
                <X size={17} />
              </Button>
              <Button className="flex-1" onClick={() => void stop()} disabled={saving}>
                <Check size={17} />
                {t.voice.stop}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Button full onClick={() => void start()}>
              <Mic size={18} />
              {t.voice.record}
            </Button>

            {recorder.error && (
              <p className="mt-2 px-1 text-sm leading-snug text-danger">
                {recorder.error === 'denied' ? t.voice.denied : t.voice.unsupported}
              </p>
            )}

            {/* Про отсутствие расшифровки говорим заранее, а не после того,
                как человек наговорил три минуты и не нашёл текста. */}
            {!transcribes && !recorder.error && (
              <p className="mt-2 px-1 text-xs leading-snug text-white/30">
                {t.voice.noTranscript}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
