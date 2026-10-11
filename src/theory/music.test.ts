import { describe, expect, it } from 'vitest'
import { fretMidi, midiOctave, tuning } from './fretboard.ts'
import {
  chordTones,
  CIRCLE_KEYS,
  diatonicAtPitchClass,
  diatonicChords,
  displayChordSymbol,
  makeSpeller,
  pitchClass,
  scaleNotes,
  voiceMidi,
} from './music.ts'
import { guitarShapes } from './shapes.ts'

describe('diatonic chords', () => {
  it('builds C major triads and romans', () => {
    const chords = diatonicChords('C', 'major', 'natural', false)
    expect(chords.map((chord) => chord.symbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'])
    expect(chords.map((chord) => chord.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
    expect(chords.map((chord) => chord.fn)).toEqual([
      'tonic',
      'subdominant',
      'tonic',
      'subdominant',
      'dominant',
      'tonic',
      'dominant',
    ])
  })

  it('builds C major seventh chords', () => {
    const chords = diatonicChords('C', 'major', 'natural', true)
    expect(chords.map((chord) => chord.symbol)).toEqual([
      'Cmaj7',
      'Dm7',
      'Em7',
      'Fmaj7',
      'G7',
      'Am7',
      'Bm7b5',
    ])
    expect(chords.map((chord) => chord.roman)).toEqual([
      'Imaj7',
      'ii7',
      'iii7',
      'IVmaj7',
      'V7',
      'vi7',
      'viiø7',
    ])
  })

  it('builds A natural minor and A harmonic minor', () => {
    expect(diatonicChords('A', 'minor', 'natural', false).map((chord) => chord.symbol)).toEqual([
      'Am',
      'Bdim',
      'C',
      'Dm',
      'Em',
      'F',
      'G',
    ])
    expect(diatonicChords('A', 'minor', 'natural', false).map((chord) => chord.roman)).toEqual([
      'i',
      'ii°',
      'III',
      'iv',
      'v',
      'VI',
      'VII',
    ])
    expect(diatonicChords('A', 'minor', 'harmonic', false).map((chord) => chord.symbol)).toEqual([
      'Am',
      'Bdim',
      'Caug',
      'Dm',
      'E',
      'F',
      'G#dim',
    ])
    expect(diatonicChords('A', 'minor', 'harmonic', true).map((chord) => chord.symbol)).toEqual([
      'AmMaj7',
      'Bm7b5',
      'C+maj7',
      'Dm7',
      'E7',
      'Fmaj7',
      'G#o7',
    ])
  })

  it('spells flat and sharp keys from the key signature', () => {
    expect(scaleNotes('Bb', 'major', 'natural')).toEqual(['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'])
    expect(diatonicChords('Bb', 'major', 'natural', false).map((chord) => chord.symbol)).toEqual([
      'Bb',
      'Cm',
      'Dm',
      'Eb',
      'F',
      'Gm',
      'Adim',
    ])
    expect(scaleNotes('F#', 'major', 'natural')).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'])
    expect(diatonicChords('F#', 'major', 'natural', false).map((chord) => chord.symbol)).toEqual([
      'F#',
      'G#m',
      'A#m',
      'B',
      'C#',
      'D#m',
      'E#dim',
    ])
    expect(diatonicChords('Db', 'major', 'natural', false).map((chord) => chord.symbol)).toEqual([
      'Db',
      'Ebm',
      'Fm',
      'Gb',
      'Ab',
      'Bbm',
      'Cdim',
    ])
  })

  it('places every diatonic root on the circle by pitch class', () => {
    expect(new Set(CIRCLE_KEYS.map((key) => pitchClass(key))).size).toBe(12)
    const chords = diatonicChords('F#', 'major', 'natural', false)
    const diminished = chords[6]
    expect(diminished?.symbol).toBe('E#dim')
    expect(diatonicAtPitchClass(chords, pitchClass('F'))?.symbol).toBe('E#dim')
  })
})

describe('chord colors and playback voicing', () => {
  it('classifies G7 chord tones', () => {
    const tones = chordTones('G7')
    expect(tones.map((tone) => [tone.name, tone.role, tone.degreeLabel])).toEqual([
      ['G', 'root', '1'],
      ['B', 'third', '3'],
      ['D', 'fifth', '5'],
      ['F', 'seventh', '♭7'],
    ])
  })

  it('voices bass and guitar chords inside a playable register', () => {
    const bass = voiceMidi('C', 'bass')
    const guitar = voiceMidi('Am', 'guitar')
    expect(bass.length).toBeGreaterThan(0)
    expect(guitar.length).toBeGreaterThan(0)
    expect(Math.min(...bass)).toBeGreaterThanOrEqual(36)
    expect(Math.max(...bass)).toBeLessThanOrEqual(62)
    expect(new Set(guitar.map((midi) => midi % 12))).toEqual(new Set([9, 0, 4]))
  })

  it('prettifies chord symbols without changing the theory spelling underneath', () => {
    expect(displayChordSymbol('Bb')).toBe('B♭')
    expect(displayChordSymbol('F#dim')).toBe('F♯°')
    expect(displayChordSymbol('Bm7b5')).toBe('Bø7')
    expect(displayChordSymbol('Cmaj7')).toBe('CM7')
    expect(displayChordSymbol('AmMaj7')).toBe('Am(M7)')
    expect(displayChordSymbol('G#o7')).toBe('G♯°7')
  })
})

describe('fretboard', () => {
  it('uses standard bass and guitar open strings', () => {
    const bass = tuning('bass')
    const guitar = tuning('guitar')
    expect(bass.map((string) => [string.number, string.openName, string.midi])).toEqual([
      [1, 'G', 43],
      [2, 'D', 38],
      [3, 'A', 33],
      [4, 'E', 28],
    ])
    expect(guitar.map((string) => string.midi)).toEqual([64, 59, 55, 50, 45, 40])
    expect(fretMidi(40, 5)).toBe(45)
    expect(midiOctave(28)).toBe(1)
    expect(midiOctave(40)).toBe(2)
    expect(midiOctave(64)).toBe(4)
    expect(midiOctave(76)).toBe(5)
  })

  it('spells frets with the key signature, including E# in F# major', () => {
    const flats = makeSpeller('Bb', 'major', 'natural')
    expect(flats((45 + 1) % 12)).toBe('Bb')
    const sharps = makeSpeller('F#', 'major', 'natural')
    expect(sharps((64 + 1) % 12)).toBe('E#')
    expect(sharps(6)).toBe('F#')
  })

  it('finds common guitar forms from tuning and chord tones', () => {
    const fretsOf = (symbol: string) => guitarShapes(symbol).map((shape) => shape.frets)
    expect(fretsOf('C')).toContainEqual([null, 3, 2, 0, 1, 0])
    expect(fretsOf('G')).toContainEqual([3, 2, 0, 0, 0, 3])
    expect(fretsOf('Am')).toContainEqual([null, 0, 2, 2, 1, 0])
    expect(fretsOf('E')).toContainEqual([0, 2, 2, 1, 0, 0])
    expect(fretsOf('F')).toContainEqual([1, 3, 3, 2, 1, 1])
    expect(fretsOf('Dm')).toContainEqual([null, null, 0, 2, 3, 1])
  })
})
