import {
  Filter,
  Gain,
  getDraw,
  getTransport,
  Limiter,
  MembraneSynth,
  now,
  PolySynth,
  start,
  Synth,
  Time,
} from 'tone'
import { Note } from 'tonal'
import { meterOf, voiceMidi, type Instrument, type Timbre, type TimeSignature } from '../theory/music.ts'

export interface PlaySnapshot {
  symbols: string[]
  bpm: number
  timeSig: TimeSignature
  loop: boolean
  metronome: boolean
  instrument: Instrument
  timbre: Timbre
}

export type PlayEvent = { type: 'beat'; index: number; beat: number } | { type: 'stop' }

type Listener = (event: PlayEvent) => void

const listeners = new Set<Listener>()
let snapshot: PlaySnapshot = {
  symbols: [],
  bpm: 120,
  timeSig: '4/4',
  loop: true,
  metronome: false,
  instrument: 'guitar',
  timbre: 'clean',
}
let audioReady = false
let playing = false
let cursor = 0
let chordEvent: number | null = null
let synth: PolySynth<Synth> | null = null
let click: MembraneSynth | null = null
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
  if (synth && filter && click && clickGain) return
  const limiter = new Limiter(-2).toDestination()
  filter = new Filter(1600, 'lowpass').connect(limiter)
  synth = new PolySynth(Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.18, sustain: 0.25, release: 0.2 },
  }).connect(filter)
  synth.maxPolyphony = 8
  clickGain = new Gain(0).connect(limiter)
  click = new MembraneSynth({
    pitchDecay: 0.01,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.01 },
  }).connect(clickGain)
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

function playChord(symbol: string, snap: PlaySnapshot, time: number) {
  if (!synth) return
  applyTimbre(snap.instrument, snap.timbre)
  const notes = voiceMidi(symbol, snap.instrument).map((midi) => Note.fromMidiSharps(midi))
  if (notes.length === 0) return
  const bar = Time('1m').toSeconds()
  const duration = Math.max(0.08, bar * (snap.timbre === 'slap' ? 0.42 : 0.88))
  synth.triggerAttackRelease(notes, duration, time)
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function updateSnapshot(next: PlaySnapshot) {
  const restart = audioReady && playing && next.timeSig !== snapshot.timeSig
  snapshot = next
  if (!audioReady) return
  getTransport().bpm.value = next.bpm
  if (restart) void startPlayback()
}

export async function startPlayback() {
  if (snapshot.symbols.length === 0) return
  await start()
  ensureGraph()
  audioReady = true
  const transport = getTransport()
  transport.stop()
  transport.cancel(0)
  transport.position = 0
  if (chordEvent != null) transport.clear(chordEvent)
  cursor = 0
  playing = true
  clickGain?.gain.cancelScheduledValues(now())
  clickGain?.gain.setValueAtTime(0.5, now())
  transport.bpm.value = snapshot.bpm
  transport.timeSignature = signatureOf(snapshot.timeSig)

  chordEvent = transport.scheduleRepeat((time) => {
    const snap = snapshot
    if (snap.symbols.length === 0) return
    if (!snap.loop && cursor >= snap.symbols.length) {
      transport.stop(time)
      getDraw().schedule(() => {
        playing = false
        cursor = 0
        synth?.releaseAll()
        clickGain?.gain.setValueAtTime(0, now())
        emit({ type: 'stop' })
      }, time)
      return
    }
    const index = cursor % snap.symbols.length
    cursor += 1
    playChord(snap.symbols[index] ?? '', snap, time)
    const meter = meterOf(snap.timeSig)
    const beatSeconds = Time(meter.unit).toSeconds()
    for (let beat = 0; beat < meter.beats; beat += 1) {
      const when = time + beatSeconds * beat
      const accent = beat === 0 || (meter.beats === 6 && beat === 3)
      if (snap.metronome) {
        click?.triggerAttackRelease(accent ? 'C5' : 'G4', '64n', when, accent ? 0.85 : 0.35)
      }
      getDraw().schedule(() => {
        if (!playing) return
        emit({ type: 'beat', index, beat })
      }, when)
    }
  }, '1m')

  transport.start(now() + 0.06)
}

export function stopPlayback() {
  playing = false
  cursor = 0
  if (audioReady) {
    const transport = getTransport()
    transport.stop()
    transport.cancel(0)
    transport.position = 0
    chordEvent = null
    synth?.releaseAll()
    clickGain?.gain.cancelScheduledValues(now())
    clickGain?.gain.setValueAtTime(0, now())
  }
  emit({ type: 'stop' })
}

export async function previewMidi(midi: number, instrument: Instrument, timbre: Timbre) {
  await start()
  ensureGraph()
  audioReady = true
  applyTimbre(instrument, timbre)
  synth?.triggerAttackRelease(Note.fromMidiSharps(midi), instrument === 'bass' ? '8n' : '8n')
}
