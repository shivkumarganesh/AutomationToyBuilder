import type { AutomatonSpec, OutputChannel } from '../model/types'
import { camAngularRate, outputChannels, spinnerRatio } from '../model/types'
import { displacementTable, sampleDisplacement, type DisplacementTable } from './follower'

/**
 * A resolved output channel plus its motion signal.
 *
 *  - lift: table in mm (follower height relative to the shaft axis)
 *  - tilt: table in degrees (lever angle around its resting midpoint)
 *  - spin: no table — angle grows continuously at `ratio` revs per crank rev
 */
export type ChannelSignal =
  | { kind: 'lift'; channel: OutputChannel & { kind: 'lift' }; table: DisplacementTable }
  | { kind: 'tilt'; channel: OutputChannel & { kind: 'tilt' }; table: DisplacementTable }
  | { kind: 'spin'; channel: OutputChannel & { kind: 'spin' }; ratio: number }

/** Convert a follower lift table into lever tilt angles (degrees, ± around rest). */
export function tiltTable(lift: DisplacementTable, leverLength: number): DisplacementTable {
  const mid = (lift.min + lift.max) / 2
  const heights = lift.heights.map(
    (h) => (Math.atan2(h - mid, leverLength) * 180) / Math.PI,
  )
  const min = Math.min(...heights)
  const max = Math.max(...heights)
  return { heights, min, max, lift: max - min }
}

/**
 * Resolve the whole stage interface: every output channel with its motion
 * signal. Recompute when the spec changes; per-frame animation only
 * samples the results.
 */
export function channelSignals(spec: AutomatonSpec): ChannelSignal[] {
  return outputChannels(spec).map((channel): ChannelSignal => {
    switch (channel.kind) {
      case 'lift':
        return {
          kind: 'lift',
          channel,
          table: displacementTable(
            channel.cam,
            channel.pushrod.padWidth,
            camAngularRate(spec.mechanism, channel.cam),
          ),
        }
      case 'tilt':
        return {
          kind: 'tilt',
          channel,
          table: tiltTable(
            displacementTable(
              channel.cam,
              channel.rocker.padWidth,
              camAngularRate(spec.mechanism, channel.cam),
            ),
            channel.rocker.leverLength,
          ),
        }
      case 'spin':
        return { kind: 'spin', channel, ratio: spinnerRatio(channel.spinner) }
    }
  })
}

/**
 * Current value of a channel at crank angle theta (radians):
 * lift → mm, tilt → degrees, spin → unbounded degrees of rotation.
 */
export function channelValue(signal: ChannelSignal, theta: number): number {
  if (signal.kind === 'spin') return (theta * 180) / Math.PI * signal.ratio
  return sampleDisplacement(signal.table, theta)
}
