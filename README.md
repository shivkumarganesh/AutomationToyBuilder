# Automaton Toy Designer

A web-based tool to design, analyze, and fabricate hand-cranked automaton toys.
Turn the crank, watch the cams dance the figures, tune every dimension, then
export ready-to-cut laser files and ready-to-print STL parts.

Built around the **Simplest Automaton Template**: a hand crank turning a
horizontal camshaft with one eccentric cam and one petal cam, driving two
vertical pushrods through stage guide slots, each carrying a figure block.

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
├── export/       svgFlatPack (laser), stlExport (FDM), download helpers
└── ui/           sidebar (parameters grouped by zone), crank controls, export panel
```

## Manufacturing export

- **Laser (SVG, mm)** — finger-jointed walls, a tabbed stage plate with pushrod
  guide slots, shaft bearing holes, and cam discs with keyed D-holes. Kerf is a
  user parameter: joint boundaries shift so fingers/tabs widen and slots narrow
  by the kerf, and holes are drawn undersize — tight friction fits off the bed.
- **3D print (binary STL, mm)** — D-profile camshaft, crank, pushrods with
  follower pads, cams, and figure blocks laid out on one build plate, with a
  user-set radial clearance on shaft holes for FDM fit. The D-flat proportion
  matches the laser cams, so cut and printed parts interchange.

## Roadmap — growing the toy library

Adding a toy = adding a template in `src/model/templates.ts` (plus, if it
introduces a new mechanism, a profile function in `src/kinematics/`):

- ~~snail-cam woodpecker~~, ~~rotation/tilt output channels~~, ~~spur gear
  trains with a layshaft~~ — shipped as the Woodpecker, Nod & Spin Carousel,
  and Geared Hummingbird templates
- 90° bevel transfer, Geneva drives for stepping motion
- articulated multi-joint characters
- linkages for multi-directional trajectories
