import type { AutomatonSpec } from '../model/types'
import { interiorWidth, outputChannels } from '../model/types'
import { FIGURE_SHAPES } from '../model/figures'
import { PROP_SHAPES } from '../model/props'
import { generateParts, packSheets, pushrodLayers, SHEET_HEIGHT, SHEET_WIDTH } from './svgFlatPack'
import { buildPrintParts } from './stlExport'
import { HINGE_GAP, STITCH_HOLE } from '../scene/flyerLayout'
import { figureStack } from '../scene/reliefLayout'
import { contactOffset } from '../scene/spinnerLayout'

/**
 * The build guide: everything a maker needs besides the cut/print file —
 * a parts list, a shopping list, and assembly steps — generated from
 * the SAME spec and the SAME part generators as the exports, so the
 * guide can never describe a part the file does not contain.
 */

const HINGE_TAPE = {
  item: 'For the wing hinges: cloth tape (bookbinding or medical), about 300 mm — OR thin soft wire (0.4–0.6 mm) or strong thread, about 500 mm',
  detail:
    'Tape is stuck across each gap on the underside. Wire or thread is looped through the pairs of small stitch holes beside each joint. Either works; you only need one.',
}

export type BuildMethod = 'laser' | 'print'

export type PartGroup = 'Box' | 'Mechanism' | 'Figures' | 'Scenery'

export interface PartRow {
  /** Label as engraved on the sheet / named in the STL. */
  name: string
  /** What the part is, in plain words. */
  label: string
  qty: number
  /** Bounding size, mm. */
  size: string
  group: PartGroup
}

export interface HardwareRow {
  item: string
  detail: string
}

export interface GuideStep {
  title: string
  body: string[]
}

export interface BuildGuide {
  method: BuildMethod
  parts: PartRow[]
  hardware: HardwareRow[]
  tools: string[]
  steps: GuideStep[]
  /** Laser: the sheet size parts are nested onto. Print: largest part footprint. */
  footprint: { width: number; height: number }
  /** Laser: how many sheets the kit needs (0 for the print route). */
  sheets: number
}

function groupOf(name: string): PartGroup {
  if (/^(frame-)?(side-|wall-|stage|bottom)/.test(name)) return 'Box'
  if (name.startsWith('prop-')) return 'Scenery'
  if (/^(figure-|detail-|depth-|limb-|axle-|wire-|hinge-stand|body-|stand-|post-|wing-)/.test(name)) return 'Figures'
  return 'Mechanism'
}

const LABELS: [RegExp, string][] = [
  [/^(frame-)?side-/, 'Side wall (carries the shaft)'],
  [/^(frame-)?wall-/, 'Front / back wall'],
  [/^(frame-)?stage/, 'Stage plate (top)'],
  [/^(frame-)?bottom/, 'Floor panel'],
  [/^camshaft/, 'Camshaft'],
  [/^layshaft/, 'Layshaft (second shaft)'],
  [/^crank/, 'Crank'],
  [/^pushrod-/, 'Pushrod'],
  [/^cam-/, 'Cam'],
  [/^gear-|^drive-gear|^driven-gear/, 'Gear'],
  [/^rocker-lever/, 'Rocker lever'],
  [/^rocker-post/, 'Rocker fulcrum post'],
  [/^rocker-link/, 'Rocker link rod'],
  [/^geneva-wheel/, 'Geneva wheel'],
  [/^geneva-driver/, 'Geneva driver'],
  [/^geneva-pin/, 'Geneva drive pin'],
  [/^spinner-platform/, 'Turntable platform'],
  [/^spinner-driven/, 'Driven disc (bottom of the spindle)'],
  [/^spinner-wheel/, 'Friction drive wheel'],
  [/^spinner-spindle/, 'Spindle with its drive'],
  [/^pinion/, 'Pinion gear'],
  [/^crown-tooth/, 'Crown gear tooth'],
  [/^crown/, 'Crown gear'],
  [/^linkage-crank/, 'Linkage crank disc'],
  [/^linkage-coupler/, 'Linkage coupler with wand'],
  [/^linkage-rocker/, 'Linkage rocker bar'],
  [/^linkage-post/, 'Linkage pivot post'],
  [/^linkage-pin/, 'Linkage pin'],
  [/^hinge-stand/, 'Hinge stand'],
  [/^body-/, 'Body plate'],
  [/^post-/, 'Body post'],
  [/^wing-/, 'Wing plate'],
  [/^figure-stand/, 'Body stand'],
  [/^figure-.*-half[12]$/, 'Figure half (glue the pair back to back)'],
  [/^figure-/, 'Figure'],
  [/^detail-/, 'Raised plate (glued onto the figure)'],
  [/^depth-/, 'Depth layer'],
  [/^prop-/, 'Scenery'],
  [/^axle-/, 'Limb axle'],
  [/^wire-/, 'Limb wire crank'],
  [/^limb-/, 'Limb plate'],
]

