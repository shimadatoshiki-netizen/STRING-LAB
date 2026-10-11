import { Chord } from 'tonal'
import {
  isCircleKey,
  type BoardMode,
  type CircleKey,
  type Instrument,
  type LabelMode,
  type MinorVariant,
  type Mode,
  type Timbre,
  type TimeSignature,
} from '../theory/music.ts'

const SESSION_KEY = 'tonara.session.v1'
const LIBRARY_KEY = 'tonara.library.v1'
const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '6/8', '5/8']

export interface ChordSlot {
  id: string
  symbol: string
}

export interface SessionState {
  tonic: CircleKey
  mode: Mode
  minorVariant: MinorVariant
  sevenths: boolean
  progression: ChordSlot[]
  selectedId: string | null
  bpm: number
  timeSig: TimeSignature
  loop: boolean
  metronome: boolean
  instrument: Instrument
  timbre: Timbre
  boardMode: BoardMode
  labelMode: LabelMode
  bassPosition: number | 'all'
  guitarShapeId: string
  tab: 'circle' | 'progression' | 'fretboard'
}

export interface SavedSong {
  id: string
  name: string
  tonic: CircleKey
  mode: Mode
  minorVariant: MinorVariant
  sevenths: boolean
  slots: { symbol: string }[]
  bpm: number
  timeSig: TimeSignature
  savedAt: number
}

export function createId(): string {
  return crypto.randomUUID()
}

export function defaultSession(): SessionState {
  const progression: ChordSlot[] = [
    { id: 'seed-c', symbol: 'C' },
    { id: 'seed-am', symbol: 'Am' },
    { id: 'seed-f', symbol: 'F' },
    { id: 'seed-g', symbol: 'G' },
  ]
  return {
    tonic: 'C',
    mode: 'major',
    minorVariant: 'natural',
    sevenths: false,
    progression,
    selectedId: progression[0]?.id ?? null,
    bpm: 120,
    timeSig: '4/4',
    loop: true,
    metronome: false,
    instrument: 'bass',
    timbre: 'clean',
    boardMode: 'chord',
    labelMode: 'name',
    bassPosition: 0,
    guitarShapeId: 'all',
    tab: 'circle',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readChord(value: unknown): ChordSlot | null {
  if (!isRecord(value) || typeof value.symbol !== 'string' || typeof value.id !== 'string') return null
  if (!Chord.get(value.symbol).tonic) return null
  return { id: value.id, symbol: value.symbol }
}

export function loadSession(): SessionState {
  const fallback = defaultSession()
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return fallback
    const data = JSON.parse(raw) as unknown
    if (!isRecord(data)) return fallback
    const progression = Array.isArray(data.progression)
      ? data.progression.map(readChord).filter((slot): slot is ChordSlot => slot !== null)
      : fallback.progression
    const tonic = typeof data.tonic === 'string' && isCircleKey(data.tonic) ? data.tonic : fallback.tonic
    const mode = data.mode === 'minor' ? 'minor' : 'major'
    const minorVariant = data.minorVariant === 'harmonic' ? 'harmonic' : 'natural'
    const timeSig = TIME_SIGNATURES.find((signature) => signature === data.timeSig) ?? '4/4'
    const bpm = typeof data.bpm === 'number' ? Math.min(220, Math.max(40, Math.round(data.bpm))) : 120
    const selectedId =
      typeof data.selectedId === 'string' && progression.some((slot) => slot.id === data.selectedId)
        ? data.selectedId
        : (progression[0]?.id ?? null)
    const bassPosition =
      data.bassPosition === 'all' || (typeof data.bassPosition === 'number' && data.bassPosition >= 0 && data.bassPosition <= 20)
        ? data.bassPosition
        : 0
    return {
      tonic,
      mode,
      minorVariant,
      sevenths: data.sevenths === true,
      progression,
      selectedId,
      bpm,
      timeSig,
      loop: data.loop !== false,
      metronome: data.metronome === true,
      instrument: data.instrument === 'guitar' ? 'guitar' : 'bass',
      timbre: data.timbre === 'warm' || data.timbre === 'slap' ? data.timbre : 'clean',
      boardMode: data.boardMode === 'scale' ? 'scale' : 'chord',
      labelMode: data.labelMode === 'degree' ? 'degree' : 'name',
      bassPosition,
      guitarShapeId: typeof data.guitarShapeId === 'string' ? data.guitarShapeId : 'all',
      tab: data.tab === 'progression' || data.tab === 'fretboard' ? data.tab : 'circle',
    }
  } catch {
    return fallback
  }
}

export function saveSession(session: SessionState) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadLibrary(): SavedSong[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.flatMap((item) => {
      if (!isRecord(item) || typeof item.name !== 'string' || typeof item.id !== 'string') return []
      if (typeof item.tonic !== 'string' || !isCircleKey(item.tonic)) return []
      const slots = Array.isArray(item.slots)
        ? item.slots.flatMap((slot) => {
            if (!isRecord(slot) || typeof slot.symbol !== 'string' || !Chord.get(slot.symbol).tonic) return []
            return [{ symbol: slot.symbol }]
          })
        : []
      if (slots.length === 0) return []
      const song: SavedSong = {
        id: item.id,
        name: item.name.slice(0, 40),
        tonic: item.tonic,
        mode: item.mode === 'minor' ? 'minor' : 'major',
        minorVariant: item.minorVariant === 'harmonic' ? 'harmonic' : 'natural',
        sevenths: item.sevenths === true,
        slots,
        bpm: typeof item.bpm === 'number' ? Math.min(220, Math.max(40, Math.round(item.bpm))) : 120,
        timeSig: TIME_SIGNATURES.find((signature) => signature === item.timeSig) ?? '4/4',
        savedAt: typeof item.savedAt === 'number' ? item.savedAt : Date.now(),
      }
      return [song]
    })
  } catch {
    return []
  }
}

export function saveLibrary(songs: SavedSong[]) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(songs.slice(0, 30)))
}
