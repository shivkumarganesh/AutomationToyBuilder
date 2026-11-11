import { useDesignerStore } from '../model/store'
import { flatPackSvg } from '../export/svgFlatPack'
import { exportStl } from '../export/stlExport'
import { downloadFile } from '../export/download'
import { NumberField } from './NumberField'
import { useUiStore } from './uiStore'

/** Manufacturing settings and one-click exports for both fabrication routes. */
export function ExportPanel() {
  const spec = useDesignerStore((s) => s.spec)
  const updateExport = useDesignerStore((s) => s.updateExport)
  const inAtomm = useUiStore((s) => s.inAtomm)

  const slug = spec.name.toLowerCase().replace(/\s+/g, '-')

  return (
    <details className="section" open>
      <summary>Manufacturing Export</summary>
      <div className="section-body">
        <NumberField
          label="Laser kerf"
          value={spec.export.kerf}
          min={0}
          max={0.5}
          step={0.05}
          onChange={(v) => updateExport({ kerf: v })}
        />
        <NumberField
          label="FDM clearance"
          value={spec.export.fdmClearance}
          min={0}
          max={0.6}
          step={0.05}
          onChange={(v) => updateExport({ fdmClearance: v })}
        />
        <div className="export-buttons">
          {inAtomm ? (
            // hosted by atomm: files leave through the platform's button
            <div data-atomm-export-button className="atomm-export-slot" />
          ) : (
            <>
              <button
                className="primary"
                onClick={() => downloadFile(`${slug}-flatpack.svg`, flatPackSvg(spec), 'image/svg+xml')}
              >
                Download SVG · laser cut
              </button>
              <button
                className="primary"
                onClick={() => downloadFile(`${slug}-parts.stl`, exportStl(spec), 'model/stl')}
              >
                Download STL · 3D print
              </button>
            </>
          )}
        </div>
        <p className="hint">
          SVG: finger-jointed walls, tabbed stage with guide slots, bearing holes, and
          kerf-compensated cam discs (red = cut, blue = engrave). STL: D-profile camshaft,
          crank, pushrods, cams, and figures laid out on one build plate.
        </p>
      </div>
    </details>
  )
}
