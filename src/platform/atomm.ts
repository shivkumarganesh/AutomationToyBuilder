import type { AutomatonSpec } from '../model/types'
import type { BuildMethod } from '../export/buildGuide'
import { guideHtml } from '../export/buildGuide'
import { flatPackSheetSvgs } from '../export/svgFlatPack'
import { exportStl } from '../export/stlExport'
import { serializeSpec } from '../model/persistence'

/**
 * Running as an atomm generator.
 *
 * The same build serves two homes. Opened directly (GitHub Pages) it is
 * an ordinary web app with its own download buttons. Hosted by the
 * atomm platform it must hand every file to the platform instead: the
 * page carries a `data-atomm-export-button` slot, which the platform
 * SDK renders as its Export button, and an `export` lifecycle hook that
 * the platform calls for the files.
 *
 * Everything here follows https://dev.atomm.com/docs — the SDK is the
 * `platform-sdk.js` script in index.html, which injects `window.atomm`.
 */

export type ExportIntent = 'download' | 'openInStudio'
export interface ExportFile {
  filename: string
  blob: Blob
}

interface AtommSdk {
  lifecycle: {
    on(
      event: 'export',
      handler: (ctx: { intent?: ExportIntent }) => Promise<ExportFile | ExportFile[]>,
    ): void
  }
  app: { getLocale(): Promise<string> }
  ui: {
    toast(o: { type?: 'success' | 'warning' | 'error' | 'info'; message: string; duration?: number }): Promise<unknown>
  }
}

declare global {
  interface Window {
    atomm?: AtommSdk
  }
}

/**
 * Are we hosted by the atomm platform?
 *
 * The documented signal: outside the platform, calls such as
 * `atomm.app.getLocale()` reject immediately; inside, they resolve. No
 * SDK object at all (script blocked or offline) also means "outside".
 * A timeout guards against a handshake that never settles.
 */
export async function detectAtomm(timeoutMs = 2500): Promise<boolean> {
  const sdk = typeof window !== 'undefined' ? window.atomm : undefined
  if (!sdk?.app?.getLocale) return false
  try {
    await Promise.race([
      sdk.app.getLocale(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ])
    return true
  } catch {
    return false
  }
}

function slugOf(spec: AutomatonSpec): string {
  return spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'automaton'
}

/** The laser cutting files: one SVG per sheet, 1:1 in mm, spec colours only. */
function cuttingFiles(spec: AutomatonSpec): ExportFile[] {
  const slug = slugOf(spec)
  const sheets = flatPackSheetSvgs(spec)
  return sheets.map((svg, i) => ({
    filename: sheets.length === 1 ? `${slug}.svg` : `${slug}-sheet-${i + 1}-of-${sheets.length}.svg`,
    blob: new Blob([svg], { type: 'image/svg+xml' }),
  }))
}

/**
 * What the platform receives for an export.
 *
 *  - Open in Studio: only what the machine software should open — the
 *    cutting sheets. (Studio is laser software, so this holds for the
 *    3D-print route too.)
 *  - Download: everything a maker needs on disk for the chosen route —
 *    the cutting sheets or the STL, plus the build guide and the design
 *    file, which the platform zips.
 */
export function exportFiles(
  spec: AutomatonSpec,
  method: BuildMethod,
  intent: ExportIntent = 'download',
): ExportFile[] {
  if (intent === 'openInStudio') return cuttingFiles(spec)
  const slug = slugOf(spec)
  const made: ExportFile[] =
    method === 'laser'
      ? cuttingFiles(spec)
      : [{ filename: `${slug}-parts.stl`, blob: new Blob([exportStl(spec) as unknown as BlobPart], { type: 'model/stl' }) }]
  return [
    ...made,
    {
      filename: `${slug}-build-guide.html`,
      blob: new Blob([guideHtml(spec, method)], { type: 'text/html' }),
    },
    { filename: `${slug}-design.json`, blob: new Blob([serializeSpec(spec)], { type: 'application/json' }) },
  ]
}

/**
 * Register the `export` hook. Safe to call anywhere: without the SDK it
 * does nothing. `current` is read at click time, so the platform always
 * gets the design as it is now.
 */
export function registerAtommExport(current: () => { spec: AutomatonSpec; method: BuildMethod }): boolean {
  const sdk = typeof window !== 'undefined' ? window.atomm : undefined
  if (!sdk?.lifecycle?.on) return false
  sdk.lifecycle.on('export', async ({ intent } = {}) => {
    const { spec, method } = current()
    const files = exportFiles(spec, method, intent ?? 'download')
    return files.length === 1 ? files[0] : files
  })
  return true
}

/** A platform toast when hosted; silently nothing otherwise. */
export function atommToast(message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') {
  window.atomm?.ui?.toast({ type, message }).catch(() => {})
}
