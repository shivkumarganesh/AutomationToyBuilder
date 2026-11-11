import type { AutomatonSpec, CharacterSpec, PropSpec } from '../model/types'
import { camAngularRate, camShaftY, outputChannels, STAGE_LIP } from '../model/types'
import { layshaftY } from '../model/types'
import { camOutline, type Point2 } from '../kinematics/camProfile'
import { gearOutline } from '../kinematics/gearProfile'
import { displacementTable } from '../kinematics/follower'
import { channelSignals, type ChannelSignal } from '../kinematics/channels'
import { rockerPivotY } from '../scene/rockerLayout'
import {
  CROWN_RIM,
  CROWN_TOOTH_LENGTH,
  crownPitchRadius,
  GENEVA_PIN_RADIUS,
  genevaWheelOutline,
} from '../scene/spinnerLayout'
import {
  couplerPlateOutline,
  LINK_PIN_DIAMETER,
  wandPlaneCrossing,
} from '../kinematics/linkage'
import {
  DEFAULT_FIGURE_SHAPE,
  figureEngraving,
  figureLayers,
  figureOutline,
} from '../model/figures'
import { propFitsStage, propPlateOutline, propStageSlots } from '../scene/propLayout'
import {
  FLYER_TAB_WIDTH,
  flyerBodyEngraving,
  flyerBodyOutline,
  flyerGeometry,
  flyerPostHeight,
  flyerPostOutline,
  flyerWingEngraving,
  flyerWingPlate,
} from '../scene/flyerLayout'
import {
  HINGE_HEIGHT,
  LIMB_AXLE_DIAMETER,
  LIMB_PIN_DIAMETER,
  limbPivotFrac,
  limbPlateOutline,
  standHeight,
} from '../scene/figureLayout'

/**
 * Laser-cut flat-pack layout of the frame (the zone boundary) and the cams.
 *
 * Kerf strategy: the beam burns `kerf/2` off each side of a cut line, so
 * fit-critical features are compensated parametrically —
 *   - finger-joint and tab boundaries shift so fingers/tabs widen by kerf
 *     and their mating notches/slots narrow by kerf (tight friction fit);
 *   - interior holes are drawn `kerf` under their intended size (the cut
 *     enlarges them back);
 *   - cam outlines are grown radially by `kerf/2`.
 * Overall panel outer dimensions are left nominal; the kerf/2 shrink
 * (~0.05 mm) does not affect assembly.
 *
 * Construction: four walls corner-joined with interleaved finger joints;
 * every wall has two tabs on its top edge that lock into slots in the
 * stage plate; the stage also carries the pushrod guide slots; the side
 * walls carry the shaft bearing holes; cams press onto a D-profile shaft.
 */

type Path = Point2[]

export interface Part {
  name: string
  outline: Path
  holes: Path[]
  /** Open polylines SCORED on the face (detail, glue-placement marks) — never cut through. */
  engrave?: Path[]
  width: number
  height: number
}

const FINGER_SEGMENTS = 5 // odd, so both ends of a joint edge are symmetric
const TAB_WIDTH = 14
const TABS_PER_EDGE = 2
const BEARING_CLEARANCE = 0.5 // radial slop so the shaft spins freely
const GUIDE_CLEARANCE = 0.4 // per-side slop so pushrods slide in their slots

/** Shaft cross-section: circle with a flat — cams key onto it and can't spin. */
export function dHolePath(diameter: number, cx: number, cy: number, segments = 48): Path {
  const r = diameter / 2
  const flatY = r * 0.55 // flat chord height above centre
  const start = Math.asin(flatY / r)
  const path: Path = []
  // arc from the right end of the flat, all the way round to its left end
  const sweep = 2 * Math.PI - (Math.PI - 2 * start)
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI - start + (i / segments) * sweep
    path.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return path
}

function rect(cx: number, cy: number, w: number, h: number): Path {
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ]
}

function circle(cx: number, cy: number, r: number, segments = 48): Path {
  const path: Path = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI
    path.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return path
}

/** Evenly spread `count` centres along a length. */
function spread(length: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => ((i + 1) * length) / (count + 1))
}

interface EdgeSpec {
  /** 'straight' | 'finger' (corner joint) | 'tabs' (into stage slots) */
  type: 'straight' | 'finger' | 'tabs'
  /** finger joints: which alternating segments are material (0 or 1). */
  phase?: 0 | 1
}

/**
 * Build one panel outline walking its four edges counter-clockwise:
 * bottom (y=0) → right → top → left. Fingers/tabs protrude by `t`.
 */
function panelOutline(w: number, h: number, t: number, kerf: number, edges: {
  bottom: EdgeSpec
  right: EdgeSpec
  top: EdgeSpec
  left: EdgeSpec
}): Path {
  const pts: Path = []
  const half = kerf / 2

  // Walk an edge from `from` to `to`; `out` is the outward normal.
  const walk = (from: Point2, to: Point2, out: Point2, spec: EdgeSpec) => {
    if (spec.type === 'straight') {
      pts.push(to)
      return
    }
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    const ux = dx / len
    const uy = dy / len

    if (spec.type === 'finger') {
      const n = FINGER_SEGMENTS
      const seg = len / n
      const phase = spec.phase ?? 0
      // segment i carries material at the nominal line when (i % 2) === phase,
      // otherwise it is a notch inset by the material thickness
      for (let i = 0; i < n; i++) {
        const isMaterial = i % 2 === phase
        const inset = isMaterial ? 0 : -t
        // material segments widen by kerf/2 on each interior boundary,
        // notches narrow by the same amount
        let s0 = i * seg
        let s1 = (i + 1) * seg
        if (i > 0) s0 += (i - 1) % 2 === phase ? half : -half
        if (i < n - 1) s1 += isMaterial ? half : -half
        pts.push({ x: from.x + ux * s0 + out.x * inset, y: from.y + uy * s0 + out.y * inset })
        pts.push({ x: from.x + ux * s1 + out.x * inset, y: from.y + uy * s1 + out.y * inset })
      }
      return
    }

    // tabs: straight edge with protruding tabs that enter stage slots
    const centers = spread(len, TABS_PER_EDGE)
    for (const c of centers) {
      const a = c - TAB_WIDTH / 2 - half
      const b = c + TAB_WIDTH / 2 + half
      pts.push({ x: from.x + ux * a, y: from.y + uy * a })
      pts.push({ x: from.x + ux * a + out.x * t, y: from.y + uy * a + out.y * t })
      pts.push({ x: from.x + ux * b + out.x * t, y: from.y + uy * b + out.y * t })
      pts.push({ x: from.x + ux * b, y: from.y + uy * b })
    }
    pts.push(to)
  }

  const c0 = { x: 0, y: 0 }
  const c1 = { x: w, y: 0 }
  const c2 = { x: w, y: h }
  const c3 = { x: 0, y: h }
  pts.push(c0)
  walk(c0, c1, { x: 0, y: -1 }, edges.bottom)
  walk(c1, c2, { x: 1, y: 0 }, edges.right)
  walk(c2, c3, { x: 0, y: 1 }, edges.top)
  walk(c3, c0, { x: -1, y: 0 }, edges.left)
  return pts
}

