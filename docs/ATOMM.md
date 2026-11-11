# Publishing on atomm

The same code runs in two places:

| Where | Exports |
|---|---|
| Opened directly (GitHub Pages) | Our own download buttons |
| Hosted by the atomm platform | The platform's Export button (Download / Open in Studio) |

Source of truth for everything below: <https://dev.atomm.com/docs/quickstart>
and <https://dev.atomm.com/llms-full.txt>.

## How it works

- `index.html` loads the platform SDK (`platform-sdk.js`, deferred), which
  injects `window.atomm`.
- `src/platform/atomm.ts`
  - `detectAtomm()` — hosted if `atomm.app.getLocale()` resolves. The docs
    state that outside the platform these calls reject immediately.
  - `registerAtommExport()` — registers the `export` lifecycle hook at
    startup. It reads the design at click time.
  - `exportFiles(spec, method, intent)` — what the platform receives:
    - **Open in Studio**: the laser cutting sheets only, one SVG per sheet.
    - **Download**: cutting sheets (laser) or the STL (3D print), plus the
      build guide and the design file. The platform zips them.
- When hosted, the Make view and the Advanced export panel render
  `<div data-atomm-export-button>` instead of our buttons, and the header
  drops its brand (the platform owns the top bar).

## Cutting files and the atomm colour spec

Sheet SVGs are 1:1 in mm, sized to the sheet, and use only the two colours
the platform reads:

| In the file | Colour | Platform group | Meaning |
|---|---|---|---|
| stroke | `#FE0002` | Red line | cut through |
| stroke | `#2366FF` | Blue line | score: detail lines, glue footprints |
| fill | `#2366FF` | Fill vector | engrave: part labels |

No `<use>`, no sheet-edge rectangle, no other colours.

## Steps

1. In the atomm Developer Console create a generator. The name is permanent
   (lowercase letters, digits, hyphens; starts with a letter).
2. Test locally inside the real platform:
   ```bash
   npm run dev          # http://localhost:5173
   ```
   then open
   `https://www.atomm.com/creativetools/community/generator/<name>?local=http://localhost:5173/`
   and click Export in the Make step. Local preview never deducts credits.
3. Build the artifact:
   ```bash
   npm run build:atomm  # writes automaton-toy-designer-atomm.zip
   ```
   The build uses relative asset paths and keeps the SDK script tag.
4. Upload the zip under "Code Artifact", fill in the listing (4:3 cover),
   and submit for review.

## Not yet done — likely to matter at review

atomm reviews generators against its design system
(<https://dev.atomm.com/design.md>). This integration covers the export
contract; it does not yet rebuild the interface on one of atomm's five layout
templates. Known gaps:

- Layout: atomm expects a 320 px parameters rail of property cards with
  export pinned in its footer, view tabs top-centre of the canvas, zoom
  bottom-start. Ours is a dark three-step workspace.
- Skin: atomm requires a light theme; ours is dark.
- Top bar: we still show the step navigation as a bar.
- 3D preview checklist: damping and clamped orbit, environment lighting with
  ACES tone mapping, debounced rebuilds, disposal, DPR clamp.
- Language: the app is English only (allowed; other locales fall back).
