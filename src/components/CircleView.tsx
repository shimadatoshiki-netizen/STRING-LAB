import { useEffect, useRef, useState } from 'react'
import { useSession } from '../state/session.tsx'
import {
  CIRCLE_KEYS,
  diatonicAtPitchClass,
  diatonicChords,
  displayChordSymbol,
  functionLabel,
  keySignatureLabel,
  modeLabel,
  pitchClass,
  prettifyAccidentals,
  relativeKey,
  type HarmonicFunction,
} from '../theory/music.ts'
import { cn } from './cn.ts'
import { HelpTip } from './HelpTip.tsx'
import { Segmented } from './ui.tsx'

function point(index: number, radius: number) {
  const theta = (index * Math.PI) / 6
  return {
    x: 50 + radius * Math.sin(theta),
    y: 50 - radius * Math.cos(theta),
  }
}

const FUNCTION_NODE: Record<HarmonicFunction, string> = {
  tonic: 'border-tonic bg-tonic/15 text-tonic',
  subdominant: 'border-sub bg-sub/15 text-sub',
  dominant: 'border-dom bg-dom/20 text-dom',
}

export function CircleView() {
  const {
    session,
    setTonic,
    setMode,
    setMinorVariant,
    setSevenths,
    addChord,
    addFamiliar,
  } = useSession()
  const chords = diatonicChords(session.tonic, session.mode, session.minorVariant, session.sevenths)
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current)
    }
  }, [])

  const announce = (message: string) => {
    setNotice(message)
    if (noticeTimer.current != null) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 1600)
  }

  const markers = CIRCLE_KEYS.map((key, index) => ({
    key,
    index,
    chord: diatonicAtPitchClass(chords, pitchClass(key)),
    point: point(index, 38),
  }))

  return (
    <section className="space-y-3">
      <div className="relative flex items-center gap-2">
        <h2 className="font-display text-2xl font-semibold tracking-tight">五度圏</h2>
        <HelpTip label="五度圏">
          <ul className="space-y-2">
            <li>色のついたコードをタップすると、進行の末尾に追加されます。</li>
            <li>うすいキーをタップするか、下のキー一覧から転調できます。</li>
            <li>緑はトニック、青はサブドミナント、黄はドミナントです。</li>
          </ul>
        </HelpTip>
      </div>

      <div className="flex flex-wrap gap-2">
        <Segmented
          label="長調と短調"
          value={session.mode}
          onChange={setMode}
          options={[
            { value: 'major', label: 'メジャー' },
            { value: 'minor', label: 'マイナー' },
          ]}
        />
        {session.mode === 'minor' && (
          <Segmented
            label="短調の種類"
            value={session.minorVariant}
            onChange={setMinorVariant}
            options={[
              { value: 'natural', label: '自然' },
              { value: 'harmonic', label: '和声' },
            ]}
          />
        )}
        <Segmented
          label="三和音と四和音"
          value={session.sevenths ? 'seventh' : 'triad'}
          onChange={(value) => setSevenths(value === 'seventh')}
          options={[
            { value: 'triad', label: '三和音' },
            { value: 'seventh', label: '四和音' },
          ]}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-muted">ダイアトニックコード</h3>
          <button
            type="button"
            onClick={() => {
              addFamiliar()
              announce('定番進行を追加しました')
            }}
            className="shrink-0 text-sm text-tonic hover:underline"
          >
            定番進行を追加
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chords.map((chord) => (
            <button
              key={chord.roman}
              type="button"
              data-testid={`diatonic-${chord.roman}`}
              onClick={() => {
                addChord(chord.symbol)
                announce(`${displayChordSymbol(chord.symbol)} を追加しました`)
              }}
              className={cn(
                'min-w-[5.4rem] shrink-0 rounded-2xl border px-3 py-3 text-left',
                FUNCTION_NODE[chord.fn],
              )}
            >
              <span className="block text-[11px] opacity-80">{chord.roman}</span>
              <span className="font-display text-xl leading-none font-semibold">
                {displayChordSymbol(chord.symbol)}
              </span>
              <span className="mt-1 block text-[10px] opacity-75">{functionLabel(chord.fn)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[260px] sm:max-w-[440px]">
        <div className="relative aspect-square">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            {markers.map((marker) => {
              const next = markers[(marker.index + 1) % markers.length]
              if (!marker.chord || !next?.chord) return null
              return (
                <line
                  key={`${marker.key}-arc`}
                  x1={marker.point.x}
                  y1={marker.point.y}
                  x2={next.point.x}
                  y2={next.point.y}
                  stroke="rgba(62,224,176,0.55)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
          <div className="pointer-events-none absolute inset-[27%] z-10 flex flex-col items-center justify-center rounded-full border border-tonic/30 bg-ink/80 text-center shadow-[0_0_40px_rgba(62,224,176,0.12)]">
            <p className="font-display text-4xl leading-none font-semibold sm:text-5xl">
              {prettifyAccidentals(session.tonic)}
            </p>
            <p className="mt-1 text-sm text-tonic">{modeLabel(session.mode, session.minorVariant)}</p>
            <p className="mt-1 text-[11px] text-muted">
              {keySignatureLabel(session.tonic, session.mode)} · 関係調{' '}
              {prettifyAccidentals(relativeKey(session.tonic, session.mode))}
            </p>
          </div>
          {markers.map((marker) => {
            const current = marker.key === session.tonic
            const label = marker.chord
              ? `${marker.chord.roman} ${displayChordSymbol(marker.chord.symbol)} を進行に追加`
              : `${prettifyAccidentals(marker.key)} に転調`
            return (
              <button
                key={marker.key}
                type="button"
                data-testid={marker.chord ? `circle-chord-${marker.chord.roman}` : `circle-key-${marker.key}`}
                aria-label={label}
                onClick={() => {
                  if (marker.chord) {
                    addChord(marker.chord.symbol)
                    announce(`${displayChordSymbol(marker.chord.symbol)} を追加しました`)
                    return
                  }
                  setTonic(marker.key)
                  announce(`${prettifyAccidentals(marker.key)} に変更しました`)
                }}
                className={cn(
                  'absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border transition-transform hover:scale-105',
                  marker.chord ? 'h-11 w-11 sm:h-14 sm:w-14' : 'h-8 w-8 sm:h-10 sm:w-10 border-line bg-panel text-muted',
                  marker.chord && FUNCTION_NODE[marker.chord.fn],
                  current && 'ring-2 ring-white',
                )}
                style={{ left: `${marker.point.x}%`, top: `${marker.point.y}%` }}
              >
                {marker.chord ? (
                  <>
                    <span className="text-[9px] leading-none opacity-80">{marker.chord.roman}</span>
                    <span className="font-display text-[12px] leading-tight font-semibold">
                      {displayChordSymbol(marker.chord.symbol)}
                    </span>
                  </>
                ) : (
                  <span className="font-display text-sm font-semibold">{prettifyAccidentals(marker.key)}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {notice}
      </p>
      {notice && <p className="text-center text-sm text-tonic">{notice}</p>}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-tonic" /> トニック
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-sub" /> サブドミナント
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-dom" /> ドミナント
        </span>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted">キー</h3>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CIRCLE_KEYS.map((key) => {
            const selected = key === session.tonic
            return (
              <button
                key={key}
                type="button"
                data-testid={`tonic-${key}`}
                aria-pressed={selected}
                onClick={() => setTonic(key)}
                className={cn(
                  'h-11 min-w-11 rounded-full px-3 font-display text-sm font-semibold',
                  selected ? 'bg-tonic text-ink' : 'bg-panel text-paper',
                )}
              >
                {prettifyAccidentals(key)}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