/** Grow a centred polygon radially (positive = outward). */
function growRadially(path: Path, amount: number): Path {
  return path.map((p) => {
    const r = Math.hypot(p.x, p.y)
    const f = (r + amount) / r
    return { x: p.x * f, y: p.y * f }
  })
}

function translate(path: Path, dx: number, dy: number): Path {
  return path.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

function rotatePath(path: Path, angle: number): Path {
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  return path.map((p) => ({ x: p.x * c - p.y * sn, y: p.x * sn + p.y * c }))
}

function bounds(path: Path) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of path) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

/** Follower pad height on a cut pushrod (matches the printed/rendered pad). */
const PUSHROD_PAD = 4

/** Sheet layers laminated to build a pushrod's square rod section. */
export function pushrodLayers(rodWidth: number, sheet: number): number {
  return Math.max(1, Math.round(rodWidth / sheet))
}

/** Generate all parts for the current spec. Exported for tests. */
export function generateParts(spec: AutomatonSpec): Part[] {
  const { width: w, depth: d, height: h, materialThickness: t } = spec.frame
  const kerf = spec.export.kerf
  const mech = spec.mechanism
  const parts: Part[] = []

  // Side walls (bear the shaft). Corner fingers phase 0; tabs on top.
  for (const name of ['side-left', 'side-right']) {
    const outline = panelOutline(d, h, t, kerf, {
      bottom: { type: 'straight' },
      right: { type: 'finger', phase: 0 },
      top: { type: 'tabs' },
      left: { type: 'finger', phase: 0 },
    })
    const holes = [
      circle(d / 2, mech.shaftHeight, (mech.shaftDiameter + BEARING_CLEARANCE - kerf) / 2),
    ]
    // the layshaft needs its own bearings, one exact centre distance below
    if (mech.gearTrain) {
      holes.push(
        circle(d / 2, layshaftY(mech), (mech.shaftDiameter + BEARING_CLEARANCE - kerf) / 2),
      )
    }
    parts.push({ name, outline, holes, width: d, height: h })
  }

  // Front/back walls: complementary corner fingers; tabs on top.
  for (const name of ['wall-front', 'wall-back']) {
    const outline = panelOutline(w, h, t, kerf, {
      bottom: { type: 'straight' },
      right: { type: 'finger', phase: 1 },
      top: { type: 'tabs' },
      left: { type: 'finger', phase: 1 },
    })
    parts.push({ name, outline, holes: [], width: w, height: h })
  }

  // Stage plate: slots for every wall tab + a guide slot per output channel.
  // It overhangs the walls by STAGE_LIP all round, so every wall-tab slot
  // has solid wood outside it. Openings are laid out in box coordinates
  // and shifted by the lip at the end.
  {
    const outline = panelOutline(w + 2 * STAGE_LIP, d + 2 * STAGE_LIP, t, kerf, {
      bottom: { type: 'straight' },
      right: { type: 'straight' },
      top: { type: 'straight' },
      left: { type: 'straight' },
    })
    const holes: Path[] = []
    const slotW = TAB_WIDTH - kerf
    const slotH = t - kerf
    // front/back wall centrelines sit t/2 in from the stage edges; their
    // top-edge tabs are spread along the wall length (= w)
    for (const c of spread(w, TABS_PER_EDGE)) {
      holes.push(rect(c, d - t / 2, slotW, slotH))
      holes.push(rect(c, t / 2, slotW, slotH))
    }
    // side wall centrelines at x = t/2 and w − t/2, tabs spread along d
    for (const c of spread(d, TABS_PER_EDGE)) {
      holes.push(rect(t / 2, c, slotH, slotW))
      holes.push(rect(w - t / 2, c, slotH, slotW))
    }
    // stage openings at each channel's position: square guide slots for
    // pushrods and rocker posts, a round bushing hole for spinner spindles
    for (const ch of outputChannels(spec)) {
      if (ch.kind === 'lift') {
        const size = ch.pushrod.rodWidth + 2 * GUIDE_CLEARANCE - kerf
        holes.push(rect(ch.x + w / 2, d / 2, size, size))
      } else if (ch.kind === 'tilt') {
        const size = 6 + 2 * GUIDE_CLEARANCE - kerf
        holes.push(rect(ch.x + w / 2, d / 2, size, size))
      } else if (ch.kind === 'path') {
        // elongated slot spanning exactly the wand's travel where it
        // pierces the stage sheet — DERIVED from the coupler curve
        const planeV = spec.frame.height + t / 2 - spec.mechanism.shaftHeight
        const cross = wandPlaneCrossing(ch.linkage, planeV)
        const slotLen = cross.max - cross.min + 3 + 2 * GUIDE_CLEARANCE - kerf
        const slotWide = 3 + 2 * GUIDE_CLEARANCE - kerf
        holes.push(
          rect(ch.x + w / 2, d / 2 + (cross.min + cross.max) / 2, slotWide, slotLen),
        )
      } else {
        holes.push(circle(ch.x + w / 2, d / 2, (6 + 2 * GUIDE_CLEARANCE - kerf) / 2))
      }
    }
    // flyers: a slot for each post's bottom tab, on the body centreline
    {
      const sigs = channelSignals(spec)
      for (const c of spec.characters) {
        const geo = flyerGeometry(spec, c, sigs)
        if (geo) holes.push(rect(geo.xc + w / 2, d / 2, t - kerf, FLYER_TAB_WIDTH - kerf))
      }
    }
    // scenery: one slot per prop tab, in the prop's row
    for (const prop of spec.props ?? []) {
      for (const slot of propStageSlots(spec.frame, prop)) {
        holes.push(rect(slot.x + w / 2, slot.z + d / 2, slot.width - kerf, slot.depth - kerf))
      }
    }
    parts.push({
      name: 'stage',
      outline,
      holes: holes.map((hole) => translate(hole, STAGE_LIP, STAGE_LIP)),
      width: w + 2 * STAGE_LIP,
      height: d + 2 * STAGE_LIP,
    })
  }

  // Bottom panel: plain rectangle glued inside the walls.
  {
    const bw = w - 2 * t
    const bd = d - 2 * t
    parts.push({
      name: 'bottom',
      outline: [
        { x: 0, y: 0 },
        { x: bw, y: 0 },
        { x: bw, y: bd },
        { x: 0, y: bd },
      ],
      holes: [],
      width: bw,
      height: bd,
    })
  }

  // Cams: profile grown by kerf/2, D-hole shrunk by kerf for a press fit.
  for (const cam of mech.cams) {
    const raw = camOutline(cam, 128)
    const outline = growRadially(raw, kerf / 2)
    const b = bounds(outline)
    const centred = translate(outline, -b.minX, -b.minY)
    const hole = translate(dHolePath(mech.shaftDiameter - kerf, 0, 0), -b.minX, -b.minY)
    // a cam thicker than the sheet laminates from identical discs — the
    // D-holes register the layers on the shaft
    const layers = Math.max(1, Math.round(cam.thickness / t))
    // named after the cam itself, so same-shaped cams with different
    // throws can be told apart on the sheet and in the guide
    const camName = cam.id.startsWith('cam-') ? cam.id : `cam-${cam.id}`
    for (let k = 0; k < layers; k++) {
      parts.push({
        name: k === 0 ? camName : `${camName}-layer${k + 1}`,
        outline: centred,
        holes: [hole],
        width: b.maxX - b.minX,
        height: b.maxY - b.minY,
      })
    }
  }

  // Gear pair: same tooth outlines the scene meshes, keyed D-holes.
  if (mech.gearTrain) {
    const g = mech.gearTrain
    for (const [name, teeth] of [
      ['gear-drive', g.teethDrive],
      ['gear-driven', g.teethDriven],
    ] as const) {
      const outline = growRadially(gearOutline(teeth, g.module), kerf / 2)
      const b = bounds(outline)
      parts.push({
        name,
        outline: translate(outline, -b.minX, -b.minY),
        holes: [translate(dHolePath(mech.shaftDiameter - kerf, 0, 0), -b.minX, -b.minY)],
        width: b.maxX - b.minX,
        height: b.maxY - b.minY,
      })
    }
  }

  // Spinner drives.
  //  - friction: keyed drive wheel disc
  //  - bevel: flat pinion gear + crown built the kit way — a slotted disc
  //    with individual tooth tabs glued through mortises near the rim
  //    (crown teeth point out of the sheet plane, so no single flat part
  //    can carry them)
  for (const sp of mech.spinners) {
    if (sp.drive === 'geneva') {
      // star wheel: flat and directly cuttable, spindle hole in the centre
      const wheel = genevaWheelOutline(sp)
      const wb = bounds(wheel)
      parts.push({
        name: `geneva-wheel-${sp.id}`,
        outline: translate(wheel, -wb.minX, -wb.minY),
        holes: [translate(circle(0, 0, (6 - kerf) / 2), -wb.minX, -wb.minY)],
        width: wb.maxX - wb.minX,
        height: wb.maxY - wb.minY,
      })
      // driver: ONE piece — a keyed disc with a radial finger that is the
      // drive pin (pin-diameter wide, reaching the pin circle radius), so
      // there is no glued peg and no mortise beside the shaft hole
      const Rd = Math.max(sp.wheelRadius - 6, mech.shaftDiameter / 2 + 5)
      const pinHalf = GENEVA_PIN_RADIUS
      const reach = sp.wheelRadius + GENEVA_PIN_RADIUS
      const a0 = Math.asin(pinHalf / Rd)
      const raw: Path = [
        { x: reach, y: -pinHalf },
        { x: reach, y: pinHalf },
      ]
      const ARC = 56
      for (let i = 0; i <= ARC; i++) {
        const a = a0 + (i / ARC) * (2 * Math.PI - 2 * a0)
        raw.push({ x: Rd * Math.cos(a), y: Rd * Math.sin(a) })
      }
      const disc = growRadially(raw, kerf / 2)
      const db = bounds(disc)
      parts.push({
        name: `geneva-driver-${sp.id}`,
        outline: translate(disc, -db.minX, -db.minY),
        holes: [translate(dHolePath(mech.shaftDiameter - kerf, 0, 0), -db.minX, -db.minY)],
        width: db.maxX - db.minX,
        height: db.maxY - db.minY,
      })
      // platform disc
      const platform = growRadially(circle(0, 0, sp.platformRadius, 72), kerf / 2)
      const b2 = bounds(platform)
      parts.push({
        name: `spinner-platform-${sp.id}`,
        outline: translate(platform, -b2.minX, -b2.minY),
        holes: [translate(circle(0, 0, (6 - kerf) / 2), -b2.minX, -b2.minY)],
        width: b2.maxX - b2.minX,
        height: b2.maxY - b2.minY,
      })
      continue
    }
    if (sp.drive === 'bevel') {
      // pinion: a plain flat spur gear with a spindle hole
      const pinion = growRadially(gearOutline(sp.pinionTeeth!, sp.module!), kerf / 2)
      const pb = bounds(pinion)
      parts.push({
        name: `pinion-${sp.id}`,
        outline: translate(pinion, -pb.minX, -pb.minY),
        holes: [translate(circle(0, 0, (6 - kerf) / 2), -pb.minX, -pb.minY)],
        width: pb.maxX - pb.minX,
        height: pb.maxY - pb.minY,
      })

      // crown disc: D-hole + one mortise slot per tooth, tangential at the rim
      const Rc = crownPitchRadius(sp)
      const teeth = sp.crownTeeth!
      const toothW = ((2 * Math.PI * Rc) / teeth) * 0.45
      // the disc carries a rim OUTSIDE the tooth slots, so each mortise has
      // solid wood around it (the teeth still stand on the pitch circle)
      const disc = growRadially(circle(0, 0, Rc + CROWN_RIM, 72), kerf / 2)
      const db = bounds(disc)
      const holes = [translate(dHolePath(mech.shaftDiameter - kerf, 0, 0), -db.minX, -db.minY)]
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2
        // slot drawn undersize by kerf; tangential orientation at radius Rc − 2
        const slot = rotatePath(rect(0, 0, t - kerf, toothW - kerf), a)
        holes.push(
          translate(slot, (Rc - 2) * Math.cos(a) - db.minX, (Rc - 2) * Math.sin(a) - db.minY),
        )
      }
      parts.push({
        name: `crown-disc-${sp.id}`,
        outline: translate(disc, -db.minX, -db.minY),
        holes,
        width: db.maxX - db.minX,
        height: db.maxY - db.minY,
      })

      // tooth tabs: oversize by kerf so they friction-fit the mortises;
      // length = protruding tooth + one material thickness of tenon
      const tabW = toothW + kerf
      const tabL = CROWN_TOOTH_LENGTH + t + kerf
      for (let i = 0; i < teeth; i++) {
        parts.push({
          name: `crown-tooth-${sp.id}-${i + 1}`,
          outline: [
            { x: 0, y: 0 },
            { x: tabL, y: 0 },
            { x: tabL, y: tabW },
            { x: 0, y: tabW },
          ],
          holes: [],
          width: tabL,
          height: tabW,
        })
      }

      // platform disc for the spindle top (shared with friction drives)
      const platform = growRadially(circle(0, 0, sp.platformRadius, 72), kerf / 2)
      const b2 = bounds(platform)
      parts.push({
        name: `spinner-platform-${sp.id}`,
        outline: translate(platform, -b2.minX, -b2.minY),
        holes: [translate(circle(0, 0, (6 - kerf) / 2), -b2.minX, -b2.minY)],
        width: b2.maxX - b2.minX,
        height: b2.maxY - b2.minY,
      })
      continue
    }
    const wheel = growRadially(circle(0, 0, sp.wheelRadius, 64), kerf / 2)
    const b1 = bounds(wheel)
    parts.push({
      name: `spinner-wheel-${sp.id}`,
      outline: translate(wheel, -b1.minX, -b1.minY),
      holes: [translate(dHolePath(mech.shaftDiameter - kerf, 0, 0), -b1.minX, -b1.minY)],
      width: b1.maxX - b1.minX,
      height: b1.maxY - b1.minY,
    })
    const platform = growRadially(circle(0, 0, sp.platformRadius, 72), kerf / 2)
    const b2 = bounds(platform)
    parts.push({
      name: `spinner-platform-${sp.id}`,
      outline: translate(platform, -b2.minX, -b2.minY),
      holes: [translate(circle(0, 0, (6 - kerf) / 2), -b2.minX, -b2.minY)],
      width: b2.maxX - b2.minX,
      height: b2.maxY - b2.minY,
    })
  }

  // Rocker levers: beam with a pivot hole at the fulcrum end, plus the
  // fulcrum post and link-rod strips — heights DERIVED from the follower's
  // mid-travel, exactly as the scene places them.
  const stageTop = spec.frame.height + t
  for (const rocker of mech.rockers) {
    const length = rocker.leverLength + 12
    const beamW = 8
    parts.push({
      name: `rocker-lever-${rocker.id}`,
      outline: [
        { x: 0, y: 0 },
        { x: length, y: 0 },
        { x: length, y: beamW },
        { x: 0, y: beamW },
      ],
      holes: [circle(6, beamW / 2, (3 - kerf) / 2)],
      width: length,
      height: beamW,
    })
    const cam = mech.cams.find((c) => c.id === rocker.camId)
    if (cam) {
      const lift = displacementTable(cam, rocker.padWidth, camAngularRate(mech, cam))
      const pivotY = rockerPivotY(lift, camShaftY(mech, cam))
      parts.push(stripPart(`rocker-post-${rocker.id}`, 6, pivotY))
      const linkLen = stageTop + 6 - pivotY
      if (linkLen > 0) parts.push(stripPart(`rocker-link-${rocker.id}`, 4, linkLen))
    }
  }

  // Four-bar linkage parts: input crank disc, the coupler+wand L-plate
  // (arm angle derived so the wand is vertical at mid-swing), the rocker
  // bar, and the pivot post at derived height.
  for (const l of mech.linkages ?? []) {
    const crankR = l.crankRadius + 5
    const disc = growRadially(circle(0, 0, crankR, 48), kerf / 2)
    const db = bounds(disc)
    parts.push({
      name: `linkage-crank-${l.id}`,
      outline: translate(disc, -db.minX, -db.minY),
      holes: [
        translate(dHolePath(mech.shaftDiameter - kerf, 0, 0), -db.minX, -db.minY),
        translate(circle(l.crankRadius, 0, (LINK_PIN_DIAMETER - kerf) / 2), -db.minX, -db.minY),
      ],
      width: db.maxX - db.minX,
      height: db.maxY - db.minY,
    })

    const plate = growRadially(couplerPlateOutline(l), kerf / 2)
    const pb = bounds(plate)
    parts.push({
      name: `linkage-coupler-${l.id}`,
      outline: translate(plate, -pb.minX, -pb.minY),
      holes: [
        translate(circle(0, 0, runningHole(LINK_PIN_DIAMETER, kerf)), -pb.minX, -pb.minY),
        translate(
          circle(l.couplerLen, 0, runningHole(LINK_PIN_DIAMETER, kerf)),
          -pb.minX,
          -pb.minY,
        ),
      ],
      width: pb.maxX - pb.minX,
      height: pb.maxY - pb.minY,
    })

    const rockerLen = l.rockerLen
    parts.push({
      name: `linkage-rocker-${l.id}`,
      outline: [
        { x: -5, y: -4 },
        { x: rockerLen + 5, y: -4 },
        { x: rockerLen + 5, y: 4 },
        { x: -5, y: 4 },
      ].map((pt) => ({ x: pt.x + 5, y: pt.y + 4 })),
      holes: [
        circle(5, 4, runningHole(LINK_PIN_DIAMETER, kerf)),
        circle(rockerLen + 5, 4, runningHole(LINK_PIN_DIAMETER, kerf)),
      ],
      width: rockerLen + 10,
      height: 8,
    })

    // 8 mm wide: the pin hole keeps 2 mm+ of wood either side
    const post = stripPart(`linkage-post-${l.id}`, 8, mech.shaftHeight)
    post.holes.push(circle(4, mech.shaftHeight - 4, runningHole(LINK_PIN_DIAMETER, kerf)))
    parts.push(post)
  }

  // Pushrods: a T-shaped strip (follower pad + rod). The rod runs in a
  // square guide slot, so it laminates from as many sheet layers as it
  // takes to build the rod's square section.
  for (const ch of outputChannels(spec)) {
    if (ch.kind !== 'lift') continue
    const { rodWidth, padWidth, length } = ch.pushrod
    const layers = pushrodLayers(rodWidth, t)
    const cx = padWidth / 2
    const raw: Path = [
      { x: 0, y: 0 },
      { x: padWidth, y: 0 },
      { x: padWidth, y: PUSHROD_PAD },
      { x: cx + rodWidth / 2, y: PUSHROD_PAD },
      { x: cx + rodWidth / 2, y: PUSHROD_PAD + length },
      { x: cx - rodWidth / 2, y: PUSHROD_PAD + length },
      { x: cx - rodWidth / 2, y: PUSHROD_PAD },
      { x: 0, y: PUSHROD_PAD },
    ]
    for (let k = 0; k < layers; k++) {
      parts.push({
        name: layers > 1 ? `pushrod-${ch.id}-layer${k + 1}` : `pushrod-${ch.id}`,
        outline: raw,
        holes: [],
        width: padWidth,
        height: PUSHROD_PAD + length,
      })
    }
  }

  // Crank arm: a stadium plate keyed onto the shaft's D-flat, with a
  // press-fit round hole for the handle — an offcut of the shaft dowel.
  {
    const arm = mech.crank.armLength
    const r = mech.shaftDiameter / 2 + 5
    const outline: Path = []
    const SEG = 16
    for (let i = 0; i <= SEG; i++) {
      const a = Math.PI + (i / SEG) * Math.PI
      outline.push({ x: r + r * Math.cos(a), y: r + r * Math.sin(a) })
    }
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI
      outline.push({ x: r + r * Math.cos(a), y: r + arm + r * Math.sin(a) })
    }
    parts.push({
      name: 'crank-arm',
      outline,
      holes: [
        dHolePath(mech.shaftDiameter - kerf, r, r),
        circle(r, r + arm, (mech.shaftDiameter - kerf) / 2),
      ],
      width: 2 * r,
      height: arm + 2 * r,
    })
  }

  // Scenery plates with their mounting tabs.
  for (const prop of spec.props ?? []) {
    parts.push(propPart(prop, t, kerf))
  }

  // Character-zone parts: every figure gets flat laser parts too, so a
  // toy can be built entirely from sheet stock (bodies laminate from
  // layers of the sheet).
  const signals = channelSignals(spec)
  for (const c of spec.characters) {
    parts.push(...characterParts(spec, c, signals, kerf))
  }

  return parts
}

