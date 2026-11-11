import type { FigureShape, Point2 } from './figures'
import type { PropShape } from './props'

/**
 * The winter set: figures and scenery for Christmas toys.
 *
 * Shapes are DESIGNED IN MILLIMETRES at their default size, then
 * normalized — so every web, leg and antler below is a real dimension
 * that can be read against the 3 mm basswood rules (nothing carrying a
 * real piece of the figure is under 2 mm wide; most are 3.5 mm or more).
 */

interface Box {
  width: number
  height: number
}

/** Normalize mm points (x about the centre, y from the ground) to the library's unit box. */
function unit(pts: Point2[], box: Box): Point2[] {
  const r = (v: number) => Math.round(v * 1000) / 1000
  return pts.map((p) => ({ x: r(p.x / box.width), y: r(p.y / box.height) }))
}

/** Right half (bottom → top) mirrored to a closed counter-clockwise outline. */
function mirrored(right: Point2[]): Point2[] {
  const left = right
    .filter((p) => p.x > 1e-6)
    .map((p) => ({ x: -p.x, y: p.y }))
    .reverse()
  return [...right, ...left]
}

function ring(cx: number, cy: number, r: number, n = 12): Point2[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

/** A five-pointed star's right half, from its lowest inner corner up to the top point. */
function starRight(cx: number, cy: number, outer: number, inner: number): Point2[] {
  const at = (deg: number, r: number) => ({
    x: cx + r * Math.cos((deg * Math.PI) / 180),
    y: cy + r * Math.sin((deg * Math.PI) / 180),
  })
  return [at(306, outer), at(342, inner), at(18, outer), at(54, inner), at(90, outer)]
}

// ---------------------------------------------------------------- figures

/**
 * Leaping reindeer in side profile, nose forward (+x). It rides a short
 * stem under its belly — the "animal on a stick" of every folk toy —
 * so the legs hang free and the hop reads as a gallop.
 */
const REINDEER: Box = { width: 46, height: 50 }
const reindeer: FigureShape = {
  id: 'reindeer',
  label: 'Reindeer',
  defaultWidth: REINDEER.width,
  defaultHeight: REINDEER.height,
  outline: unit(
    [
      // stem
      { x: -2.5, y: 0 },
      { x: 2.5, y: 0 },
      { x: 2.5, y: 15 },
      // belly → front leg, stretched forward
      { x: 6.5, y: 16.5 },
      { x: 9.5, y: 15 },
      { x: 13.5, y: 7.5 },
      { x: 16.5, y: 5 },
      { x: 18.5, y: 7.5 },
      { x: 14.5, y: 17.5 },
      // chest and throat
      { x: 14.5, y: 23 },
      { x: 14, y: 28 },
      { x: 15, y: 33 },
      // muzzle
      { x: 20.5, y: 31.5 },
      { x: 23, y: 33.5 },
      { x: 22.5, y: 36.5 },
      { x: 17.5, y: 39.5 },
      // antler: front tine, beam, back tine
      { x: 16.5, y: 40.5 },
      { x: 17.5, y: 43.5 },
      { x: 21.5, y: 44.5 },
      { x: 21.5, y: 47.5 },
      { x: 17.5, y: 47 },
      { x: 17, y: 50 },
      { x: 13.5, y: 50 },
      { x: 13, y: 47 },
      { x: 8.5, y: 49 },
      { x: 7, y: 46 },
      { x: 12, y: 43.5 },
      { x: 12, y: 41 },
      // ear, nape
      { x: 8, y: 42 },
      { x: 7.5, y: 38.5 },
      { x: 10, y: 37 },
      { x: 8, y: 32 },
      // back, rump, tail
      { x: 3.5, y: 29.5 },
      { x: -8, y: 29 },
      { x: -14, y: 28 },
      { x: -17, y: 31 },
      { x: -19, y: 28.5 },
      { x: -16, y: 24 },
      // hind leg, stretched back
      { x: -19.5, y: 18 },
      { x: -23, y: 12 },
      { x: -21, y: 9 },
      { x: -17.5, y: 12 },
      { x: -11.5, y: 18.5 },
      // belly back to the stem
      { x: -5, y: 15.5 },
      { x: -2.5, y: 15 },
    ],
    REINDEER,
  ),
  engrave: [
    unit(ring(17.5, 35.5, 0.9), REINDEER),
    // collar with a bell
    unit(
      [
        { x: 9.5, y: 35 },
        { x: 11.5, y: 32.5 },
        { x: 14.3, y: 31 },
      ],
      REINDEER,
    ),
    unit(ring(12.3, 30.6, 1.1, 8), REINDEER),
    // haunch and shoulder
    unit(
      [
        { x: -9, y: 27.5 },
        { x: -11.5, y: 23.5 },
        { x: -10.5, y: 19.5 },
      ],
      REINDEER,
    ),
    unit(
      [
        { x: 7, y: 28 },
        { x: 9.5, y: 23.5 },
        { x: 9, y: 18.5 },
      ],
      REINDEER,
    ),
  ],
}

/** Three snowballs and a top hat; a scarf plate glued on for depth. */
const SNOWMAN: Box = { width: 30, height: 66 }
const snowman: FigureShape = (() => {
  const balls = [
    { cy: 14, r: 15 },
    { cy: 34, r: 11 },
    { cy: 49, r: 8 },
  ]
  const half = (y: number) => {
    let w = 0
    for (const b of balls) {
      const d = b.r * b.r - (y - b.cy) * (y - b.cy)
      if (d > 0) w = Math.max(w, Math.sqrt(d))
    }
    return w
  }
  const right: Point2[] = [{ x: 0, y: 0 }]
  // up the snowballs to the brim of the hat
  for (let y = 0; y <= 54.01; y += 1.5) right.push({ x: half(y), y })
  right.push(
    { x: 10, y: 54.6 },
    { x: 10, y: 57.4 },
    { x: 6, y: 57.4 },
    { x: 6, y: 66 },
    { x: 0, y: 66 },
  )
  return {
    id: 'snowman',
    label: 'Snowman',
    defaultWidth: SNOWMAN.width,
    defaultHeight: SNOWMAN.height,
    outline: unit(mirrored(right), SNOWMAN),
    engrave: [
      unit(ring(-2.8, 51, 0.8, 8), SNOWMAN),
      unit(ring(2.8, 51, 0.8, 8), SNOWMAN),
      // carrot nose
      unit(
        [
          { x: 0, y: 49.3 },
          { x: 5, y: 48 },
          { x: 0, y: 47 },
          { x: 0, y: 49.3 },
        ],
        SNOWMAN,
      ),
      // hat band
      unit(
        [
          { x: -5.6, y: 59.6 },
          { x: 5.6, y: 59.6 },
        ],
        SNOWMAN,
      ),
      // coal buttons
      unit(ring(0, 31, 1, 8), SNOWMAN),
      unit(ring(0, 26.5, 1, 8), SNOWMAN),
      unit(ring(0, 17, 1.1, 8), SNOWMAN),
      unit(ring(0, 11, 1.1, 8), SNOWMAN),
    ],
    layers: [
      // scarf: a band round the neck with one end hanging
      unit(
        [
          { x: -6.6, y: 41.4 },
          { x: 2.4, y: 41.4 },
          { x: 3, y: 34.5 },
          { x: 7.2, y: 34.5 },
          { x: 6.6, y: 44.8 },
          { x: -6.6, y: 44.8 },
        ],
        SNOWMAN,
      ),
    ],
  }
})()

/** Three tiers of branches and a star — made to turn on a spinner or bob in the snow. */
const XMASTREE: Box = { width: 36, height: 55.5 }
const xmastree: FigureShape = {
  id: 'xmastree',
  label: 'Christmas tree',
  defaultWidth: XMASTREE.width,
  defaultHeight: XMASTREE.height,
  outline: unit(
    mirrored([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 7 },
      { x: 18, y: 7 },
      { x: 8, y: 22 },
      { x: 14, y: 22 },
      { x: 5.5, y: 36 },
      { x: 10, y: 36 },
      ...starRight(0, 49, 6.5, 3),
    ]),
    XMASTREE,
  ),
  engrave: [
    // garlands
    unit(
      [
        { x: -11, y: 11.5 },
        { x: -3, y: 10 },
        { x: 5, y: 12 },
        { x: 11, y: 16 },
      ],
      XMASTREE,
    ),
    unit(
      [
        { x: -8, y: 26 },
        { x: -1, y: 25 },
        { x: 5, y: 27.5 },
        { x: 8.5, y: 30.5 },
      ],
      XMASTREE,
    ),
    unit(
      [
        { x: -5, y: 39 },
        { x: 0, y: 38.5 },
        { x: 4, y: 41 },
      ],
      XMASTREE,
    ),
    // baubles
    unit(ring(-6, 16.5, 1.3, 8), XMASTREE),
    unit(ring(6, 9.8, 1.3, 8), XMASTREE),
    unit(ring(1.5, 31, 1.2, 8), XMASTREE),
    unit(ring(-4.5, 23.5, 1.2, 8), XMASTREE),
  ],
}

