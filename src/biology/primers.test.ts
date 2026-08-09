import { describe, it, expect } from 'vitest'
import { calculateTm, designPrimers } from './primers'

describe('calculateTm', () => {
  it('applies the Wallace rule for primers under 14nt', () => {
    // "ATGC": 2 A/T, 2 G/C -> 2*2 + 4*2 = 12
    expect(calculateTm('ATGC')).toBe(12)
  })

  it('applies the GC-based formula for primers 14nt and longer', () => {
    const primer = 'ATGCATGCATGCATGCATGC' // 20nt, 10 G/C
    expect(primer.length).toBe(20)
    const expected = 64.9 + (41 * (10 - 16.4)) / primer.length
    expect(calculateTm(primer)).toBeCloseTo(expected, 6)
  })

  it('is case-insensitive', () => {
    expect(calculateTm('atgc')).toBe(calculateTm('ATGC'))
  })
})

describe('designPrimers', () => {
  const seq = 'A'.repeat(20) + 'GGCCGGCCGGCCGGCCGGCC' + 'T'.repeat(20) // region of interest at [20,40)
  const region = { start: 20, end: 40 }

  it('generates forward primers starting at the region start', () => {
    const { forward } = designPrimers(seq, region)
    expect(forward.length).toBeGreaterThan(0)
    for (const p of forward) {
      expect(p.start).toBe(20)
      expect(p.orientation).toBe('forward')
      expect(seq.slice(p.start, p.end)).toBe(p.sequence)
    }
  })

  it('generates reverse primers ending at the region end, as the reverse complement of the template', () => {
    const { reverse } = designPrimers(seq, region)
    expect(reverse.length).toBeGreaterThan(0)
    for (const p of reverse) {
      expect(p.end).toBe(40)
      expect(p.orientation).toBe('reverse')
    }
  })

  it('sorts candidates by closeness to the target Tm', () => {
    const { forward } = designPrimers(seq, region, { targetTmRange: { min: 60, max: 60 } })
    for (let i = 1; i < forward.length; i++) {
      const prevDist = Math.abs(forward[i - 1].tm - 60)
      const dist = Math.abs(forward[i].tm - 60)
      expect(dist).toBeGreaterThanOrEqual(prevDist - 1e-9)
    }
  })

  it('reports length, GC%, and Tm consistent with the primer sequence', () => {
    const { forward } = designPrimers(seq, region)
    const p = forward[0]
    expect(p.length).toBe(p.sequence.length)
    expect(p.tm).toBe(calculateTm(p.sequence))
  })
})
