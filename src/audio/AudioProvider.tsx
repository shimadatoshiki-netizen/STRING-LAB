import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  previewMidi,
  startPlayback,
  stopPlayback,
  subscribe,
  updateSnapshot,
} from './engine.ts'
import { useSession } from '../state/session.tsx'
import type { Instrument, Timbre } from '../theory/music.ts'

interface AudioApi {
  playing: boolean
  index: number | null
  beat: number
  error: string | null
  toggle: () => Promise<void>
  preview: (midi: number, instrument: Instrument, timbre: Timbre) => Promise<void>
}

const PlaybackContext = createContext<AudioApi | null>(null)

export function AudioProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState<number | null>(null)
  const [beat, setBeat] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    updateSnapshot({
      symbols: session.progression.map((slot) => slot.symbol),
      bpm: session.bpm,
      timeSig: session.timeSig,
      loop: session.loop,
      metronome: session.metronome,
      instrument: session.instrument,
      timbre: session.timbre,
    })
  }, [session])

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'stop') {
        setPlaying(false)
        setIndex(null)
        setBeat(0)
        return
      }
      setPlaying(true)
      setIndex(event.index)
      setBeat(event.beat)
    })
  }, [])

  const api: AudioApi = {
    playing,
    index,
    beat,
    error,
    toggle: async () => {
      if (playing) {
        stopPlayback()
        return
      }
      if (session.progression.length === 0) return
      try {
        await startPlayback()
        setPlaying(true)
        setError(null)
      } catch {
        setError('音声を開始できませんでした')
        setPlaying(false)
      }
    },
    preview: async (midi, instrument, timbre) => {
      try {
        await previewMidi(midi, instrument, timbre)
        setError(null)
      } catch {
        setError('この音を鳴らせませんでした')
      }
    },
  }

  return <PlaybackContext.Provider value={api}>{children}</PlaybackContext.Provider>
}

export function useAudio() {
  const value = useContext(PlaybackContext)
  if (!value) throw new Error('AudioProvider の内側で使ってください')
  return value
}
