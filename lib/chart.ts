/**
 * Геометрия графика.
 *
 * Живёт отдельно от компонента, потому что это чистая арифметика, которую
 * надо проверять тестами: съехавшая на пиксель шкала выглядит нормально, но
 * врёт про цифры.
 */

/**
 * Верх шкалы.
 *
 * Правило: делаешь максимум 10 — шкала до 10, максимум 100 — до 100. Но
 * округлённое, иначе подписи получаются вида «17» и «8.5», и график
 * перестаёт читаться с одного взгляда. Высота графика при этом не меняется
 * никогда — двигается только кривая внутри неё.
 */
export function niceMax(value: number): number {
  const max = Math.max(0, Math.ceil(value || 0));
  if (max <= 5) return 5;
  if (max <= 20) return Math.ceil(max / 5) * 5;
  if (max <= 100) return Math.ceil(max / 10) * 10;
  if (max <= 500) return Math.ceil(max / 50) * 50;
  if (max <= 2000) return Math.ceil(max / 100) * 100;
  return Math.ceil(max / 500) * 500;
}

export type Pt = { x: number; y: number };

/**
 * Гладкая кривая через точки: Catmull-Rom, переведённый в кубические Безье.
 *
 * Контрольные точки прижимаются к границам поля. Без этого на резком скачке
 * кривая вылетает выше шкалы и рисует «рассылок больше, чем было».
 */
export function smoothPath(points: Pt[], top: number, bottom: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const clamp = (y: number) => Math.max(top, Math.min(bottom, y));
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6);

    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}
