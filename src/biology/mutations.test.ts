import { describe, it, expect } from 'vitest'
import { applyMutation, classifyMutation, shiftFeatureCoordinates } from './mutations'
import { reverseComplement } from './sequence'
import type { Construct, Feature } from '../types/models'

function cds(overrides: Partial<Feature> = {}): Feature {
  return { id: 'cds1', type: 'CDS', name: 'testCDS', start: 3, end: 15, strand: 1, ...overrides }
}

describe('shiftFeatureCoordinates', () => {
  const features: Feature[] = [
    { id: 'before', type: 'misc', name: 'before', start: 0, end: 5, strand: 1 },
    { id: 'containing', type: 'CDS', name: 'containing', start: 3, end: 20, strand: 1 },
    { id: 'after', type: 'misc', name: 'after', start: 25, end: 30, strand: 1 },
  ]

  it('leaves features entirely before the edit position untouched', () => {
    const [before] = shiftFeatureCoordinates(features, 10, 5)
    expect(before).toEqual(features[0])
  })

  it('shifts both start and end for features starting at/after the edit position', () => {
    const [, , after] = shiftFeatureCoordinates(features, 10, 5)
    expect(after).toMatchObject({ start: 30, end: 35 })
  })

  it('keeps start and shifts only end for a feature containing the edit position', () => {
    const [, containing] = shiftFeatureCoordinates(features, 10, 5)
    expect(containing).toMatchObject({ start: 3, end: 25 })
  })

  it('is a no-op when deltaLength is 0', () => {
    expect(shiftFeatureCoordinates(features, 10, 0)).toEqual(features)
  })

  it('shifts every segment of a multi-segment feature independently', () => {
    const joined: Feature = {
      id: 'j',
      type: 'CDS',
      name: 'joined',
      start: 0,
      end: 20,
      strand: 1,
      segments: [
        { start: 0, end: 5 },
        { start: 15, end: 20 },
      ],
    }
    const [shifted] = shiftFeatureCoordinates([joined], 17, 3)
    // position 17 falls inside the second segment [15,20) -> that segment keeps its start, shifts its end
    expect(shifted.segments).toEqual([
      { start: 0, end: 5 },
      { start: 15, end: 23 },
    ])
    expect(shifted.start).toBe(0)
    expect(shifted.end).toBe(23)
  })
})

describe('classifyMutation: plus-strand substitutions (CDS ATG GAA TTT TGA)', () => {
  const payload = 'ATGGAATTTTGA'
  const seqBefore = 'AAA' + payload + 'AAA' // CDS at [3, 15)
  const feature = cds()

  it('synonymous: TTT -> TTC (Phe -> Phe)', () => {
    const seqAfter = seqBefore.slice(0, 11) + 'C' + seqBefore.slice(12)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 11, reference: 'T', alternate: 'C' })
    expect(effect).toEqual({
      consequence: 'synonymous',
      codonBefore: 'TTT',
      codonAfter: 'TTC',
      aminoAcidBefore: 'F',
      aminoAcidAfter: 'F',
      aminoAcidPosition: 3,
    })
  })

  it('missense: TTT -> GTT (Phe -> Val)', () => {
    const seqAfter = seqBefore.slice(0, 9) + 'G' + seqBefore.slice(10)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 9, reference: 'T', alternate: 'G' })
    expect(effect).toEqual({
      consequence: 'missense',
      codonBefore: 'TTT',
      codonAfter: 'GTT',
      aminoAcidBefore: 'F',
      aminoAcidAfter: 'V',
      aminoAcidPosition: 3,
    })
  })

  it('nonsense: GAA -> TAA (Glu -> Stop)', () => {
    const seqAfter = seqBefore.slice(0, 6) + 'T' + seqBefore.slice(7)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 6, reference: 'G', alternate: 'T' })
    expect(effect).toEqual({
      consequence: 'nonsense',
      codonBefore: 'GAA',
      codonAfter: 'TAA',
      aminoAcidBefore: 'E',
      aminoAcidAfter: '*',
      aminoAcidPosition: 2,
    })
  })

  it('start-loss: ATG -> GTG (Met -> Val at position 1)', () => {
    const seqAfter = seqBefore.slice(0, 3) + 'G' + seqBefore.slice(4)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 3, reference: 'A', alternate: 'G' })
    expect(effect).toEqual({
      consequence: 'start-loss',
      codonBefore: 'ATG',
      codonAfter: 'GTG',
      aminoAcidBefore: 'M',
      aminoAcidAfter: 'V',
      aminoAcidPosition: 1,
    })
  })

  it('stop-loss: TGA -> GGA (Stop -> Gly)', () => {
    const seqAfter = seqBefore.slice(0, 12) + 'G' + seqBefore.slice(13)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 12, reference: 'T', alternate: 'G' })
    expect(effect).toEqual({
      consequence: 'stop-loss',
      codonBefore: 'TGA',
      codonAfter: 'GGA',
      aminoAcidBefore: '*',
      aminoAcidAfter: 'G',
      aminoAcidPosition: 4,
    })
  })

  it('a mutation position outside the given feature is noncoding', () => {
    const seqAfter = 'G' + seqBefore.slice(1)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 0, reference: 'A', alternate: 'G' })
    expect(effect).toEqual({ consequence: 'noncoding' })
  })
})

