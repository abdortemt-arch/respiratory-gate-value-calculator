#!/usr/bin/env python3
"""Prepare web logo assets from the original brand files (originals in brand/ are untouched).

White backgrounds become transparent with a colour-to-alpha (un-multiply white) pass, so
anti-aliased edges stay smooth on the light app background. Usage:

    python3 scripts/brand/prepare_logos.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "brand"
OUT = ROOT / "public" / "brand"


def white_to_alpha(im: Image.Image) -> Image.Image:
    """GIMP-style colour-to-alpha against white."""
    im = im.convert("RGB")
    out = Image.new("RGBA", im.size)
    px_in, px_out = im.load(), out.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b = px_in[x, y]
            a = 255 - min(r, g, b)
            if a == 0:
                px_out[x, y] = (255, 255, 255, 0)
                continue
            scale = 255 / a

            def un(c: int) -> int:
                return max(0, min(255, round(255 - (255 - c) * scale)))

            px_out[x, y] = (un(r), un(g), un(b), a)
    return out


def trim(im: Image.Image, pad: int = 0) -> Image.Image:
    box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    im = im.crop(box)
    if pad:
        canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (255, 255, 255, 0))
        canvas.paste(im, (pad, pad))
        im = canvas
    return im


def fit(im: Image.Image, width: int) -> Image.Image:
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def square(im: Image.Image, size: int, pad_ratio: float = 0.08) -> Image.Image:
    inner = round(size * (1 - 2 * pad_ratio))
    scale = inner / max(im.size)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    logo = trim(white_to_alpha(Image.open(SRC / "logo-color-square.png")))
    fit(logo, 480).save(OUT / "rg-logo-color.png", optimize=True)

    # Mark only: everything above the wordmark (rows 0-614 of the 720 px original).
    mark = trim(white_to_alpha(Image.open(SRC / "logo-color-square.png").crop((0, 0, 624, 630))))
    fit(mark, 256).save(OUT / "rg-mark-color.png", optimize=True)
    square(mark, 512).save(ROOT / "src" / "app" / "icon.png", optimize=True)
    # iOS renders transparent touch icons on black, so the Apple icon gets a white background.
    apple = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
    apple.alpha_composite(square(mark, 180, 0.1))
    apple.convert("RGB").save(ROOT / "src" / "app" / "apple-icon.png", optimize=True)

    # Monochrome mark (dark-surface / watermark use only): crop the icon from the 739x415 frame.
    mono = Image.open(SRC / "logo-monochrome-dark.png").convert("RGB").crop((322, 160, 418, 254))
    mono.save(OUT / "rg-mark-mono-dark.png", optimize=True)
    print("Wrote", *sorted(p.name for p in OUT.iterdir()), "src/app/icon.png", "src/app/apple-icon.png")


if __name__ == "__main__":
    main()
