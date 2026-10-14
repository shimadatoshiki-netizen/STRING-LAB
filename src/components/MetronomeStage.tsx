import { useAudio } from '../audio/AudioProvider.tsx'
import { useSession } from '../state/session.tsx'
import {
  accentAt,
  drumHits,
  grooveParts,
  isDrumGroove,
  partsPerBeat,
  type Accent,
  type DrumVoice,
} from '../theory/metronome.ts'
import { meterOf } from '../theory/music.ts'
import { cn } from './cn.ts'

const LANES: { voice: DrumVoice; label: string; on: string; idle: string }[] = [
  { voice: 'kick', label: 'キック', on: 'bg-tonic', idle: 'bg-tonic/25' },
  { voice: 'snare', label: 'スネア', on: 'bg-dom', idle: 'bg-dom/25' },
  { voice: 'hat', label: 'ハイハット', on: 'bg-sub', idle: 'bg-sub/30' },
]

export function MetronomeStage({ onClose }: { onClose: () => void }) {
  const { session } = useSession()
  const audio = useAudio()
  const beats = meterOf(session.timeSig).beats
  const subdivision = session.click.subdivision
  const groove = isDrumGroove(subdivision) ? subdivision : null
  const parts = isDrumGroove(subdivision) ? grooveParts(subdivision, beats) : partsPerBeat(subdivision)
  const live = audio.playing || audio.clicking
  const currentBeat = live ? audio.beat + 1 : 0

  return (
    <div className="fixed inset-x-0 top-0 z-[25] flex h-dvh flex-col overflow-y-auto bg-ink px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-64">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <p className="font-display text-sm font-semibold tracking-[0.18em]">METRONOME</p>
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-full border border-line px-4 text-sm text-paper"
        >
          閉じる
        </button>
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-5xl flex-1 flex-col items-center">
        <p className="font-display text-7xl leading-none font-semibold tabular-nums">{session.bpm}</p>
        <p className="mt-2 text-sm text-muted">{session.timeSig}</p>
        <p
          className={cn(
            'mt-6 flex h-28 w-28 items-center justify-center rounded-full font-display text-5xl font-semibold',
            live ? 'bg-tonic text-ink' : 'border border-line text-muted',
          )}
        >
          {live ? currentBeat : '–'}
        </p>
        <p className="mt-3 min-h-5 text-sm text-muted">
          {live ? '' : 'メトロノームか再生を押すと、拍が光ります。'}
        </p>

        {groove ? (
          <GrooveLanes beats={beats} parts={parts} groove={groove} live={live} beat={audio.beat} part={audio.part} />
        ) : (
          <BeatRow
            beats={beats}
            parts={parts}
            accents={session.click.accents}
            live={live}
            beat={audio.beat}
            part={audio.part}
          />
        )}
      </div>
    </div>
  )
}

function BeatRow({
  beats,
  parts,
  accents,
  live,
  beat,
  part,
}: {
  beats: number
  parts: number
  accents: Accent[]
  live: boolean
  beat: number
  part: number
}) {
  return (
    <div className="mt-8 flex flex-wrap items-end justify-center gap-3">
      {Array.from({ length: beats }, (_, index) => {
        const accent = accentAt(accents, index)
        const active = live && beat === index
        return (
          <div key={index} className="flex flex-col items-center">
            <div
              className={cn(
                'flex items-center justify-center rounded-full font-display font-semibold',
                index === 0 ? 'h-20 w-20 text-3xl' : 'h-16 w-16 text-2xl',
                accent === 'mute' && 'border border-line text-muted opacity-40',
                accent !== 'mute' && active && 'bg-tonic text-ink',
                accent === 'strong' && !active && 'border-2 border-tonic text-tonic',
                accent === 'normal' && !active && 'border border-line text-paper',
              )}
            >
              {index + 1}
            </div>
            {parts > 1 && (
              <div className="mt-2 flex gap-1">
                {Array.from({ length: parts }, (_, pip) => (
                  <span
                    key={pip}
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      active && part === pip ? 'bg-tonic' : 'bg-white/20',
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function GrooveLanes({
  beats,
  parts,
  groove,
  live,
  beat,
  part,
}: {
  beats: number
  parts: number
  groove: 'beat8' | 'beat16' | 'four'
  live: boolean
  beat: number
  part: number
}) {
  const steps = Array.from({ length: beats }, (_, index) =>
    Array.from({ length: parts }, (_, pip) => ({
      beat: index,
      part: pip,
      hits: drumHits(groove, index, beats, pip),
    })),
  ).flat()

  return (
    <div className="mt-10 w-full max-w-xl space-y-3">
      {LANES.map((lane) => (
        <div key={lane.voice} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-muted">{lane.label}</span>
          <div className="flex min-w-0 flex-1 gap-0.5">
            {steps.map((step) => {
              const has = step.hits.includes(lane.voice)
              const on = live && beat === step.beat && part === step.part
              return (
                <span
                  key={`${step.beat}-${step.part}`}
                  className={cn(
                    'h-8 min-w-0 flex-1 rounded-sm',
                    step.part === 0 && 'ml-0.5',
                    on && has && lane.on,
                    !on && has && lane.idle,
                    !has && 'bg-white/6',
                    on && 'outline outline-1 outline-paper',
                  )}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