describe('classifyMutation: indels', () => {
  const payload = 'ATGGAATTTTGA'
  const seqBefore = 'AAA' + payload + 'AAA'
  const feature = cds()

  it('a 1bp insertion causes a frameshift', () => {
    const seqAfter = seqBefore.slice(0, 6) + 'A' + seqBefore.slice(6)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 6, reference: '', alternate: 'A' })
    expect(effect.consequence).toBe('frameshift')
  })

  it('a 2bp deletion causes a frameshift', () => {
    const seqAfter = seqBefore.slice(0, 9) + seqBefore.slice(11)
    const effect = classifyMutation(feature, seqBefore, seqAfter, {
      position: 9,
      reference: seqBefore.slice(9, 11),
      alternate: '',
    })
    expect(effect.consequence).toBe('frameshift')
  })

  it('a 3bp in-frame insertion between codons adds a residue without disturbing start/stop', () => {
    // insert "GGG" right after GAA (position 9): ATG GAA [GGG] TTT TGA -> M E G F *
    const seqAfter = seqBefore.slice(0, 9) + 'GGG' + seqBefore.slice(9)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 9, reference: '', alternate: 'GGG' })
    expect(effect.consequence).toBe('in-frame-indel')
  })

  it('an in-frame deletion of the start codon is reported as start-loss', () => {
    const seqAfter = seqBefore.slice(0, 3) + seqBefore.slice(6)
    const effect = classifyMutation(feature, seqBefore, seqAfter, {
      position: 3,
      reference: seqBefore.slice(3, 6),
      alternate: '',
    })
    expect(effect.consequence).toBe('start-loss')
  })
})

describe('classifyMutation: minus-strand CDS', () => {
  const payload = 'ATGGAATTTTGA'
  const seqBefore = 'AAA' + reverseComplement(payload) + 'AAA' // reading direction still spells MEF*
  const feature = cds({ strand: -1 })

  it('reads the correct codon on the reverse strand: nonsense GAA -> TAA', () => {
    // position 11 is the plus-strand base whose complement is the first base of reading-codon 2 (GAA)
    expect(seqBefore[11]).toBe('C')
    const seqAfter = seqBefore.slice(0, 11) + 'A' + seqBefore.slice(12)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 11, reference: 'C', alternate: 'A' })
    expect(effect).toEqual({
      consequence: 'nonsense',
      codonBefore: 'GAA',
      codonAfter: 'TAA',
      aminoAcidBefore: 'E',
      aminoAcidAfter: '*',
      aminoAcidPosition: 2,
    })
  })
})

