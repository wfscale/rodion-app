/**
 * Запись голоса: выбор формата и чтение длительности.
 *
 * Чистая часть вынесена отдельно от хука, потому что именно здесь ломается
 * совместимость: Safari и Chrome записывают в разные контейнеры, и ошибка в
 * одной строчке означает файл, который потом нигде не проигрывается.
 */

/**
 * Форматы по убыванию желания.
 *
 * opus в webm — вдвое меньше при том же качестве речи, но Safari его не
 * пишет вообще, а на iPhone это единственный браузер. Поэтому список, а не
 * константа: берём первый, который поддерживает конкретное устройство.
 */
export const AUDIO_FORMATS = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const;

/** Расширение файла по mime-типу. Хранилище отдаёт файл по нему же. */
export function extForMime(mime: string): string {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  if (base === 'audio/mp4') return 'm4a';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/mpeg') return 'mp3';
  if (base === 'audio/wav' || base === 'audio/x-wav') return 'wav';
  return 'webm';
}

/**
 * Первый формат, который умеет это устройство.
 *
 * Пустая строка означает «пиши как знаешь»: MediaRecorder без mimeType
 * выберет свой формат сам. Это хуже, чем выбрать осознанно, но лучше, чем
 * отказаться записывать.
 */
export function pickMimeType(
  supported: (mime: string) => boolean = (mime) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime),
): string {
  for (const format of AUDIO_FORMATS) {
    try {
      if (supported(format)) return format;
    } catch {
      // isTypeSupported бросает на мусорном вводе в старых движках
    }
  }
  return '';
}

/** «1:07» — минуты и секунды. Часы в заметке не нужны: столько не наговорить. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Потолок одной записи.
 *
 * Десять минут — это уже не мысль, а разговор с собой, и слушать её потом
 * никто не станет. Останавливаем сами, чтобы забытая включённой запись не
 * съела ни батарею, ни место.
 */
export const MAX_RECORDING_SECONDS = 600;

/** С этой секунды показываем, что запись скоро оборвётся сама. */
export const RECORDING_WARN_SECONDS = MAX_RECORDING_SECONDS - 60;

/** Имя файла в хранилище. Папка — id владельца, по ней же работает политика. */
export function audioPath(userId: string, id: string, mime: string): string {
  return `${userId}/${id}.${extForMime(mime)}`;
}
