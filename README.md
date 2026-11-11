# Automaton Toy Designer

A web-based tool to design, analyze, and fabricate hand-cranked automaton toys.
Turn the crank, watch the cams dance the figures, tune every dimension, then
export ready-to-cut laser files and ready-to-print STL parts.

## Using it — choose, design, make

1. **Choose** — pick a figure (whale, dolphin, fish, sting ray, sailboat, bird,
   butterfly, cat, dancer, rocket), then pick how it should move (bob, bounce,
   climb & drop, rock, spin, swoop). The app composes a complete working toy —
   mechanism, figure and matching scenery — from parameter sets the shipped
   templates prove. Or open one of twelve ready-made toys — including the
   articulated creatures: Flying Bird, Manta Ray, Dragon and Swimming Fish.
2. **Design** — *Simple* mode talks in figures, motions and scenery (swap the
   figure, change the motion feel, how far it travels, timing, size; add up to
   four moving figures and static scenery plates). *Advanced* mode exposes every
   cam, lever, gear and linkage dimension plus the displacement chart. Undo /
   redo (Ctrl+Z), rename, auto-save, share links.
3. **Make** — choose **laser cut** or **3D print**. Either route is a complete
   kit: preview the cutting sheet or the packed print plate, read the parts and
   shopping list, follow an assembly guide generated from this exact design
   (shaft loading order with measured positions), and print the guide or save
   it as a PDF.

## Running

```bash
npm install
npm run dev      # designer at http://localhost:5173
npm test         # kinematics + export unit tests
npm run build    # production build
```

## Architecture — two zones, one interface

An automaton is modeled as two worlds joined by a contract (`src/model/types.ts`):

- **Mechanism zone (inside the box)** — crank, camshaft, cams, followers.
  It produces named **output channels**: displacement as a function of crank
  angle, surfaced at a physical position on the stage.
- **Character zone (above the stage)** — the visible figures. Characters bind
  to channels *by id*, never to cams, so swapping an eccentric cam for a snail
  cam changes a figure's dance without touching the figure — and re-skinning a
  figure never touches the mechanism.
- **Stage interface** — each pushrod passes through a guide slot in the stage
  plate and *is* one output channel.

One math path drives everything: `src/kinematics/` samples each cam profile
into a polygon and computes flat-faced follower displacement (rotate outline,
take the highest point under the pad — exact for any profile, including the
snail cam's drop and wide pads bridging petal lobes). The same tables move the
3D scene, draw the displacement chart, and validate the exports.

```
src/
├── model/        AutomatonSpec (frame / mechanism / characters / export), templates, zustand store
├── kinematics/   cam profiles (eccentric, petal, snail), follower solver, channel signals
├── scene/        react-three-fiber view: FrameBox boundary, mechanism/ group, character/ group
├── analysis/     displacement chart (lift vs crank angle, live marker, hover readout)
├── export/       svgFlatPack (laser), stlExport (FDM), buildGuide (parts list, shopping list, assembly steps)
└── ui/           app shell (Home gallery + wizard, Simple/Advanced sidebar, Make view), crank controls
```

## Manufacturing export

- **Laser (SVG, mm)** — finger-jointed walls, a tabbed stage plate with pushrod
  guide slots, shaft bearing holes, cam discs with keyed D-holes, rocker
  post/link strips at derived heights, figure silhouettes, and — for
  articulated figures — the full kit: side-profile body with running-fit axle
  holes at each limb pivot, the stand at the derived linkage height, and limb
  paddles whose pivot/pin hole spacing is exactly the crank arm. Kerf is a
  user parameter: joint boundaries shift so fingers/tabs widen and slots narrow
  by the kerf, and holes are drawn undersize — tight friction fits off the bed.
  The sheet also carries laminated T-shaped pushrods, the crank arm and the
  scenery plates, so only dowel stock is bought in.
- **3D print (binary STL, mm)** — the box itself as six flat finger-jointed
  panels (the laser outlines with the kerf compensation run in reverse: a
  negative kerf of twice the FDM clearance loosens every joint and hole),
  scenery plates, D-profile camshaft, crank, pushrods with
  follower pads, cams, rocker hardware (lever, fulcrum post, link rod), figure
  blocks with hinge stands, and articulated figure kits: body printed with its
  derived stand, limb plates, pivot axles, and the WIRE CRANKS that carry each
  channel's motion to its pins (vertical run and reach derived from the same
  rest geometry the scene renders — wings get a slotted yoke, head/tail a flat
  L-crank with a washer end). A user-set radial clearance sizes all holes for
  FDM fit; the D-flat proportion matches the laser cams, so cut and printed
  parts interchange.

## Running on atomm

The app doubles as an [atomm](https://dev.atomm.com/docs/quickstart) generator.
Hosted by the platform it shows atomm's Export button (Download / Open in
Studio) and hands files over through the `export` hook; opened directly it
shows its own download buttons. `npm run build:atomm` writes the upload zip.
See [docs/ATOMM.md](docs/ATOMM.md) for how it works, the steps, and what is
still missing for atomm's design review.

## Built for 3 mm basswood

Every laser design is validated as a 3 mm basswood build
(`src/export/basswood.ts`), by the test-suite for every shipped toy and recipe
and live in the Make view for the user's own edits:

