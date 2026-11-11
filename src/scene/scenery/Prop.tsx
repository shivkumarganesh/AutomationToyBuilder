import { useMemo } from 'react'
import { ExtrudeGeometry, Shape } from 'three'
import type { PropSpec } from '../../model/types'
import { propOutline } from '../../model/props'
import { propRowZ, propWorldX } from '../propLayout'
import { useDesignerStore } from '../../model/store'

/**
 * A static scenery plate standing on the stage in its row. Cut from the
 * box's own sheet, so its thickness is the material thickness.
 */
export function Prop({ prop }: { prop: PropSpec }) {
  const frame = useDesignerStore((s) => s.spec.frame)
  const t = frame.materialThickness
  const geometry = useMemo(() => {
    const pts = propOutline(prop.shape, prop.width, prop.height)
    const shape = new Shape()
    shape.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
    shape.closePath()
    const geo = new ExtrudeGeometry(shape, { depth: t, bevelEnabled: false })
    geo.translate(0, 0, -t / 2)
    return geo
  }, [prop.shape, prop.width, prop.height, t])

  return (
    <mesh
      geometry={geometry}
      position={[propWorldX(frame, prop), frame.height + t, propRowZ(frame, prop.row)]}
    >
      <meshStandardMaterial color={prop.color} />
    </mesh>
  )
}
