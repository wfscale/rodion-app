"""
Генерация иконок приложения.

Запуск: python3 scripts/make-icons.py

Рисует кольцо прогресса на почти чёрном фоне — тот же мотив, что и на
главной. Файлы кладутся в public/ и подключаются через манифест и
metadata.icons в app/layout.tsx.

Иконка для iOS намеренно без прозрачности и без скруглений: систему
интересует квадратная картинка, углы она скругляет сама.
"""

from PIL import Image, ImageDraw

BG = (10, 10, 10)          # #0A0A0A — фон приложения
FG = (255, 255, 255)
SS = 4                     # суперсэмплинг для сглаживания краёв


def make_icon(size: int, padding_ratio: float = 0.0) -> Image.Image:
    canvas = size * SS
    img = Image.new("RGB", (canvas, canvas), BG)
    draw = ImageDraw.Draw(img)

    pad = canvas * padding_ratio
    inner = canvas - pad * 2

    stroke = inner * 0.115
    radius = inner * 0.32
    cx = cy = canvas / 2

    box = [cx - radius, cy - radius, cx + radius, cy + radius]

    # Тусклый полный круг — «невыполненная» часть дня.
    draw.ellipse(box, outline=(38, 38, 38), width=int(stroke))

    # Яркая дуга на 75% — от 12 часов по часовой стрелке.
    draw.arc(box, start=-90, end=180, fill=FG, width=int(stroke))

    # Скруглённые концы дуги: Pillow рисует торцы прямыми.
    # Обводка ложится внутрь габаритного прямоугольника, поэтому осевая
    # линия дуги проходит по радиусу (radius - stroke/2) — кружки ставим
    # именно туда, иначе они выпирают наружу.
    half = stroke / 2
    axis = radius - half
    for (ex, ey) in ((cx, cy - axis), (cx - axis, cy)):
        draw.ellipse([ex - half, ey - half, ex + half, ey + half], fill=FG)

    return img.resize((size, size), Image.LANCZOS)


targets = [
    ("public/icon-192.png", 192, 0.0),
    ("public/icon-512.png", 512, 0.0),
    # maskable: Android обрезает края, поэтому оставляем поля.
    ("public/icon-maskable-512.png", 512, 0.14),
    # iOS: 180×180 — размер для Retina-экранов iPhone.
    ("public/apple-touch-icon.png", 180, 0.0),
]

for path, size, pad in targets:
    make_icon(size, pad).save(path, "PNG", optimize=True)
    print(f"  {path}  {size}×{size}")

print("готово")
