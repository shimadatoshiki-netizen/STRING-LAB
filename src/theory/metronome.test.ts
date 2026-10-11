import { describe, expect, it } from 'vitest'
import { barIsSilent, bpmFromTaps, cycleAccent, drumHits, grooveParts, nextBpm, partsPerBeat, readMetronome } from './metronome.ts'

describe('metronome plan', () => {
  it('plays recommended drum grooves on the beat grid', () => {
    const voices = (groove: 'beat8' | 'beat16' | 'four', beats: number) => {
      const parts = grooveParts(groove, beats)
      return Array.from({ length: beats }, (_, beat) =>
        Array.from({ length: parts }, (_, part) => drumHits(groove, beat, beats, part).join('+')),
      )
    }
    expect(voices('beat8', 4)).toEqual([
      ['hat+kick', 'hat'],
      ['hat+snare', 'hat'],
      ['hat+kick', 'hat'],
      ['hat+snare', 'hat'],
    ])
    expect(voices('four', 4).map((beat) => beat[0])).toEqual(['kick+hat', 'kick+hat+snare', 'kick+hat', 'kick+hat+snare'])
    expect(voices('beat16', 4)[0]).toEqual(['hat+kick', 'hat', 'hat', 'hat'])
    expect(voices('beat16', 4)[1]?.[0]).toBe('hat+snare')
    expect(voices('beat8', 6).map((beat) => beat[0])).toEqual(['hat+kick', 'hat', 'hat', 'hat+snare', 'hat', 'hat'])
    expect(readMetronome({ sound: 'beat8' }).subdivision).toBe('beat8')
    expect(readMetronome({ sound: 'kick' }).sound).toBe('kick')
  })

  it('divides a beat into clicks', () => {
    expect(partsPerBeat('quarter')).toBe(1)
    expect(partsPerBeat('eighth')).toBe(2)
    expect(partsPerBeat('triplet')).toBe(3)
    expect(partsPerBeat('sixteenth')).toBe(4)
  })

  it('cycles accent strength', () => {
    expect(cycleAccent('strong')).toBe('normal')
    expect(cycleAccent('normal')).toBe('mute')
    expect(cycleAccent('mute')).toBe('strong')
  })

  it('silences the rest bars of a cycle', () => {
    expect([0, 1, 2, 3].map((bar) => barIsSilent(bar, 2, 1))).toEqual([false, false, true, false])
    expect(barIsSilent(0, 0, 0)).toBe(false)
  })

  it('raises tempo on completed bars and holds at the cap', () => {
    expect(nextBpm(120, 3, 2, 4, 180)).toBe(120)
    expect(nextBpm(120, 4, 2, 4, 180)).toBe(122)
    expect(nextBpm(179, 4, 2, 4, 180)).toBe(180)
    expect(nextBpm(180, 4, 5, 4, 160)).toBe(180)
  })

  it('reads BPM from tap gaps', () => {
    expect(bpmFromTaps([0, 500, 1000])).toBe(120)
    expect(bpmFromTaps([0])).toBeNull()
    expect(bpmFromTaps([0, 100])).toBe(220)
  })

  it('keeps saved click settings inside the known choices', () => {
    const click = readMetronome({
      sound: 'wood',
      subdivision: 'triplet',
      accents: ['mute', 'strong'],
      trainerStep: 5,
      trainerEvery: 2,
      trainerMax: 400,
      mutePlay: 4,
      muteRest: 4,
      countIn: true,
    })
    expect(click.sound).toBe('wood')
    expect(click.subdivision).toBe('triplet')
    expect(click.accents.slice(0, 2)).toEqual(['mute', 'strong'])
    expect(click.trainerStep).toBe(5)
    expect(click.trainerMax).toBe(220)
    expect(click.mutePlay).toBe(4)
    expect(click.countIn).toBe(true)
    expect(readMetronome({ sound: 'voice' }).sound).toBe('click')
  })
})
