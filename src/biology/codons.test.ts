import { describe, it, expect } from 'vitest'
import { optimizeCodons, compareCodonUsage } from './codons'
import { translateDNA } from './translation'

describe('optimizeCodons', () => {
  it('replaces each codon with the organism\'s most frequent synonym (E. coli)', () => {
    // CTA (Leu, 5.3/1000) and AAG (Lys, 12.1/1000) are not E. coli's preferred codons;
    // CTG (46.9/1000) and AAA (33.2/1000) are.
    const result = optimizeCodons('CTAAAG', 'ecoli')
    expect(result.optimizedDNA).toBe('CTGAAA')
    expect(result.changes).toEqual([
      { index: 0, position: 0, before: 'CTA', after: 'CTG' },
      { index: 1, position: 3, before: 'AAG', after: 'AAA' },
    ])
  })

  it('never changes the encoded protein', () => {
    const cds = 'ATGGAATTTAAAGGGCCCTTTAAAGAATGA'
    for (const organism of ['ecoli', 'human', 'yeast'] as const) {
      const result = optimizeCodons(cds, organism)
      expect(result.proteinUnchanged).toBe(true)
      expect(translateDNA(result.optimizedDNA)).toBe(translateDNA(cds))
    }
  })

  it('leaves stop codons untouched', () => {
    const result = optimizeCodons('ATGTAA', 'ecoli')
    expect(result.optimizedDNA.endsWith('TAA')).toBe(true)
  })

  it('does not record a change when the codon is already optimal', () => {
    // AAA is already E. coli's preferred Lys codon
    const result = optimizeCodons('AAA', 'ecoli')
    expect(result.changes).toEqual([])
    expect(result.optimizedDNA).toBe('AAA')
  })

  it('produces a different optimized sequence for a different organism', () => {
    // Leucine: E. coli prefers CTG, yeast prefers TTG/TTA range with CTG being rare
    const cds = 'CTC' // Leu
    const ecoli = optimizeCodons(cds, 'ecoli').optimizedDNA
    const yeast = optimizeCodons(cds, 'yeast').optimizedDNA
    expect(ecoli).toBe('CTG')
    expect(yeast).not.toBe(ecoli)
  })

  it('reports GC% before and after consistent with the actual sequences', () => {
    const result = optimizeCodons('CTAAAG', 'ecoli')
    // CTAAAG: 2 GC of 6 -> 33.33%; CTGAAA: 2 GC of 6 -> 33.33%
    expect(result.gcBefore).toBeCloseTo(33.33, 1)
    expect(result.gcAfter).toBeCloseTo(33.33, 1)
  })
})

describe('compareCodonUsage', () => {
  it('counts codon occurrences and flags the organism-preferred one', () => {
    const entries = compareCodonUsage('CTGCTGCTA', 'ecoli') // 2x CTG, 1x CTA (both Leu)
    const ctg = entries.find((e) => e.codon === 'CTG')!
    const cta = entries.find((e) => e.codon === 'CTA')!
    expect(ctg.countInSequence).toBe(2)
    expect(ctg.isMostFrequent).toBe(true)
    expect(cta.countInSequence).toBe(1)
    expect(cta.isMostFrequent).toBe(false)
  })

  it('excludes stop codons', () => {
    const entries = compareCodonUsage('ATGTAA', 'ecoli')
    expect(entries.some((e) => e.codon === 'TAA')).toBe(false)
  })
})
