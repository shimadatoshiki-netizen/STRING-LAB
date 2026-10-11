import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { diatonicChords } from '../theory/music.ts'
import { familiarDegrees } from './active.ts'
import {
  createId,
  loadLibrary,
  loadSession,
  saveLibrary,
  saveSession,
  type ChordSlot,
  type SavedSong,
  type SessionState,
} from './storage.ts'
import type {
  BoardMode,
  CircleKey,
  Instrument,
  LabelMode,
  MinorVariant,
  Mode,
  Timbre,
  TimeSignature,
} from '../theory/music.ts'

interface SessionApi {
  session: SessionState
  library: SavedSong[]
  setTonic: (tonic: CircleKey) => void
  setMode: (mode: Mode) => void
  setMinorVariant: (variant: MinorVariant) => void
  setSevenths: (sevenths: boolean) => void
  addChord: (symbol: string) => void
  addFamiliar: () => void
  removeChord: (id: string) => void
  moveChord: (id: string, direction: -1 | 1) => void
  selectChord: (id: string) => void
  clearProgression: () => void
  setBpm: (bpm: number) => void
  setTimeSig: (timeSig: TimeSignature) => void
  setLoop: (loop: boolean) => void
  setMetronome: (metronome: boolean) => void
  setInstrument: (instrument: Instrument) => void
  setTimbre: (timbre: Timbre) => void
  setBoardMode: (boardMode: BoardMode) => void
  setLabelMode: (labelMode: LabelMode) => void
  setBassPosition: (bassPosition: number | 'all') => void
  setGuitarShapeId: (guitarShapeId: string) => void
  setTab: (tab: SessionState['tab']) => void
  saveCurrent: (name: string) => void
  loadSong: (id: string) => void
  deleteSong: (id: string) => void
}

const SessionContext = createContext<SessionApi | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(loadSession)
  const [library, setLibrary] = useState<SavedSong[]>(loadLibrary)

  useEffect(() => {
    saveSession(session)
  }, [session])

  useEffect(() => {
    saveLibrary(library)
  }, [library])

  const api = useMemo<SessionApi>(() => {
    const patch = (partial: Partial<SessionState>) => {
      setSession((current) => ({ ...current, ...partial }))
    }
    return {
      session,
      library,
      setTonic: (tonic) => patch({ tonic }),
      setMode: (mode) => patch({ mode }),
      setMinorVariant: (minorVariant) => patch({ minorVariant }),
      setSevenths: (sevenths) => patch({ sevenths }),
      addChord: (symbol) => {
        const slot = { id: createId(), symbol }
        setSession((current) => ({
          ...current,
          progression: [...current.progression, slot],
          selectedId: slot.id,
        }))
      },
      addFamiliar: () => {
        setSession((current) => {
          const chords = diatonicChords(current.tonic, current.mode, current.minorVariant, current.sevenths)
          const added = familiarDegrees(current).flatMap((degree) => {
            const chord = chords[degree]
            return chord ? [{ id: createId(), symbol: chord.symbol }] : []
          })
          return {
            ...current,
            progression: [...current.progression, ...added],
            selectedId: added[0]?.id ?? current.selectedId,
          }
        })
      },
      removeChord: (id) => {
        setSession((current) => {
          const progression = current.progression.filter((slot) => slot.id !== id)
          const selectedId =
            current.selectedId === id ? (progression[0]?.id ?? null) : current.selectedId
          return { ...current, progression, selectedId }
        })
      },
      moveChord: (id, direction) => {
        setSession((current) => {
          const index = current.progression.findIndex((slot) => slot.id === id)
          const next = index + direction
          if (index < 0 || next < 0 || next >= current.progression.length) return current
          const progression = current.progression.slice()
          const [slot] = progression.splice(index, 1)
          if (!slot) return current
          progression.splice(next, 0, slot)
          return { ...current, progression }
        })
      },
      selectChord: (selectedId) => patch({ selectedId }),
      clearProgression: () => patch({ progression: [], selectedId: null }),
      setBpm: (bpm) => patch({ bpm: Math.min(220, Math.max(40, Math.round(bpm))) }),
      setTimeSig: (timeSig) => patch({ timeSig }),
      setLoop: (loop) => patch({ loop }),
      setMetronome: (metronome) => patch({ metronome }),
      setInstrument: (instrument) => patch({ instrument }),
      setTimbre: (timbre) => patch({ timbre }),
      setBoardMode: (boardMode) => patch({ boardMode }),
      setLabelMode: (labelMode) => patch({ labelMode }),
      setBassPosition: (bassPosition) => patch({ bassPosition }),
      setGuitarShapeId: (guitarShapeId) => patch({ guitarShapeId }),
      setTab: (tab) => patch({ tab }),
      saveCurrent: (name) => {
        const trimmed = name.trim()
        if (!trimmed || session.progression.length === 0) return
        const song: SavedSong = {
          id: createId(),
          name: trimmed.slice(0, 40),
          tonic: session.tonic,
          mode: session.mode,
          minorVariant: session.minorVariant,
          sevenths: session.sevenths,
          slots: session.progression.map((slot: ChordSlot) => ({ symbol: slot.symbol })),
          bpm: session.bpm,
          timeSig: session.timeSig,
          savedAt: Date.now(),
        }
        setLibrary((current) => [song, ...current].slice(0, 30))
      },
      loadSong: (id) => {
        const song = library.find((item) => item.id === id)
        if (!song) return
        const progression = song.slots.map((slot) => ({ id: createId(), symbol: slot.symbol }))
        setSession((current) => ({
          ...current,
          tonic: song.tonic,
          mode: song.mode,
          minorVariant: song.minorVariant,
          sevenths: song.sevenths,
          progression,
          selectedId: progression[0]?.id ?? null,
          bpm: song.bpm,
          timeSig: song.timeSig,
          tab: 'progression',
        }))
      },
      deleteSong: (id) => {
        setLibrary((current) => current.filter((song) => song.id !== id))
      },
    }
  }, [library, session])

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('SessionProvider の内側で使ってください')
  return value
}
