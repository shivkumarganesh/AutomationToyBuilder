import { useMemo } from 'react'
import { useDesignerStore } from '../model/store'
import { channelSignals } from '../kinematics/channels'

/**
 * The resolved stage interface (channels + displacement tables) for the
 * current spec. Memoized so per-frame animation only samples tables.
 */
export function useChannels() {
  const spec = useDesignerStore((s) => s.spec)
  return useMemo(() => channelSignals(spec), [spec])
}