/** Plain rectangular strip part (posts, links, stands). */
function stripPart(name: string, w: number, h: number): Part {
  return {
    name,
    outline: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
    holes: [],
    width: w,
    height: h,
  }
}

/** Running-fit hole radius for a rotating shaft/pin of the given diameter. */
function runningHole(diameter: number, kerf: number): number {
  return (diameter + BEARING_CLEARANCE - kerf) / 2
}

/**
 * Flat laser parts for one figure.
 *
 * Block figures cut as a front silhouette (body + head in one outline).
 * Articulated figures cut as a kit: a SIDE-profile body plate carrying a
 * running-fit axle hole at each limb's derived pivot position, the stand
 * (derived height), and one paddle plate per limb — the same outline the
 * STL prints, with the pivot/pin hole pair exactly crankArm apart. Wire
 * cranks bend from wire stock (or print from the STL kit).
 */
function characterParts(
  spec: AutomatonSpec,
  c: CharacterSpec,
  signals: ChannelSignal[],
  kerf: number,
): Part[] {
  const out: Part[] = []
  const hasHeadLimb = c.kind === 'articulated' && (c.limbs ?? []).some((l) => l.kind === 'head')

  // silhouette: body rectangle, head bump on top unless a head limb replaces it
  const headSize = c.width * 0.55
  const silhouette = (w: number): Path => {
    const pts: Path = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: c.height },
    ]
    if (!hasHeadLimb) {
      pts.push(
        { x: (w + headSize) / 2, y: c.height },
        { x: (w + headSize) / 2, y: c.height + headSize },
        { x: (w - headSize) / 2, y: c.height + headSize },
        { x: (w - headSize) / 2, y: c.height },
      )
    }
    pts.push({ x: 0, y: c.height })
    return pts
  }

  if (c.kind === 'flyer') {
    const geo = flyerGeometry(spec, c, signals)
    if (!geo) return out
    const t = spec.frame.materialThickness
    const place = (name: string, raw: Path, holes: Path[] = [], engrave: Path[] = []): Part => {
      const b0 = bounds(raw)
      const cx = (b0.minX + b0.maxX) / 2
      const cy = (b0.minY + b0.maxY) / 2
      const grown = growRadially(
        raw.map((pt) => ({ x: pt.x - cx, y: pt.y - cy })),
        kerf / 2,
      ).map((pt) => ({ x: pt.x + cx, y: pt.y + cy }))
      const b = bounds(grown)
      return {
        name,
        outline: translate(grown, -b.minX, -b.minY),
        holes: holes.map((h) => translate(h, -b.minX, -b.minY)),
        ...(engrave.length > 0
          ? { engrave: engrave.map((l) => translate(l, -b.minX, -b.minY)) }
          : {}),
        width: b.maxX - b.minX,
        height: b.maxY - b.minY,
      }
    }
    // body: the post's top tab passes through a slot at the wing-root middle
    out.push(
      place(
        `body-${c.id}`,
        flyerBodyOutline(c),
        [rect(0, 0, t - kerf, FLYER_TAB_WIDTH - kerf)],
        flyerBodyEngraving(c),
      ),
    )
    out.push(place(`post-${c.id}`, flyerPostOutline(flyerPostHeight(spec, geo), t)))
    for (const side of [geo.left, geo.right]) {
      const tag = side.sign < 0 ? 'L' : 'R'
      side.hinges.forEach((_, i) => {
        const flip = (pt: Point2) => ({ x: side.sign * pt.x, y: pt.y })
        const plate = flyerWingPlate(c, side, i).map(flip)
        const ribs = flyerWingEngraving(c, side, i).map((l) => l.map(flip))
        out.push(place(`wing-${c.id}-${tag}${i + 1}`, plate, [], ribs))
      })
    }
    return out
  }

  if (c.kind === 'silhouette') {
    // curated library outline, scaled to the figure's real dimensions
    const raw = figureOutline(c.shape ?? DEFAULT_FIGURE_SHAPE, c.width, c.height)
    const grown = growRadially(
      raw.map((pt) => ({ x: pt.x, y: pt.y - c.height / 2 })),
      kerf / 2,
    ).map((pt) => ({ x: pt.x, y: pt.y + c.height / 2 }))
    const b = bounds(grown)
    const shapeId = c.shape ?? DEFAULT_FIGURE_SHAPE
    const layers = figureLayers(shapeId, c.width, c.height)
    // scored on the face: the detail lines, plus the footprint of every
    // glued-on plate so it is obvious where each one goes
    const marks = [
      ...figureEngraving(shapeId, c.width, c.height),
      ...layers.map((l) => [...l, l[0]]),
    ]
    out.push({
      name: `figure-${c.id}`,
      outline: translate(grown, -b.minX, -b.minY),
      holes: [],
      ...(marks.length > 0 ? { engrave: marks.map((l) => translate(l, -b.minX, -b.minY)) } : {}),
      width: b.maxX - b.minX,
      height: b.maxY - b.minY,
    })
    // raised detail plates: one for each face of the figure
    layers.forEach((layer, k) => {
      const lb = bounds(layer)
      for (const face of ['front', 'back']) {
        out.push({
          name: `detail-${c.id}-${k + 1}-${face}`,
          outline: translate(layer, -lb.minX, -lb.minY),
          holes: [],
          width: lb.maxX - lb.minX,
          height: lb.maxY - lb.minY,
        })
      }
    })
    return out
  }

  if (c.kind !== 'articulated') {
    const w = c.width
    out.push({
      name: `figure-${c.id}`,
      outline: silhouette(w),
      holes: [],
      width: w,
      height: c.height + headSize,
    })
    const signal = signals.find((s) => s.channel.id === c.channelId)
    if (signal?.kind === 'tilt') {
      out.push(stripPart(`hinge-stand-${c.id}`, c.width * 0.6, HINGE_HEIGHT + 2))
    }
    return out
  }

  // articulated: SIDE profile (depth × height) so limb axles cross the sheet
  // An axle hole near an edge gets a LUG — the outline steps out around
  // it — so every hole keeps LUG mm of wood on all sides.
  const LUG = LIMB_AXLE_DIAMETER / 2 + 2.6
  const holes: Path[] = []
  const limbs = c.limbs ?? []
  const head = limbs.find((l) => l.kind === 'head')
  const tail = limbs.find((l) => l.kind === 'tail')
  // tail lug steps out of the back edge; everything shifts right by it
  const backLug = tail ? Math.max(0, LUG - 3) : 0
  const tailY = tail ? Math.min(limbPivotFrac('tail') * c.height, c.height - LUG) : 0
  const bx = backLug
  for (const limb of limbs) {
    // wings/head axles cross mid-depth; the tail axle sits at the back edge.
    // The head pivots AT the top of the body, inside its lug.
    const y =
      limb.kind === 'head'
        ? c.height
        : limb.kind === 'tail'
          ? tailY
          : Math.min(limbPivotFrac(limb.kind) * c.height, c.height - LUG)
    const x = limb.kind === 'tail' ? 3 : c.depth / 2
    holes.push(circle(bx + x, y, runningHole(LIMB_AXLE_DIAMETER, kerf)))
  }
  const body: Path = [
    { x: bx, y: 0 },
    { x: bx + c.depth, y: 0 },
    { x: bx + c.depth, y: c.height },
  ]
  if (head)
    body.push(
      { x: bx + c.depth / 2 + LUG, y: c.height },
      { x: bx + c.depth / 2 + LUG, y: c.height + LUG },
      { x: bx + c.depth / 2 - LUG, y: c.height + LUG },
      { x: bx + c.depth / 2 - LUG, y: c.height },
    )
  body.push({ x: bx, y: c.height })
  if (tail && backLug > 0)
    body.push(
      { x: bx, y: tailY + LUG },
      { x: 0, y: tailY + LUG },
      { x: 0, y: tailY - LUG },
      { x: bx, y: tailY - LUG },
    )
  out.push({
    name: `figure-${c.id}`,
    outline: body,
    holes,
    width: bx + c.depth,
    height: c.height + (head ? LUG : 0),
  })
  out.push(stripPart(`figure-stand-${c.id}`, 8, Math.max(standHeight(spec, c, signals), 2)))

  for (const limb of c.limbs ?? []) {
    const raw = limbPlateOutline(limb)
    const grown = growRadially(raw, kerf / 2)
    const b = bounds(grown)
    const plate = (name: string): Part => ({
      name,
      outline: translate(grown, -b.minX, -b.minY),
      holes: [
        translate(circle(0, 0, runningHole(LIMB_AXLE_DIAMETER, kerf)), -b.minX, -b.minY),
        translate(
          circle(-limb.crankArm, 0, runningHole(LIMB_PIN_DIAMETER, kerf)),
          -b.minX,
          -b.minY,
        ),
      ],
      width: b.maxX - b.minX,
      height: b.maxY - b.minY,
    })
    if (limb.kind === 'wings') {
      // symmetric plate: left and right are the same part flipped over
      out.push(plate(`${limb.id}-left`), plate(`${limb.id}-right`))
    } else {
      out.push(plate(limb.id))
    }
  }
  return out
}

