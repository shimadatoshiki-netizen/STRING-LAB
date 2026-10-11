import { CircleView } from './CircleView.tsx'
import { FretboardView } from './FretboardView.tsx'
import { ProgressionView } from './ProgressionView.tsx'
import { TransportBar } from './TransportBar.tsx'
import { useSession } from '../state/session.tsx'
import { modeLabel, prettifyAccidentals } from '../theory/music.ts'
import { cn } from './cn.ts'

const TABS = [
  { id: 'circle', label: '五度圏' },
  { id: 'progression', label: '進行' },
  { id: 'fretboard', label: '指板' },
] as const

export function Shell() {
  const { session, setTab } = useSession()
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="font-display text-lg leading-tight font-semibold tracking-[0.16em]">STRING LAB</h1>
          </div>
          <p className="rounded-full border border-line bg-panel px-3 py-1.5 font-display text-sm">
            {prettifyAccidentals(session.tonic)}{' '}
            <span className="text-muted">{modeLabel(session.mode, session.minorVariant)}</span>
          </p>
        </div>
        <nav aria-label="画面" className="mx-auto flex max-w-5xl gap-1 px-3 pb-3">
          {TABS.map((tab) => {
            const selected = session.tab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-testid={`tab-${tab.id}`}
                aria-selected={selected}
                onClick={() => setTab(tab.id)}
                className={cn(
                  'h-11 flex-1 rounded-full text-sm font-medium',
                  selected ? 'bg-paper text-ink' : 'bg-white/5 text-muted',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-60">
        {session.tab === 'circle' && <CircleView />}
        {session.tab === 'progression' && <ProgressionView />}
        {session.tab === 'fretboard' && <FretboardView />}
      </main>
      <TransportBar />
    </div>
  )
}
