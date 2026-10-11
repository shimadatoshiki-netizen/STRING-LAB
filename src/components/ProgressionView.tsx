import { useState } from 'react'
import { useAudio } from '../audio/AudioProvider.tsx'
import { resolveActiveSymbol } from '../state/active.ts'
import { useSession } from '../state/session.tsx'
import {
  diatonicChords,
  displayChordSymbol,
  romanForSymbol,
} from '../theory/music.ts'
import { cn } from './cn.ts'
import { HelpTip } from './HelpTip.tsx'

export function ProgressionView() {
  const { session, library, removeChord, moveChord, selectChord, clearProgression, saveCurrent, loadSong, deleteSong } =
    useSession()
  const audio = useAudio()
  const chords = diatonicChords(session.tonic, session.mode, session.minorVariant, session.sevenths)
  const suggestion = `${session.tonic} ${session.progression.map((slot) => displayChordSymbol(slot.symbol)).join(' ')}`.slice(0, 40)
  const [name, setName] = useState('')

  return (
    <section className="space-y-5">
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl font-semibold tracking-tight">コード進行</h2>
          <HelpTip label="コード進行">
            <ul className="space-y-2">
              <li>五度圏で追加したコードがここに並びます。</li>
              <li>カードを選ぶと、そのコードが指板に出ます。前・後で並べ替え、×で削除します。</li>
              <li>名前をつけて保存し、あとから読み込めます。</li>
            </ul>
          </HelpTip>
        </div>
        <button
          type="button"
          onClick={clearProgression}
          disabled={session.progression.length === 0}
          className="shrink-0 text-sm whitespace-nowrap text-muted hover:text-paper disabled:opacity-40"
        >
          クリア
        </button>
      </div>

      {session.progression.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          五度圏のダイアトニックコードをタップすると、ここに並びます。
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {session.progression.map((slot, index) => {
            const roman = romanForSymbol(slot.symbol, chords)
            const selected = !audio.playing && slot.id === session.selectedId
            const current = audio.playing && audio.index === index
            return (
              <article
                key={slot.id}
                className={cn(
                  'w-32 shrink-0 rounded-3xl border bg-panel p-3',
                  current && 'border-tonic shadow-[0_0_24px_rgba(62,224,176,0.18)]',
                  selected && 'border-white/70',
                  !current && !selected && 'border-line',
                )}
              >
                <button type="button" onClick={() => selectChord(slot.id)} className="w-full text-left">
                  <span className="block text-[11px] text-muted">{roman ?? 'キー外'}</span>
                  <span className="font-display text-2xl leading-none font-semibold">
                    {displayChordSymbol(slot.symbol)}
                  </span>
                </button>
                <div className="mt-3 flex gap-1">
                  <button
                    type="button"
                    aria-label={`${displayChordSymbol(slot.symbol)} を前へ`}
                    disabled={index === 0}
                    onClick={() => moveChord(slot.id, -1)}
                    className="h-9 flex-1 rounded-full bg-white/6 text-sm disabled:opacity-30"
                  >
                    前
                  </button>
                  <button
                    type="button"
                    aria-label={`${displayChordSymbol(slot.symbol)} を後ろへ`}
                    disabled={index === session.progression.length - 1}
                    onClick={() => moveChord(slot.id, 1)}
                    className="h-9 flex-1 rounded-full bg-white/6 text-sm disabled:opacity-30"
                  >
                    後
                  </button>
                  <button
                    type="button"
                    aria-label={`${displayChordSymbol(slot.symbol)} を削除`}
                    onClick={() => removeChord(slot.id)}
                    className="h-9 w-9 rounded-full bg-white/6 text-sm"
                  >
                    ×
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <form
        className="rounded-3xl border border-line bg-panel p-4"
        onSubmit={(event) => {
          event.preventDefault()
          saveCurrent(name.trim() || suggestion)
          setName('')
        }}
      >
        <h3 className="text-sm font-medium">進行を保存</h3>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            placeholder={suggestion || '名前'}
            aria-label="進行の名前"
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-ink px-4 text-sm outline-none focus:border-tonic"
          />
          <button
            type="submit"
            disabled={session.progression.length === 0}
            className="h-11 rounded-full bg-tonic px-4 text-sm font-semibold text-ink disabled:opacity-40"
          >
            保存
          </button>
        </div>
        {library.length === 0 ? (
          <p className="mt-4 text-sm text-muted">保存した進行はまだありません。</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {library.map((song) => (
              <li key={song.id} className="flex items-center gap-2 rounded-2xl bg-white/4 px-3 py-2">
                <button type="button" onClick={() => loadSong(song.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium">{song.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {song.tonic}
                    {song.mode === 'minor' ? 'm' : ''} · {song.timeSig} · {song.bpm} BPM ·{' '}
                    {song.slots.map((slot) => displayChordSymbol(slot.symbol)).join(' ')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteSong(song.id)}
                  aria-label={`${song.name} を削除`}
                  className="h-9 rounded-full px-3 text-sm text-muted hover:text-paper"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <p className="text-xs text-muted">
        再生中のコードは {displayChordSymbol(resolveActiveSymbol(session, audio.playing ? audio.index : null))} です。
      </p>
    </section>
  )
}