/** Scenery plate: library outline + mounting tabs, grown for kerf. */
function propPart(prop: PropSpec, t: number, kerf: number): Part {
  const raw = propPlateOutline(prop, t)
  const cy = prop.height / 2
  const grown = growRadially(
    raw.map((pt) => ({ x: pt.x, y: pt.y - cy })),
    kerf / 2,
  ).map((pt) => ({ x: pt.x, y: pt.y + cy }))
  const b = bounds(grown)
  return {
    name: `prop-${prop.id.replace(/^prop-/, '')}`,
    outline: translate(grown, -b.minX, -b.minY),
    holes: [],
    width: b.maxX - b.minX,
    height: b.maxY - b.minY,
  }
}

/**
 * Prop ids whose stage slots collide with another stage opening (a
 * channel slot, a wall-tab slot or another prop) or leave the stage.
 * The UI warns on these; templates and recipes must return none.
 */
export function propConflicts(spec: AutomatonSpec): string[] {
  const props = spec.props ?? []
  if (props.length === 0) return []
  const { width: w, depth: d } = spec.frame
  const stage = generateParts({ ...spec, props: [] }).find((p) => p.name === 'stage')!
  const taken = stage.holes.map(bounds)
  const MARGIN = 1.5
  const bad: string[] = []
  for (const prop of props) {
    const mine = propStageSlots(spec.frame, prop).map((s) => ({
      minX: s.x + w / 2 + STAGE_LIP - s.width / 2,
      maxX: s.x + w / 2 + STAGE_LIP + s.width / 2,
      minY: s.z + d / 2 + STAGE_LIP - s.depth / 2,
      maxY: s.z + d / 2 + STAGE_LIP + s.depth / 2,
    }))
    const hit = mine.some((a) =>
      taken.some(
        (b) =>
          a.minX < b.maxX + MARGIN &&
          a.maxX > b.minX - MARGIN &&
          a.minY < b.maxY + MARGIN &&
          a.maxY > b.minY - MARGIN,
      ),
    )
    if (hit || !propFitsStage(spec.frame, prop)) bad.push(prop.id)
    taken.push(...mine)
  }
  return bad
}

