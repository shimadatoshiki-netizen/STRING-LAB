import { useEffect, useRef, useState } from 'react'
import { useAudio } from '../audio/AudioProvider.tsx'
import { resolveActiveSymbol } from '../state/active.ts'
import { useSession } from '../state/session.tsx'
import {
  BASS_POSITIONS,
  DOUBLE_INLAY_FRETS,
  fretMidi,
  INLAY_FRETS,
  inBassWindow,
  MAX_FRET,
  midiOctave,
  positionHasPitchClass,
  tuning,
} from '../theory/fretboard.ts'
import {
  chordTones,
  displayChordSymbol,
  intervalBetween,
  intervalLabel,
  makeSpeller,
  modeLabel,
  pitchClass,
  prettifyAccidentals,
  scaleTones,
  toneByPc,
  type ToneInfo,
  type ToneRole,
} from '../theory/music.ts'
import { guitarShapes, type GuitarShape } from '../theory/shapes.ts'
import { cn } from './cn.ts'
import { Segmented } from './ui.tsx'

const ROLE_CLASS: Record<ToneRole, string> = {
  root: 'bg-root text-ink',
  third: 'bg-third text-ink',
  fifth: 'bg-fifth text-ink',
  seventh: 'bg-seventh text-ink',
  other: 'bg-other text-ink',
}

const ROLE_NAME: Record<ToneRole, string> = {
  root: 'ルート',
  third: '3度',
  fifth: '5度',
  seventh: '7度',
  other: 'その他のスケール音',
}

