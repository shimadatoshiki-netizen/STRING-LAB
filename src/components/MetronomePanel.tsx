import { useRef, type ReactNode } from 'react'
import { useAudio } from '../audio/AudioProvider.tsx'
import { useSession } from '../state/session.tsx'
import { bpmFromTaps, type Accent, type ClickSound, type Subdivision, type TrainerEvery, type TrainerStep } from '../theory/metronome.ts'
import { meterOf } from '../theory/music.ts'
import { cn } from './cn.ts'

const SOUNDS: { value: ClickSound; label: string }[] = [
  { value: 'click', label: 'クリック' },
  { value: 'wood', label: 'ウッド' },
  { value: 'hat', label: 'ハイハット' },
  { value: 'snare', label: 'スネア' },
  { value: 'kick', label: 'キック' },
  { value: 'beep', label: 'ビープ' },
  { value: 'rim', label: 'リム' },
]

const SUBDIVISIONS: { value: Subdivision; label: string }[] = [
  { value: 'quarter', label: '拍' },
  { value: 'eighth', label: '8分' },
  { value: 'triplet', label: '3連' },
  { value: 'sixteenth', label: '16分' },
  { value: 'beat8', label: '8ビート' },
  { value: 'beat16', label: '16ビート' },
  { value: 'four', label: '4つ打ち' },
]

const STEPS: { value: TrainerStep; label: string }[] = [
  { value: 0, label: 'なし' },
  { value: 1, label: '+1' },
  { value: 2, label: '+2' },
  { value: 5, label: '+5' },
]

const EVERY: { value: TrainerEvery; label: string }[] = [
  { value: 2, label: '2小節' },
  { value: 4, label: '4小節' },
  { value: 8, label: '8小節' },
]

const MUTES: { play: number; rest: number; label: string; name: string }[] = [
  { play: 0, rest: 0, label: 'なし', name: '休まず鳴らす' },
  { play: 1, rest: 1, label: '1:1', name: '1小節鳴らして1小節休む' },
  { play: 2, rest: 1, label: '2:1', name: '2小節鳴らして1小節休む' },
  { play: 4, rest: 4, label: '4:4', name: '4小節鳴らして4小節休む' },
]

const ACCENT_NAME: Record<Accent, string> = { strong: '強', normal: '中', mute: '無' }

export function MetronomePanel() {
  const { session, setBpm, patchClick, cycleAccent } = useSession()
  const audio = useAudio()
  const taps = useRef<number[]>([])
  const beats = meterOf(session.timeSig).beats
  const click = session.click

  const tapTempo = () => {
    const at = performance.now()
    const recent = taps.current.filter((time) => at - time < 2000)
    recent.push(at)
    taps.current = recent.slice(-6)
    const bpm = bpmFromTaps(taps.current)
    if (bpm != null) setBpm(bpm)
  }

  return (
    <div data-testid="metronome-panel" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold">メトロノーム</p>
        <button
          type="button"
          onClick={tapTempo}
          className="h-8 rounded-full border border-line px-3 text-xs text-paper"
        >
          タップ
        </button>
      </div>

      <Field label="音">
        {SOUNDS.map((sound) => (
          <Chip
            key={sound.value}
            pressed={click.sound === sound.value}
            onClick={() => {
              patchClick({ sound: sound.value })
              void audio.previewClick(sound.value)
            }}
          >
            {sound.label}
          </Chip>
        ))}
      </Field>

      <Field label="分割">
        {SUBDIVISIONS.map((item) => (
          <Chip
            key={item.value}
            pressed={click.subdivision === item.value}
            onClick={() => patchClick({ subdivision: item.value })}
          >
            {item.label}
          </Chip>
        ))}
      </Field>

      <Field label="拍の強さ">
        {Array.from({ length: beats }, (_, beat) => {
          const accent = click.accents[beat] ?? 'normal'
          return (
            <button
              key={beat}
              type="button"
              aria-label={`${beat + 1}拍目 ${ACCENT_NAME[accent]}`}
              onClick={() => cycleAccent(beat)}
              className={cn(
                'h-8 min-w-8 rounded-full px-2 text-xs',
                accent === 'strong' && 'bg-tonic text-ink',
                accent === 'normal' && 'border border-line text-paper',
                accent === 'mute' && 'border border-line text-muted line-through',
              )}
            >
              {beat + 1}
              <span className="ml-1">{ACCENT_NAME[accent]}</span>
            </button>
          )
        })}
      </Field>

      <Field label="テンポ上昇">
        {STEPS.map((step) => (
          <Chip key={step.value} pressed={click.trainerStep === step.value} onClick={() => patchClick({ trainerStep: step.value })}>
            {step.label}
          </Chip>
        ))}
      </Field>

      {click.trainerStep > 0 && (
        <>
          <Field label="間隔">
            {EVERY.map((item) => (
              <Chip
                key={item.value}
                pressed={click.trainerEvery === item.value}
                onClick={() => patchClick({ trainerEvery: item.value })}
              >
                {item.label}
              </Chip>
            ))}
          </Field>
          <label className="flex items-center gap-2 text-xs text-muted">
            <span className="w-14 shrink-0">上限 {click.trainerMax}</span>
            <input
              aria-label="テンポの上限"
              type="range"
              min={60}
              max={220}
              value={click.trainerMax}
              onChange={(event) => patchClick({ trainerMax: Number(event.target.value) })}
              className="min-w-0 flex-1 accent-tonic"
            />
          </label>
        </>
      )}

      <Field label="休符">
        {MUTES.map((item) => (
          <Chip
            key={item.label}
            pressed={click.mutePlay === item.play && click.muteRest === item.rest}
            label={item.name}
            onClick={() => patchClick({ mutePlay: item.play, muteRest: item.rest })}
          >
            {item.label}
          </Chip>
        ))}
      </Field>

      <button
        type="button"
        aria-pressed={click.countIn}
        onClick={() => patchClick({ countIn: !click.countIn })}
        className={cn(
          'h-8 rounded-full border px-3 text-xs',
          click.countIn ? 'border-tonic text-tonic' : 'border-line text-muted',
        )}
      >
        カウントイン
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">{children}</div>
    </div>
  )
}

function Chip({
  pressed,
  onClick,
  children,
  label,
}: {
  pressed: boolean
  onClick: () => void
  children: string
  label?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'h-8 rounded-full px-2.5 text-xs whitespace-nowrap',
        pressed ? 'bg-tonic text-ink' : 'bg-white/6 text-muted',
      )}
    >
      {children}
    </button>
  )
}
