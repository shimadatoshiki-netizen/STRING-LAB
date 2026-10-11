import {
  Filter,
  Gain,
  getDraw,
  getTransport,
  Limiter,
  MembraneSynth,
  NoiseSynth,
  now,
  PolySynth,
  start,
  Synth,
  Time,
} from 'tone'
import { Note } from 'tonal'
import {
  accentAt,
  barIsSilent,
  defaultMetronome,
  drumHits,
  grooveParts,
  isDrumGroove,
  nextBpm,
  partsPerBeat,
  type Accent,
  type ClickSound,
  type DrumVoice,
  type MetronomeSettings,
} from '../theory/metronome.ts'
import { meterOf, voiceMidi, type Instrument, type Timbre, type TimeSignature } from '../theory/music.ts'

export interface PlaySnapshot {
  symbols: string[]
  bpm: number
  timeSig: TimeSignature
  loop: boolean
  metronome: boolean
  click: MetronomeSettings
  instrument: Instrument
  timbre: Timbre
}

export type PlayEvent =
  | { type: 'beat'; index: number | null; beat: number; mode: 'chords' | 'click' }
  | { type: 'bpm'; bpm: number }
  | { type: 'stop' }

type Listener = (event: PlayEvent) => void
type RunMode = 'stop' | 'chords' | 'click'
type ClickStrength = Accent | 'tick'

const listeners = new Set<Listener>()
let snapshot: PlaySnapshot = {
  symbols: [],
  bpm: 120,
  timeSig: '4/4',
  loop: true,
  metronome: false,
  click: defaultMetronome(),
  instrument: 'guitar',
  timbre: 'clean',
}
let audioReady = false
let runMode: RunMode = 'stop'
let liveBpm = snapshot.bpm
let cursor = 0
let practiceBars = 0
let countInLeft = 0
let loopEvent: number | null = null
let synth: PolySynth<Synth> | null = null
let clickSynth: MembraneSynth | null = null
let woodSynth: MembraneSynth | null = null
let beepSynth: Synth | null = null
let rimSynth: NoiseSynth | null = null
let kickSynth: MembraneSynth | null = null
let snareSynth: NoiseSynth | null = null
let hatSynth: NoiseSynth | null = null
let clickGain: Gain | null = null
let filter: Filter | null = null

function emit(event: PlayEvent) {
  listeners.forEach((listener) => listener(event))
}

function signatureOf(signature: TimeSignature): [number, number] {
  const [beats, division] = signature.split('/').map(Number)
  return [beats ?? 4, division ?? 4]
}

function profile(instrument: Instrument, timbre: Timbre) {
  if (instrument === 'bass' && timbre === 'warm') {
    return { type: 'sine' as const, attack: 0.03, decay: 0.24, sustain: 0.55, release: 0.28, filter: 520, volume: -7 }
  }
  if (instrument === 'bass' && timbre === 'slap') {
    return { type: 'square' as const, attack: 0.001, decay: 0.07, sustain: 0, release: 0.04, filter: 1700, volume: -11 }
  }
  if (instrument === 'bass') {
    return { type: 'triangle' as const, attack: 0.008, decay: 0.16, sustain: 0.28, release: 0.14, filter: 880, volume: -8 }
  }
  if (timbre === 'warm') {
    return { type: 'triangle' as const, attack: 0.02, decay: 0.22, sustain: 0.4, release: 0.36, filter: 1700, volume: -10 }
  }
  if (timbre === 'slap') {
    return { type: 'square' as const, attack: 0.001, decay: 0.06, sustain: 0, release: 0.04, filter: 2400, volume: -13 }
  }
  return { type: 'triangle' as const, attack: 0.005, decay: 0.14, sustain: 0.16, release: 0.16, filter: 2800, volume: -11 }
}