/** Santa's sleigh: a deep seat on one solid runner with a curled toe. */
const SLEIGH: Box = { width: 50, height: 34 }
const sleigh: FigureShape = {
  id: 'sleigh',
  label: 'Sleigh',
  defaultWidth: SLEIGH.width,
  defaultHeight: SLEIGH.height,
  outline: unit(
    [
      // runner, curling up at the toe
      { x: -22, y: 0 },
      { x: 0, y: 0 },
      { x: 18, y: 0 },
      { x: 23, y: 2 },
      { x: 25, y: 7 },
      { x: 23.5, y: 11.5 },
      { x: 19.5, y: 12.5 },
      { x: 20.5, y: 8 },
      { x: 19, y: 5 },
      { x: 15.5, y: 4 },
      // dashboard scroll
      { x: 12.5, y: 10 },
      { x: 15.5, y: 17.5 },
      { x: 17, y: 23.5 },
      { x: 13, y: 25 },
      { x: 9.5, y: 19 },
      // seat
      { x: 3, y: 15.5 },
      { x: -5, y: 15.5 },
      // high back
      { x: -8.5, y: 22 },
      { x: -12, y: 30 },
      { x: -17, y: 34 },
      { x: -23, y: 33 },
      { x: -21, y: 26 },
      { x: -19.5, y: 16 },
      { x: -20, y: 8 },
      { x: -25, y: 5 },
      { x: -25, y: 1.5 },
    ],
    SLEIGH,
  ),
  engrave: [
    // the runner
    unit(
      [
        { x: -20, y: 4.2 },
        { x: 13, y: 4.2 },
      ],
      SLEIGH,
    ),
    // side panel
    unit(
      [
        { x: -16.5, y: 8 },
        { x: -16, y: 18 },
        { x: -18, y: 27 },
        { x: -15.5, y: 29.5 },
        { x: -11.5, y: 21 },
        { x: -7, y: 12.5 },
        { x: 6, y: 12.5 },
        { x: 9.5, y: 8 },
        { x: -16.5, y: 8 },
      ],
      SLEIGH,
    ),
    unit(ring(13.5, 21, 1.4, 8), SLEIGH),
  ],
}