function openPathToSvg(path: Path): string {
  return path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')
}

function pathToSvg(path: Path): string {
  const d = path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')
  return `${d} Z`
}

/** The sheet stock the flat-pack is nested onto (a common hobby-laser size). */
export const SHEET_WIDTH = 300
export const SHEET_HEIGHT = 200
const SHEET_MARGIN = 5
const PART_GAP = 10
const SHEET_SPACING = 12

export interface PlacedPart {
  part: Part
  /** Translation of the (possibly rotated) part onto its sheet. */
  dx: number
  dy: number
}

export interface PackedSheet {
  width: number
  height: number
  parts: PlacedPart[]
}

/** Quarter-turn a part so a long piece can lie along the sheet. */
function rotatePart(part: Part): Part {
  const b = bounds(part.outline)
  const turn = (path: Path) => path.map((p) => ({ x: p.y - b.minY, y: b.maxX - p.x }))
  return {
    name: part.name,
    outline: turn(part.outline),
    holes: part.holes.map(turn),
    ...(part.engrave ? { engrave: part.engrave.map(turn) } : {}),
    width: part.height,
    height: part.width,
  }
}

/**
 * Nest every part onto SHEET_WIDTH × SHEET_HEIGHT sheets (tallest
 * first, in shelves). A part too big for any sheet gets a sheet of its
 * own size — the basswood audit reports it.
 */
