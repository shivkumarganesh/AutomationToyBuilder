/**
 * The sound of the toy: soft wooden ticks as the crank turns and a
 * knock when a follower drops off a cam. Synthesised with Web Audio —
 * no files to load — and silent until the visitor has interacted with
 * the page (browsers require that).
 */
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!ctx) {
    ctx = new AudioContext()
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return ctx
}

/** Call from a user gesture so later sounds are allowed to play. */
export function unlockSound() {
  const a = audio()
  if (a && a.state === 'suspended') void a.resume()
}

/**
 * One wooden knock. `weight` 0…1 sets loudness and how deep it sounds:
 * small = a ratchet tick, large = a follower landing.
 */
export function knock(weight: number) {
  const a = audio()
  if (!a || a.state !== 'running' || !noise) return
  const t = a.currentTime
  const w = Math.max(0.05, Math.min(1, weight))

  // the click of the strike: a filtered burst of noise
  const src = a.createBufferSource()
  src.buffer = noise
  const band = a.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2600 - 1500 * w
  band.Q.value = 1.2
  const clickGain = a.createGain()
  clickGain.gain.setValueAtTime(0.16 * w + 0.02, t)
  clickGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.03 + 0.04 * w)
  src.connect(band).connect(clickGain).connect(a.destination)
  src.start(t)
  src.stop(t + 0.1)

  // the body of the wood: a short falling tone
  const osc = a.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(520 - 280 * w, t)
  osc.frequency.exponentialRampToValueAtTime(190 - 70 * w, t + 0.07)
  const bodyGain = a.createGain()
  bodyGain.gain.setValueAtTime(0.22 * w, t)
  bodyGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.09 + 0.06 * w)
  osc.connect(bodyGain).connect(a.destination)
  osc.start(t)
  osc.stop(t + 0.2)
}