export function FretboardView() {
  const { session, setInstrument, setBoardMode, setLabelMode, setBassPosition, setGuitarShapeId } = useSession()
  const audio = useAudio()
  const scroller = useRef<HTMLDivElement>(null)
  const symbol = resolveActiveSymbol(session, audio.playing ? audio.index : null)
  const strings = tuning(session.instrument)
  const spell = makeSpeller(session.tonic, session.mode, session.minorVariant)
  const tones = session.boardMode === 'chord' ? chordTones(symbol) : scaleTones(session.tonic, session.mode, session.minorVariant)
  const shapes = session.instrument === 'guitar' && session.boardMode === 'chord' ? guitarShapes(symbol) : []
  const shape = shapes.find((item) => item.id === session.guitarShapeId) ?? null
  const rootPc = tones.find((tone) => tone.role === 'root')?.pc ?? pitchClass(session.tonic)
  const [picked, setPicked] = useState<{ stringNumber: number; fret: number } | null>(null)

  useEffect(() => {
    const node = scroller.current
    if (!node) return
    const fret = shape ? shape.startFret : session.instrument === 'bass' && session.bassPosition !== 'all' ? session.bassPosition : 0
    node.scrollTo({ left: Math.max(0, fret * 44), behavior: 'smooth' })
  }, [shape, session.bassPosition, session.instrument, symbol])

  const pickedCell = picked
    ? describeCell(strings, spell, tones, symbol, session.boardMode, picked.stringNumber, picked.fret)
    : null

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">指板</h2>
          <p className="mt-1 text-sm text-muted">
            {session.boardMode === 'chord'
              ? `${displayChordSymbol(symbol)} の構成音`
              : `${prettifyAccidentals(session.tonic)} ${modeLabel(session.mode, session.minorVariant)} のスケール`}
          </p>
        </div>
        <Segmented
          label="楽器"
          value={session.instrument}
          onChange={setInstrument}
          options={[
            { value: 'bass', label: 'ベース' },
            { value: 'guitar', label: 'ギター' },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Segmented
          label="表示内容"
          value={session.boardMode}
          onChange={setBoardMode}
          options={[
            { value: 'chord', label: '構成音' },
            { value: 'scale', label: 'スケール' },
          ]}
        />
        <Segmented
          label="ラベル"
          value={session.labelMode}
          onChange={setLabelMode}
          options={[
            { value: 'name', label: '音名' },
            { value: 'degree', label: '度数' },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {tones.map((tone) => (
          <span
            key={`${tone.interval}-${tone.name}`}
            className={cn('rounded-full px-3 py-1 font-display text-sm font-semibold', ROLE_CLASS[tone.role])}
          >
            {session.labelMode === 'degree' ? tone.degreeLabel : prettifyAccidentals(tone.name)}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {(['root', 'third', 'fifth', 'seventh'] as ToneRole[]).map((role) => (
          <span key={role} className="inline-flex items-center gap-1.5">
            <i className={cn('h-2.5 w-2.5 rounded-full', ROLE_CLASS[role])} />
            {ROLE_NAME[role]}
          </span>
        ))}
      </div>

      {session.instrument === 'bass' ? (
        <div className="flex gap-2 overflow-x-auto">
          <PositionChip
            label="全体"
            pressed={session.bassPosition === 'all'}
            onClick={() => setBassPosition('all')}
          />
          {BASS_POSITIONS.map((position) => (
            <PositionChip
              key={position}
              label={position === 0 ? '開放' : `${position}フレット`}
              pressed={session.bassPosition === position}
              marked={positionHasPitchClass('bass', position, rootPc)}
              onClick={() => setBassPosition(position)}
            />
          ))}
        </div>
      ) : session.boardMode === 'chord' ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            aria-pressed={shape == null}
            onClick={() => setGuitarShapeId('all')}
            className={cn(
              'h-16 shrink-0 rounded-2xl border px-3 text-sm',
              shape == null ? 'border-tonic bg-tonic/15 text-tonic' : 'border-line bg-panel',
            )}
          >
            すべて
          </button>
          {shapes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === shape?.id}
              onClick={() => setGuitarShapeId(item.id)}
              className={cn(
                'shrink-0 rounded-2xl border px-2 py-1.5',
                item.id === shape?.id ? 'border-tonic bg-tonic/10' : 'border-line bg-panel',
              )}
            >
              <ShapeSketch shape={item} />
              <span className="mt-1 block text-center text-[10px] text-muted">{item.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          {[0, 5, 7, 12].map((fret) => (
            <button
              key={fret}
              type="button"
              onClick={() => scroller.current?.scrollTo({ left: fret * 44, behavior: 'smooth' })}
              className="h-10 shrink-0 rounded-full bg-panel px-3 text-sm whitespace-nowrap"
            >
              {fret === 0 ? '開放' : `${fret}フレット`}
            </button>
          ))}
        </div>
      )}

      <div ref={scroller} className="overflow-x-auto rounded-3xl border border-line bg-[#0c1824]">
        <div className="min-w-max">
          <div className="flex">
            <div className="sticky left-0 z-10 w-14 bg-[#0c1824]" />
            {Array.from({ length: MAX_FRET + 1 }, (_, fret) => (
              <div key={fret} className="flex h-8 w-11 items-end justify-center pb-1 text-[10px] text-muted">
                <span>
                  {fret}
                  {(INLAY_FRETS as readonly number[]).includes(fret) && ' ·'}
                  {(DOUBLE_INLAY_FRETS as readonly number[]).includes(fret) && '·'}
                </span>
              </div>
            ))}
          </div>
          {strings.map((string, displayIndex) => {
            const gauges = session.instrument === 'bass' ? [1, 1.6, 2.4, 3.4] : [1, 1.15, 1.5, 1.9, 2.5, 3.2]
            const gauge = gauges[displayIndex] ?? 1
            return (
              <div key={string.number} className="flex">
                <div className="sticky left-0 z-10 flex w-14 flex-col justify-center bg-[#0c1824] pl-2">
                  <span className="font-display text-sm font-semibold leading-none">{string.openName}</span>
                  <span className="text-[10px] text-muted">{string.number}弦</span>
                </div>
                {Array.from({ length: MAX_FRET + 1 }, (_, fret) => {
                  const midi = fretMidi(string.midi, fret)
                  const pc = midi % 12
                  const tone = toneByPc(tones, pc)
                  const name = tone?.name ?? spell(pc)
                  const inShape =
                    shape == null || shape.frets[strings.length - 1 - displayIndex] === fret
                  const inWindow =
                    session.instrument !== 'bass' || inBassWindow(fret, session.bassPosition)
                  const visible = Boolean(tone) && inShape
                  const dim = visible && !inWindow
                  const pulse = visible && audio.playing && audio.beat === 0 && tone?.role === 'root'
                  const selected = picked?.stringNumber === string.number && picked.fret === fret
                  return (
                    <button
                      key={fret}
                      type="button"
                      onClick={() => {
                        setPicked({ stringNumber: string.number, fret })
                        void audio.preview(midi, session.instrument, session.timbre)
                      }}
                      aria-label={`${string.number}弦 ${fret === 0 ? '開放' : `${fret}フレット`} ${prettifyAccidentals(name)}${midiOctave(midi)}`}
                      className={cn(
                        'relative h-10 w-11 border-r border-white/12',
                        fret === 0 && 'border-r-[3px] border-r-white/75',
                        selected && 'bg-white/8',
                      )}
                    >
                      <span
                        className="absolute inset-x-0 top-1/2 bg-white/35"
                        style={{ height: gauge, transform: 'translateY(-50%)' }}
                      />
                      {visible && tone && (
                        <span
                          className={cn(
                            'absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full font-display',
                            ROLE_CLASS[tone.role],
                            dim && 'opacity-30',
                            pulse && 'scale-110 shadow-[0_0_16px_rgba(62,224,176,0.8)]',
                          )}
                        >
                          <span className="text-[11px] leading-none font-semibold">
                            {session.labelMode === 'degree' ? tone.degreeLabel : prettifyAccidentals(name)}
                          </span>
                          {session.labelMode === 'name' && (
                            <span className="text-[8px] leading-none opacity-70">{midiOctave(midi)}</span>
                          )}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <p className="min-h-6 text-sm text-paper">
        {pickedCell
          ? `${pickedCell.stringNumber}弦 ${pickedCell.fret === 0 ? '開放' : `${pickedCell.fret}フレット`} · ${prettifyAccidentals(pickedCell.name)}${pickedCell.octave} · ${pickedCell.relation}`
          : 'フレットをタップすると音名、オクターブ、度数を確認して鳴らせます。'}
      </p>
      {session.instrument === 'bass' && (
        <p className="text-xs text-muted">
          ベースは {session.bassPosition === 'all' ? '全フレット' : session.bassPosition === 0 ? '開放から5フレット' : `${session.bassPosition}〜${session.bassPosition + 4}フレット`} を濃く表示しています。点のあるポジションにルートがあります。
        </p>
      )}
    </section>
  )
}

function describeCell(
  strings: ReturnType<typeof tuning>,
  spell: (pc: number) => string,
  tones: ToneInfo[],
  symbol: string,
  boardMode: 'chord' | 'scale',
  stringNumber: number,
  fret: number,
) {
  const string = strings.find((item) => item.number === stringNumber)
  if (!string) return null
  const midi = fretMidi(string.midi, fret)
  const pc = midi % 12
  const tone = toneByPc(tones, pc)
  const name = tone?.name ?? spell(pc)
  const root = boardMode === 'chord' ? (chordTones(symbol)[0]?.name ?? name) : tones[0]?.name ?? name
  const interval = tone?.interval ?? intervalBetween(root, name)
  return {
    stringNumber,
    fret,
    name,
    octave: midiOctave(midi),
    relation: tone ? `${ROLE_NAME[tone.role]} · ${intervalLabel(interval)}` : intervalLabel(interval),
  }
}

function PositionChip({
  label,
  pressed,
  marked,
  onClick,
}: {
  label: string
  pressed: boolean
  marked?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'h-10 shrink-0 rounded-full border px-3 text-sm',
        pressed ? 'border-tonic bg-tonic text-ink' : 'border-line bg-panel text-paper',
      )}
    >
      {label}
      {marked && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />}
    </button>
  )
}

function ShapeSketch({ shape }: { shape: GuitarShape }) {
  const highToLow = [...shape.frets].reverse()
  const pressed = shape.frets.filter((fret): fret is number => fret != null && fret > 0)
  const min = pressed.length > 0 ? Math.min(...pressed) : 0
  const origin = shape.frets.some((fret) => fret === 0) ? 0 : Math.max(0, min - 1)
  return (
    <span className="grid grid-cols-5 grid-rows-6 gap-px">
      {highToLow.map((fret, stringIndex) =>
        Array.from({ length: 5 }, (_, column) => {
          const absolute = origin + column
          const on = fret === absolute
          return (
            <span
              key={`${stringIndex}-${column}`}
              className={cn('h-1.5 w-2.5', on ? 'rounded-full bg-tonic' : 'bg-white/10')}
            />
          )
        }),
      )}
    </span>
  )
}
