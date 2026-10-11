export type ClickSound = 'click' | 'wood' | 'hat' | 'snare' | 'kick' | 'beep' | 'rim'
export type DrumGroove = 'beat8' | 'beat16' | 'four'
export type DrumVoice = 'kick' | 'snare' | 'hat'
export type Pulse = 'quarter' | 'eighth' | 'triplet' | 'sixteenth'
export type Subdivision = Pulse | DrumGroove
export type Accent = 'strong' | 'normal' | 'mute'
export type TrainerStep = 0 | 1 | 2 | 5
export type TrainerEvery = 2 | 4 | 8

export interface MetronomeSettings {
  sound: ClickSound
  subdivision: Subdivision
  accents: Accent[]
  trainerStep: TrainerStep
  trainerEvery: TrainerEvery
  trainerMax: number
  mutePlay: number
  muteRest: number
  countIn: boolean
}

export const ACCENT_SLOTS = 6

const SOUNDS: ClickSound[] = ['click', 'wood', 'hat', 'snare', 'kick', 'beep', 'rim']
const PULSES: Pulse[] = ['quarter', 'eighth', 'triplet', 'sixteenth']
const GROOVES: DrumGroove[] = ['beat8', 'beat16', 'four']
const ACCENTS: Accent[] = ['strong', 'normal', 'mute']
const STEPS: TrainerStep[] = [0, 1, 2, 5]
const EVERY: TrainerEvery[] = [2, 4, 8]

export function defaultMetronome(): MetronomeSettings {
  return {
    sound: 'click',
    subdivision: 'quarter',
    accents: ['strong', 'normal', 'normal', 'normal', 'normal', 'normal'],
    trainerStep: 0,
    trainerEvery: 4,
    trainerMax: 180,
    mutePlay: 0,
    muteRest: 0,
    countIn: false,
  }
}

export function partsPerBeat(subdivision: Pulse): number {
  switch (subdivision) {
    case 'quarter':
      return 1
    case 'eighth':
      return 2
    case 'triplet':
      return 3
    case 'sixteenth':
      return 4
  }
}

export function isDrumGroove(value: string): value is DrumGroove {
  return value === 'beat8' || value === 'beat16' || value === 'four'
}

/** Eighth-note meters already are 6/8 and 5/8. Quarter-note meters get denser subdivisions. */
export function grooveParts(groove: DrumGroove, beatCount: number): number {
  const eighthPulse = beatCount >= 5
  if (groove === 'beat16') return eighthPulse ? 2 : 4
  return eighthPulse ? 1 : 2
}

export function drumHits(groove: DrumGroove, beat: number, beatCount: number, part: number): DrumVoice[] {
  const hits: DrumVoice[] = []
  const eighthPulse = beatCount >= 5
  if (groove === 'beat8') {
    if (eighthPulse) {
      hits.push('hat')
      if (beat === 0) hits.push('kick')
      if (beat === 3) hits.push('snare')
      return hits
    }
    hits.push('hat')
    if (part !== 0) return hits
    if (beatCount === 3) {
      if (beat === 0) hits.push('kick')
      else hits.push('snare')
      return hits
    }
    if (beat % 2 === 0) hits.push('kick')
    else hits.push('snare')
    return hits
  }
  if (groove === 'four') {
    if (eighthPulse) {
      hits.push('hat')
      if (beat === 0 || beat === 3) hits.push('kick')
      if (beat === 3) hits.push('snare')
      return hits
    }
    if (part === 0) {
      hits.push('kick', 'hat')
      if (beatCount === 3 ? beat === 2 : beat % 2 === 1) hits.push('snare')
    } else {
      hits.push('hat')
    }
    return hits
  }
  hits.push('hat')
  if (eighthPulse) {
    if (part === 0 && beat === 0) hits.push('kick')
    if (part === 0 && beat === 3) hits.push('snare')
    return hits
  }
  const step = beat * 4 + part
  if (beatCount === 3) {
    if (step === 0 || step === 6) hits.push('kick')
    if (step === 4 || step === 8) hits.push('snare')
    return hits
  }
  if (step === 0 || step === 6 || step === 10) hits.push('kick')
  if (step === 4 || step === beatCount * 4 - 4) hits.push('snare')
  return hits
}

export function accentAt(accents: Accent[], beat: number): Accent {
  return accents[beat] ?? 'normal'
}

export function cycleAccent(accent: Accent): Accent {
  const index = ACCENTS.indexOf(accent)
  return ACCENTS[(index + 1) % ACCENTS.length] ?? 'normal'
}

/** 0-based bar index. play=2 rest=1 sounds on 0,1 and is silent on 2. */
export function barIsSilent(barIndex: number, play: number, rest: number): boolean {
  if (play <= 0 || rest <= 0) return false
  return barIndex % (play + rest) >= play
}

/** Raises BPM after every N completed bars, and never lowers it to the cap. */
export function nextBpm(bpm: number, completedBars: number, step: number, every: number, max: number): number {
  if (step <= 0 || every <= 0 || completedBars <= 0 || completedBars % every !== 0) return bpm
  if (bpm >= max) return bpm
  return Math.min(max, bpm + step)
}

export function bpmFromTaps(times: number[]): number | null {
  if (times.length < 2) return null
  let total = 0
  for (let index = 1; index < times.length; index += 1) {
    total += (times[index] ?? 0) - (times[index - 1] ?? 0)
  }
  const average = total / (times.length - 1)
  if (average <= 0) return null
  return Math.min(220, Math.max(40, Math.round(60000 / average)))
}

export function readMetronome(value: unknown): MetronomeSettings {
  const fallback = defaultMetronome()
  if (typeof value !== 'object' || value === null) return fallback
  const data = value as Record<string, unknown>
  const legacyGroove = GROOVES.find((item) => item === data.sound)
  const sound = SOUNDS.find((item) => item === data.sound) ?? fallback.sound
  const subdivision =
    legacyGroove ??
    GROOVES.find((item) => item === data.subdivision) ??
    PULSES.find((item) => item === data.subdivision) ??
    fallback.subdivision
  const accents = fallback.accents.slice()
  if (Array.isArray(data.accents)) {
    data.accents.slice(0, ACCENT_SLOTS).forEach((item, index) => {
      const accent = ACCENTS.find((candidate) => candidate === item)
      if (accent) accents[index] = accent
    })
  }
  const trainerStep = STEPS.find((item) => item === data.trainerStep) ?? 0
  const trainerEvery = EVERY.find((item) => item === data.trainerEvery) ?? 4
  const trainerMax =
    typeof data.trainerMax === 'number' ? Math.min(220, Math.max(40, Math.round(data.trainerMax))) : fallback.trainerMax
  const mute = readMute(data.mutePlay, data.muteRest)
  return {
    sound,
    subdivision,
    accents,
    trainerStep,
    trainerEvery,
    trainerMax,
    mutePlay: mute.play,
    muteRest: mute.rest,
    countIn: data.countIn === true,
  }
}

function readMute(play: unknown, rest: unknown): { play: number; rest: number } {
  if (play === 1 && rest === 1) return { play: 1, rest: 1 }
  if (play === 2 && rest === 1) return { play: 2, rest: 1 }
  if (play === 4 && rest === 4) return { play: 4, rest: 4 }
  return { play: 0, rest: 0 }
}
