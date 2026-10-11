import { Chord, Interval, Key, Note } from 'tonal'

/** Clockwise from C at 12 o'clock. One spelling per pitch class. */
export const CIRCLE_KEYS = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'Db',
  'Ab',
  'Eb',
  'Bb',
  'F',
] as const

export type CircleKey = (typeof CIRCLE_KEYS)[number]
export type Mode = 'major' | 'minor'
export type MinorVariant = 'natural' | 'harmonic'
export type TimeSignature = '4/4' | '3/4' | '6/8' | '5/8'
export type Instrument = 'bass' | 'guitar'
export type Timbre = 'clean' | 'warm' | 'slap'
export type BoardMode = 'chord' | 'scale'
export type LabelMode = 'name' | 'degree'
export type HarmonicFunction = 'tonic' | 'subdominant' | 'dominant'
export type ToneRole = 'root' | 'third' | 'fifth' | 'seventh' | 'other'

export interface DiatonicChord {
  degree: number
  roman: string
  symbol: string
  root: string
  notes: string[]
  intervals: string[]
  fn: HarmonicFunction
}

export interface ToneInfo {
  name: string
  pc: number
  interval: string
  role: ToneRole
  degreeLabel: string
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

const DEGREE_LABEL: Record<string, string> = {
  '1P': '1',
  '2m': '♭2',
  '2M': '2',
  '3m': '♭3',
  '3M': '3',
  '4P': '4',
  '4A': '♯4',
  '5d': '♭5',
  '5P': '5',
  '5A': '♯5',
  '6m': '♭6',
  '6M': '6',
  '7d': '♭♭7',
  '7m': '♭7',
  '7M': '7',
}

const INTERVAL_JA: Record<string, string> = {
  '1P': '完全1度',
  '2m': '短2度',
  '2M': '長2度',
  '3m': '短3度',
  '3M': '長3度',
  '4P': '完全4度',
  '4A': '増4度',
  '5d': '減5度',
  '5P': '完全5度',
  '5A': '増5度',
  '6m': '短6度',
  '6M': '長6度',
  '7d': '減7度',
  '7m': '短7度',
  '7M': '長7度',
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

type KeyScale = ReturnType<typeof Key.majorKey>

function keyScale(tonic: string, mode: Mode, variant: MinorVariant): KeyScale {
  if (mode === 'major') return Key.majorKey(tonic)
  const minor = Key.minorKey(tonic)
  return (variant === 'harmonic' ? minor.harmonic : minor.natural) as KeyScale
}

function alteration(tonic: string, mode: Mode): number {
  return mode === 'major' ? Key.majorKey(tonic).alteration : Key.minorKey(tonic).alteration
}

export function pitchClass(note: string): number {
  const chroma = Note.chroma(note)
  if (typeof chroma !== 'number' || Number.isNaN(chroma)) {
    throw new Error(`音名を解釈できません: ${note}`)
  }
  return chroma
}

export function scaleNotes(tonic: string, mode: Mode, variant: MinorVariant): string[] {
  return [...keyScale(tonic, mode, variant).scale]
}

export function relativeKey(tonic: string, mode: Mode): string {
  if (mode === 'major') return Key.majorKey(tonic).minorRelative
  return Key.minorKey(tonic).relativeMajor
}

export function keySignatureLabel(tonic: string, mode: Mode): string {
  const alt = alteration(tonic, mode)
  if (alt === 0) return '調号なし'
  if (alt > 0) return `♯${alt}`
  return `♭${Math.abs(alt)}`
}

export function modeLabel(mode: Mode, variant: MinorVariant): string {
  if (mode === 'major') return 'メジャー'
  return variant === 'harmonic' ? '和声短調' : '自然短調'
}

function romanFor(index: number, symbol: string): string {
  const chord = Chord.get(symbol)
  const intervals = new Set(chord.intervals)
  const minorish = intervals.has('3m')
  let roman: string = minorish ? ROMAN[index].toLowerCase() : ROMAN[index]
  const dim5 = intervals.has('5d')
  const aug5 = intervals.has('5A')
  const maj7 = intervals.has('7M')
  const min7 = intervals.has('7m')
  const dim7 = intervals.has('7d')

  if (dim5 && minorish && !maj7 && !min7 && !dim7) return `${roman}°`
  if (aug5 && !minorish && !maj7 && !min7 && !dim7) return `${roman}+`
  if (dim7 && dim5) return `${roman}°7`
  if (min7 && dim5 && minorish) return `${roman}ø7`
  if (maj7 && minorish) return `${roman}(maj7)`
  if (maj7 && aug5) return `${roman}+maj7`
  if (maj7) return `${roman}maj7`
  if (min7) return `${roman}7`
  return roman
}

function fnOf(code: string): HarmonicFunction {
  if (code === 'D') return 'dominant'
  if (code === 'SD') return 'subdominant'
  return 'tonic'
}

export function diatonicChords(
  tonic: string,
  mode: Mode,
  variant: MinorVariant,
  sevenths: boolean,
): DiatonicChord[] {
  const scale = keyScale(tonic, mode, variant)
  const symbols = sevenths ? scale.chords : scale.triads
  return symbols.map((symbol, degree) => {
    const chord = Chord.get(symbol)
    return {
      degree,
      roman: romanFor(degree, symbol),
      symbol,
      root: chord.tonic ?? scale.scale[degree] ?? symbol,
      notes: [...chord.notes],
      intervals: [...chord.intervals],
      fn: fnOf(scale.chordsHarmonicFunction[degree] ?? 'T'),
    }
  })
}

export function displayChordSymbol(symbol: string): string {
  const compact = symbol
    .replace('mMaj7', 'm(M7)')
    .replace('+maj7', '+M7')
    .replace('maj7', 'M7')
    .replace('m7b5', 'ø7')
    .replace('o7', '°7')
    .replace('dim7', '°7')
    .replace('dim', '°')
    .replace('aug', '+')
  return prettifyAccidentals(compact)
}

export function prettifyAccidentals(text: string): string {
  return text.replace(/([A-G])b/g, '$1♭').replace(/([A-G])#/g, '$1♯')
}

export function functionLabel(fn: HarmonicFunction): string {
  if (fn === 'dominant') return 'ドミナント'
  if (fn === 'subdominant') return 'サブドミナント'
  return 'トニック'
}

export function makeSpeller(
  tonic: string,
  mode: Mode,
  variant: MinorVariant,
): (pc: number) => string {
  const preferFlats = alteration(tonic, mode) < 0
  const names = (preferFlats ? FLATS : SHARPS).slice()
  for (const note of scaleNotes(tonic, mode, variant)) {
    names[pitchClass(note)] = Note.pitchClass(note)
  }
  return (pc: number) => names[((pc % 12) + 12) % 12] ?? 'C'
}

function roleOfInterval(interval: string): ToneRole {
  if (interval.startsWith('1')) return 'root'
  if (interval.startsWith('3')) return 'third'
  if (interval.startsWith('5')) return 'fifth'
  if (interval.startsWith('7')) return 'seventh'
  return 'other'
}

function toneFrom(name: string, interval: string): ToneInfo {
  return {
    name: Note.pitchClass(name) || name,
    pc: pitchClass(name),
    interval,
    role: roleOfInterval(interval),
    degreeLabel: DEGREE_LABEL[interval] ?? interval,
  }
}

export function chordTones(symbol: string): ToneInfo[] {
  const chord = Chord.get(symbol)
  if (!chord.tonic || chord.notes.length === 0) return []
  return chord.notes.map((name, index) => toneFrom(name, chord.intervals[index] ?? '1P'))
}

export function scaleTones(tonic: string, mode: Mode, variant: MinorVariant): ToneInfo[] {
  const scale = keyScale(tonic, mode, variant)
  return scale.scale.map((name, index) => toneFrom(name, scale.intervals[index] ?? '1P'))
}

export function toneByPc(tones: ToneInfo[], pc: number): ToneInfo | null {
  return tones.find((tone) => tone.pc === pc) ?? null
}

export function intervalLabel(interval: string | null): string {
  if (!interval) return 'コード外'
  return INTERVAL_JA[interval] ?? interval
}

export function intervalBetween(from: string, to: string): string | null {
  const distance = Interval.distance(from, to)
  return distance || null
}

export function diatonicAtPitchClass(
  chords: DiatonicChord[],
  pc: number,
): DiatonicChord | null {
  return chords.find((chord) => pitchClass(chord.root) === pc) ?? null
}

export function romanForSymbol(symbol: string, chords: DiatonicChord[]): string | null {
  return chords.find((chord) => chord.symbol === symbol)?.roman ?? null
}

export function meterOf(signature: TimeSignature): { beats: number; unit: '4n' | '8n' } {
  switch (signature) {
    case '4/4':
      return { beats: 4, unit: '4n' }
    case '3/4':
      return { beats: 3, unit: '4n' }
    case '6/8':
      return { beats: 6, unit: '8n' }
    case '5/8':
      return { beats: 5, unit: '8n' }
  }
}

function nearestMidi(pc: number, target: number): number {
  const targetPc = ((target % 12) + 12) % 12
  let delta = pc - targetPc
  if (delta > 6) delta -= 12
  if (delta < -6) delta += 12
  return target + delta
}

/** Close voicing used for playback. Bass sits around E2, guitar around E3–E5. */
export function voiceMidi(symbol: string, instrument: Instrument): number[] {
  const chord = Chord.get(symbol)
  if (!chord.tonic || chord.notes.length === 0) return []
  const rootPc = pitchClass(chord.tonic)
  const rootMidi = nearestMidi(rootPc, instrument === 'bass' ? 40 : 52)
  const low = instrument === 'bass' ? 36 : 48
  const high = instrument === 'bass' ? 62 : 76
  const midis = [rootMidi]
  for (const note of chord.notes.slice(1)) {
    const pc = pitchClass(note)
    let midi = rootMidi + ((pc - rootPc + 12) % 12)
    while (midi < low) midi += 12
    while (midi > high) midi -= 12
    if (!midis.includes(midi)) midis.push(midi)
  }
  if (instrument === 'guitar') {
    const upperRoot = rootMidi + 12
    if (upperRoot <= high && !midis.includes(upperRoot)) midis.push(upperRoot)
  }
  return midis.sort((a, b) => a - b)
}

export function isCircleKey(value: string): value is CircleKey {
  return (CIRCLE_KEYS as readonly string[]).includes(value)
}
