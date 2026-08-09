import { describe, it, expect } from 'vitest'
import { assembleFragments, type AssemblyFragment } from './assembly'
import type { Feature } from '../types/models'

function feature(id: string, start: number, end: number): Feature {
  return { id, type: 'misc', name: id, start, end, strand: 1 }
}

describe('assembleFragments', () => {
  it('returns a single fragment unchanged with no junctions', () => {
    const frag: AssemblyFragment = {
      id: 'a',
      label: 'A',
      sequence: 'ACGTACGT',
      features: [feature('f', 0, 4)],
    }
    const result = assembleFragments([frag])
    expect(result.sequence).toBe('ACGTACGT')
    expect(result.junctions).toEqual([])
    expect(result.features[0]).toMatchObject({ id: 'a:f', start: 0, end: 4 })
  })

  it('auto-detects a Gibson-style overlap and trims the duplicate once', () => {
    const fragA: AssemblyFragment = {
      id: 'a',
      label: 'A',
      sequence: 'AAAAAAAAGGATCCTT',
      features: [],
    }
    const fragB: AssemblyFragment = {
      id: 'b',
      label: 'B',
      sequence: 'GGATCCTTCCCCCCCC',
      features: [],
    }
    const result = assembleFragments([fragA, fragB])
    expect(result.junctions).toEqual([{ overlapLength: 8 }])
    expect(result.sequence).toBe('AAAAAAAAGGATCCTTCCCCCCCC') // overlap counted once
    expect(result.sequence.length).toBe(24)
  })

  it('concatenates plainly when there is no overlap', () => {
    const fragA: AssemblyFragment = { id: 'a', label: 'A', sequence: 'AAAA', features: [] }
    const fragB: AssemblyFragment = { id: 'b', label: 'B', sequence: 'TTTT', features: [] }
    const result = assembleFragments([fragA, fragB])
    expect(result.junctions).toEqual([{ overlapLength: 0 }])
    expect(result.sequence).toBe('AAAATTTT')
  })

  it("re-offsets a later fragment's features by the cumulative prior length", () => {
    const fragA: AssemblyFragment = {
      id: 'a',
      label: 'A',
      sequence: 'AAAA',
      features: [feature('f1', 0, 4)],
    }
    const fragB: AssemblyFragment = {
      id: 'b',
      label: 'B',
      sequence: 'TTTT',
      features: [feature('f2', 0, 4)],
    }
    const result = assembleFragments([fragA, fragB])
    expect(result.features).toEqual([
      { id: 'a:f1', type: 'misc', name: 'f1', start: 0, end: 4, strand: 1 },
      { id: 'b:f2', type: 'misc', name: 'f2', start: 4, end: 8, strand: 1 },
    ])
  })

  it('circularizes by trimming a matching overlap between the tail and the first fragment start', () => {
    const fragA: AssemblyFragment = { id: 'a', label: 'A', sequence: 'GGATCCTTAAAA', features: [] }
    const fragB: AssemblyFragment = { id: 'b', label: 'B', sequence: 'CCCCGGATCCTT', features: [] }
    const result = assembleFragments([fragA, fragB], { circularize: true })
    // linear join has no A/B overlap (0), circularizing trims the final 8bp that duplicate fragA's start
    expect(result.junctions).toEqual([{ overlapLength: 0 }, { overlapLength: 8 }])
    expect(result.sequence).toBe('GGATCCTTAAAACCCC')
    expect(result.sequence.length).toBe(16)
  })
})
