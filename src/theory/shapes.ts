import { chordTones, type ToneRole } from './music.ts'

export interface GuitarShape {
  id: string
  /** Low E to high E. null mutes the string. */
  frets: (number | null)[]
  label: string
  startFret: number
}

const LOW_TO_HIGH = [40, 45, 50, 55, 59, 64]
const cache = new Map<string, GuitarShape[]>()

function essentialRoles(hasSeventh: boolean): ToneRole[] {
  return hasSeventh ? ['root', 'third', 'seventh'] : ['root', 'third', 'fifth']
}

function hasInternalMute(frets: (number | null)[]): boolean {
  let sounded = false
  let gap = false
  for (const fret of frets) {
    if (fret == null) {
      if (sounded) gap = true
    } else if (gap) {
      return true
    } else {
      sounded = true
    }
  }
  return false
}

function shapeRegion(frets: (number | null)[]): 'open' | 'low' | 'mid' | 'high' {
  if (frets.some((fret) => fret === 0)) return 'open'
  const pressed = frets.filter((fret): fret is number => fret != null && fret > 0)
  const min = pressed.length > 0 ? Math.min(...pressed) : 0
  if (min <= 4) return 'low'
  if (min <= 8) return 'mid'
  return 'high'
}

function shapeLabel(frets: (number | null)[]): string {
  const sounded = frets.filter((fret): fret is number => fret != null)
  const pressed = sounded.filter((fret) => fret > 0)
  if (pressed.length === 0) return '開放'
  const min = Math.min(...pressed)
  if (sounded.some((fret) => fret === 0) && min <= 3) return '開放'
  return `${min}フレット`
}

function patternKey(frets: (number | null)[]): string {
  const pressed = frets.filter((fret): fret is number => fret != null && fret > 0)
  const base = pressed.length > 0 ? Math.min(...pressed) : 0
  return frets
    .map((fret) => {
      if (fret == null) return 'x'
      if (fret === 0) return 'o'
      return String(fret - base)
    })
    .join('.')
}

function search(symbol: string): GuitarShape[] {
  const tones = chordTones(symbol)
  if (tones.length === 0) return []
  const pcs = new Set(tones.map((tone) => tone.pc))
  const rootPc = tones.find((tone) => tone.role === 'root')?.pc ?? tones[0].pc
  const required = essentialRoles(tones.some((tone) => tone.role === 'seventh'))
    .map((role) => tones.find((tone) => tone.role === role)?.pc)
    .filter((pc): pc is number => pc != null)

  const found: { frets: (number | null)[]; score: number }[] = []

  const consider = (frets: (number | null)[]) => {
    let leading = 0
    for (const fret of frets) {
      if (fret == null) leading += 1
      else break
    }
    if (leading > 2 || hasInternalMute(frets)) return

    const played: { pc: number; fret: number }[] = []
    frets.forEach((fret, index) => {
      if (fret == null) return
      played.push({ fret, pc: (LOW_TO_HIGH[index] + fret) % 12 })
    })
    if (played.length < 3) return
    if (!played.some((note) => note.pc === rootPc)) return
    const sounding = new Set(played.map((note) => note.pc))
    if (!required.every((pc) => sounding.has(pc))) return

    const pressed = played.map((note) => note.fret).filter((fret) => fret > 0)
    if (pressed.length > 0 && Math.max(...pressed) - Math.min(...pressed) > 3) return

    let score = played.length * 4 - leading * 3
    if (played[0]?.pc === rootPc) score += 40
    score += required.length * 10
    score += played.filter((note) => note.fret === 0).length * 6
    const minPressed = pressed.length > 0 ? Math.min(...pressed) : 0
    score -= minPressed * 0.15
    found.push({ frets: frets.slice(), score })
  }

  const visitWindow = (minFret: number, maxFret: number) => {
    const options = LOW_TO_HIGH.map((midi) => {
      const openPc = midi % 12
      const choices: (number | null)[] = [null]
      for (let fret = minFret; fret <= maxFret; fret += 1) {
        if (pcs.has((openPc + fret) % 12)) choices.push(fret)
      }
      return choices
    })
    const acc: (number | null)[] = []
    const walk = (index: number) => {
      if (index === options.length) {
        consider(acc)
        return
      }
      for (const choice of options[index]) {
        acc.push(choice)
        walk(index + 1)
        acc.pop()
      }
    }
    walk(0)
  }

  visitWindow(0, 3)
  for (let start = 1; start <= 15; start += 1) visitWindow(start, start + 3)

  const buckets: Record<'open' | 'low' | 'mid' | 'high', typeof found> = {
    open: [],
    low: [],
    mid: [],
    high: [],
  }
  for (const shape of found) {
    const region = shapeRegion(shape.frets)
    buckets[region].push(shape)
  }

  const unique: GuitarShape[] = []
  const seen = new Set<string>()
  for (const region of ['open', 'low', 'mid', 'high'] as const) {
    const ranked = buckets[region].sort((a, b) => b.score - a.score)
    let kept = 0
    for (const shape of ranked) {
      const key = patternKey(shape.frets)
      if (seen.has(key)) continue
      seen.add(key)
      const sounded = shape.frets.filter((fret): fret is number => fret != null)
      unique.push({
        id: shape.frets.map((fret) => (fret == null ? 'x' : String(fret))).join('-'),
        frets: shape.frets,
        label: shapeLabel(shape.frets),
        startFret: sounded.length > 0 ? Math.min(...sounded) : 0,
      })
      kept += 1
      if (kept === 1) break
    }
  }
  return unique.sort((a, b) => a.startFret - b.startFret || a.id.localeCompare(b.id))
}

export function guitarShapes(symbol: string): GuitarShape[] {
  const cached = cache.get(symbol)
  if (cached) return cached
  const shapes = search(symbol)
  cache.set(symbol, shapes)
  return shapes
}
