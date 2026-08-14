import { describe, it, expect } from 'vitest'
import {
  buildResidueMapping,
  computeBurialScores,
  findStructureMatch,
  NEIGHBOR_RADIUS_ANGSTROM,
} from './structureMapping'
import { translateFeature } from './translation'
import { parseGenBank } from '../parsers/genbank'
import { GFP_CONSTRUCT_GENBANK } from '../data/exampleConstructs/gfpConstruct'
import { MINIMAL_CDS_GENBANK } from '../data/exampleConstructs/minimalCDS'
import { KNOWN_STRUCTURES } from '../data/structures'

describe('buildResidueMapping', () => {
  it('maps identical sequences 1:1 with identity 1', () => {
    const ref = 'MSKGEELFTG'
    const refResSeqs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const mapping = buildResidueMapping(ref, ref, refResSeqs)
    expect(mapping.identity).toBe(1)
    for (let i = 0; i < ref.length; i++) {
      expect(mapping.toReference.get(i + 1)).toBe(refResSeqs[i])
      expect(mapping.toConstruct.get(refResSeqs[i])).toBe(i + 1)
    }
  })

  it('still maps mismatched positions (point-substitution case) — not just match ops', () => {
    // Reference and construct differ at exactly one position (index 4, 0-based): E -> Q.
    const reference = 'MSKGEELFTG'
    const construct = 'MSKGQELFTG'
    const refResSeqs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
    const mapping = buildResidueMapping(construct, reference, refResSeqs)

    expect(mapping.identity).toBeLessThan(1)
    expect(mapping.identity).toBeGreaterThan(0.8)
    // Every position, including the mismatched one, still has a mapping.
    expect(mapping.toReference.size).toBe(10)
    expect(mapping.toReference.get(5)).toBe(14) // the mismatched position itself
    expect(mapping.toReference.get(1)).toBe(10)
    expect(mapping.toReference.get(10)).toBe(19)
  })

  it('leaves inserted construct positions unmapped, and correctly shifts positions after the insertion', () => {
    const reference = 'MAKGEEL'
    const refResSeqs = [10, 11, 12, 13, 14, 15, 16]
    const construct = 'MAKXYZGEEL' // "XYZ" inserted after position 3
    const mapping = buildResidueMapping(construct, reference, refResSeqs)

    // Unaffected prefix maps 1:1.
    expect(mapping.toReference.get(1)).toBe(10)
    expect(mapping.toReference.get(2)).toBe(11)
    expect(mapping.toReference.get(3)).toBe(12)
    // Inserted positions have no reference counterpart.
    expect(mapping.toReference.has(4)).toBe(false)
    expect(mapping.toReference.has(5)).toBe(false)
    expect(mapping.toReference.has(6)).toBe(false)
    // Positions after the insertion still map correctly, shifted by the insertion length.
    expect(mapping.toReference.get(7)).toBe(13) // G
    expect(mapping.toReference.get(8)).toBe(14) // E
    expect(mapping.toReference.get(9)).toBe(15) // E
    expect(mapping.toReference.get(10)).toBe(16) // L
    expect(mapping.identity).toBe(1) // every aligned (non-gap) position is an exact match
  })

  it('degrades honestly on a frameshift-style garbled tail: pre-divergence positions map correctly, identity drops well below threshold', () => {
    const reference = 'ACDEFGHIKLMNPQRSTVWY' // 20 distinct standard amino acids
    const refResSeqs = Array.from({ length: 20 }, (_, i) => i + 1)
    // First 10 residues identical; last 10 are a garbled, non-matching tail (as a frameshift's
    // downstream mistranslation would produce) built from letters absent in the reference's
    // second half, so there's no accidental identity in the garbled region.
    const construct = 'ACDEFGHIKL' + 'LKIHGFEDCA'
    const mapping = buildResidueMapping(construct, reference, refResSeqs)

    expect(mapping.toReference.get(1)).toBe(1)
    expect(mapping.toReference.get(10)).toBe(10)
    expect(mapping.identity).toBeLessThan(0.7) // well below IDENTITY_THRESHOLD
  })
})

