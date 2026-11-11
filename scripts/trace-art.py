"""
Turn a line drawing into a layered figure for the toy library.

  python scripts/trace-art.py <image> <config.json> <out.ts> [--debug dir]

The drawing is black line art on white. The script
  1. takes everything enclosed by the outer line as the SILHOUETTE (the
     base plate), adding a mounting stem under the middle;
  2. splits the inside into the regions the lines enclose, and builds one
     glued-on PLATE per tier from the regions the config lists for it
     (tier 1 sits on the base, tier 2 on tier 1, ...);
  3. thins every remaining inside line to a centreline to ENGRAVE,
     dropping the ones that are already a plate's edge.

Run it once with an empty config to get regions.png, read the region
numbers off it, then list them per tier in the config.

Needs: numpy pillow scipy scikit-image opencv-python-headless
"""
import json, sys, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

src, cfg_path, out_path = sys.argv[1:4]
debug = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None
cfg = json.load(open(cfg_path))
width_mm = cfg['widthMm']

g = np.array(Image.open(src).convert('L'))
ink = g < cfg.get('threshold', 140)
H, W = ink.shape
disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
dil = lambda m, r: cv2.dilate(m.astype(np.uint8), disk(r)).astype(bool)
ero = lambda m, r: cv2.erode(m.astype(np.uint8), disk(r)).astype(bool)

# ---- silhouette
lab, _ = ndi.label(~ink)
edge = (set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])) - {0}
sil = ~np.isin(lab, list(edge))
regions, count = ndi.label(sil & ~ink)

drawn = sil.copy()   # the silhouette exactly as drawn
# optional: thicken the parts the config names (thin antlers), by pixels
for grow in cfg.get('thicken', []):
    part = dil(np.isin(regions, grow['regions']), grow['px'] + cfg.get('stroke', 9))
    near = dil(np.isin(regions, grow['regions']), cfg.get('stroke', 9) + 2) & sil
    sil = sil | (dil(near, grow['px']) & part)

ys, xs = np.where(sil)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
MIN_GAP = 0.0062 * (x1 - x0)
px = width_mm / (x1 - x0)          # mm per pixel
cx = (x0 + x1) / 2
stem = cfg.get('stem')
if stem:
    half = stem['widthMm'] / px / 2
    top = stem['topPx']
    bottom = y1 + int(round(stem.get('belowMm', 0.5) / px))
    canvas = np.zeros((max(H, bottom + 4), W), bool)
    canvas[:H] = sil
    canvas[top:bottom + 1, int(round(cx - half)):int(round(cx + half)) + 1] = True
    sil = canvas
    pad = lambda m: np.vstack([m, np.zeros((sil.shape[0] - m.shape[0], W), m.dtype)])
    ink, regions, drawn = pad(ink), pad(regions), pad(drawn)
    H = sil.shape[0]
    y1 = bottom
height_mm = (y1 - y0) * px

def spaced(pts, gap, closed=True):
    # no two neighbours closer than `gap` px: the cutter gains nothing from them
    out = [pts[0]]
    for p in pts[1:]:
        if np.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= gap: out.append(p)
    if closed and len(out) > 3 and np.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) < gap: out.pop()
    return np.array(out)

def contour(mask, eps):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    return spaced(cv2.approxPolyDP(c, eps, True)[:, 0, :].astype(float), MIN_GAP)

def unit(pts):
    return [[round((x - cx) / (x1 - x0), 4), round((y1 - y) / (y1 - y0), 4)] for x, y in pts]

def ccw(pts):
    a = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    return pts if a > 0 else pts[::-1]

eps = cfg.get('outlineEps', 1.2)
outline = contour(sil, eps)
while len(outline) > cfg.get('maxOutline', 260):
    eps *= 1.15
    outline = contour(sil, eps)

# ---- plates, one per tier
stroke = cfg.get('stroke', 9)           # full line width, px
plates, plate_masks = [], []
covered = np.zeros_like(sil)
for tier in cfg.get('tiers', []):
    m = np.isin(regions, tier)
    # swallow the lines between the chosen regions, stop mid-line at the rim
    m = ero(dil(m, stroke), stroke // 2 + 1) & sil
    m = ndi.binary_fill_holes(m)
    # keep clear of the silhouette's own cut edge, so plate and base never share a kerf
    m = m & ero(sil, cfg.get('insetPx', 3))
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, disk(cfg.get('openPx', 5))).astype(bool)
    l, n = ndi.label(m)
    if n > 1:
        sizes = ndi.sum(m, l, range(1, n + 1))
        m = l == (1 + int(np.argmax(sizes)))
    plate_masks.append(m)
    p = contour(m, cfg.get('plateEps', 1.4))
    plates.append(ccw(unit(p)))

