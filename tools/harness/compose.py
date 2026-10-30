#!/usr/bin/python3
"""Places a harness screenshot on a neutral canvas, for store listing images.

  compose.py in.png out.png [--canvas 1600x1000] [--bg 161616] [--mode center|fit]

center: the capture keeps its pixel size, centered with a thin border and soft shadow
        (use for panels and popovers that are much smaller than the canvas).
fit:    the capture is scaled down to fill the canvas with a margin (use for full tabs).
"""
import argparse

from PIL import Image, ImageDraw, ImageFilter


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--canvas", default="1600x1000")
    ap.add_argument("--bg", default="161616")
    ap.add_argument("--mode", default="center", choices=["center", "fit"])
    ap.add_argument("--margin", type=int, default=48)
    args = ap.parse_args()

    width, height = (int(v) for v in args.canvas.split("x"))
    shot = Image.open(args.src).convert("RGB")
    if args.mode == "fit":
        scale = min((width - 2 * args.margin) / shot.width, (height - 2 * args.margin) / shot.height)
        scale = min(scale, 1.0) if shot.width <= width else scale
        shot = shot.resize((max(1, round(shot.width * scale)), max(1, round(shot.height * scale))), Image.LANCZOS)
    elif shot.width > width or shot.height > height:
        scale = min(width / shot.width, height / shot.height)
        shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.LANCZOS)

    canvas = Image.new("RGB", (width, height), "#" + args.bg.lstrip("#"))
    x, y = (width - shot.width) // 2, (height - shot.height) // 2

    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + 10, x + shot.width, y + shot.height + 10), 12, fill=(0, 0, 0, 150))
    canvas.paste(Image.alpha_composite(canvas.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(24))).convert("RGB"))

    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width - 1, shot.height - 1), 12, fill=255)
    canvas.paste(shot, (x, y), mask)
    ImageDraw.Draw(canvas).rounded_rectangle((x, y, x + shot.width - 1, y + shot.height - 1), 12, outline="#3a3a3a", width=1)
    canvas.save(args.dst, optimize=True)


if __name__ == "__main__":
    main()
