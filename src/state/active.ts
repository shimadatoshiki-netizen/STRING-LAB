import { diatonicChords } from '../theory/music.ts'
import type { SessionState } from './storage.ts'

export function resolveActiveSymbol(session: SessionState, playingIndex: number | null): string {
  if (playingIndex != null) {
    const playing = session.progression[playingIndex]
    if (playing) return playing.symbol
  }
  const selected = session.progression.find((slot) => slot.id === session.selectedId)
  if (selected) return selected.symbol
  if (session.progression[0]) return session.progression[0].symbol
  return (
    diatonicChords(session.tonic, session.mode, session.minorVariant, session.sevenths)[0]?.symbol ??
    'C'
  )
}

export function familiarDegrees(session: SessionState): number[] {
  if (session.mode === 'major') return [0, 5, 3, 4]
  if (session.minorVariant === 'harmonic') return [0, 5, 2, 4]
  return [0, 5, 2, 6]
}