- no neck narrower than 2 mm carrying a meaningful piece of a part (pointed
  tips are not necks);
- at least 2 mm of wood between any hole and an edge or another hole;
- no part smaller than 3 mm across, none larger than a 300 × 200 mm sheet;
- anything thicker than the sheet (cams, pushrods) is cut as whole laminated
  layers;
- parts are nested onto 300 × 200 mm sheets and the sheet count is reported.

The audit shaped the parts: the stage overhangs the walls so tab slots have
solid wood outside them, axle holes near an edge get a lug, the Geneva driver
is one piece with its pin as a finger, crown-gear tooth tabs are ≥ 3 mm with a
rim outside their mortises. Bought-in stock is limited to dowel (shafts,
spindles), small pins, wire for the wire-linkage bird, and hinge tape.

## Depth and engraving — flat sheet, rounded toy

Figures and winged creatures carry a **depth** setting (0–3 levels per face).

- **Laser cut:** each level is another plate of the same 3 mm sheet, a step
  smaller than the one below (`depth-…` parts, one set per face). Every plate
  is scored with the footprint of whatever is glued onto it and with the
  engraved detail that ends up on its surface, so lines never run off a plate
  or get buried under one. Thin tails and fins stay single-thickness; a level
  that would be too small to cut is simply left out.
- **3D print:** the same depth becomes a smooth dome. Figures print as two
  mirrored halves, flat side down, glued back to back; a creature's ridge is
  part of its body. No supports.
- **Preview:** engraving is drawn as a burnt score line with a soft scorch,
  and cut edges are darkened on wood finishes — what you see is what the
  laser leaves.

The stack is computed once (`src/scene/reliefLayout.ts`, `src/model/relief.ts`)
and shared by the 3D view, the SVG and the STL; tests check every plate against
the basswood rules.

## Roadmap — growing the toy library

Adding a toy = adding a template in `src/model/templates.ts` (plus, if it
introduces a new mechanism, a profile function in `src/kinematics/`):

- ~~snail-cam woodpecker~~, ~~rotation/tilt output channels~~, ~~spur gear
  trains with a layshaft~~ — shipped as the Woodpecker, Nod & Spin Carousel,
  and Geared Hummingbird templates
- ~~90° bevel transfer~~, ~~Geneva drives for stepping motion~~ — shipped as
  the Bevel Gear Carousel and Stepping Owl templates
- ~~articulated multi-joint characters~~ — shipped as the Flapping Bird:
  figures with pivot-jointed wings/head/tail limbs, each driven by an output
  channel through a pin-and-wire linkage (`angle = asin(d / crankArm)`), with
  printable limb plates whose hole spacing IS the linkage geometry
- ~~linkages for multi-directional trajectories~~ — shipped as the Soaring
  Gull: a Grashof crank-rocker four-bar whose coupler point carries a wand
  through an elongated stage slot (slot length derived from the wand's actual
  crossing), giving figures a true 2D glide with pitch — the `path` output
  channel

- ~~figure & prop library, figure-first workflow~~ — shipped: ten curated
  silhouette figures (`src/model/figures.ts`), five scenery props
  (`src/model/props.ts`, tabbed into derived stage slots via
  `src/scene/propLayout.ts`), and the catalogue + recipes in
  `src/model/catalog.ts` (every figure × motion is tested to produce a valid,
  conflict-free, fully exportable toy)
- ~~printable assembly guide~~ — shipped as `src/export/buildGuide.ts`
- ~~articulated creatures~~ — shipped: **flyers** (`kind: 'flyer'`, shapes in
  `src/model/flyers.ts`, geometry in `src/scene/flyerLayout.ts`): a flat body
  on a fixed post with tape-hinged wing plates, each plate resting on its own
  pushrod (`angle = atan2(tip − hinge, arm)`, the second plate hanging from the
  first plate's moving hinge) — the Flying Bird, Manta Ray and Dragon; and
  **segmented bodies** (figure shapes with `partOf`), each segment on its own
  phase-lagged cam — the Swimming Fish

- ~~a scene worth looking at~~ — shipped: workbench, wood grain, shadows,
  finishes (painted / natural / walnut), a crank you grab and turn, and
  synthesised knocks driven by the real follower motion
- ~~detail~~ — shipped: figures and flyers carry ENGRAVED lines (eyes, gills,
  wing ribs — scored, never cut) and raised DETAIL PLATES glued on each face
  (a fin, a wing); printed figures get the plates as relief

- ~~motion-first cam designer~~ — shipped: the `custom` cam kind. Drag twelve
  heights on a curve of height-vs-crank-angle and the cam is the base circle
  plus that curve, laid out against the rotation so it plays back in the order
  drawn (`src/kinematics/drawnMotion.ts`). The editor overlays what the real
  flat follower does, and warns when a climb exceeds a 38° pressure angle

- ~~draw your own figure~~ — shipped: sketch on a canvas or upload a picture;
  `src/model/tracing.ts` keeps the largest blob, walks its boundary, simplifies
  and smooths it into library coordinates with the mount under its lowest
  edge, and the studio checks it against the basswood neck rule at real size
  (with a Thicker control). The outline travels inside the design
  (`shape: 'custom'`), so saves and share links carry it

Next: segmented swimmers (phase-lagged body sections), a motion-first cam
designer (draw the displacement curve, get the cam), per-part STL files.
