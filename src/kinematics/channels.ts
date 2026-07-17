import type { AutomatonSpec } from '../model/types'
import { outputChannels, type OutputChannel } from '../model/types'
import { displacementTable, type DisplacementTable } from './follower'

/** A resolved output channel plus its displacement signal. */
export interface ChannelSignal {
  channel: OutputChannel
  table: DisplacementTable
}

/**
 * Resolve the whole stage interface: every output channel with its
 * precomputed displacement curve. Recompute when the spec changes;
 * per-frame animation only samples the tables.
 */
export function channelSignals(spec: AutomatonSpec): ChannelSignal[] {
  return outputChannels(spec).map((channel) => ({
    channel,
    table: displacementTable(channel.cam, channel.pushrod.padWidth),
  }))
}
