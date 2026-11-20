#!/usr/bin/env python3
"""ARENA-ENV-006 (experiment): projection texture for combat-environment-006.js.

Input : assets/arena-env005-terrace.webp (owner's terrace art as shipped in ENV-005).
Output: assets/arena-env006-terrace-projection.webp, 2048x1024.

Layout comes from CombatEnvironment006.LAYOUT (read through node, single source):
  * middle band  : the painting at native pixels, rows above LAYOUT.texTop dropped
                   (never on screen, even at the widest zoom);
  * side/bottom margins: mirrored copy of the painting, blurred and darkened with
                   distance, stored at low density (seen only at zoom-out or on
                   screens wider than 2.17:1);
  * the ENV-005 CSS top shade (HUD readability) is baked in, in reference-screen rows.
Usage: python3 tools/build-arena-env006-texture.py [source.webp] [out.webp]
Needs Pillow + numpy (tooling only, not a game dependency).
"""
import json, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter

src = sys.argv[1] if len(sys.argv) > 1 else "assets/arena-env005-terrace.webp"
out = sys.argv[2] if len(sys.argv) > 2 else "assets/arena-env006-terrace-projection.webp"
info = json.loads(subprocess.check_output(["node", "-p",
    "const E=require('./combat-environment-006.js');"
    "JSON.stringify({L:E.LAYOUT,I:E.IMAGE,R:E.REF})"]))
L, I, R = info["L"], info["I"], info["R"]

img = Image.open(src).convert("RGB")
assert img.size == (I["width"], I["height"]), img.size
a = np.asarray(img).astype(np.float32) / 255.0
a = a[L["texTop"]:]                                   # drop rows never on screen
pl, pr, pb = L["padLeft"], L["padRight"], L["padBottom"]
ext = np.pad(a, ((0, pb), (pl, pr), (0, 0)), mode="symmetric")
h, w = ext.shape[:2]

# HUD shade of ENV-005: linear-gradient(180deg,#14100c66 0%,#14100c1f 22%,#14100c00 40%)
s = max(R["width"] / I["width"], R["height"] / I["height"])
top = R["height"] - I["height"] * s
rows = np.arange(h) + L["texTop"]                    # image y of each row
f = (top + rows * s) / R["height"]                   # fraction of the arena height
alpha = np.interp(f, [0, .22, .40], [0x66 / 255, 0x1f / 255, 0])
shade = np.array([0x14, 0x10, 0x0c], np.float32) / 255
ext = ext * (1 - alpha[:, None, None]) + shade * alpha[:, None, None]

# Margins: blur and darken with distance outside the painted rectangle.
ys, xs = np.mgrid[0:h, 0:w]
dx = np.maximum(pl - xs, xs - (pl + I["width"] - 1)).clip(0)
dy = (ys - (I["height"] - L["texTop"] - 1)).clip(0)
d = np.hypot(dx, dy)
def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
blur = np.asarray(Image.fromarray((ext * 255).astype(np.uint8)).filter(
    ImageFilter.GaussianBlur(14))).astype(np.float32) / 255
m = smooth(0, 160, d)[..., None]
ext = ext * (1 - m) + blur * m
dark = (1 - .5 * smooth(40, 620, d))[..., None]
warm = np.array([.16, .12, .09], np.float32)
ext = ext * dark + warm * (1 - dark) * .35

# Resample the bands into the atlas (middle band stays 1:1).
T = L["texture"]; tw, th = T["width"], T["height"]
mid_w = tw - L["texLeft"] - L["texRight"]; mid_h = I["height"] - L["texTop"]
assert mid_w == I["width"], (mid_w, I["width"])
big = Image.fromarray((ext.clip(0, 1) * 255 + .5).astype(np.uint8))
xb = [(0, pl, L["texLeft"]), (pl, pl + I["width"], mid_w), (pl + I["width"], w, L["texRight"])]
yb = [(0, mid_h, mid_h), (mid_h, h, th - mid_h)]
atlas = Image.new("RGB", (tw, th))
oy = 0
for y0, y1, hh in yb:
    ox = 0
    for x0, x1, ww in xb:
        part = big.crop((x0, y0, x1, y1))
        if part.size != (ww, hh): part = part.resize((ww, hh), Image.LANCZOS)
        atlas.paste(part, (ox, oy)); ox += ww
    oy += hh
atlas.save(out, "WEBP", quality=84, method=6)
print(out, atlas.size)