function labelOf(name: string): string {
  return LABELS.find(([re]) => re.test(name))?.[1] ?? 'Part'
}

/** Collapse laminations / numbered repeats into one row with a quantity. */
function baseName(name: string): string {
  return name.replace(/-layer\d+$/, '').replace(/^(crown-tooth-.*)-\d+$/, '$1')
}

function collect(raw: { name: string; w: number; h: number }[]): PartRow[] {
  const rows = new Map<string, PartRow>()
  for (const p of raw) {
    const key = baseName(p.name)
    const row = rows.get(key)
    if (row) row.qty++
    else
      rows.set(key, {
        name: key,
        label: labelOf(key),
        qty: 1,
        size: `${Math.round(p.w)} × ${Math.round(p.h)}`,
        group: groupOf(key),
      })
  }
  const order: PartGroup[] = ['Box', 'Mechanism', 'Figures', 'Scenery']
  return [...rows.values()].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
}

/** One line per kind of scenery and row, with a count — not one identical line per piece. */
function sceneryLines(spec: AutomatonSpec): string[] {
  const groups = new Map<string, number>()
  for (const p of spec.props ?? []) {
    const key = `${PROP_SHAPES[p.shape]?.label.toLowerCase() ?? 'scenery piece'}|${p.row}`
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return [...groups].map(([key, n]) => {
    const [label, row] = key.split('|')
    const where = row === 'front' ? 'front row of stage slots (nearest you)' : 'back row of stage slots'
    return n === 1
      ? `Press the tabs of the ${label} into the ${where}.`
      : `Press the tabs of the ${n} ${label} pieces into the ${where}; each fits only its own slots.`
  })
}

/** Everything on the shaft, left to right, with its distance from the left inner wall. */
export function shaftOrder(spec: AutomatonSpec): { what: string; mm: number }[] {
  const inner = interiorWidth(spec.frame)
  const m = spec.mechanism
  const items: { what: string; position: number }[] = [
    ...m.cams
      .filter((c) => c.shaft !== 'lay')
      .map((c) => ({ what: `${c.kind} cam “${c.id}”`, position: c.position })),
    ...m.spinners.map((s) => ({
      what:
        s.drive === 'bevel'
          ? `crown gear for “${s.id}”`
          : s.drive === 'geneva'
            ? `Geneva driver for “${s.id}”`
            : `friction wheel for “${s.id}”`,
      position: s.position,
    })),
    ...(m.linkages ?? []).map((l) => ({
      what: `linkage crank disc “${l.id}”`,
      position: l.position,
    })),
    ...(m.gearTrain ? [{ what: 'drive gear', position: m.gearTrain.position }] : []),
  ]
  return items
    .sort((a, b) => a.position - b.position)
    .map((i) => ({ what: i.what, mm: Math.round(i.position * inner) }))
}

export function buildGuide(spec: AutomatonSpec, method: BuildMethod): BuildGuide {
  const { frame, mechanism: m } = spec
  const t = frame.materialThickness
  const channels = outputChannels(spec)
  const laser = method === 'laser'
  const articulated = spec.characters.filter((c) => c.kind === 'articulated')
  const flyers = spec.characters.filter((c) => c.kind === 'flyer')
  const shaftLen = frame.width + 24

  // ---- parts, straight from the generators ----
  let parts: PartRow[]
  let footprint: { width: number; height: number }
  let sheets = 0
  if (laser) {
    parts = collect(generateParts(spec).map((p) => ({ name: p.name, w: p.width, h: p.height })))
    sheets = packSheets(spec).length
    footprint = { width: SHEET_WIDTH, height: SHEET_HEIGHT }
  } else {
    const built = buildPrintParts(spec).map((p) => {
      p.geometry.computeBoundingBox()
      const bb = p.geometry.boundingBox!
      const dims = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].sort(
        (a, b) => b - a,
      )
      return { name: p.name, w: dims[0], h: dims[1] }
    })
    parts = collect(built)
    footprint = {
      width: Math.ceil(Math.max(...built.map((p) => p.w))),
      height: Math.ceil(Math.max(...built.map((p) => p.h))),
    }
  }

  // ---- shopping list ----
  const hardware: HardwareRow[] = []
  if (laser) {
    hardware.push({
      item: `${t} mm basswood sheet, ${SHEET_WIDTH} × ${SHEET_HEIGHT} mm × ${sheets}`,
      detail:
        'Every part is nested onto sheets of this size and checked for basswood: no thin necks, no holes near edges. Plywood or MDF of the same thickness also works.',
    })
    hardware.push({
      item: `${m.shaftDiameter} mm round dowel, ${shaftLen} mm long`,
      detail:
        'The camshaft. Sand a flat along it to match the D-shaped holes (or glue the cams where the guide says).',
    })
    hardware.push({
      item: `${m.shaftDiameter} mm dowel offcut, ${m.crank.handleLength} mm`,
      detail: 'The crank handle — presses into the round hole of the crank arm.',
    })
    if (m.gearTrain)
      hardware.push({
        item: `${m.shaftDiameter} mm round dowel, ${frame.width + 4} mm long`,
        detail: 'The layshaft, in the lower pair of bearing holes.',
      })
    for (const sp of m.spinners)
      hardware.push({
        item: `6 mm dowel, about ${Math.round(frame.height + t + 12 - m.shaftHeight)} mm`,
        detail: `Spindle for “${sp.id}”: its drive part is glued on the bottom end, it runs up through the stage, and the platform is glued on top. Trim to fit.`,
      })
    if ((m.linkages ?? []).length > 0)
      hardware.push({
        item: `3 mm pins × ${(m.linkages ?? []).length * 3}`,
        detail: 'Linkage pivots — bamboo skewer or 3 mm dowel, about 10 mm each.',
      })
    if (m.rockers.length > 0)
      hardware.push({
        item: `Small pins or brads × ${m.rockers.length * 2}`,
        detail: 'Rocker pivots: lever on its post, and the figure on its hinge stand.',
      })
    if (articulated.length > 0)
      hardware.push({
        item: '2 mm steel or brass wire, about 300 mm',
        detail: 'Bent into the limb cranks. Plus 3 mm dowel for the limb axles.',
      })
    hardware.push({ item: 'Wood glue (PVA)', detail: 'For the box joints, laminations and figures.' })
    if (flyers.length > 0) hardware.push(HINGE_TAPE)
    hardware.push({
      item: 'Candle wax or dry soap',
      detail: 'Rubbed on cam edges and inside guide slots so everything glides.',
    })
  } else {
    hardware.push({
      item: 'PLA or PETG filament, roughly 150–250 g',
      detail: `Every part prints flat without supports. Largest part: ${footprint.width} × ${footprint.height} mm.`,
    })
    if (m.rockers.length > 0)
      hardware.push({
        item: `Small pins × ${m.rockers.length * 2}`,
        detail:
          'Rocker pivots: lever on its post, and the figure on its hinge stand. Offcuts of 1.75 mm filament work well.',
      })
    else
      hardware.push({
        item: 'Nothing else to buy',
        detail: 'The box, shaft, crank and every moving part are in the STL.',
      })
    if (flyers.length > 0) hardware.push(HINGE_TAPE)
    hardware.push({
      item: 'Superglue (optional)',
      detail: 'A drop on the box joints and figures once everything runs freely.',
    })
    hardware.push({
      item: 'Candle wax or dry lubricant',
      detail: 'On cam edges and in guide slots for a smooth, quiet crank.',
    })
  }

  const tools = laser
    ? ['Laser cutter (or a cutting service)', 'Fine sandpaper', 'Small saw for the dowels', 'Clamps or masking tape']
    : ['FDM 3D printer', 'Flush cutters or a craft knife', 'Fine sandpaper or a small file']

  // ---- assembly ----
  const steps: GuideStep[] = []

  steps.push(
    laser
      ? {
          title: 'Cut the parts',
          body: [
            `Load ${t} mm basswood and cut the SVG one sheet at a time. Red lines cut through. Blue is scored lightly on the surface at low power: the detail lines on the figures and the part labels. Green rectangles mark each sheet's edge and are not cut.`,
            'Lay parts with long thin shapes along the grain where you can — basswood is strongest that way.',
            `The file is compensated for a ${spec.export.kerf} mm kerf. If joints come out loose or too tight, change the kerf setting and re-export.`,
            'Lightly sand the scorched edges. Keep the small parts together in a tray.',
          ],
        }
      : {
          title: 'Print the parts',
          body: [
            'Slice the STL as it is laid out: every part already lies flat on the bed. If the plate is too small, split the parts in your slicer and print in batches.',
            '0.2 mm layers, 3 walls, 20% infill, no supports.',
            `Holes carry ${spec.export.fdmClearance} mm clearance. If parts are too tight or too loose on your printer, change the clearance setting and re-export.`,
          ],
        },
  )

  const pushrods = channels.filter((c) => c.kind === 'lift')
  if (laser && pushrods.length > 0) {
    const layers = pushrodLayers(pushrods[0].kind === 'lift' ? pushrods[0].pushrod.rodWidth : 6, t)
    if (layers > 1)
      steps.push({
        title: 'Laminate the pushrods',
        body: [
          `Each pushrod is ${layers} identical T-shaped layers. Glue them face to face, edges flush, and clamp until dry.`,
          'Sand the rod lightly so it slides freely through its square stage slot.',
        ],
      })
  }

  if (laser && spec.mechanism.cams.some((c) => Math.round(c.thickness / t) > 1))
    steps.push({
      title: 'Laminate the cams',
      body: [
        'Each cam is cut as two or more identical discs. Glue them face to face with the D-shaped holes lined up — slide them onto the shaft while the glue sets to keep them square.',
      ],
    })

  steps.push({
    title: 'Dry-fit the box',
    body: [
      'Slot the two side walls (the ones with the round bearing holes) into the front and back walls. The finger joints only fit one way.',
      'Drop the floor panel inside. Leave the stage plate off for now and do not glue anything yet.',
    ],
  })

  if (laser && m.spinners.some((sp) => sp.drive === 'bevel'))
    steps.push({
      title: 'Build the crown gear',
      body: [
        'The crown gear is a disc with a ring of slots and a set of small tooth tabs. Push one tab through every slot, all standing out of the SAME face, with a dab of glue on each.',
        'Check the tabs stand square to the disc and let it dry before it goes on the shaft.',
      ],
    })

  const order = shaftOrder(spec)
  steps.push({
    title: 'Load the camshaft',
    body: [
      'Push the shaft through the left side wall, thread the parts on in this order, then push the shaft on through the right wall:',
      ...order.map(
        (o, i) => `${i + 1}. ${o.what} — centre ${o.mm} mm from the inside of the left wall`,
      ),
      'The D-shaped holes lock each part to the flat on the shaft, so the timing between cams is set for you.',
      'Leave about 12 mm of shaft sticking out on the crank side.',
    ],
  })

  if (m.gearTrain)
    steps.push({
      title: 'Fit the layshaft',
      body: [
        'Thread the driven gear and any layshaft cams onto the second shaft, in the lower bearing holes.',
        'Line the two gears up so their teeth mesh along the full width. They should turn without binding.',
      ],
    })

  for (const ch of channels) {
    if (ch.kind === 'lift')
      steps.push({
        title: `Pushrod “${ch.id}”`,
        body: [
          `Stand the pushrod on cam “${ch.cam.id}” with its flat pad resting on the cam edge.`,
          'When the stage goes on, the rod passes up through the matching square slot.',
        ],
      })
    else if (ch.kind === 'tilt')
      steps.push({
        title: `Rocker “${ch.id}”`,
        body: [
          'Glue the fulcrum post to the floor. Pin the lever to the top of the post so it see-saws freely.',
          `Rest the lever's pad on cam “${ch.cam.id}”. Hook the link rod to the lever; it rises through the stage slot to push the figure.`,
        ],
      })
    else if (ch.kind === 'spin') {
      const drive = ch.spinner.drive ?? 'friction'
      const body: string[] = []
      if (drive === 'bevel') {
        if (laser)
          body.push(
            'Glue the pinion gear onto the bottom end of the spindle dowel.',
          )
        else body.push('The spindle is printed with its pinion gear on the bottom end.')
        body.push('Stand the spindle so the pinion meshes with the teeth standing out of the crown gear.')
      } else if (drive === 'geneva') {
        body.push(
          laser
            ? 'Glue the star-shaped Geneva wheel onto the bottom end of the spindle dowel.'
            : 'The spindle is printed with the star-shaped Geneva wheel on its bottom end.',
          'Stand the spindle so the finger of the driver on the camshaft enters a slot of the star once per crank turn and pushes it on one step.',
        )
      } else {
        const off = Math.abs(Math.round(contactOffset(ch.spinner)))
        body.push(
          laser
            ? 'Glue the small driven disc onto the bottom end of the spindle dowel.'
            : 'The spindle is printed with its driven disc on the bottom end.',
          `Stand the spindle so the disc rests flat on the rim of the friction wheel, with the wheel about ${off} mm to one side of the spindle — never directly under it, or nothing turns. A rubber band stretched round the wheel rim adds grip.`,
        )
      }
      body.push(
        'The spindle comes UP through the round hole in the stage when the stage is fitted. Only then does the platform go on: press (or glue) it onto the top of the spindle. Do not fit the platform first — it will not pass through the hole.',
      )
      steps.push({ title: `Turntable “${ch.id}”`, body })
    }
    else
      steps.push({
        title: `Linkage “${ch.id}”`,
        body: [
          'Glue the pivot post to the floor behind the shaft. Pin the rocker bar to the top of the post.',
          'Pin the coupler to the crank disc and to the free end of the rocker bar. All three pins must turn freely.',
          'The wand on the coupler rises through the long slot in the stage and carries the figure.',
        ],
      })
  }

  steps.push({
    title: 'Fit the stage and test',
    body: [
      `Lower the stage plate over the ${[pushrods.length > 0 || channels.some((c) => c.kind === 'tilt') ? 'rods' : '', m.spinners.length > 0 ? 'spindles' : '', (m.linkages ?? []).length > 0 ? 'wands' : ''].filter(Boolean).join(', ')} and press it onto the wall tabs.${m.spinners.length > 0 ? ' Now fit each turntable platform onto the top of its spindle.' : ''}`,
      laser
        ? 'Push the crank arm onto the shaft end, press the handle dowel into its round hole, and turn slowly. Everything should move without sticking.'
        : 'Push the crank (arm and handle are one printed piece) onto the shaft end and turn slowly. Everything should move without sticking.',
      'If something binds: sand the slot or rod a little and add wax. Do not glue the stage until it all runs smoothly.',
    ],
  })

  if (spec.characters.length > 0) {
    const body: string[] = []
    for (const c of spec.characters) {
      const ch = channels.find((x) => x.id === c.channelId)
      const what =
        c.kind === 'silhouette'
          ? `the ${FIGURE_SHAPES[c.shape ?? '']?.label.toLowerCase() ?? 'figure'} “${c.label}”`
          : `“${c.label}”`
      if (!ch) continue
      if (c.kind === 'flyer') {
        body.push(
          `Build ${what}: press the post's lower tab into its stage slot and the body plate onto the upper tab, nose to the front. Check the body sits level, then glue.`,
          `How the wings connect: every wing plate is HINGED to its neighbour — the inner plate to the body${c.flyer && c.flyer.left.length > 1 ? ', the outer plate to the inner plate' : ''} — with a ${HINGE_GAP} mm gap between them so they can fold. Nothing else holds a wing: it simply rests on top of its pushrod. Choose ONE of the two hinge methods below.`,
          `Hinge method A — tape (quickest). Turn the body and wing plates upside down on the table and line them up as they will sit, with a ${HINGE_GAP} mm gap at every joint (two coins on edge make a good spacer). Stick a strip of cloth tape along each gap, pressing it onto both plates but NOT down into the gap. Trim the ends flush. Turn it over: each wing should drop under its own weight when you lift and release it.`,
          `Hinge method B — wire or thread loops (no tape, lasts longer). The small ${STITCH_HOLE} mm holes beside every joint are stitch holes: each hole faces a partner across the gap. With the plates ${HINGE_GAP} mm apart, pass a 40 mm piece of thin soft wire (0.4–0.6 mm) or strong thread down through one hole and up through its partner, then twist or knot the ends underneath, leaving the loop slack enough for the wing to fold both ways. Do every pair. Snip the tails and press them flat.`,
          'Check each hinge: hold the body level and lift a wing tip about 15 mm. It must fall back the moment you let go. If it sticks, the tape is too tight in the gap or the loop is twisted too tight — loosen it.',
          'Round the top of each pushrod with sandpaper so it is a smooth dome. Rest each wing plate on its rod — gravity keeps it there. Do not glue or tie the wings to the rods: the rod tip has to slide a little under the wing as it rises.',
        )
        continue
      }
      if (c.kind === 'articulated')
        body.push(
          laser
            ? `Build ${what}: glue the body plate to its stand, and the stand to the top of “${ch.id}”. Cut a 3 mm dowel axle for each limb, push it through the body, and fit the limb plates on its ends. Bend each wire crank from the 2 mm wire and hook it from its rod to the limb.`
            : `Build ${what}: the body is printed with its stand — glue the stand to the top of “${ch.id}”. Push each printed axle through the body, fit the limb plates on its ends, and hook each printed wire crank from its rod to the limb.`,
        )
      else if (ch.kind === 'lift') body.push(`Glue ${what} to the top of pushrod “${ch.id}”.`)
      else if (ch.kind === 'tilt')
        body.push(
          `Glue the hinge stand to the stage, pin ${what} to it, and rest the figure on the link rod of “${ch.id}”.`,
        )
      else if (ch.kind === 'spin') body.push(`Glue ${what} onto the platform of “${ch.id}”.`)
      else body.push(`Glue ${what} to the tip of the wand of “${ch.id}”.`)
    }
    const names = parts.map((p) => p.name)
    const prep: string[] = []
    if (laser && names.some((n) => n.startsWith('depth-')))
      prep.push(
        'Build up the depth layers. Each figure plate is scored with the outline of the L1 layer: glue L1 inside that outline, then L2 inside the outline scored on L1, and so on. Do the same on the back with the “back” set, so the figure is rounded on both faces. On a winged creature the layers go on top of the body only.',
        'Let the stack dry under a weight, then soften the steps with sandpaper if you want a smoother body — or leave them crisp.',
      )
    if (laser)
      for (const c of spec.characters) {
        if (c.kind !== 'silhouette') continue
        const stack = figureStack(c)
        if (stack.details.length === 0) continue
        const stacked = stack.details.some((d) => d.rise > 0)
        prep.push(
          stacked
            ? `“${c.label}” is built up from ${stack.details.length} raised plates on each face, in order: ${stack.details
                .map((d, k) => `plate ${k + 1} (“detail-${c.id}-${k + 1}”) goes ${d.rise > 0 ? 'on top of the plate before it' : stack.levels.length > 0 ? 'on the top depth layer' : 'on the figure plate'}`)
                .join('; ')}. Each piece is scored with the outline of the piece that goes on it — glue inside that outline. Where a plate reaches right to the edge there is no scored line: line it up with the edge instead. Use the “front” set on one face and the “back” set on the other.`
            : `Glue the raised plate${stack.details.length > 1 ? 's' : ''} of “${c.label}” (“detail-${c.id}-…”) inside the outline${stack.details.length > 1 ? 's' : ''} scored for ${stack.details.length > 1 ? 'them' : 'it'} — on the ${stack.levels.length > 0 ? 'depth layer or figure plate that carries the outline' : 'figure plate'} — “front” on one face, “back” on the other.`,
        )
      }
    if (!laser && names.some((n) => /-half[12]$/.test(n)))
      prep.push(
        'Layered and rounded figures print as two halves (“half1” and “half2”), each flat on the bed with its shaped side up. Glue the two flat faces together, edges flush.',
      )
    if (prep.length > 0)
      steps.push({ title: 'Build up the figures', body: [...prep, 'Let everything dry before mounting.'] })
    steps.push({ title: 'Mount the figures', body })
  }

  if ((spec.props ?? []).length > 0)
    steps.push({
      title: 'Add the scenery',
      body: [
        ...sceneryLines(spec),
        'Turn the crank once more to check no figure touches the scenery.',
      ],
    })

  steps.push({
    title: 'Glue and finish',
    body: [
      'When it runs smoothly, take the stage off once more, glue the box joints, and refit it.',
      laser
        ? 'Paint or stain the figures and scenery — acrylics work well on basswood. Paint the pieces of a layered figure before gluing them together for crisp edges.'
        : 'Paint the figures and scenery, or reprint them in coloured filament.',
      'Turn the crank and enjoy!',
    ],
  })

  return { method, parts, hardware, tools, steps, footprint, sheets }
}

