import type { Instrument } from './music.ts'

export const MAX_FRET = 24

export interface TuningString {
  /** 1 is the highest-pitched string. */
  number: number
  openName: string
  midi: number
}

/**
 * Standard tuning, highest string first so the on-screen nut matches a player
 * looking down at the instrument.
 * Bass: G2 D2 A1 E1. Guitar: E4 B3 G3 D3 A2 E2.
 */
export function tuning(instrument: Instrument): TuningString[] {
  if (instrument === 'bass') {
    return [
      { number: 1, openName: 'G', midi: 43 },
      { number: 2, openName: 'D', midi: 38 },
      { number: 3, openName: 'A', midi: 33 },
      { number: 4, openName: 'E', midi: 28 },
    ]
  }
  return [
    { number: 1, openName: 'E', midi: 64 },
    { number: 2, openName: 'B', midi: 59 },
    { number: 3, openName: 'G', midi: 55 },
    { number: 4, openName: 'D', midi: 50 },
    { number: 5, openName: 'A', midi: 45 },
    { number: 6, openName: 'E', midi: 40 },
  ]
}

export function fretMidi(openMidi: number, fret: number): number {
  return openMidi + fret
}

export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1
}

export const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21] as const
export const DOUBLE_INLAY_FRETS = [12, 24] as const

export function inBassWindow(fret: number, position: number | 'all'): boolean {
  if (position === 'all') return true
  const end = position === 0 ? 4 : position + 4
  return fret >= (position === 0 ? 0 : position) && fret <= end
}

export const BASS_POSITIONS = [0, 2, 5, 7, 9, 12] as const

export function positionHasPitchClass(
  instrument: Instrument,
  position: number,
  pc: number,
): boolean {
  const start = position === 0 ? 0 : position
  const end = position === 0 ? 4 : position + 4
  return tuning(instrument).some((string) => {
    for (let fret = start; fret <= end; fret += 1) {
      if ((string.midi + fret) % 12 === pc) return true
    }
    return false
  })
}