# ---- engraving: inside lines, minus anything that is already an edge
inner = ink & ero(drawn, stroke + 2)
edges = np.zeros_like(sil)
for m in plate_masks:
    rim = dil(m, 1) & ~ero(m, 1)
    edges |= dil(rim, stroke // 2 + 3)
# solid blobs (a pupil) are engraved as their outline
blob = dil(ero(inner, cfg.get('blobPx', 6)), cfg.get('blobPx', 6) + 1) & inner
lines = inner & ~blob
skel = skeletonize(lines) & ~edges
engrave = []
cs, _ = cv2.findContours(blob.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
for c in cs:
    if cv2.contourArea(c) < 40: continue
    p = cv2.approxPolyDP(c, 1.0, True)[:, 0, :].astype(float).tolist()
    engrave.append(unit(p + [p[0]]))

# walk the skeleton into polylines
sk = skel.copy()
nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
def degree(y, x):
    return sum(1 for dy, dx in nb if 0 <= y + dy < H and 0 <= x + dx < W and sk[y + dy, x + dx])
def walk(y, x):
    path = [(x, y)]
    sk[y, x] = False
    while True:
        nxt = [(y + dy, x + dx) for dy, dx in nb if 0 <= y + dy < H and 0 <= x + dx < W and sk[y + dy, x + dx]]
        if not nxt: return path
        # prefer straight neighbours so diagonals do not zig-zag
        nxt.sort(key=lambda p: abs(p[0] - y) + abs(p[1] - x))
        y, x = nxt[0]
        sk[y, x] = False
        path.append((x, y))
min_len = cfg.get('minLineMm', 1.6) / px
while True:
    pts = np.argwhere(sk)
    if len(pts) == 0: break
    ends = [(y, x) for y, x in pts if degree(y, x) == 1]
    y, x = ends[0] if ends else pts[0]
    path = walk(y, x)
    length = sum(np.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]) for i in range(len(path) - 1))
    if length < min_len: continue
    p = cv2.approxPolyDP(np.array(path, np.int32).reshape(-1, 1, 2), cfg.get('lineEps', 1.3), False)[:, 0, :].astype(float)
    if len(p) >= 2: engrave.append(unit(p))

# ---- write
name = cfg['id']
fmt = lambda pts: '[' + ', '.join(f'[{x}, {y}]' for x, y in pts) + ']'
with open(out_path, 'w') as f:
    f.write('// Generated by scripts/trace-art.py — edit the config and re-run rather than this file.\n')
    f.write("import type { TracedArt } from './tracedArt'\n\n")
    f.write(f'export const {cfg["export"]}: TracedArt = {{\n')
    f.write(f"  id: '{name}',\n  label: '{cfg['label']}',\n")
    f.write(f'  width: {round(width_mm, 1)},\n  height: {round(height_mm, 1)},\n')
    f.write(f'  outline: {fmt(ccw(unit(outline)))},\n')
    f.write('  plates: [\n' + ''.join(f'    {fmt(p)},\n' for p in plates) + '  ],\n')
    f.write('  engrave: [\n' + ''.join(f'    {fmt(e)},\n' for e in engrave) + '  ],\n}\n')
print(f'{name}: {round(width_mm,1)} x {round(height_mm,1)} mm, {px:.4f} mm/px, outline {len(outline)} pts, '
      f'{len(plates)} plates ({[len(p) for p in plates]}), {len(engrave)} engraved lines, '
      f'{sum(len(e) for e in engrave)} pts')

if debug:
    os.makedirs(debug, exist_ok=True)
    out = np.full((H, W, 3), 255, np.uint8)
    rng = np.random.default_rng(3)
    for i in range(1, count + 1):
        m = regions == i
        if m.sum() < 60: continue
        out[m] = rng.integers(70, 230, 3)
        cy_, cx_ = ndi.center_of_mass(m)
        cv2.putText(out, str(i), (int(cx_) - 10, int(cy_) + 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 3)
        cv2.putText(out, str(i), (int(cx_) - 10, int(cy_) + 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    out[ink] = 0
    cv2.imwrite(f'{debug}/regions.png', out)
    view = np.full((H, W, 3), 255, np.uint8)
    view[sil] = (200, 215, 235)
    shades = [(150, 180, 215), (110, 140, 190), (80, 100, 160)]
    for k, m in enumerate(plate_masks): view[m] = shades[k % 3]
    back = lambda pts: np.array([[x * (x1 - x0) + cx, y1 - y * (y1 - y0)] for x, y in pts], np.int32)
    cv2.polylines(view, [back(ccw(unit(outline)))], True, (0, 0, 255), 2)
    for p in plates: cv2.polylines(view, [back(p)], True, (0, 120, 0), 2)
    for e in engrave: cv2.polylines(view, [back(e)], False, (30, 30, 30), 2)
    cv2.imwrite(f'{debug}/result.png', view)
