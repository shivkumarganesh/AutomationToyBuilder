import { afterEach, describe, expect, it } from 'vitest'
import { templates } from '../model/templates'
import { composeToy } from '../model/catalog'
import { packSheets, flatPackSheetSvgs, flatPackSvg, CUT_COLOR, ENGRAVE_COLOR } from '../export/svgFlatPack'
import { detectAtomm, exportFiles, registerAtommExport, type ExportFile } from './atomm'

type G = { window?: unknown }
const g = globalThis as G
afterEach(() => {
  delete g.window
})

const valid = (f: ExportFile) => {
  expect(f.filename).toMatch(/^[^/\\]+\.[a-z0-9]+$/) // has an extension, no path separators
  expect(f.blob).toBeInstanceOf(Blob)
  expect(f.blob.size).toBeGreaterThan(0)
  expect(f.blob.size).toBeLessThan(100 * 1024 * 1024)
  expect(f.blob.type).not.toBe('')
}

describe('atomm: detecting the host', () => {
  it('is "outside" with no window, no SDK, a rejecting SDK, or one that never answers', async () => {
    expect(await detectAtomm()).toBe(false)
    g.window = {}
    expect(await detectAtomm()).toBe(false)
    // opened directly, the SDK loads but its calls reject immediately
    g.window = { atomm: { app: { getLocale: () => Promise.reject(new Error('not hosted')) } } }
    expect(await detectAtomm()).toBe(false)
    g.window = { atomm: { app: { getLocale: () => new Promise(() => {}) } } }
    expect(await detectAtomm(30)).toBe(false)
  })

  it('is "inside" when the platform answers', async () => {
    g.window = { atomm: { app: { getLocale: () => Promise.resolve('en') } } }
    expect(await detectAtomm()).toBe(true)
  })
})

describe('atomm: the export hook', () => {
  it('does nothing without the SDK, and registers exactly one export handler with it', async () => {
    const current = () => ({ spec: templates.simplest, method: 'laser' as const })
    expect(registerAtommExport(current)).toBe(false)
    const calls: [string, (ctx: { intent?: string }) => Promise<unknown>][] = []
    g.window = { atomm: { lifecycle: { on: (e: string, h: never) => calls.push([e, h]) } } }
    expect(registerAtommExport(current)).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('export')
    // the platform may call with either intent, or none at all
    for (const ctx of [{ intent: 'download' }, { intent: 'openInStudio' }, {}]) {
      const out = (await calls[0][1](ctx)) as ExportFile | ExportFile[]
      for (const f of Array.isArray(out) ? out : [out]) valid(f)
    }
  })

  it('reads the design at click time, not at registration', async () => {
    let spec = templates.simplest
    let handler: ((ctx: { intent?: string }) => Promise<unknown>) | undefined
    g.window = { atomm: { lifecycle: { on: (_e: string, h: never) => (handler = h) } } }
    registerAtommExport(() => ({ spec, method: 'laser' }))
    spec = templates.dragon
    const out = (await handler!({ intent: 'download' })) as ExportFile[]
    expect(out[0].filename.startsWith('dragon')).toBe(true)
  })
})

describe('atomm: what each export contains', () => {
  for (const [key, spec] of Object.entries({ ...templates, whale: composeToy('whale', 'bob') })) {
    it(`${key}: valid files for both routes and both intents`, () => {
      const sheets = packSheets(spec).length
      const laser = exportFiles(spec, 'laser', 'download')
      laser.forEach(valid)
      expect(laser.filter((f) => f.filename.endsWith('.svg'))).toHaveLength(sheets)
      expect(laser.some((f) => f.filename.endsWith('-build-guide.html'))).toBe(true)
      expect(laser.some((f) => f.filename.endsWith('-design.json'))).toBe(true)
      expect(new Set(laser.map((f) => f.filename)).size).toBe(laser.length)

      const print = exportFiles(spec, 'print', 'download')
      print.forEach(valid)
      expect(print.filter((f) => f.filename.endsWith('.stl'))).toHaveLength(1)
      expect(print.some((f) => f.filename.endsWith('.svg'))).toBe(false)

      // Studio only ever gets the vector cutting sheets
      for (const method of ['laser', 'print'] as const) {
        const studio = exportFiles(spec, method, 'openInStudio')
        expect(studio).toHaveLength(sheets)
        for (const f of studio) {
          valid(f)
          expect(f.filename.endsWith('.svg')).toBe(true)
          expect(f.blob.type).toBe('image/svg+xml')
        }
      }
    })
  }

  it('sheet files follow the atomm SVG colour spec and are 1:1 in mm', () => {
    for (const spec of [templates.dragon, templates.carousel, composeToy('fish', 'bounce')]) {
      const svgs = flatPackSheetSvgs(spec)
      const sheets = packSheets(spec)
      expect(svgs).toHaveLength(sheets.length)
      svgs.forEach((svg, i) => {
        const { width, height } = sheets[i]
        expect(svg).toContain(`width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"`)
        // every colour in the file is one of the two the platform reads
        const colours = new Set(
          [...svg.matchAll(/(?:stroke|fill)="(#[0-9A-Fa-f]{3,8})"/g)].map((m) => m[1].toUpperCase()),
        )
        for (const c of colours) expect([CUT_COLOR, ENGRAVE_COLOR]).toContain(c)
        expect(colours.has(CUT_COLOR)).toBe(true)
        // only elements the platform groups; nothing it silently skips
        expect(svg).not.toMatch(/<use[\s>]/)
        expect(svg).not.toMatch(/<rect[\s>]/) // no sheet-edge rectangle to be cut by mistake
        expect(svg).not.toMatch(/currentColor|var\(--|hsl\(/)
        const tags = new Set([...svg.matchAll(/<([a-z]+)[\s>]/g)].map((m) => m[1]))
        for (const t of tags) expect(['svg', 'g', 'path', 'text']).toContain(t)
      })
      // nothing is lost by splitting: same number of cut paths as the one-page file
      const count = (s: string) => (s.match(/<path /g) ?? []).length
      expect(svgs.reduce((n, s) => n + count(s), 0)).toBe(count(flatPackSvg(spec)))
    }
  })

  it('cut paths are closed outlines; scored paths are open and blue', () => {
    const svg = flatPackSheetSvgs(composeToy('whale', 'bob')).join('\n')
    const group = (id: string) => [...svg.matchAll(new RegExp(`<g id="${id}"([^>]*)>([\\s\\S]*?)</g>`, 'g'))]
    for (const [, attrs, body] of group('cut')) {
      expect(attrs).toContain(`stroke="${CUT_COLOR}"`)
      expect(attrs).toContain('fill="none"')
      for (const d of body.matchAll(/d="([^"]+)"/g)) expect(d[1].endsWith(' Z')).toBe(true)
    }
    const scored = group('score').map((m) => m[2]).join('')
    expect(scored).toContain('<path')
    expect(scored).not.toContain(' Z')
    for (const [, attrs] of group('engrave')) {
      expect(attrs).toContain(`fill="${ENGRAVE_COLOR}"`)
      expect(attrs).toContain('stroke="none"')
    }
  })
})
