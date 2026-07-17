import type { AutomatonSpec, CamSpec } from './types'
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

function parseCam(raw: unknown, i: number): CamSpec {
  const c = raw as Record<string, unknown>
  if (typeof c !== 'object' || c === null) fail(`cam[${i}] must be an object`)
  const base = {
    id: str(c.id, `cam[${i}].id`),
    position: num(c.position, `cam[${i}].position`, 0, 1),
    phaseDeg: num(c.phaseDeg, `cam[${i}].phaseDeg`, 0, 360),
    thickness: num(c.thickness, `cam[${i}].thickness`, 1, 30),
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
  if (!Array.isArray(o.characters)) fail('characters must be an array')
  const crank = mech.crank as Record<string, unknown>
  if (typeof crank !== 'object' || crank === null) fail('mechanism.crank missing')
  const exp = o.export as Record<string, unknown>
  if (typeof exp !== 'object' || exp === null) fail('export settings missing')

  const cams = mech.cams.map(parseCam)
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
  const rodIds = new Set(pushrods.map((r) => r.id))
  if (rodIds.size !== pushrods.length) fail('pushrod ids must be unique')

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

  return {
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
      cams,
      pushrods,
    },
    characters,
    export: {
      kerf: num(exp.kerf, 'export.kerf', 0, 1),
      fdmClearance: num(exp.fdmClearance, 'export.fdmClearance', 0, 1),
    },
  }
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