export function packSheets(spec: AutomatonSpec): PackedSheet[] {
  const usableW = SHEET_WIDTH - 2 * SHEET_MARGIN
  const usableH = SHEET_HEIGHT - 2 * SHEET_MARGIN
  const sized = generateParts(spec).map((raw) => {
    let part = raw
    let b = bounds(part.outline)
    // lie every part on its long side (low shelves pack tighter), unless
    // it only fits the sheet the other way up
    const w0 = b.maxX - b.minX
    const h0 = b.maxY - b.minY
    const landscape = w0 >= h0
    const fitsAsIs = w0 <= usableW && h0 <= usableH
    const fitsTurned = h0 <= usableW && w0 <= usableH
    if ((!landscape && fitsTurned) || (!fitsAsIs && fitsTurned)) {
      part = rotatePart(part)
      b = bounds(part.outline)
    }
    return { part, b, w: b.maxX - b.minX, h: b.maxY - b.minY }
  })
  // first-fit decreasing height: tall parts open shelves, small parts
  // then fill the leftover room on ANY sheet before a new one is started
  sized.sort((p, q) => q.h - p.h || q.w - p.w)

  interface Shelf {
    y: number
    h: number
    x: number
  }
  const sheets: PackedSheet[] = []
  const shelves = new Map<PackedSheet, Shelf[]>()
  for (const { part, b, w, h } of sized) {
    if (w > usableW || h > usableH) {
      // oversize: its own sheet, sized to the part (the audit reports it)
      sheets.push({
        width: w + 2 * SHEET_MARGIN,
        height: h + 2 * SHEET_MARGIN,
        parts: [{ part, dx: SHEET_MARGIN - b.minX, dy: SHEET_MARGIN - b.minY }],
      })
      continue
    }
    const put = (sheet: PackedSheet, shelf: Shelf) => {
      sheet.parts.push({ part, dx: shelf.x - b.minX, dy: shelf.y - b.minY })
      shelf.x += w + PART_GAP
    }
    let done = false
    // 1. an existing shelf with room
    for (const [sheet, list] of shelves) {
      const shelf = list.find((sh) => h <= sh.h && sh.x + w <= SHEET_WIDTH - SHEET_MARGIN)
      if (shelf) {
        put(sheet, shelf)
        done = true
        break
      }
    }
    // 2. a new shelf on a sheet with height to spare
    if (!done) {
      for (const [sheet, list] of shelves) {
        const last = list[list.length - 1]
        const y = last.y + last.h + PART_GAP
        if (y + h <= SHEET_HEIGHT - SHEET_MARGIN) {
          const shelf = { y, h, x: SHEET_MARGIN }
          list.push(shelf)
          put(sheet, shelf)
          done = true
          break
        }
      }
    }
    // 3. a fresh sheet
    if (!done) {
      const sheet: PackedSheet = { width: SHEET_WIDTH, height: SHEET_HEIGHT, parts: [] }
      const shelf = { y: SHEET_MARGIN, h, x: SHEET_MARGIN }
      sheets.push(sheet)
      shelves.set(sheet, [shelf])
      put(sheet, shelf)
    }
  }
  return sheets
}

