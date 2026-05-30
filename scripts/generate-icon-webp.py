#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import math
import random
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "src" / "App.tsx"
ASSET_ROOT = ROOT / "public" / "assets"
SIZE = 128
SCALE = 4
BUDGET_BYTES = 600 * 1024

PALE_BACKGROUNDS = [
    (254, 243, 199),
    (220, 252, 231),
    (219, 234, 254),
    (237, 233, 254),
    (255, 228, 230),
    (224, 242, 254),
    (254, 249, 195),
    (245, 245, 244),
]

ACCENTS = [
    (217, 119, 6),
    (4, 120, 87),
    (37, 99, 235),
    (124, 58, 237),
    (190, 18, 60),
    (14, 116, 144),
    (146, 64, 14),
    (67, 56, 202),
]

INK = (61, 45, 37)
PAPER = (255, 252, 239)
WHITE = (255, 255, 255)


def parse_icon_record(source: str, name: str) -> list[tuple[str, str]]:
    start = source.index(f"const {name}: Record<string, string> = {{")
    end = source.index("\n}", start)
    record = source[start:end]
    return re.findall(r"['`]([^'`]+)['`]:\s*['`]([^'`]+)['`]", record)


def color_for(identifier: str) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    digest = hashlib.sha256(identifier.encode("utf-8")).digest()
    return PALE_BACKGROUNDS[digest[0] % len(PALE_BACKGROUNDS)], ACCENTS[digest[1] % len(ACCENTS)]


