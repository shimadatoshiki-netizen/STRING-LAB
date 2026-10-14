import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAudio } from '../audio/AudioProvider.tsx'
import { MetronomePanel } from './MetronomePanel.tsx'
import { MetronomeStage } from './MetronomeStage.tsx'
import { resolveActiveSymbol } from '../state/active.ts'
import { useSession } from '../state/session.tsx'
import { diatonicChords, displayChordSymbol, meterOf, romanForSymbol, type Timbre, type TimeSignature } from '../theory/music.ts'
import { cn } from './cn.ts'

const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '6/8', '5/8']
const TIMBRES: { value: Timbre; label: string }[] = [
  { value: 'clean', label: 'クリーン' },
  { value: 'warm', label: 'ウォーム' },
  { value: 'slap', label: 'スラップ' },
]

export function TransportBar() {
  const { session, setBpm, setTimeSig, setLoop, setInstrument, setTimbre } = useSession()
  const audio = useAudio()
  const [metroOpen, setMetroOpen] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)
  const symbol = resolveActiveSymbol(session, audio.playing ? audio.index : null)
  const roman = romanForSymbol(
    symbol,
    diatonicChords(session.tonic, session.mode, session.minorVariant, session.sevenths),
  )
  const beats = meterOf(session.timeSig).beats
  const disabled = session.progression.length === 0

  const metroOn = session.metronome || audio.clicking
  const moving = audio.playing || audio.clicking

  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur">
      {stageOpen && createPortal(<MetronomeStage onClose={() => setStageOpen(false)} />, document.body)}
      {metroOpen && (
        <div className="absolute inset-x-0 bottom-full border-t border-line bg-ink/95 backdrop-blur">
          <div className="mx-auto max-h-[46dvh] max-w-5xl overflow-y-auto px-3 py-3">
            <MetronomePanel />
          </div>
        </div>
      )}
      <div className="mx-auto max-w-5xl px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="play"
            aria-label={audio.playing ? '停止' : '再生'}
            disabled={disabled}
            onClick={() => void audio.toggle()}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-tonic text-ink disabled:opacity-40"
          >
            {audio.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="truncate font-display text-2xl leading-none font-semibold">
                {displayChordSymbol(symbol)}
              </p>
              <p className="text-xs text-muted">{roman ?? '進行'}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex rounded-full bg-white/6 p-0.5">
                {TIME_SIGNATURES.map((signature) => (
                  <button
                    key={signature}
                    type="button"
                    aria-pressed={session.timeSig === signature}
                    onClick={() => setTimeSig(signature)}
                    className={cn(
                      'h-7 rounded-full px-2 text-xs',
                      session.timeSig === signature ? 'bg-panel-2 text-paper' : 'text-muted',
                    )}
                  >
                    {signature}
                  </button>
                ))}
              </div>
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
                <span className="w-8 shrink-0 font-display text-sm text-paper">{session.bpm}</span>
                <input
                  aria-label="BPM"
                  type="range"
                  min={40}
                  max={220}
                  value={session.bpm}
                  onChange={(event) => setBpm(Number(event.target.value))}
                  className="min-w-0 flex-1 accent-tonic"
                />
              </label>
            </div>
          </div>
          <button
            type="button"
            aria-pressed={session.loop}
            aria-label="ループ再生"
            onClick={() => setLoop(!session.loop)}
            className={cn(
              'h-11 rounded-full border px-3 text-xs',
              session.loop ? 'border-tonic text-tonic' : 'border-line text-muted',
            )}
          >
            ループ
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <SegmentMini
            label="楽器"
            value={session.instrument}
            options={[
              { value: 'bass' as const, label: 'ベース' },
              { value: 'guitar' as const, label: 'ギター' },
            ]}
            onChange={setInstrument}
          />
          <SegmentMini label="音色" value={session.timbre} options={TIMBRES} onChange={setTimbre} />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            aria-pressed={metroOn}
            onClick={() => void audio.toggleClick()}
            className={cn(
              'h-8 shrink-0 rounded-full border px-3 text-xs whitespace-nowrap',
              metroOn ? 'border-tonic text-tonic' : 'border-line text-muted',
            )}
          >
            メトロノーム
          </button>
          <button
            type="button"
            aria-expanded={metroOpen}
            aria-label="メトロノームの詳細"
            onClick={() => setMetroOpen((open) => !open)}
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
              metroOpen ? 'border-tonic text-tonic' : 'border-line text-muted',
            )}
          >
            <SlidersIcon />
          </button>
          <button
            type="button"
            aria-expanded={stageOpen}
            aria-label="メトロノーム画面"
            onClick={() => setStageOpen((open) => !open)}
            className="flex h-8 items-center gap-1 rounded-full px-1"
          >
            {Array.from({ length: beats }, (_, beat) => (
              <span
                key={beat}
                className={cn(
                  'h-2 w-2 rounded-full',
                  moving && audio.beat === beat ? 'bg-tonic' : 'bg-white/20',
                )}
              />
            ))}
          </button>
        </div>
        {audio.error && <p className="mt-1 text-xs text-dom">{audio.error}</p>}
      </div>
    </footer>
  )
}

function SegmentMini<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-full bg-white/6 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-8 shrink-0 rounded-full px-2 text-xs whitespace-nowrap',
            option.value === value ? 'bg-tonic text-ink' : 'text-muted',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d="M7 4.5v13l11-6.5-11-6.5Z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d="M6 4h3.2v14H6V4Zm6.8 0H16v14h-3.2V4Z" fill="currentColor" />
    </svg>
  )
}

function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 4.5h12M2 8h12M2 11.5h12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6" cy="4.5" r="1.4" fill="currentColor" />
      <circle cx="11" cy="8" r="1.4" fill="currentColor" />
      <circle cx="5" cy="11.5" r="1.4" fill="currentColor" />
    </svg>
  )
}