describe('findStructureMatch', () => {
  it('returns null for a CDS unrelated to GFP', () => {
    const { records } = parseGenBank(MINIMAL_CDS_GENBANK)
    const construct = records[0]
    const cdsFeatures = construct.features.filter((f) => f.type === 'CDS')
    expect(findStructureMatch(cdsFeatures, construct.sequence, KNOWN_STRUCTURES)).toBeNull()
  })

  it('matches the shipped GFP construct against 1EMA at high identity', () => {
    const { records } = parseGenBank(GFP_CONSTRUCT_GENBANK)
    const construct = records[0]
    const cdsFeatures = construct.features.filter((f) => f.type === 'CDS')
    const match = findStructureMatch(cdsFeatures, construct.sequence, KNOWN_STRUCTURES)

    expect(match).not.toBeNull()
    expect(match!.structure.pdbId).toBe('1EMA')
    // Real, computed identity (not hand-derived) — comfortably in the high-0.9x range.
    expect(match!.mapping.identity).toBeGreaterThan(0.95)

    // The construct's chromophore-forming residue (position 65) is genuinely unmapped: 1EMA
    // records residues 65-67 as a single modified HETATM residue ("CRO", the cyclized
    // chromophore), not three separate resolvable ATOM Cα entries — so there is no reference
    // resSeq 65 to align against at all (an honest gap, not a same-position mismatch).
    expect(match!.mapping.toReference.has(65)).toBe(false)

    // Real mismatched (aligned-but-different) positions found by the alignment.
    const cds = cdsFeatures[0]
    const codons = translateFeature(cds, construct.sequence)
    const protein = codons
      .filter((c) => c.aa !== '*')
      .map((c) => c.aa)
      .join('')
    const refResSeqAt72 = match!.mapping.toReference.get(72)!
    const refResidueAt72 = match!.structure.residues.find((r) => r.resSeq === refResSeqAt72)!
    expect(protein[71]).not.toBe(refResidueAt72.resName)
  })
})

describe('computeBurialScores', () => {
  it('scores every point in a tight cluster as buried', () => {
    // 17 points close enough together that every point has 16 neighbors (>= BURIED_MIN).
    const residues = Array.from({ length: 17 }, (_, i) => ({
      resSeq: i + 1,
      ca: [i * 0.1, 0, 0] as [number, number, number],
    }))
    const scores = computeBurialScores(residues)
    for (const score of scores) {
      expect(score.neighborCount).toBe(16)
      expect(score.category).toBe('buried')
    }
  })

  it('scores far-apart points as exposed, and never counts a residue as its own neighbor', () => {
    const residues = Array.from({ length: 5 }, (_, i) => ({
      resSeq: i + 1,
      ca: [i * 1000, 0, 0] as [number, number, number], // far beyond NEIGHBOR_RADIUS_ANGSTROM
    }))
    const scores = computeBurialScores(residues)
    for (const score of scores) {
      expect(score.neighborCount).toBe(0) // not 1 — a residue never counts itself
      expect(score.category).toBe('exposed')
    }
  })

  it('is boundary-inclusive at exactly EXPOSED_MAX (8) neighbors', () => {
    const target = { resSeq: 0, ca: [0, 0, 0] as [number, number, number] }
    const near = Array.from({ length: 8 }, (_, i) => ({
      resSeq: i + 1,
      ca: [5, i, 0] as [number, number, number], // within NEIGHBOR_RADIUS_ANGSTROM of target
    }))
    const far = { resSeq: 100, ca: [1000, 0, 0] as [number, number, number] }
    const scores = computeBurialScores([target, ...near, far])
    const targetScore = scores.find((s) => s.resSeq === 0)!
    expect(targetScore.neighborCount).toBe(8)
    expect(targetScore.category).toBe('exposed')
  })

  it('is boundary-inclusive at exactly BURIED_MIN (16) neighbors', () => {
    const target = { resSeq: 0, ca: [0, 0, 0] as [number, number, number] }
    const near = Array.from({ length: 16 }, (_, i) => ({
      resSeq: i + 1,
      ca: [1, i * 0.1, 0] as [number, number, number],
    }))
    const scores = computeBurialScores([target, ...near])
    const targetScore = scores.find((s) => s.resSeq === 0)!
    expect(targetScore.neighborCount).toBe(16)
    expect(targetScore.category).toBe('buried')
    expect(NEIGHBOR_RADIUS_ANGSTROM).toBe(11)
  })

  it('scores an in-between neighbor count as intermediate', () => {
    const target = { resSeq: 0, ca: [0, 0, 0] as [number, number, number] }
    const near = Array.from({ length: 12 }, (_, i) => ({
      resSeq: i + 1,
      ca: [1, i * 0.1, 0] as [number, number, number],
    }))
    const scores = computeBurialScores([target, ...near])
    const targetScore = scores.find((s) => s.resSeq === 0)!
    expect(targetScore.neighborCount).toBe(12)
    expect(targetScore.category).toBe('intermediate')
  })
})
