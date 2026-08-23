'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_RECORDING_SECONDS, pickMimeType } from '@/lib/audio';

/**
 * Минимальная часть Web Speech API, которая нам нужна.
 *
 * Своих типов у неё в TypeScript нет — она не входит в стандарт DOM и живёт
 * в браузерах под вендорным именем. Описываем ровно то, что вызываем.
 */
type SpeechResult = { transcript: string };
type SpeechAlternatives = { 0: SpeechResult; isFinal: boolean; length: number };
type SpeechEvent = { resultIndex: number; results: { length: number } & Record<number, SpeechAlternatives> };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Умеет ли этот браузер расшифровывать речь на лету. */
export function canTranscribe(): boolean {
  return recognitionCtor() !== null;
}

export type RecorderState = 'idle' | 'recording' | 'saving';

export type Recording = {
  blob: Blob;
  mime: string;
  seconds: number;
  /** Что удалось разобрать на лету. Пустая строка — расшифровки не было. */
  transcript: string;
};

/**
 * Запись голоса с живой расшифровкой.
 *
 * Расшифровка идёт параллельно записи и по своему каналу: готового файла
 * Web Speech API не понимает, он слушает только живой микрофон. Поэтому либо
 * так, либо никак — а «никак» означает, что через месяц в списке лежат сорок
 * безымянных записей, которые никто не переслушает.
 *
 * Падение расшифровки не трогает запись: слова — приятный бонус, звук —
 * то, ради чего кнопку и нажали.
 */
export function useVoiceRecorder(lang: string) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  /** Разобранное набело: промежуточные догадки сюда не попадают. */
  const finalTextRef = useRef('');
  /** Куда отдать результат, когда MediaRecorder закончит собирать файл. */
  const resolveRef = useRef<((value: Recording | null) => void) | null>(null);
  /** Отмена: файл собран, но он никому не нужен. */
  const cancelledRef = useRef(false);
  /** Длительность для onstop: он читает её вне цикла отрисовки. */
  const secondsRef = useRef(0);
  /** Ссылка на stop для таймера: сам stop объявлен ниже. */
  const stopRef = useRef<(() => Promise<Recording | null>) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    try {
      recognitionRef.current?.stop();
    } catch {
      // уже остановлено — это не ошибка
    }
    recognitionRef.current = null;
  }, []);

  // Уход со страницы во время записи не должен оставить микрофон включённым.
  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    setSeconds(0);
    finalTextRef.current = '';
    chunksRef.current = [];
    cancelledRef.current = false;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('unsupported');
      return false;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Отказ в доступе и отсутствие микрофона выглядят одинаково, и для
      // человека это один и тот же тупик: записывать нечем.
      setError('denied');
      return false;
    }

    streamRef.current = stream;

    const mime = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(
        stream,
        // 32 кбит/с — речь на этом битрейте разборчива полностью, а минута
        // весит четверть мегабайта. Разница слышна только на музыке.
        mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : { audioBitsPerSecond: 32_000 },
      );
    } catch {
      cleanup();
      setError('unsupported');
      return false;
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const type = recorder.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const resolve = resolveRef.current;
      resolveRef.current = null;

      cleanup();

      if (resolve) {
        resolve(
          cancelledRef.current || blob.size === 0
            ? null
            : { blob, mime: type, seconds: Math.max(1, secondsRef.current), transcript: finalTextRef.current.trim() },
        );
      }
    };

    recorderRef.current = recorder;
    recorder.start(1000);
    setState('recording');

    secondsRef.current = 0;
    timerRef.current = setInterval(() => {
      // Счёт ведёт ref, а не обновлятель состояния: в StrictMode React
      // вызывает обновлятель дважды, и побочный эффект внутри него удвоил бы
      // длительность записи.
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      // Забытая включённой запись не должна съесть ни батарею, ни место.
      if (secondsRef.current >= MAX_RECORDING_SECONDS) void stopRef.current?.();
    }, 1000);

    // Расшифровка — отдельный, необязательный канал.
    const Ctor = recognitionCtor();
    if (Ctor) {
      try {
        const recognition = new Ctor();
        recognition.lang = lang === 'en' ? 'en-US' : 'ru-RU';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const item = event.results[i];
            const text = item[0]?.transcript ?? '';
            if (item.isFinal) finalTextRef.current += text;
            else interim += text;
          }
          setTranscript((finalTextRef.current + interim).trim());
        };

        // Браузер обрывает распознавание на паузах в речи. Для потока мыслей
        // паузы — норма, поэтому поднимаем его обратно, пока идёт запись.
        recognition.onend = () => {
          if (recognitionRef.current !== recognition) return;
          try {
            recognition.start();
          } catch {
            // уже запущено либо запись кончилась
          }
        };

        recognition.onerror = () => {
          // Молча: звук пишется, а слова были бонусом.
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch {
        recognitionRef.current = null;
      }
    }

    return true;
  }, [cleanup, lang]);

  const finish = useCallback(
    (cancelled: boolean) =>
      new Promise<Recording | null>((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === 'inactive') {
          cleanup();
          setState('idle');
          resolve(null);
          return;
        }

        cancelledRef.current = cancelled;
        resolveRef.current = resolve;
        setState(cancelled ? 'idle' : 'saving');

        try {
          recorder.stop();
        } catch {
          cleanup();
          setState('idle');
          resolve(null);
        }
      }),
    [cleanup],
  );

  const stop = useCallback(() => finish(false), [finish]);
  const cancel = useCallback(() => finish(true), [finish]);

  // Таймер зовёт stop по достижении потолка, а объявлен он ниже start —
  // связываем через ref, а не присваиванием прямо в отрисовке.
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const reset = useCallback(() => {
    setState('idle');
    setSeconds(0);
    setTranscript('');
    secondsRef.current = 0;
  }, []);

  return { state, seconds, transcript, error, start, stop, cancel, reset };
}
