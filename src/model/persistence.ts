import type { AutomatonSpec, CamSpec, GearTrainSpec } from './types'
import { layshaftY } from './types'
import { simplestAutomaton } from './templates'

/**
 * Design persistence: JSON download/import, localStorage auto-save, and
 * shareable URLs. All entry points funnel through `parseSpec`, which
 * validates untrusted input (imported files, URL fragments, stale
 * localStorage) before it can reach the store.
 */

const STORAGE_KEY = 'automaton-designer.spec.v1'
const HASH_PREFIX = '#d='

class SpecParseError extends Error {}

function fail(msg: string): never {
  throw new SpecParseError(msg)
}

function num(v: unknown, name: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${name} must be a finite number`)
  if (v < min || v > max) fail(`${name} out of range [${min}, ${max}]`)
  return v
}

function str(v: unknown, name: string): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 200) fail(`${name} must be a short string`)
  return v
}

function parseCam(raw: unknown, i: number, hasGearTrain: boolean): CamSpec {
  const c = raw as Record<string, unknown>
  if (typeof c !== 'object' || c === null) fail(`cam[${i}] must be an object`)
  if (c.shaft !== undefined && c.shaft !== 'crank' && c.shaft !== 'lay')
    fail(`cam[${i}].shaft unknown`)
  if (c.shaft === 'lay' && !hasGearTrain)
    fail(`cam[${i}] sits on the layshaft but the design has no gear train`)
  const base = {
    id: str(c.id, `cam[${i}].id`),
    position: num(c.position, `cam[${i}].position`, 0, 1),
    phaseDeg: num(c.phaseDeg, `cam[${i}].phaseDeg`, 0, 360),
    thickness: num(c.thickness, `cam[${i}].thickness`, 1, 30),
    // only stamp the field when it carries information — keeps round-trips exact
    ...(c.shaft !== undefined ? { shaft: c.shaft as 'crank' | 'lay' } : {}),
  }
  switch (c.kind) {
    case 'eccentric':
      return {
        ...base,
        kind: 'eccentric',
        radius: num(c.radius, `cam[${i}].radius`, 5, 60),
        eccentricity: num(c.eccentricity, `cam[${i}].eccentricity`, 0.5, 40),
      }
    case 'petal':
      return {
        ...base,
        kind: 'petal',
        baseRadius: num(c.baseRadius, `cam[${i}].baseRadius`, 5, 60),
        lift: num(c.lift, `cam[${i}].lift`, 0.5, 40),
        lobes: Math.round(num(c.lobes, `cam[${i}].lobes`, 2, 12)),
      }
    case 'snail':
      return {
        ...base,
        kind: 'snail',
        baseRadius: num(c.baseRadius, `cam[${i}].baseRadius`, 5, 60),
        lift: num(c.lift, `cam[${i}].lift`, 0.5, 40),
      }
    default:
      fail(`cam[${i}].kind unknown`)
  }
}

/**
 * Validate untrusted JSON into an AutomatonSpec. Throws with a readable
 * message on anything malformed; never lets dangling references through.
 */
export function parseSpec(json: string): AutomatonSpec {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    fail('not valid JSON')
  }
  const o = raw as Record<string, unknown>
  if (typeof o !== 'object' || o === null) fail('design must be an object')

  const frame = o.frame as Record<string, unknown>
  if (typeof frame !== 'object' || frame === null) fail('frame missing')
  const mech = o.mechanism as Record<string, unknown>
  if (typeof mech !== 'object' || mech === null) fail('mechanism missing')
  if (!Array.isArray(mech.cams) || mech.cams.length < 1 || mech.cams.length > 8)
    fail('mechanism.cams must be a non-empty array')
  if (!Array.isArray(mech.pushrods)) fail('mechanism.pushrods must be an array')
  // rockers/spinners were added after v1 — older saves simply omit them
  const rawRockers = mech.rockers === undefined ? [] : mech.rockers
  const rawSpinners = mech.spinners === undefined ? [] : mech.spinners
  if (!Array.isArray(rawRockers)) fail('mechanism.rockers must be an array')
  if (!Array.isArray(rawSpinners)) fail('mechanism.spinners must be an array')
  if (!Array.isArray(o.characters)) fail('characters must be an array')
  const crank = mech.crank as Record<string, unknown>
  if (typeof crank !== 'object' || crank === null) fail('mechanism.crank missing')
  const exp = o.export as Record<string, unknown>
  if (typeof exp !== 'object' || exp === null) fail('export settings missing')

  // optional gear train — every mesh property is validated, not trusted
  let gearTrain: GearTrainSpec | undefined
  if (mech.gearTrain !== undefined && mech.gearTrain !== null) {
    const g = mech.gearTrain as Record<string, unknown>
    if (typeof g !== 'object') fail('gearTrain must be an object')
    gearTrain = {
      teethDrive: Math.round(num(g.teethDrive, 'gearTrain.teethDrive', 8, 80)),
      teethDriven: Math.round(num(g.teethDriven, 'gearTrain.teethDriven', 8, 40)),
      module: num(g.module, 'gearTrain.module', 1, 4),
      position: num(g.position, 'gearTrain.position', 0, 1),
    }
    if (gearTrain.teethDrive % gearTrain.teethDriven !== 0)
      fail('gearTrain ratio must be an integer (teethDrive divisible by teethDriven)')
  }

  const cams = mech.cams.map((raw, i) => parseCam(raw, i, gearTrain !== undefined))
  const camIds = new Set(cams.map((c) => c.id))
  if (camIds.size !== cams.length) fail('cam ids must be unique')

  const pushrods = mech.pushrods.map((raw, i) => {
    const r = raw as Record<string, unknown>
    if (typeof r !== 'object' || r === null) fail(`pushrod[${i}] must be an object`)
    const rod = {
      id: str(r.id, `pushrod[${i}].id`),
      camId: str(r.camId, `pushrod[${i}].camId`),
      rodWidth: num(r.rodWidth, `pushrod[${i}].rodWidth`, 2, 20),
      padWidth: num(r.padWidth, `pushrod[${i}].padWidth`, 2, 60),
      length: num(r.length, `pushrod[${i}].length`, 10, 300),
    }
    if (!camIds.has(rod.camId)) fail(`pushrod[${i}] references unknown cam ${rod.camId}`)
    return rod
  })
  const rockers = rawRockers.map((raw, i) => {
    const r = raw as Record<string, unknown>
    if (typeof r !== 'object' || r === null) fail(`rocker[${i}] must be an object`)
    const rocker = {
      id: str(r.id, `rocker[${i}].id`),
      camId: str(r.camId, `rocker[${i}].camId`),
      leverLength: num(r.leverLength, `rocker[${i}].leverLength`, 5, 200),
      padWidth: num(r.padWidth, `rocker[${i}].padWidth`, 2, 60),
    }
    if (!camIds.has(rocker.camId)) fail(`rocker[${i}] references unknown cam ${rocker.camId}`)
    return rocker
  })

  const spinners = rawSpinners.map((raw, i) => {
    const sp = raw as Record<string, unknown>
    if (typeof sp !== 'object' || sp === null) fail(`spinner[${i}] must be an object`)
    const base = {
      id: str(sp.id, `spinner[${i}].id`),
      position: num(sp.position, `spinner[${i}].position`, 0, 1),
      ratio: num(sp.ratio, `spinner[${i}].ratio`, 0.2, 10),
      wheelRadius: num(sp.wheelRadius, `spinner[${i}].wheelRadius`, 4, 60),
      platformRadius: num(sp.platformRadius, `spinner[${i}].platformRadius`, 5, 120),
    }
    if (sp.drive === undefined || sp.drive === 'friction') return base
    if (sp.drive === 'geneva') {
      if (base.wheelRadius < 8)
        fail(`spinner[${i}]: geneva pin circle radius must be at least 8`)
      return {
        ...base,
        drive: 'geneva' as const,
        stations: Math.round(num(sp.stations, `spinner[${i}].stations`, 3, 12)),
      }
    }
    if (sp.drive !== 'bevel') fail(`spinner[${i}].drive unknown`)
    const crownTeeth = Math.round(num(sp.crownTeeth, `spinner[${i}].crownTeeth`, 8, 48))
    const pinionTeeth = Math.round(num(sp.pinionTeeth, `spinner[${i}].pinionTeeth`, 6, 24))
    if (pinionTeeth >= crownTeeth)
      fail(`spinner[${i}]: the pinion must be smaller than the crown gear`)
    return {
      ...base,
      drive: 'bevel' as const,
      crownTeeth,
      pinionTeeth,
      module: num(sp.module, `spinner[${i}].module`, 1, 4),
    }
  })

  const rodIds = new Set([
    ...pushrods.map((r) => r.id),
    ...rockers.map((r) => r.id),
    ...spinners.map((sp) => sp.id),
  ])
  if (rodIds.size !== pushrods.length + rockers.length + spinners.length)
    fail('output channel ids must be unique')

  const characters = o.characters.map((raw, i) => {
    const c = raw as Record<string, unknown>
    if (typeof c !== 'object' || c === null) fail(`character[${i}] must be an object`)
    const ch = {
      id: str(c.id, `character[${i}].id`),
      channelId: str(c.channelId, `character[${i}].channelId`),
      kind: 'block' as const,
      width: num(c.width, `character[${i}].width`, 4, 100),
      height: num(c.height, `character[${i}].height`, 4, 150),
      depth: num(c.depth, `character[${i}].depth`, 4, 100),
      color: /^#[0-9a-fA-F]{6}$/.test(String(c.color)) ? String(c.color) : '#4f8fe0',
      label: str(c.label, `character[${i}].label`),
    }
    if (!rodIds.has(ch.channelId)) fail(`character[${i}] rides unknown channel ${ch.channelId}`)
    return ch
  })

  const spec: AutomatonSpec = {
    name: str(o.name, 'name'),
    frame: {
      width: num(frame.width, 'frame.width', 50, 600),
      depth: num(frame.depth, 'frame.depth', 30, 400),
      height: num(frame.height, 'frame.height', 30, 400),
      materialThickness: num(frame.materialThickness, 'frame.materialThickness', 1, 12),
    },
    mechanism: {
      shaftDiameter: num(mech.shaftDiameter, 'mechanism.shaftDiameter', 2, 20),
      shaftHeight: num(mech.shaftHeight, 'mechanism.shaftHeight', 10, 380),
      crank: {
        armLength: num(crank.armLength, 'crank.armLength', 5, 100),
        handleLength: num(crank.handleLength, 'crank.handleLength', 5, 100),
        handleDiameter: num(crank.handleDiameter, 'crank.handleDiameter', 3, 40),
      },
      gearTrain,
      cams,
      pushrods,
      rockers,
      spinners,
    },
    characters,
    export: {
      kerf: num(exp.kerf, 'export.kerf', 0, 1),
      fdmClearance: num(exp.fdmClearance, 'export.fdmClearance', 0, 1),
    },
  }
  if (spec.mechanism.gearTrain && layshaftY(spec.mechanism) < 8)
    fail('gear train too large: the layshaft would sit below the box floor')
  return spec
}

export function serializeSpec(spec: AutomatonSpec): string {
  return JSON.stringify(spec, null, 2)
}

/** Unicode-safe base64url of the design, small enough for a URL fragment. */
export function encodeSpecForUrl(spec: AutomatonSpec): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSpecFromUrl(encoded: string): AutomatonSpec {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  let binary: string
  try {
    binary = atob(b64)
  } catch {
    fail('share link is corrupted')
  }
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return parseSpec(new TextDecoder().decode(bytes))
}

export function shareUrl(spec: AutomatonSpec): string {
  return `${location.origin}${location.pathname}${HASH_PREFIX}${encodeSpecForUrl(spec)}`
}

export function saveToLocalStorage(spec: AutomatonSpec) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spec))
  } catch {
    // storage full or unavailable — auto-save is best-effort
  }
}

export function clearLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Design to open on boot: a share link takes priority, then the auto-saved
 * design, then the default template. Invalid data falls through silently.
 */
export function loadInitialSpec(): AutomatonSpec {
  if (typeof window !== 'undefined') {
    if (window.location.hash.startsWith(HASH_PREFIX)) {
      try {
        return decodeSpecFromUrl(window.location.hash.slice(HASH_PREFIX.length))
      } catch {
        // corrupted link — fall through
      }
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return parseSpec(stored)
    } catch {
      // corrupted auto-save — fall through
    }
  }
  return structuredClone(simplestAutomaton)
}
