import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  previewClick,
  previewMidi,
  startClick,
  startPlayback,
  stopPlayback,
  subscribe,
  updateSnapshot,
} from './engine.ts'
import { useSession } from '../state/session.tsx'
import type { ClickSound } from '../theory/metronome.ts'
import type { Instrument, Timbre } from '../theory/music.ts'

interface AudioApi {
  playing: boolean
  clicking: boolean
  index: number | null
  beat: number
  part: number
  error: string | null
  toggle: () => Promise<void>
  toggleClick: () => Promise<void>
  preview: (midi: number, instrument: Instrument, timbre: Timbre) => Promise<void>
  previewClick: (sound: ClickSound) => Promise<void>
}

const PlaybackContext = createContext<AudioApi | null>(null)

export function AudioProvider({ children }: { children: ReactNode }) {
  const { session, setBpm, setMetronome } = useSession()
  const [playing, setPlaying] = useState(false)
  const [clicking, setClicking] = useState(false)
  const [index, setIndex] = useState<number | null>(null)
  const [beat, setBeat] = useState(0)
  const [part, setPart] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const setBpmRef = useRef(setBpm)
  setBpmRef.current = setBpm

  const publish = (metronome: boolean) => {
    updateSnapshot({
      symbols: session.progression.map((slot) => slot.symbol),
      bpm: session.bpm,
      timeSig: session.timeSig,
      loop: session.loop,
      metronome,
      click: session.click,
      instrument: session.instrument,
      timbre: session.timbre,
    })
  }

  useEffect(() => {
    publish(session.metronome)
  }, [session])

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'stop') {
        setPlaying(false)
        setClicking(false)
        setIndex(null)
        setBeat(0)
        setPart(0)
        return
      }
      if (event.type === 'bpm') {
        setBpmRef.current(event.bpm)
        return
      }
      if (event.mode === 'click') {
        setClicking(true)
        setIndex(null)
      } else {
        setPlaying(true)
        setClicking(false)
        setIndex(event.index)
      }
      setBeat(event.beat)
      setPart(event.part)
    })
  }, [])

  const api: AudioApi = {
    playing,
    clicking,
    index,
    beat,
    part,
    error,
    toggle: async () => {
      if (playing) {
        stopPlayback()
        return
      }
      if (session.progression.length === 0) return
      publish(session.metronome)
      try {
        await startPlayback()
        setPlaying(true)
        setClicking(false)
        setError(null)
      } catch {
        setError('音声を開始できませんでした')
        setPlaying(false)
      }
    },
    toggleClick: async () => {
      if (playing) {
        const next = !session.metronome
        setMetronome(next)
        publish(next)
        return
      }
      if (clicking) {
        setMetronome(false)
        stopPlayback()
        return
      }
      setMetronome(true)
      publish(true)
      try {
        await startClick()
        setClicking(true)
        setError(null)
      } catch {
        setError('メトロノームを開始できませんでした')
        setClicking(false)
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
    previewClick: async (sound) => {
      try {
        await previewClick(sound)
        setError(null)
      } catch {
        setError('このクリックを鳴らせませんでした')
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
