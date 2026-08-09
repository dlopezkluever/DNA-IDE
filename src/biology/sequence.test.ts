import { describe, it, expect } from 'vitest'
import {
  complement,
  reverseComplement,
  calculateGC,
  slidingWindowGC,
  normalizeSequence,
  validateSequence,
  wrapIndex,
  spansOrigin,
  getSubsequence,
  featureLength,
  toDisplayPosition,
  fromDisplayPosition,
} from './sequence'

describe('complement', () => {
  it('complements the four standard bases', () => {
    expect(complement('A')).toBe('T')
    expect(complement('T')).toBe('A')
    expect(complement('G')).toBe('C')
    expect(complement('C')).toBe('G')
  })

  it('complements IUPAC ambiguity codes symmetrically (involutive)', () => {
    const codes = ['A', 'T', 'C', 'G', 'R', 'Y', 'S', 'W', 'K', 'M', 'B', 'V', 'D', 'H', 'N']
    for (const code of codes) {
      expect(complement(complement(code))).toBe(code)
    }
  })

  it('is case-insensitive', () => {
    expect(complement('a')).toBe('T')
  })
})

describe('reverseComplement', () => {
  it('matches the PRD explain-mode worked example', () => {
    // PRD §25: 5' ATGCCGTA 3' -> reverse complement 5' TACGGCAT 3'
    expect(reverseComplement('ATGCCGTA')).toBe('TACGGCAT')
  })

  it('matches a simple hand-traced example', () => {
    expect(reverseComplement('ATGC')).toBe('GCAT')
  })

  it('is its own inverse (round trip)', () => {
    const seq = 'ATGCCGTACGGGCTTAAGN'
    expect(reverseComplement(reverseComplement(seq))).toBe(seq)
  })

  it('handles empty string', () => {
    expect(reverseComplement('')).toBe('')
  })
})

describe('calculateGC', () => {
  it('returns 100 for all-GC sequence', () => {
    expect(calculateGC('GGCC')).toBe(100)
  })

  it('returns 0 for all-AT sequence', () => {
    expect(calculateGC('ATAT')).toBe(0)
  })

  it('returns 50 for an even mix', () => {
    expect(calculateGC('ATGC')).toBe(50)
  })

  it('excludes ambiguous bases from the denominator', () => {
    // 2 GC out of 4 significant (A,T,G,C) bases; the N is excluded entirely
    expect(calculateGC('ATGCN')).toBe(50)
  })

  it('returns 0 for an empty sequence rather than NaN', () => {
    expect(calculateGC('')).toBe(0)
  })

  it('returns 0 when only ambiguous bases are present', () => {
    expect(calculateGC('NNNN')).toBe(0)
  })
})

describe('slidingWindowGC', () => {
  it('produces the correct number of windows', () => {
    const seq = 'A'.repeat(20)
    const windows = slidingWindowGC(seq, 5, 1)
    expect(windows.length).toBe(20 - 5 + 1)
  })

  it('computes correct GC% per window', () => {
    const seq = 'GGGGAAAA' // first half all GC, second half all AT
    const windows = slidingWindowGC(seq, 4, 4)
    expect(windows).toEqual([
      { start: 0, end: 4, gc: 100 },
      { start: 4, end: 8, gc: 0 },
    ])
  })

  it('falls back to a single whole-sequence window if windowSize exceeds length', () => {
    const windows = slidingWindowGC('ATGC', 100)
    expect(windows).toEqual([{ start: 0, end: 4, gc: 50 }])
  })

  it('returns empty array for empty sequence', () => {
    expect(slidingWindowGC('', 5)).toEqual([])
  })
})

describe('normalizeSequence', () => {
  it('uppercases and strips non-letter characters', () => {
    expect(normalizeSequence('  atg\n1 ccg-tac  ')).toBe('ATGCCGTAC')
  })
})

describe('validateSequence', () => {
  it('accepts a clean ACGT sequence', () => {
    expect(validateSequence('ACGTACGT')).toEqual({ valid: true, invalidChars: [] })
  })

  it('accepts IUPAC ambiguity codes', () => {
    expect(validateSequence('ACGTRYSWKMN').valid).toBe(true)
  })

  it('flags invalid characters with their index', () => {
    const result = validateSequence('ACG1TZ')
    expect(result.valid).toBe(false)
    expect(result.invalidChars).toEqual([
      { char: '1', index: 3 },
      { char: 'Z', index: 5 },
    ])
  })
})

describe('wrapIndex', () => {
  it('wraps positive overflow', () => {
    expect(wrapIndex(12, 10)).toBe(2)
  })

  it('wraps negative values', () => {
    expect(wrapIndex(-1, 10)).toBe(9)
  })

  it('leaves in-range values untouched', () => {
    expect(wrapIndex(5, 10)).toBe(5)
  })
})

describe('spansOrigin', () => {
  it('is true when end < start', () => {
    expect(spansOrigin({ start: 10, end: 5 })).toBe(true)
  })

  it('is false for a normal forward range', () => {
    expect(spansOrigin({ start: 5, end: 10 })).toBe(false)
  })
})

describe('getSubsequence', () => {
  const seq = 'ABCDEFGHIJ'

  it('slices normally within bounds', () => {
    expect(getSubsequence(seq, 2, 5, 'linear')).toBe('CDE')
  })

  it('wraps across the origin for circular topology when end < start', () => {
    expect(getSubsequence(seq, 8, 2, 'circular')).toBe('IJAB')
  })

  it('clamps to sequence bounds for linear topology', () => {
    expect(getSubsequence(seq, -5, 100, 'linear')).toBe(seq)
  })
})

describe('featureLength', () => {
  const seqLen = 20

  it('computes a normal forward feature', () => {
    expect(featureLength({ start: 2, end: 10 }, seqLen)).toBe(8)
  })

  it('computes an origin-wrapping feature via end < start convention', () => {
    expect(featureLength({ start: 18, end: 3 }, seqLen)).toBe(5)
  })

  it('sums segment lengths for a join()-style feature', () => {
    const feature = {
      start: 15,
      end: 5,
      segments: [
        { start: 15, end: 20 },
        { start: 0, end: 5 },
      ],
    }
    expect(featureLength(feature, seqLen)).toBe(10)
  })
})

describe('display position conversion', () => {
  it('round trips 0-based <-> 1-based', () => {
    expect(toDisplayPosition(0)).toBe(1)
    expect(fromDisplayPosition(1)).toBe(0)
    expect(fromDisplayPosition(toDisplayPosition(541))).toBe(541)
  })
})