/**
 * Render the flat-pack SVG document (mm units, hairline cut strokes):
 * the sheets stacked down the page, each with its edge drawn in green
 * for alignment (not a cut line).
 */
export function flatPackSvg(spec: AutomatonSpec): string {
  const sheets = packSheets(spec)
  const all = sheets.flatMap((s) => s.parts.map((p) => p.part))
  const cut: string[] = []
  const score: string[] = []
  const labels: string[] = []
  const edges: string[] = []
  let top = 0
  let docW = 0
  for (const [n, sheet] of sheets.entries()) {
    edges.push(
      `<rect x="0" y="${top}" width="${sheet.width}" height="${sheet.height}"/>`,
    )
    labels.push(
      `<text x="2" y="${top + 4}" font-size="3">sheet ${n + 1} of ${sheets.length} — ${sheet.width} × ${sheet.height} mm</text>`,
    )
    for (const { part, dx, dy } of sheet.parts) {
      const oy = dy + top
      cut.push(`<path d="${pathToSvg(translate(part.outline, dx, oy))}"/>`)
      for (const hole of part.holes) cut.push(`<path d="${pathToSvg(translate(hole, dx, oy))}"/>`)
      for (const line of part.engrave ?? [])
        score.push(`<path d="${openPathToSvg(translate(line, dx, oy))}"/>`)
      const pb = bounds(translate(part.outline, dx, oy))
      // tiny repeated parts (crown tooth tabs) get one grouped label
      const groupMatch = /^(crown-tooth-.*)-(\d+)$/.exec(part.name)
      if (groupMatch) {
        if (groupMatch[2] === '1') {
          const count = all.filter((q) => q.name.startsWith(`${groupMatch[1]}-`)).length
          labels.push(
            `<text x="${pb.minX}" y="${pb.minY - 1.5}" font-size="3">${groupMatch[1]} ×${count}</text>`,
          )
        }
      } else if (part.width >= 60 && part.height >= 30) {
        // panels carry their name on the piece, clear of edge joints and the centre
        const ly = pb.minY + (pb.maxY - pb.minY) * 0.3
        labels.push(
          `<text x="${(pb.minX + pb.maxX) / 2}" y="${ly.toFixed(2)}" text-anchor="middle" font-size="4">${part.name}</text>`,
        )
      } else {
        // everything else is named on the scrap just below it, cut short
        // so it never runs under the next part
        const room = Math.max(4, Math.floor((pb.maxX - pb.minX + PART_GAP - 3) / 1.7))
        const text = part.name.length > room ? `${part.name.slice(0, room - 1)}…` : part.name
        labels.push(
          `<text x="${pb.minX.toFixed(2)}" y="${(pb.maxY + 3.6).toFixed(2)}" font-size="3">${text}</text>`,
        )
      }
    }
    docW = Math.max(docW, sheet.width)
    top += sheet.height + SHEET_SPACING
  }
  const docH = top - SHEET_SPACING

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${docW}mm" height="${docH}mm" viewBox="0 0 ${docW} ${docH}">`,
    `<!-- ${spec.name} — flat-pack, kerf ${spec.export.kerf} mm, material ${spec.frame.materialThickness} mm, ${sheets.length} sheet(s). Red = cut through, blue = engrave/score on the surface, green = sheet edge (do not cut). -->`,
    `<g id="sheet-edges" fill="none" stroke="#00a000" stroke-width="0.1">`,
    ...edges,
    `</g>`,
    `<g id="cut" fill="none" stroke="#ff0000" stroke-width="0.1">`,
    ...cut,
    `</g>`,
    `<g id="score" fill="none" stroke="#0000ff" stroke-width="0.1">`,
    ...score,
    `</g>`,
    `<g id="engrave" fill="#0000ff" font-family="sans-serif">`,
    ...labels,
    `</g>`,
    `</svg>`,
  ].join('\n')
}
