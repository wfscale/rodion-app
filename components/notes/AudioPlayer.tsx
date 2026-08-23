'use client';

import { Loader2, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { formatDuration } from '@/lib/audio';

type AudioPlayerProps = {
  path: string;
  /** Длительность из базы: показать её надо до того, как файл загрузится. */
  duration: number | null;
  /** Подписать ссылку. Хранилище приватное, постоянной ссылки у файла нет. */
  resolve: (path: string) => Promise<string | null>;
  /** Компактный вид для карточки в списке. */
  compact?: boolean;
};

/**
 * Проигрыватель записи.
 *
 * Ссылка подписывается при первом нажатии, а не при отрисовке: в списке из
 * сорока заметок это были бы сорок запросов на подпись ради файлов, которые
 * никто не откроет.
 */
export function AudioPlayer({ path, duration, resolve, compact = false }: AudioPlayerProps) {
  const { t } = useLanguage();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [failed, setFailed] = useState(false);

  // Уход со страницы во время воспроизведения не должен оставить звук играть.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  /*
   * В шторке ссылка подписывается заранее, в списке — по нажатию.
   *
   * Safari разрешает воспроизведение только внутри жеста пользователя, а
   * подпись ссылки — это await, который жест разрывает: первое нажатие
   * молча не сработает. В шторку заходят специально ради прослушивания,
   * поэтому там ссылка готова заранее и нажатие остаётся синхронным.
   * В списке первое нажатие может потребовать второго — зато сорок заметок
   * не тянут сорок подписей ради файлов, которые никто не откроет.
   */
  useEffect(() => {
    if (compact || url) return;
    let alive = true;
    void resolve(path).then((signed) => {
      if (alive && signed) setUrl(signed);
    });
    return () => {
      alive = false;
    };
  }, [compact, path, resolve, url]);

  async function toggle() {
    if (playing) {
      audioRef.current?.pause();
      return;
    }

    if (audioRef.current) {
      void audioRef.current.play();
      return;
    }

    let signed = url;
    if (!signed) {
      setLoading(true);
      setFailed(false);
      signed = await resolve(path);
      setLoading(false);
    }

    if (!signed) {
      setFailed(true);
      return;
    }
    setUrl(signed);

    const audio = new Audio(signed);
    audioRef.current = audio;

    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.ontimeupdate = () => setPosition(audio.currentTime);
    audio.onended = () => {
      setPlaying(false);
      setPosition(0);
      audio.currentTime = 0;
    };
    audio.onerror = () => {
      setFailed(true);
      setPlaying(false);
      audioRef.current = null;
    };

    // Отказ автовоспроизведения — не ошибка файла: элемент уже создан, и
    // следующее нажатие пройдёт синхронно, внутри жеста.
    void audio.play().catch(() => setPlaying(false));
  }

  const total = duration ?? 0;
  const pct = total > 0 ? Math.min(100, (position / total) * 100) : 0;
  const shown = playing || position > 0 ? position : total;

  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'rounded-2xl bg-white/[0.05] p-2'}`}>
      <button
        type="button"
        onClick={(e) => {
          // Плеер живёт внутри карточки-кнопки, открывающей заметку:
          // нажатие на воспроизведение не должно её открывать.
          e.stopPropagation();
          void toggle();
        }}
        aria-label={playing ? t.voice.pause : t.voice.play}
        className={`flex shrink-0 items-center justify-center rounded-full transition-colors ${
          compact
            ? 'h-10 w-10 bg-white/10 text-white hover:bg-white/20'
            : 'h-11 w-11 bg-white text-ink'
        }`}
      >
        {loading ? (
          <Loader2 size={17} className="animate-spin" />
        ) : playing ? (
          <Pause size={17} strokeWidth={2.4} fill="currentColor" />
        ) : (
          // Треугольник заметно легче читается заполненным.
          <Play size={17} strokeWidth={2.4} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-white/70 transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <span className="shrink-0 text-xs font-semibold tabular-nums text-white/45">
        {failed ? t.voice.failed : formatDuration(shown)}
      </span>
    </div>
  );
}