def lighten(color: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(round(channel + (255 - channel) * amount) for channel in color)


def darken(color: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(round(channel * (1 - amount)) for channel in color)


def scaled(points: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(round(x * SCALE), round(y * SCALE)) for x, y in points]


def box(x0: float, y0: float, x1: float, y1: float) -> tuple[int, int, int, int]:
    return tuple(round(v * SCALE) for v in (x0, y0, x1, y1))


def stroke_width(width: float) -> int:
    return max(1, round(width * SCALE))


def line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill, width: float, joint: str = "curve"):
    draw.line(scaled(points), fill=fill, width=stroke_width(width), joint=joint)


def ellipse(draw: ImageDraw.ImageDraw, bounds, fill, outline=INK, width: float = 4):
    draw.ellipse(box(*bounds), fill=fill, outline=outline, width=stroke_width(width))


def rounded(draw: ImageDraw.ImageDraw, bounds, radius: float, fill, outline=INK, width: float = 4):
    draw.rounded_rectangle(box(*bounds), radius=round(radius * SCALE), fill=fill, outline=outline, width=stroke_width(width))


def polygon(draw: ImageDraw.ImageDraw, points, fill, outline=INK, width: float = 4):
    draw.polygon(scaled(points), fill=fill)
    draw.line(scaled(points + [points[0]]), fill=outline, width=stroke_width(width), joint="curve")


def add_sticker_base(draw: ImageDraw.ImageDraw, rng: random.Random, identifier: str):
    bg, accent = color_for(identifier)
    rounded(draw, (10, 10, 118, 118), 28, bg, darken(bg, 0.35), 3)
    for _ in range(18):
        x = rng.randint(20, 108)
        y = rng.randint(18, 110)
        r = rng.choice([1, 1.5, 2])
        fill = (*lighten(bg, 0.22), 120)
        draw.ellipse(box(x - r, y - r, x + r, y + r), fill=fill)
    line(draw, [(24, 28), (44, 22), (68, 24)], lighten(accent, 0.55), 2)


def add_gloss(draw: ImageDraw.ImageDraw):
    line(draw, [(33, 31), (51, 25), (70, 29)], (255, 255, 255, 170), 4)


def draw_bone(draw, rng, accent):
    fill = lighten((245, 218, 161), 0.45)
    outline = darken(accent, 0.2)
    rounded(draw, (34, 54, 94, 75), 11, fill, outline, 5)
    for cx, cy in [(31, 50), (31, 79), (97, 50), (97, 79)]:
        ellipse(draw, (cx - 14, cy - 14, cx + 14, cy + 14), fill, outline, 5)
    line(draw, [(42, 62), (80, 62)], (255, 255, 255), 4)


def draw_fang(draw, rng, accent):
    fill = (255, 255, 245)
    polygon(draw, [(36, 25), (72, 24), (88, 44), (77, 98), (56, 82), (43, 100), (31, 47)], fill, darken(accent, 0.18), 5)
    line(draw, [(49, 39), (60, 75), (55, 89)], lighten(accent, 0.45), 3)
    if any(token in rng.choice(["poison", "blood", "mad", "weak", "bite"]) for token in ["poison"]):
        ellipse(draw, (71, 63, 86, 78), (74, 222, 128), darken((74, 222, 128), 0.35), 3)


def draw_ball_or_disc(draw, rng, accent, disc=False):
    if disc:
        ellipse(draw, (24, 34, 104, 90), lighten(accent, 0.28), darken(accent, 0.32), 5)
        ellipse(draw, (42, 47, 86, 77), PAPER, darken(accent, 0.25), 4)
    else:
        ellipse(draw, (28, 28, 100, 100), lighten(accent, 0.2), darken(accent, 0.35), 5)
        line(draw, [(38, 44), (64, 61), (91, 48)], WHITE, 5)
        line(draw, [(34, 78), (60, 66), (94, 80)], darken(accent, 0.22), 4)


def draw_collar(draw, rng, accent):
    rounded(draw, (21, 43, 107, 79), 18, lighten(accent, 0.24), darken(accent, 0.32), 5)
    rounded(draw, (35, 52, 93, 70), 9, (255, 244, 214), darken(accent, 0.32), 3)
    for x in [35, 51, 67, 83]:
        ellipse(draw, (x, 55, x + 9, 64), darken(accent, 0.1), darken(accent, 0.35), 2)
    polygon(draw, [(64, 75), (78, 90), (64, 105), (50, 90)], (250, 204, 21), darken(accent, 0.34), 4)


def draw_vest(draw, rng, accent):
    polygon(draw, [(34, 24), (57, 34), (71, 34), (94, 24), (104, 94), (76, 105), (64, 92), (52, 105), (24, 94)], lighten(accent, 0.35), darken(accent, 0.35), 5)
    line(draw, [(64, 39), (64, 91)], darken(accent, 0.25), 4)
    line(draw, [(39, 61), (89, 61)], WHITE, 3)


def draw_shield(draw, rng, accent):
    polygon(draw, [(64, 20), (100, 34), (94, 74), (64, 106), (34, 74), (28, 34)], lighten(accent, 0.22), darken(accent, 0.35), 5)
    polygon(draw, [(64, 33), (84, 42), (80, 69), (64, 88), (48, 69), (44, 42)], PAPER, darken(accent, 0.24), 3)


def draw_blade(draw, rng, accent, katana=False, axe=False):
    if axe:
        line(draw, [(45, 92), (82, 33)], darken((146, 64, 14), 0.1), 8)
        polygon(draw, [(70, 24), (101, 36), (84, 62), (66, 48)], (224, 242, 254), darken(accent, 0.35), 5)
        return
    blade = (229, 240, 255) if katana else (245, 245, 244)
    line(draw, [(39, 91), (88, 32)], blade, 11)
    line(draw, [(39, 91), (88, 32)], darken(accent, 0.35), 4)
    line(draw, [(48, 77), (79, 40)], WHITE, 3)
    rounded(draw, (31, 86, 55, 102), 5, lighten(accent, 0.2), darken(accent, 0.35), 4)
    if katana:
        line(draw, [(28, 96), (47, 112)], darken((146, 64, 14), 0.15), 7)


def draw_house(draw, rng, accent):
    polygon(draw, [(25, 55), (64, 24), (103, 55)], lighten(accent, 0.24), darken(accent, 0.35), 5)
    rounded(draw, (34, 53, 94, 101), 8, (255, 247, 237), darken(accent, 0.33), 5)
    rounded(draw, (52, 70, 76, 101), 12, darken(accent, 0.05), darken(accent, 0.35), 3)


def draw_ingot(draw, rng, accent, silver=False):
    fill = (229, 231, 235) if silver else (251, 191, 36)
    outline = (71, 85, 105) if silver else (146, 64, 14)
    polygon(draw, [(28, 52), (44, 34), (84, 34), (100, 52), (86, 83), (42, 83)], fill, outline, 5)
    line(draw, [(43, 56), (85, 56)], WHITE, 4)
    line(draw, [(50, 70), (78, 70)], lighten(outline, 0.45), 3)


def draw_bowl(draw, rng, accent):
    ellipse(draw, (31, 36, 97, 80), (255, 255, 255), darken(accent, 0.35), 5)
    rounded(draw, (26, 61, 102, 92), 16, lighten(accent, 0.25), darken(accent, 0.35), 5)
    for x in [46, 62, 78]:
        ellipse(draw, (x - 5, 46, x + 5, 56), (146, 64, 14), darken((146, 64, 14), 0.25), 2)


def draw_bin(draw, rng, accent):
    rounded(draw, (37, 31, 92, 101), 8, lighten((74, 222, 128), 0.2), (22, 101, 52), 5)
    rounded(draw, (31, 25, 98, 39), 7, darken((74, 222, 128), 0.04), (22, 101, 52), 4)
    line(draw, [(47, 48), (47, 86)], (22, 101, 52), 3)
    line(draw, [(64, 48), (64, 88)], (22, 101, 52), 3)
    line(draw, [(80, 48), (80, 86)], (22, 101, 52), 3)
    ellipse(draw, (76, 67, 91, 82), (163, 230, 53), (63, 98, 18), 3)


def draw_engine(draw, rng, accent):
    rounded(draw, (28, 43, 98, 84), 10, (226, 232, 240), (51, 65, 85), 5)
    ellipse(draw, (38, 53, 62, 77), (148, 163, 184), (51, 65, 85), 4)
    line(draw, [(66, 62), (96, 62)], (51, 65, 85), 5)
    line(draw, [(71, 46), (85, 29), (98, 40)], (125, 211, 252), (4 if False else 4))


def draw_scroll_or_book(draw, rng, accent):
    rounded(draw, (34, 26, 93, 101), 9, (255, 247, 237), darken(accent, 0.35), 5)
    line(draw, [(45, 45), (82, 45)], lighten(accent, 0.1), 4)
    line(draw, [(45, 60), (76, 60)], lighten(accent, 0.1), 4)
    line(draw, [(45, 75), (84, 75)], lighten(accent, 0.1), 4)


def draw_paw_or_hand(draw, rng, accent, hand=False):
    if hand:
        rounded(draw, (43, 38, 82, 96), 18, lighten(accent, 0.3), darken(accent, 0.35), 5)
        for x in [35, 48, 61, 74]:
            rounded(draw, (x, 24, x + 14, 59), 7, lighten(accent, 0.37), darken(accent, 0.35), 4)
        return
    ellipse(draw, (42, 52, 86, 96), lighten(accent, 0.3), darken(accent, 0.35), 5)
    for x, y in [(35, 38), (52, 30), (72, 30), (89, 38)]:
        ellipse(draw, (x, y, x + 18, y + 22), lighten(accent, 0.36), darken(accent, 0.35), 4)


def draw_fur_or_snow(draw, rng, accent, snow=False):
    base = (224, 242, 254) if snow else (255, 255, 255)
    for cx, cy, r in [(47, 52, 22), (70, 47, 25), (82, 72, 24), (52, 78, 25)]:
        ellipse(draw, (cx - r, cy - r, cx + r, cy + r), base, darken(accent, 0.32), 4)
    if snow:
        for angle in range(0, 180, 45):
            dx = math.cos(math.radians(angle)) * 27
            dy = math.sin(math.radians(angle)) * 27
            line(draw, [(64 - dx, 64 - dy), (64 + dx, 64 + dy)], (37, 99, 235), 4)


def draw_cup_or_royal(draw, rng, accent, crown=False):
    if crown:
        polygon(draw, [(29, 77), (36, 36), (52, 58), (64, 30), (77, 58), (92, 36), (99, 77)], (251, 191, 36), (146, 64, 14), 5)
        line(draw, [(35, 84), (94, 84)], (146, 64, 14), 6)
        return
    rounded(draw, (36, 37, 86, 91), 10, (255, 247, 237), darken(accent, 0.35), 5)
    ellipse(draw, (75, 49, 104, 76), PAPER, darken(accent, 0.35), 4)
    line(draw, [(44, 52), (76, 52)], lighten(accent, 0.2), 4)


def draw_default(draw, rng, accent):
    polygon(draw, [(64, 23), (98, 47), (85, 95), (43, 95), (30, 47)], lighten(accent, 0.28), darken(accent, 0.34), 5)
    ellipse(draw, (48, 43, 80, 75), PAPER, darken(accent, 0.2), 4)


def draw_subject(draw: ImageDraw.ImageDraw, rng: random.Random, identifier: str, kind: str):
    _, accent = color_for(identifier)
    slug = identifier.lower()

    if "trash" in slug:
        draw_bin(draw, rng, accent)
    elif "house" in slug or "kennel" in slug:
        draw_house(draw, rng, accent)
    elif "ingot" in slug:
        draw_ingot(draw, rng, accent, silver="silver" in slug)
    elif "shield" in slug or "wooden" in slug:
        draw_shield(draw, rng, accent)
    elif "vest" in slug or "robe" in slug or "curtain" in slug:
        draw_vest(draw, rng, accent)
    elif "katana" in slug or "sword" in slug:
        draw_blade(draw, rng, accent, katana="katana" in slug)
    elif "axe" in slug or "demolish" in slug:
        draw_blade(draw, rng, accent, axe=True)
    elif "bone" in slug and "dinosaur" not in slug:
        draw_bone(draw, rng, accent)
    elif "fang" in slug or "canine" in slug or "bite" in slug:
        draw_fang(draw, rng, accent)
    elif "collar" in slug or "armband" in slug:
        draw_collar(draw, rng, accent)
    elif "ball" in slug:
        draw_ball_or_disc(draw, rng, accent)
    elif "disc" in slug:
        draw_ball_or_disc(draw, rng, accent, disc=True)
    elif "waterer" in slug or "bowl" in slug:
        draw_bowl(draw, rng, accent)
    elif "manual" in slug or "edict" in slug or "minister" in slug:
        draw_scroll_or_book(draw, rng, accent)
    elif "paw" in slug or "midas" in slug:
        draw_paw_or_hand(draw, rng, accent, hand="midas" in slug)
    elif "fur" in slug or "zero" in slug or "avalanche" in slug or "cold" in slug:
        draw_fur_or_snow(draw, rng, accent, snow=("zero" in slug or "avalanche" in slug or "frost" in slug or "cold" in slug))
    elif "engine" in slug or "counter" in slug:
        draw_engine(draw, rng, accent)
    elif "cup" in slug:
        draw_cup_or_royal(draw, rng, accent)
    elif "fallen" in slug or "vault" in slug or "colossus" in slug or "gym" in slug:
        draw_cup_or_royal(draw, rng, accent, crown=True)
    elif "carrot" in slug:
        polygon(draw, [(42, 36), (83, 50), (62, 99)], (251, 146, 60), (154, 52, 18), 5)
        line(draw, [(61, 36), (66, 21), (74, 38), (86, 27)], (22, 163, 74), 5)
    elif "tissue" in slug:
        rounded(draw, (28, 42, 101, 85), 10, (255, 255, 255), darken(accent, 0.35), 5)
        line(draw, [(45, 52), (86, 52)], (191, 219, 254), 3)
        line(draw, [(41, 66), (91, 66)], (191, 219, 254), 3)
    elif "die" in slug or "dice" in slug:
        rounded(draw, (36, 32, 92, 88), 12, PAPER, darken(accent, 0.35), 5)
        for cx, cy in [(50, 46), (64, 60), (78, 74)]:
            ellipse(draw, (cx - 4, cy - 4, cx + 4, cy + 4), darken(accent, 0.2), darken(accent, 0.2), 1)
    elif "foxtail" in slug or "tail" in slug:
        line(draw, [(33, 82), (48, 47), (83, 35), (99, 53), (80, 74), (48, 89)], lighten(accent, 0.28), 13)
        line(draw, [(82, 39), (98, 53), (83, 68)], WHITE, 8)
    elif "catnip" in slug:
        line(draw, [(64, 95), (64, 42)], (22, 101, 52), 5)
        for side in [-1, 1, -1, 1]:
            y = rng.randint(45, 77)
            polygon(draw, [(64, y), (64 + side * 28, y - 13), (64 + side * 19, y + 12)], (74, 222, 128), (22, 101, 52), 3)
    elif "bear" in slug:
        ellipse(draw, (34, 34, 94, 94), (180, 83, 9), (92, 45, 15), 5)
        ellipse(draw, (25, 26, 47, 49), (180, 83, 9), (92, 45, 15), 4)
        ellipse(draw, (81, 26, 103, 49), (180, 83, 9), (92, 45, 15), 4)
        ellipse(draw, (50, 58, 78, 82), (254, 215, 170), (92, 45, 15), 3)
    else:
        draw_default(draw, rng, accent)


def render_icon(identifier: str, kind: str) -> Image.Image:
    rng = random.Random(hashlib.sha256(identifier.encode("utf-8")).hexdigest())
    image = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(box(14, 15, 121, 121), radius=round(28 * SCALE), fill=(61, 45, 37, 38))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(4 * SCALE)))

    draw = ImageDraw.Draw(image, "RGBA")
    add_sticker_base(draw, rng, identifier)
    draw_subject(draw, rng, identifier, kind)
    add_gloss(draw)

    return image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def write_icon(path: Path, identifier: str, kind: str, quality: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    render_icon(identifier, kind).save(path, "WEBP", quality=quality, method=6)


def target_paths() -> list[tuple[str, str, Path]]:
    source = APP_PATH.read_text(encoding="utf-8", errors="replace")
    entries: list[tuple[str, str, Path]] = []
    for identifier, old_path in parse_icon_record(source, "itemIcons"):
        stem = Path(old_path).stem
        output = ASSET_ROOT / "items" / f"{stem}.webp"
        entries.append((identifier, "item", output))
    for identifier, old_path in parse_icon_record(source, "relicIcons"):
        stem = Path(old_path).stem
        output = ASSET_ROOT / "relics" / f"{stem}.webp"
        entries.append((identifier, "relic", output))
    deduped: dict[Path, tuple[str, str, Path]] = {}
    for entry in entries:
        deduped.setdefault(entry[2], entry)
    return list(deduped.values())


def main():
    parser = argparse.ArgumentParser(description="Generate 128px handdrawn WebP icons from DogFight icon ids.")
    parser.add_argument("--quality", type=int, default=76)
    parser.add_argument("--budget", type=int, default=BUDGET_BYTES)
    args = parser.parse_args()

    paths = target_paths()
    quality = args.quality
    while True:
        for identifier, kind, output in paths:
            write_icon(output, identifier, kind, quality)
        total = sum(output.stat().st_size for _, _, output in paths)
        if total <= args.budget or quality <= 48:
            break
        quality -= 4

    print(f"generated={len(paths)} quality={quality} total_bytes={total} budget={args.budget}")
    if total > args.budget:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
