import { useFrame } from '@react-three/fiber'
import { useDesignerStore } from '../model/store'

/** Advances the crank angle while the "Turn Crank" animation is running. */
export function CrankDriver() {
  useFrame((_, delta) => {
    const { isCranking, advanceCrank } = useDesignerStore.getState()
    if (isCranking) advanceCrank(Math.min(delta, 0.1))
  })
  return null
}
