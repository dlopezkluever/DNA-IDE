import { describe, it, expect } from 'vitest'
import { findORFs } from './orf'
import { reverseComplement } from './sequence'

describe('findORFs (linear)', () => {
  const payload = 'ATGGAATTTTGA' // ATG GAA TTT TGA -> M E F *
  const seq = 'AAA' + payload + 'AAA' // 3 + 12 + 3 = 18nt

  it('finds a simple forward-strand ORF', () => {
    const orfs = findORFs(seq, { minLength: 1, strands: [1] })
    expect(orfs).toEqual([
      { start: 3, end: 15, strand: 1, frame: 0, length: 12, aminoAcidLength: 3, proteinSequence: 'MEF*' },
    ])
  })

  it('finds ORFs on the reverse strand by scanning the reverse complement', () => {
    const rcSeq = 'AAA' + reverseComplement(payload) + 'AAA'
    const orfs = findORFs(rcSeq, { minLength: 1, strands: [-1] })
    expect(orfs.length).toBe(1)
    expect(orfs[0].strand).toBe(-1)
    expect(orfs[0].proteinSequence).toBe('MEF*')
  })

  it('reports no ORF when there is a start codon but no downstream in-frame stop', () => {
    const noStop = 'AAAATGGAAAAAGGGCCCTTTAAA' // ATG present, no TAA/TAG/TGA in frame after it
    expect(findORFs(noStop, { minLength: 1, strands: [1] })).toEqual([])
  })

  it('applies the default minLength=100 filter', () => {
    // the 12nt payload ORF above is well under the default threshold
    expect(findORFs(seq, { strands: [1] })).toEqual([])
  })

  it('scans both strands by default and sorts by start position', () => {
    const orfs = findORFs(seq, { minLength: 1 })
    expect(orfs.length).toBeGreaterThanOrEqual(1)
    for (let i = 1; i < orfs.length; i++) {
      expect(orfs[i].start).toBeGreaterThanOrEqual(orfs[i - 1].start)
    }
  })
})

describe('findORFs (circular)', () => {
  // "TTTTGA" + "CCCCCC" + "ATGGAA" — going around the origin reads
  // ...ATGGAA|TTTTGA... = ATG GAA TTT TGA, the same payload as above.
  const seq = 'TTTTGACCCCCCATGGAA'

  it('finds an ORF that spans the origin only when topology is circular', () => {
    const orfs = findORFs(seq, { topology: 'circular', minLength: 1, strands: [1] })
    expect(orfs).toEqual([
      { start: 12, end: 6, strand: 1, frame: 0, length: 12, aminoAcidLength: 3, proteinSequence: 'MEF*' },
    ])
  })

  it('does not find the wrapping ORF when treated as linear', () => {
    const orfs = findORFs(seq, { topology: 'linear', minLength: 1, strands: [1] })
    expect(orfs).toEqual([])
  })

  it('does not double-count the wrapping ORF as a duplicate', () => {
    const orfs = findORFs(seq, { topology: 'circular', minLength: 1, strands: [1] })
    expect(orfs.length).toBe(1)
  })
})