export const CHRISTMAS_FIGURES: FigureShape[] = [reindeer, snowman, xmastree, sleigh]

// ---------------------------------------------------------------- scenery

const prop = (
  id: string,
  label: string,
  box: Box,
  color: string,
  row: 'front' | 'back',
  mm: Point2[],
): PropShape => ({
  id,
  label,
  defaultWidth: box.width,
  defaultHeight: box.height,
  defaultColor: color,
  defaultRow: row,
  outline: unit(subdivided(mm), box),
})

/** Break long straight edges (above the base) so every shape scales and smooths like the rest. */
function subdivided(pts: Point2[], step = 5): Point2[] {
  const out: Point2[] = []
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]
    out.push(a)
    if (a.y < 1e-6 && b.y < 1e-6) return
    const n = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / step)
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / (n + 1), y: a.y + ((b.y - a.y) * k) / (n + 1) })
  })
  return out
}

/** A fir in three tiers, heavy with snow. */
const pine = prop(
  'pine',
  'Pine',
  { width: 30, height: 56 },
  '#2f7a55',
  'back',
  mirrored([
    { x: 0, y: 0 },
    { x: 3.5, y: 0 },
    { x: 3.5, y: 8 },
    { x: 15, y: 8 },
    { x: 7, y: 24 },
    { x: 12, y: 24 },
    { x: 5, y: 40 },
    { x: 8.5, y: 40 },
    { x: 0, y: 56 },
  ]),
)