describe('classifyMutation: minus-strand spliced (complement(join(...))) CDS', () => {
  // Plus-strand pieces, listed in ascending-coordinate order as GenBank convention requires:
  // piece1 [0,6) = 'TCAAAA', piece2 [16,22) = 'TTCCAT'.
  // Per INSDC semantics, complement(join(A,B)) = reverseComplement(A + B) — i.e. the pieces are
  // joined in listed order FIRST, then the whole composite is reverse-complemented, which is why
  // the reading sequence below starts with piece2's reverse complement, not piece1's.
  const piece1 = 'TCAAAA'
  const spacer = 'CCCCCCCCCC'
  const piece2 = 'TTCCAT'
  const seqBefore = piece1 + spacer + piece2 // 22nt
  const feature = cds({
    start: 0,
    end: 22,
    strand: -1,
    segments: [
      { start: 0, end: 6 },
      { start: 16, end: 22 },
    ],
  })

  it('reads MEF* across the splice junction', () => {
    // sanity check via a no-op-equivalent mutation would require a real edit; instead verify
    // indirectly through a start-loss mutation at the true 5' end of the reading sequence.
    expect(seqBefore[21]).toBe('T')
    const seqAfter = seqBefore.slice(0, 21) + 'C' + seqBefore.slice(22)
    const effect = classifyMutation(feature, seqBefore, seqAfter, { position: 21, reference: 'T', alternate: 'C' })
    expect(effect).toEqual({
      consequence: 'start-loss',
      codonBefore: 'ATG',
      codonAfter: 'GTG',
      aminoAcidBefore: 'M',
      aminoAcidAfter: 'V',
      aminoAcidPosition: 1,
    })
  })
})

describe('applyMutation', () => {
  function buildConstruct(): Construct {
    const payload = 'ATGGAATTTTGA'
    return {
      id: 'c1',
      name: 'test',
      sequence: 'AAA' + payload + 'AAA',
      topology: 'linear',
      features: [cds()],
      mutations: [],
    }
  }

  it('applies a synonymous substitution and classifies it correctly', () => {
    const construct = buildConstruct()
    const { construct: updated, mutation } = applyMutation(construct, {
      type: 'substitution',
      position: 11,
      reference: 'T',
      alternate: 'C',
    })
    expect(updated.sequence[11]).toBe('C')
    expect(mutation.proteinEffect?.consequence).toBe('synonymous')
    expect(mutation.affectedFeatureIds).toEqual(['cds1'])
    expect(updated.mutations).toHaveLength(1)
  })

  it('records a noncoding mutation and shifts downstream feature coordinates for an insertion before the CDS', () => {
    const construct = buildConstruct()
    const { construct: updated, mutation } = applyMutation(construct, {
      type: 'insertion',
      position: 0,
      reference: '',
      alternate: 'GG',
    })
    expect(updated.sequence.length).toBe(construct.sequence.length + 2)
    expect(mutation.affectedFeatureIds).toEqual([])
    expect(mutation.proteinEffect).toEqual({ consequence: 'noncoding' })
    expect(updated.features[0]).toMatchObject({ start: 5, end: 17 })
  })

  it('throws when the provided reference does not match the actual sequence', () => {
    const construct = buildConstruct()
    expect(() =>
      applyMutation(construct, { type: 'substitution', position: 3, reference: 'G', alternate: 'C' }),
    ).toThrow(/Reference mismatch/)
  })

  it('does not mutate the original construct object (immutability)', () => {
    const construct = buildConstruct()
    const originalSeq = construct.sequence
    applyMutation(construct, { type: 'substitution', position: 3, reference: 'A', alternate: 'C' })
    expect(construct.sequence).toBe(originalSeq)
    expect(construct.mutations).toHaveLength(0)
  })
})
