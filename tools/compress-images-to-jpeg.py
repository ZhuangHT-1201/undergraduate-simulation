#!/usr/bin/env python3
"""Convert PNG under images/ to optimized JPEG; recompress existing JPEG."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "images"

# (subdir glob hint, quality, max longest edge or None)
RULES = [
    ("share", 88, None),
    ("cg", 84, None),
    ("generated/game_avatar", 88, 512),
    ("generated/ui_button", 80, 256),
    ("generated/ui_panel", 85, 512),
    ("generated/avatars/female", 86, 384),
    ("generated/avatars/male", 86, 384),
    ("generated/avatars/avatar_alt", 86, 384),
    ("generated/items", 86, None),
]

DEFAULT_QUALITY = 85
DEFAULT_MAX_SIDE = None


def rule_for(path: Path) -> tuple[int, int | None]:
    rel = path.as_posix().replace("\\", "/")
    for hint, quality, max_side in RULES:
        if hint in rel:
            return quality, max_side
    return DEFAULT_QUALITY, DEFAULT_MAX_SIDE


def to_rgb(im: Image.Image, bg=(255, 255, 255)) -> Image.Image:
    if im.mode in ("RGBA", "LA"):
        base = Image.new("RGB", im.size, bg)
        base.paste(im, mask=im.split()[-1])
        return base
    if im.mode == "P":
        return to_rgb(im.convert("RGBA"), bg)
    return im.convert("RGB")


def save_jpeg(src: Path, quality: int, max_side: int | None) -> Path:
    out = src.with_suffix(".jpg")
    im = Image.open(src)
    im = to_rgb(im)
    if max_side and max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    im.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
    return out


def recompress_jpeg(src: Path, quality: int, max_side: int | None) -> None:
    im = Image.open(src)
    im = to_rgb(im)
    if max_side and max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    im.save(src, "JPEG", quality=quality, optimize=True, progressive=True)


def main() -> None:
    converted: list[dict] = []
    total_before = 0
    total_after = 0

    for png in sorted(IMAGES.rglob("*.png")):
        before = png.stat().st_size
        q, mx = rule_for(png)
        out = save_jpeg(png, q, mx)
        after = out.stat().st_size
        png.unlink()
        total_before += before
        total_after += after
        converted.append(
            {
                "from": str(png.relative_to(ROOT)).replace("\\", "/"),
                "to": str(out.relative_to(ROOT)).replace("\\", "/"),
                "before_kb": round(before / 1024),
                "after_kb": round(after / 1024),
            }
        )
        print(f"PNG→JPG {png.name}: {before//1024}KB → {after//1024}KB (q={q})")

    for jpg in sorted(IMAGES.rglob("*.jpg")):
        before = jpg.stat().st_size
        q, mx = rule_for(jpg)
        recompress_jpeg(jpg, q, mx)
        after = jpg.stat().st_size
        if after < before:
            total_before += before - after
            print(f"JPG optimize {jpg.name}: {before//1024}KB → {after//1024}KB")
        total_after += 0

    report = ROOT / "tools" / "image-compress-report.json"
    report.write_text(json.dumps(converted, ensure_ascii=False, indent=2), encoding="utf-8")
    saved_kb = (total_before - total_after) // 1024 if converted else 0
    print(f"\nConverted {len(converted)} PNG files. Report: {report.relative_to(ROOT)}")
    if converted:
        sum_b = sum(c["before_kb"] for c in converted)
        sum_a = sum(c["after_kb"] for c in converted)
        print(f"PNG total: {sum_b}KB → {sum_a}KB (saved ~{sum_b - sum_a}KB)")


if __name__ == "__main__":
    main()
