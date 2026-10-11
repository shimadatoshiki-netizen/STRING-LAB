import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="contents">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}の使い方`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted hover:text-paper"
      >
        <HelpMark />
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={`${label}の使い方`}
          className="absolute top-full left-0 z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-4 text-sm leading-relaxed text-paper shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
        >
          {children}
        </div>
      )}
    </div>
  )
}

function HelpMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.1 6.15a1.9 1.9 0 1 1 2.55 1.8c-.48.2-.75.58-.75 1.1V9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="7.9" cy="11.35" r="0.7" fill="currentColor" />
    </svg>
  )
}