function ensureGraph() {
  if (synth && filter && clickSynth && woodSynth && beepSynth && rimSynth && kickSynth && snareSynth && hatSynth && clickGain) return
  const limiter = new Limiter(-2).toDestination()
  filter = new Filter(1600, 'lowpass').connect(limiter)
  synth = new PolySynth(Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.18, sustain: 0.25, release: 0.2 },
  }).connect(filter)
  synth.maxPolyphony = 8
  clickGain = new Gain(0).connect(limiter)
  clickSynth = new MembraneSynth({
    pitchDecay: 0.008,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
  }).connect(clickGain)
  woodSynth = new MembraneSynth({
    pitchDecay: 0.02,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.02 },
  }).connect(clickGain)
  beepSynth = new Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
  }).connect(clickGain)
  beepSynth.volume.value = -10
  rimSynth = new NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
  }).connect(clickGain)
  rimSynth.volume.value = -8
  kickSynth = new MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.04 },
  }).connect(clickGain)
  const snareFilter = new Filter({ frequency: 1800, type: 'bandpass' }).connect(clickGain)
  snareSynth = new NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 },
  }).connect(snareFilter)
  snareSynth.volume.value = -6
  const hatFilter = new Filter({ frequency: 7000, type: 'highpass' }).connect(clickGain)
  hatSynth = new NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
  }).connect(hatFilter)
  hatSynth.volume.value = -10
}

function applyTimbre(instrument: Instrument, timbre: Timbre) {
  if (!synth || !filter) return
  const sound = profile(instrument, timbre)
  synth.set({
    oscillator: { type: sound.type },
    envelope: {
      attack: sound.attack,
      decay: sound.decay,
      sustain: sound.sustain,
      release: sound.release,
    },
  })
  synth.volume.value = sound.volume
  filter.frequency.value = sound.filter
}

function playClick(sound: ClickSound, strength: ClickStrength, time: number) {
  const strong = strength === 'strong'
  const tick = strength === 'tick'
  const velocity = strong ? 0.9 : tick ? 0.28 : 0.5
  if (sound === 'wood') {
    woodSynth?.triggerAttackRelease(strong ? 'A3' : tick ? 'E4' : 'D3', '32n', time, velocity)
    return
  }
  if (sound === 'beep') {
    beepSynth?.triggerAttackRelease(strong ? 'C6' : tick ? 'G6' : 'E5', '64n', time, velocity * 0.45)
    return
  }
  if (sound === 'rim') {
    rimSynth?.triggerAttackRelease(tick ? '64n' : '32n', time, velocity * 0.7)
    return
  }
  if (sound === 'kick' || sound === 'snare' || sound === 'hat') {
    playDrums([sound], time, strong && !tick)
    return
  }
  clickSynth?.triggerAttackRelease(strong ? 'C6' : tick ? 'G5' : 'E5', '64n', time, velocity)
}

function playDrums(voices: DrumVoice[], time: number, strong: boolean) {
  for (const voice of voices) {
    if (voice === 'kick') kickSynth?.triggerAttackRelease(strong ? 'C1' : 'D1', '8n', time, strong ? 1 : 0.75)
    if (voice === 'snare') snareSynth?.triggerAttackRelease('16n', time, 0.6)
    if (voice === 'hat') hatSynth?.triggerAttackRelease('64n', time, strong ? 0.4 : 0.25)
  }
}

function playChord(symbol: string, snap: PlaySnapshot, time: number) {
  if (!synth) return
  applyTimbre(snap.instrument, snap.timbre)
  const notes = voiceMidi(symbol, snap.instrument).map((midi) => Note.fromMidiSharps(midi))
  if (notes.length === 0) return
  const bar = Time('1m').toSeconds()
  const duration = Math.max(0.08, bar * (snap.timbre === 'slap' ? 0.42 : 0.88))
  synth.triggerAttackRelease(notes, duration, time)
}

function halt(silence = true) {
  runMode = 'stop'
  cursor = 0
  practiceBars = 0
  countInLeft = 0
  if (!audioReady) return
  const transport = getTransport()
  transport.stop()
  transport.cancel(0)
  if (loopEvent != null) {
    transport.clear(loopEvent)
    loopEvent = null
  }
  transport.position = 0
  synth?.releaseAll()
  if (!silence || !clickGain) return
  clickGain.gain.cancelScheduledValues(now())
  clickGain.gain.setValueAtTime(0, now())
}

