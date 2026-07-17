import { useRef, useState } from 'react'
import { useDesignerStore } from '../model/store'
import {
  clearLocalStorage,
  parseSpec,
  serializeSpec,
  shareUrl,
} from '../model/persistence'
import { simplestAutomaton } from '../model/templates'
import { downloadFile } from '../export/download'

/** Save, restore, and share whole designs as JSON or a URL. */
export function SavePanel() {
  const spec = useDesignerStore((s) => s.spec)
  const loadTemplate = useDesignerStore((s) => s.loadTemplate)
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(null), 2500)
  }

  const slug = spec.name.toLowerCase().replace(/\s+/g, '-')

  const onImport = async (file: File) => {
    try {
      const spec = parseSpec(await file.text())
      loadTemplate(spec)
      flash(`Loaded “${spec.name}”`)
    } catch (e) {
      flash(`Import failed: ${e instanceof Error ? e.message : 'invalid file'}`)
    }
  }

  const onShare = async () => {
    const url = shareUrl(spec)
    try {
      await navigator.clipboard.writeText(url)
      flash('Share link copied to clipboard')
    } catch {
      window.prompt('Copy this share link:', url)
    }
    // keep the address bar in sync so a plain browser-refresh also keeps the design
    history.replaceState(null, '', url)
  }

  return (
    <details className="section" open>
      <summary>Save &amp; Share</summary>
      <div className="section-body">
        <div className="export-buttons">
          <button onClick={() => downloadFile(`${slug}.json`, serializeSpec(spec), 'application/json')}>
            Download design · JSON
          </button>
          <button onClick={() => fileInput.current?.click()}>Import design · JSON</button>
          <button onClick={onShare}>Copy share link</button>
          <button
            onClick={() => {
              clearLocalStorage()
              history.replaceState(null, '', location.pathname)
              loadTemplate(simplestAutomaton)
              flash('Reset to the default template')
            }}
          >
            Reset design
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImport(file)
            e.target.value = ''
          }}
        />
        {status && <p className="hint">{status}</p>}
        <p className="hint">
          Designs auto-save in this browser. The share link carries the whole design in
          the URL — anyone opening it gets an editable copy.
        </p>
      </div>
    </details>
  )
}
