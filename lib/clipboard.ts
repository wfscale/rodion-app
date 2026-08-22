/**
 * Копирование текста в буфер.
 *
 * С фолбэком на скрытую textarea: Clipboard API работает только в защищённом
 * контексте, и на локальном http он молча отваливается. Копирование — это
 * половина смысла заготовок, и ломаться оно не имеет права.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // падаем в фолбэк ниже
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