/** The whole guide as a self-contained printable HTML page. */
export function guideHtml(spec: AutomatonSpec, method: BuildMethod): string {
  const g = buildGuide(spec, method)
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const groups = [...new Set(g.parts.map((p) => p.group))]
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(spec.name)} — build guide</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;color:#222;max-width:780px;margin:32px auto;padding:0 20px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px;border-bottom:2px solid #e0a54f;padding-bottom:4px}
h3{font-size:14px;margin:14px 0 4px}.sub{color:#666;margin:0 0 16px}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #ddd;font-size:13px}
th{background:#f5f0e6}ol.steps>li{margin-bottom:14px;break-inside:avoid}ol.steps>li>b{font-size:15px}
ul{margin:4px 0;padding-left:20px}.box{display:inline-block;width:12px;height:12px;border:1.5px solid #555;margin-right:6px;vertical-align:-2px}
@media print{body{margin:0}h2{break-after:avoid}}
</style></head><body>
<h1>${esc(spec.name)}</h1>
<p class="sub">Build guide · ${g.method === 'laser' ? 'laser-cut' : '3D-printed'} · box ${spec.frame.width} × ${spec.frame.depth} × ${spec.frame.height} mm</p>
<h2>What you need</h2>
<table><tr><th>Item</th><th>Notes</th></tr>
${g.hardware.map((h) => `<tr><td><span class="box"></span>${esc(h.item)}</td><td>${esc(h.detail)}</td></tr>`).join('\n')}
</table>
<h3>Tools</h3><ul>${g.tools.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
<h2>Parts (${g.parts.reduce((n, p) => n + p.qty, 0)})</h2>
${groups
  .map(
    (group) => `<h3>${group}</h3><table><tr><th>Part</th><th>Name</th><th>Qty</th><th>Size (mm)</th></tr>
${g.parts
  .filter((p) => p.group === group)
  .map(
    (p) =>
      `<tr><td><span class="box"></span>${esc(p.label)}</td><td>${esc(p.name)}</td><td>${p.qty}</td><td>${p.size}</td></tr>`,
  )
  .join('\n')}
</table>`,
  )
  .join('\n')}
<h2>Assembly</h2>
<ol class="steps">
${g.steps.map((s) => `<li><b>${esc(s.title)}</b><ul>${s.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></li>`).join('\n')}
</ol>
</body></html>`
}
