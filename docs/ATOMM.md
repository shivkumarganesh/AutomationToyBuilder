# Publishing on atomm

The same code runs in two places:

| Where | Exports |
|---|---|
| Opened directly (GitHub Pages) | Our own download buttons |
| Hosted by the atomm platform | The platform's Export button (Download / Open in Studio) |

Source of truth for everything below: <https://dev.atomm.com/docs/quickstart>
and <https://dev.atomm.com/llms-full.txt>.

## Where it is deployed

- GitHub Pages serves both interfaces: the original designer at
  `/AutomationToyBuilder/` and this one at `/AutomationToyBuilder/atomm.html`.
  Outside atomm it shows ordinary download buttons.
- The atomm platform serves the zip from `npm run build:atomm`.

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
- When hosted, the export slot replaces our download buttons (in the atomm
  interface described below, and in the regular app's Make view too).

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
   `https://www.atomm.com/creativetools/community/generator/<name>?local=http://localhost:5173/atomm.html`
   and click Export at the bottom of the parameters panel. Local preview never deducts credits.
3. Build the artifact:
   ```bash
   npm run build:atomm  # writes automaton-toy-designer-atomm.zip
   ```
   The build uses relative asset paths and keeps the SDK script tag.
4. Upload the zip under "Code Artifact", fill in the listing (4:3 cover),
   and submit for review.

## The atomm interface

`atomm.html` is a second entry page: the same toy model, mechanism maths,
exports and basswood audit, behind an interface built on atomm's **layout 5**
template (`https://dev.atomm.com/templates/layout-5-multi.skeleton.html`).
`npm run build:atomm` builds this page as the artifact's `index.html`.
`npm run dev:atomm` opens it locally.

| Region | Contents |
|---|---|
| Tool rail (64) | Toys · Figures · Scenery · Import. Clicking the active tool collapses the panel. |
| Panel (320) | Ready-made toys; figure → motion (a second level with a back row); scenery; trace your own picture. |
| Canvas | 3D preview / Cut sheets / Assembly tabs top-centre, Tips top-end, zoom cluster bottom-start. |
| Parameters (320) | Units + Reset; property cards for Crank, each figure, Scenery, Box and Make; export pinned in the footer. |

- `src/atomm/atomm.css` is the template's stylesheet, unmodified.
  `src/atomm/atomm-extra.css` adds this generator's own pieces using the
  template's tokens only.
- Hosted, the footer holds the `data-atomm-export-button` slot. Opened
  directly, it holds ordinary download buttons.
- Parameter edits commit to the design debounced (120 ms), so geometry is not
  rebuilt per frame while a slider is dragged.

### 3D preview checklist

Done in code (`src/scene/Studio.tsx`, `src/scene/Workshop.tsx`,
`src/scene/AutomatonScene.tsx` with `studio`):

- OrbitControls damping on; distance clamped to 1.2–8 × R; pitch clamped
  above the floor; opening shot at 3.2 × R tilted down.
- RoomEnvironment image-based light through PMREM (built once, disposed on
  unmount) plus one directional light; ACES tone mapping (the renderer
  default); DPR clamped to 2.
- One shared grain texture as map and bump map, repeat derived from
  millimetres; faces and sides as separate material groups, sides darker.
- Idle sway and a drag spring on a persistent rig, both off under
  `prefers-reduced-motion`; frame-loop transforms never touch React state.
- Geometry replaced by a rebuild is disposed; the camera is untouched by
  parameter changes; the stage sets `user-select: none`.
- three.js pinned to 0.178.0.

Checked in a browser: wheel zoom inside the 3D area leaves the page
unscrolled; no three.js deprecation warnings in the console; the layout stacks
below 960 px with no horizontal scroll; `dir="rtl"` mirrors rails, sliders and
switches.

### Still unverified or open

- **Never run inside the real platform.** The export slot and hook follow the
  docs and were exercised with a stand-in SDK only.
- Checklist items that need a long real session: frame rate while dragging a
  slider on real hardware, five minutes of parameter changes with flat
  memory, hide-tab-and-return, mounting at 0 × 0.
- "One geometry IR": the 3D view and the cut file share outlines and layout
  functions, but mechanism parts (shaft, cams in place) are placed by scene
  components rather than generated from the 2D sheet. A reviewer may or may
  not accept that.
- Selects are native `<select>` elements in the template's field shell, not
  the template's custom combobox (the design spec allows native).
- Platform-fed blocks (Surface materials, cloud History) are not included.
- English only.
- Drawing a figure freehand exists in the regular app but not here; the
  Import panel traces an uploaded picture.
