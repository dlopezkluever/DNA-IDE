import { describe, it, expect } from 'vitest'
import {
  STANDARD_CODON_TABLE,
  translateCodon,
  translateDNA,
  translateFrame,
  translateFeature,
  isStartCodon,
  isStopCodon,
  AMINO_ACID_INFO,
} from './translation'
import { reverseComplement } from './sequence'

describe('STANDARD_CODON_TABLE', () => {
  it('contains all 64 codons', () => {
    expect(Object.keys(STANDARD_CODON_TABLE).length).toBe(64)
  })

  it('has exactly 3 stop codons', () => {
    const stops = Object.entries(STANDARD_CODON_TABLE).filter(([, aa]) => aa === '*')
    expect(stops.map(([codon]) => codon).sort()).toEqual(['TAA', 'TAG', 'TGA'])
  })

  it('every amino acid returned has an entry in AMINO_ACID_INFO', () => {
    for (const aa of Object.values(STANDARD_CODON_TABLE)) {
      expect(AMINO_ACID_INFO[aa]).toBeDefined()
    }
  })
})

describe('translateCodon', () => {
  it('translates known codons', () => {
    expect(translateCodon('ATG')).toBe('M')
    expect(translateCodon('TTT')).toBe('F')
    expect(translateCodon('GGG')).toBe('G')
    expect(translateCodon('TAA')).toBe('*')
  })

  it('is case-insensitive', () => {
    expect(translateCodon('atg')).toBe('M')
  })

  it('returns X for malformed input', () => {
    expect(translateCodon('AT')).toBe('X')
    expect(translateCodon('ATGG')).toBe('X')
    expect(translateCodon('NNN')).toBe('X')
  })
})

describe('isStartCodon / isStopCodon', () => {
  it('identifies ATG as the start codon', () => {
    expect(isStartCodon('ATG')).toBe(true)
    expect(isStartCodon('atg')).toBe(true)
    expect(isStartCodon('GTG')).toBe(false)
  })

  it('identifies all three stop codons', () => {
    expect(isStopCodon('TAA')).toBe(true)
    expect(isStopCodon('TAG')).toBe(true)
    expect(isStopCodon('TGA')).toBe(true)
    expect(isStopCodon('AAA')).toBe(false)
  })
})

describe('translateDNA', () => {
  it('matches the PRD explain-mode worked example (ATG GAA TTT TGA -> M-E-F-*)', () => {
    expect(translateDNA('ATGGAATTTTGA')).toBe('MEF*')
  })

  it('continues past internal stops when toStop is false (default)', () => {
    expect(translateDNA('ATGGAATTTTGAAAA')).toBe('MEF*K')
  })

  it('truncates immediately after the first stop when toStop is true', () => {
    expect(translateDNA('ATGGAATTTTGAAAA', { toStop: true })).toBe('MEF*')
  })

  it('respects the frame offset', () => {
    // shifting frame by 1 re-groups the codons entirely
    expect(translateDNA('AATGGAATTTTGA', { frame: 1 })).toBe('MEF*')
  })

  it('drops a trailing incomplete codon', () => {
    expect(translateDNA('ATGGAATT')).toBe('ME') // trailing "TT" is incomplete, dropped
  })
})

describe('translateFrame', () => {
  const seq = 'ATGGAATTTTGA' // ATG GAA TTT TGA

  it('returns codons with correct plus-strand coordinates for strand 1', () => {
    const codons = translateFrame(seq, 0, 1)
    expect(codons).toEqual([
      { seq: 'ATG', aa: 'M', start: 0, end: 3 },
      { seq: 'GAA', aa: 'E', start: 3, end: 6 },
      { seq: 'TTT', aa: 'F', start: 6, end: 9 },
      { seq: 'TGA', aa: '*', start: 9, end: 12 },
    ])
  })

  it('every minus-strand codon is the reverse complement of its own plus-strand coordinate range', () => {
    const codons = translateFrame(seq, 0, -1)
    for (const codon of codons) {
      expect(codon.seq).toBe(reverseComplement(seq.slice(codon.start, codon.end)))
      expect(codon.aa).toBe(translateCodon(codon.seq))
    }
  })

  it('minus-strand frame 0 covers the sequence end-to-start with contiguous, non-overlapping ranges', () => {
    const codons = translateFrame(seq, 0, -1)
    expect(codons.length).toBe(4)
    expect(codons[0].start).toBe(9)
    expect(codons[0].end).toBe(12)
    expect(codons[codons.length - 1].start).toBe(0)
    expect(codons[codons.length - 1].end).toBe(3)
  })

  it('drops trailing bases that do not complete a codon', () => {
    const codons = translateFrame('ATGGAATT', 0, 1)
    expect(codons.length).toBe(2)
  })
})

describe('translateFeature', () => {
  const payload = 'ATGGAATTTTGA' // ATG GAA TTT TGA -> MEF*

  it('plus-strand feature: codons carry direct plus-strand coordinates', () => {
    const seq = 'AAA' + payload + 'AAA'
    const codons = translateFeature({ start: 3, end: 15, strand: 1 }, seq)
    expect(codons).toEqual([
      { seq: 'ATG', aa: 'M', start: 3, end: 6 },
      { seq: 'GAA', aa: 'E', start: 6, end: 9 },
      { seq: 'TTT', aa: 'F', start: 9, end: 12 },
      { seq: 'TGA', aa: '*', start: 12, end: 15 },
    ])
  })

  it('minus-strand feature: reads MEF* with coordinates decreasing across the codon list', () => {
    const seq = 'AAA' + reverseComplement(payload) + 'AAA'
    const codons = translateFeature({ start: 3, end: 15, strand: -1 }, seq)
    expect(codons.map((c) => c.aa).join('')).toBe('MEF*')
    expect(codons).toEqual([
      { seq: 'ATG', aa: 'M', start: 12, end: 15 },
      { seq: 'GAA', aa: 'E', start: 9, end: 12 },
      { seq: 'TTT', aa: 'F', start: 6, end: 9 },
      { seq: 'TGA', aa: '*', start: 3, end: 6 },
    ])
  })

  it('minus-strand spliced feature (complement(join(...))): reads MEF* across the junction', () => {
    // Same fixture as mutations.test.ts's complement(join(...)) case.
    const piece1 = 'TCAAAA' // [0,6)
    const spacer = 'CCCCCCCCCC'
    const piece2 = 'TTCCAT' // [16,22)
    const seq = piece1 + spacer + piece2
    const feature = {
      start: 0,
      end: 22,
      strand: -1 as const,
      segments: [
        { start: 0, end: 6 },
        { start: 16, end: 22 },
      ],
    }
    const codons = translateFeature(feature, seq)
    expect(codons.map((c) => c.aa).join('')).toBe('MEF*')
    expect(codons[0]).toEqual({ seq: 'ATG', aa: 'M', start: 19, end: 22 })
    expect(codons[3]).toEqual({ seq: 'TGA', aa: '*', start: 0, end: 3 })
  })
})
