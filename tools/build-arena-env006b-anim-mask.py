#!/usr/bin/env python3
"""ARENA-ENV-006B (experiment): animation mask for combat-environment-006.js.

Input : assets/arena-env005-terrace.webp (owner's terrace art, ENV-005).
Output: assets/arena-env006b-anim-mask.webp, ANIM_MASK size (1024x512), same UV layout
        as the projection texture (LAYOUT) at half resolution; margins stay empty.

Channels (all in [0,1]):
  R  shade map S: luminance / local "lit tile" luminance (max filter + blur), median-filtered
     so thin tile seams are not mistaken for shade. The shader relights the painting by
     S(uv+d)/S(uv): the leaf patches move, the tiles do not.
  G  leaf-shade weight: ZONES.leaf ellipse, floor-coloured pixels only (pink/green plants out).
  B  motion weight: above MOTION_SPLIT_Y — white spray of the waterfall (ZONES.mist, kept
     above the balustrade top from EDGE); below it — corner flowers/leaves (ZONES.flowers).
Zones, layout and sizes are read from the module through node (single source of truth).
Usage: python3 tools/build-arena-env006b-anim-mask.py [source.webp] [out.webp]
Needs Pillow + numpy (tooling only, not a game dependency).
"""
import json, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter

src = sys.argv[1] if len(sys.argv) > 1 else "assets/arena-env005-terrace.webp"
out = sys.argv[2] if len(sys.argv) > 2 else "assets/arena-env006b-anim-mask.webp"
info = json.loads(subprocess.check_output(["node", "-p",
    "const E=require('./combat-environment-006.js');"
    "JSON.stringify({L:E.LAYOUT,I:E.IMAGE,M:E.ANIM_MASK,Z:E.ZONES,S:E.MOTION_SPLIT_Y,E:E.EDGE})"]))
L, I, M, Z, SPLIT, EDGE = info["L"], info["I"], info["M"], info["Z"], info["S"], info["E"]

img = Image.open(src).convert("RGB")
assert img.size == (I["width"], I["height"]), img.size
a = np.asarray(img).astype(np.float32) / 255
H, W = a.shape[:2]
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def ellipse(cx, cy, rx, ry):
    return 1 - smooth(.6, 1.0, ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
def gray(x): return Image.fromarray((np.clip(x, 0, 1) * 255 + .5).astype(np.uint8))
def arr(im): return np.asarray(im).astype(np.float32) / 255

lum = a @ np.array([.299, .587, .114], np.float32)
hsv = np.asarray(img.convert("HSV")).astype(np.float32)
hue, sat = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255

# R: shade map.
lit = arr(gray(lum).filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(24)))
shade = np.clip(lum / np.maximum(lit, 1e-3), .3, 1)
shade = arr(gray(shade).filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.GaussianBlur(1.5)))

# G: leaf-shade weight on floor-coloured pixels (tan or unsaturated).
tan = ((hue > 15) & (hue < 45)).astype(np.float32)
floor = arr(gray(1 - smooth(.30, .45, sat) * (1 - tan)).filter(ImageFilter.GaussianBlur(4)))
leaf = ellipse(*Z["leaf"]["ellipse"]) * floor * smooth(Z["leaf"]["minY"], Z["leaf"]["minY"] + 65, ys)

# B (above split): waterfall spray, never on the balustrade (stay above the far-layer top).
ex = [e[0] for e in EDGE]; top = np.interp(xs, ex, [e[2] if e[2] > -1000 else e[1] for e in EDGE])
white = smooth(.48, .72, lum) * (1 - smooth(.20, .40, sat))
mist = ellipse(*Z["mist"]["ellipse"]) * (1 - smooth(top - 22, top - 4, ys))
mist = arr(gray(mist * white).filter(ImageFilter.GaussianBlur(5))) * mist
# B (below split): flowers/leaves in the corners.
plant = smooth(.28, .45, sat) * (((hue > 200) | (hue < 10)) | ((hue > 45) & (hue < 160))).astype(np.float32)
corners = np.maximum.reduce([ellipse(*e) for e in Z["flowers"]])
flowers = arr(gray(corners * plant).filter(ImageFilter.GaussianBlur(4))) * corners
motion = np.where(ys < SPLIT, mist * smooth(SPLIT - 2, SPLIT - 40, ys), flowers * smooth(SPLIT + 2, SPLIT + 40, ys))

# Atlas (full projection-texture layout), then halve.
T = L["texture"]; atlas = np.zeros((T["height"], T["width"], 3), np.float32)
atlas[..., 0] = 1  # lit everywhere outside the painting
band = slice(L["texTop"], H)
rows = H - L["texTop"]
# S is read only near the leaf zone (offsets <= ~10 px): elsewhere 1 keeps the file small.
near = arr(gray(leaf).filter(ImageFilter.MaxFilter(31))) > .002
atlas[0:rows, L["texLeft"]:L["texLeft"] + W, 0] = np.where(near, shade, 1)[band]
atlas[0:rows, L["texLeft"]:L["texLeft"] + W, 1] = leaf[band]
atlas[0:rows, L["texLeft"]:L["texLeft"] + W, 2] = motion[band]
mask = Image.fromarray((np.clip(atlas, 0, 1) * 255 + .5).astype(np.uint8)).resize((M["width"], M["height"]), Image.BOX)
mask.save(out, "WEBP", lossless=True, method=6)
stat = {k: [int((v > .5).sum())] for k, v in (("leaf", leaf), ("mist", mist), ("flowers", flowers))}
print(out, mask.size, stat)