function begin(mode: 'chords' | 'click') {
  const transport = getTransport()
  halt(false)
  runMode = mode
  liveBpm = snapshot.bpm
  countInLeft = mode === 'chords' && snapshot.click.countIn ? 1 : 0
  clickGain?.gain.cancelScheduledValues(now())
  clickGain?.gain.setValueAtTime(0.55, now())
  transport.bpm.value = snapshot.bpm
  transport.timeSignature = signatureOf(snapshot.timeSig)

  loopEvent = transport.scheduleRepeat((time) => {
    if (runMode === 'stop') return
    const snap = snapshot
    const countingIn = countInLeft > 0
    if (countingIn) countInLeft -= 1

    if (mode === 'chords' && !countingIn) {
      if (snap.symbols.length === 0 || (!snap.loop && cursor >= snap.symbols.length)) {
        transport.stop(time)
        getDraw().schedule(() => {
          halt()
          emit({ type: 'stop' })
        }, time)
        return
      }
      const index = cursor % snap.symbols.length
      cursor += 1
      playChord(snap.symbols[index] ?? '', snap, time)
      scheduleBar(time, snap, 'chords', index, countingIn)
      return
    }

    scheduleBar(time, snap, mode === 'click' ? 'click' : 'chords', null, countingIn)
  }, '1m')

  transport.start(now() + 0.06)
}

function scheduleBar(
  time: number,
  snap: PlaySnapshot,
  mode: 'chords' | 'click',
  index: number | null,
  countingIn: boolean,
) {
  const meter = meterOf(snap.timeSig)
  const beatSeconds = Time(meter.unit).toSeconds()
  const subdivision = snap.click.subdivision
  const groove = isDrumGroove(subdivision) ? subdivision : null
  const parts = isDrumGroove(subdivision) ? grooveParts(subdivision, meter.beats) : partsPerBeat(subdivision)
  const partSeconds = beatSeconds / parts
  const silent = !countingIn && barIsSilent(practiceBars, snap.click.mutePlay, snap.click.muteRest)
  const audible = countingIn || ((mode === 'click' || snap.metronome) && !silent)

  for (let beat = 0; beat < meter.beats; beat += 1) {
    const accent = accentAt(snap.click.accents, beat)
    for (let part = 0; part < parts; part += 1) {
      const when = time + beatSeconds * beat + partSeconds * part
      if (audible && accent !== 'mute') {
        if (groove) playDrums(drumHits(groove, beat, meter.beats, part), when, part === 0 && accent === 'strong')
        else playClick(snap.click.sound, part === 0 ? accent : 'tick', when)
      }
      if (part === 0) {
        getDraw().schedule(() => {
          if (runMode === 'stop') return
          emit({ type: 'beat', index, beat, mode })
        }, when)
      }
    }
  }

  if (countingIn) return
  const completed = practiceBars + 1
  const raised = nextBpm(liveBpm, completed, snap.click.trainerStep, snap.click.trainerEvery, snap.click.trainerMax)
  practiceBars = completed
  if (raised === liveBpm) return
  liveBpm = raised
  snapshot = { ...snapshot, bpm: raised }
  const barEnd = time + beatSeconds * meter.beats
  getTransport().bpm.setValueAtTime(raised, barEnd)
  getDraw().schedule(() => emit({ type: 'bpm', bpm: raised }), barEnd)
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function updateSnapshot(next: PlaySnapshot) {
  const signatureChanged = next.timeSig !== snapshot.timeSig
  const bpmChanged = next.bpm !== snapshot.bpm
  const restart = audioReady && runMode !== 'stop' && signatureChanged
  const was = runMode
  snapshot = next
  if (bpmChanged) liveBpm = next.bpm
  if (!audioReady) return
  if (bpmChanged) getTransport().bpm.value = next.bpm
  if (!restart) return
  if (was === 'click') void startClick()
  else void startPlayback()
}

export async function startPlayback() {
  if (snapshot.symbols.length === 0) return
  await start()
  ensureGraph()
  audioReady = true
  begin('chords')
}

export async function startClick() {
  await start()
  ensureGraph()
  audioReady = true
  begin('click')
}

export function stopPlayback() {
  halt()
  emit({ type: 'stop' })
}

export async function previewMidi(midi: number, instrument: Instrument, timbre: Timbre) {
  await start()
  ensureGraph()
  audioReady = true
  applyTimbre(instrument, timbre)
  synth?.triggerAttackRelease(Note.fromMidiSharps(midi), '8n')
}

export async function previewClick(sound: ClickSound) {
  await start()
  ensureGraph()
  audioReady = true
  const at = now()
  clickGain?.gain.cancelScheduledValues(at)
  clickGain?.gain.setValueAtTime(0.55, at)
  if (sound === 'kick' || sound === 'snare' || sound === 'hat') playDrums([sound], at, true)
  else playClick(sound, 'strong', at)
  if (runMode === 'stop') clickGain?.gain.setValueAtTime(0, at + 0.35)
}