/** Soft drifts of snow along the front of the stage. */
const snowdrift = (() => {
  const box = { width: 110, height: 16 }
  const top: Point2[] = []
  for (let i = 0; i <= 28; i++) {
    const u = i / 28
    const h =
      0.56 + 0.26 * Math.sin(u * Math.PI * 2 * 1.5 + 0.6) + 0.18 * Math.sin(u * Math.PI * 2 * 3.5 + 2)
    top.push({ x: (0.5 - u) * box.width, y: Math.max(0.3, h) * box.height })
  }
  const peak = Math.max(...top.map((p) => p.y))
  return prop('snowdrift', 'Snow drift', box, '#eef3f8', 'front', [
    { x: -box.width / 2, y: 0 },
    { x: box.width / 2, y: 0 },
    ...top.map((p) => ({ x: p.x, y: (p.y / peak) * box.height })),
  ])
})()

/** A cabin under a snowy roof, chimney and all. */
const cabin = prop('cabin', 'Cabin', { width: 44, height: 38 }, '#b5654a', 'back', [
  { x: -18, y: 0 },
  { x: 18, y: 0 },
  { x: 18, y: 17 },
  { x: 22, y: 17 },
  { x: 14.5, y: 25 },
  { x: 14.5, y: 34 },
  { x: 8.5, y: 34 },
  { x: 8.5, y: 30.5 },
  { x: 0, y: 38 },
  { x: -22, y: 17 },
  { x: -18, y: 17 },
])

/** The Christmas star, high on a post behind everything. */
const star = (() => {
  const box = { width: 26, height: 70 }
  const s = starRight(0, 57, 13, 5.5)
  return prop(
    'star',
    'Star',
    box,
    '#f2c744',
    'back',
    mirrored([{ x: 0, y: 0 }, { x: 2.4, y: 0 }, { x: 2.4, y: 49.9 }, ...s]),
  )
})()

/** A pile of presents tied with a bow. */
const gifts = prop('gifts', 'Presents', { width: 26, height: 23 }, '#c93a2e', 'front', [
  { x: -13, y: 0 },
  { x: 13, y: 0 },
  { x: 13, y: 11 },
  { x: 8, y: 11 },
  { x: 8, y: 19 },
  { x: 3, y: 19 },
  { x: 5.5, y: 23 },
  { x: 1.5, y: 22 },
  { x: 0, y: 20 },
  { x: -1.5, y: 22 },
  { x: -5.5, y: 23 },
  { x: -3, y: 19 },
  { x: -8, y: 19 },
  { x: -8, y: 11 },
  { x: -13, y: 11 },
])

export const CHRISTMAS_PROPS: PropShape[] = [pine, snowdrift, cabin, star, gifts]
