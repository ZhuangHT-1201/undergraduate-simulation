#!/usr/bin/env python3
"""从 share_card.jpg 生成 1:1 的 share_preview.jpg（朋友圈用）。"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "images/share/share_card.jpg"
OUT = ROOT / "images/share/share_preview.jpg"


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    square = im.crop((left, top, left + side, top + side))
    square = square.resize((500, 500), Image.Resampling.LANCZOS)
    square.save(OUT, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
