import { describe, it, expect } from 'vitest'
import {
  findCandidateGuides,
  scoreGuide,
  buildOffTargetIndex,
  countExactOffTargets,
  findNearMatches,
  type GuideCandidate,
} from './crispr'
import { SPCAS9 } from '../data/pamSystems'
import { reverseComplement } from './sequence'
import type { Feature } from '../types/models'

// 20nt, deliberately alternating so it contains no internal 'GG'/'CC' (which would create
// spurious PAM matches) and no homopolymer run >= 4 (which would trip the scoring heuristic).
const GUIDE = 'ATCG'.repeat(5)

// 20nt, deliberately non-repetitive (no internal periodicity) so off-target/near-match counting
// tests aren't confounded by GUIDE's own 4-base repeat coincidentally re-matching itself at
// shifted offsets.
const UNIQUE_GUIDE = 'ACGTGCATGGTACCGATCAG'

describe('findCandidateGuides', () => {
  it('Case A: a single NGG produces exactly one forward candidate with the correct guideSequence and cutPosition', () => {
    const prefix = 'A'.repeat(5)
    const pam = 'TGG'
    const suffix = 'A'.repeat(5)
    const seq = prefix + GUIDE + pam + suffix

    const candidates = findCandidateGuides(seq, SPCAS9, 'linear')
    expect(candidates).toHaveLength(1)

    const pamPosition = prefix.length + GUIDE.length
    expect(candidates[0]).toEqual({
      id: `fwd-${pamPosition}`,
      strand: 1,
      pamPosition,
      pamSequence: pam,
      guideStart: prefix.length,
      guideEnd: pamPosition,
      guideSequence: GUIDE,
      cutPosition: pamPosition - SPCAS9.cutOffsetFromPAM,
    })
  })

  it('Case B: a single CCN produces exactly one reverse candidate whose guideSequence is the reverse complement of the plus-strand slice', () => {
    const prefix = 'A'.repeat(5)
    const pam = 'CCA'
    const plusSlice = GUIDE
    const suffix = 'A'.repeat(5)
    const seq = prefix + pam + plusSlice + suffix

    const candidates = findCandidateGuides(seq, SPCAS9, 'linear')
    expect(candidates).toHaveLength(1)

    const pamPosition = prefix.length
    const guideStart = pamPosition + pam.length
    const guideEnd = guideStart + plusSlice.length
    expect(candidates[0]).toEqual({
      id: `rev-${pamPosition}`,
      strand: -1,
      pamPosition,
      pamSequence: reverseComplement(pam),
      guideStart,
      guideEnd,
      guideSequence: reverseComplement(plusSlice),
      cutPosition: pamPosition + pam.length + SPCAS9.cutOffsetFromPAM,
    })
    // The exact bug class the spec warns about: a swapped-direction bug would report the
    // plain plus-strand slice instead of its reverse complement.
    expect(candidates[0].guideSequence).not.toBe(plusSlice)
  })

  it('finds a PAM whose GG straddles the circular origin exactly once, not when treated as linear', () => {
    // last base (wildcard) + first two bases ('GG') only form a valid PAM when wrapped
    const seq = 'GG' + 'A'.repeat(27) + 'T'
    expect(seq.length).toBe(30)

    const circular = findCandidateGuides(seq, SPCAS9, 'circular')
    expect(circular).toHaveLength(1)
    expect(circular[0].strand).toBe(1)
    expect(circular[0].pamPosition).toBe(seq.length - 1)
    expect(circular[0].pamSequence).toBe('TGG')
    expect(circular[0].guideSequence).toBe('A'.repeat(20))

    expect(findCandidateGuides(seq, SPCAS9, 'linear')).toEqual([])
  })

  it('extracts a guide window that wraps the circular origin correctly', () => {
    const headPart = 'GATCG' // 5nt -> seq[0:5]
    const pamWildcard = 'T' // seq[5]
    const pamGG = 'GG' // seq[6:8]
    const filler = 'A'.repeat(7) // seq[8:15], safe (no G/C)
    const tailPart = 'ATCG'.repeat(3) + 'ATC' // 15nt -> seq[15:30]
    const seq = headPart + pamWildcard + pamGG + filler + tailPart
    expect(seq.length).toBe(30)

    const candidates = findCandidateGuides(seq, SPCAS9, 'circular')
    const match = candidates.find((c) => c.strand === 1 && c.pamPosition === 5)
    expect(match).toBeDefined()
    expect(match!.guideStart).toBe(15)
    expect(match!.guideEnd).toBe(5)
    expect(match!.guideSequence).toBe(tailPart + headPart)
  })

  it('linear: excludes candidates whose guide window would run off either end, rather than clamping', () => {
    const seqA = 'A'.repeat(5) + 'TGG' + 'A'.repeat(30) // PAM at 5, only 5nt precede it
    expect(
      findCandidateGuides(seqA, SPCAS9, 'linear').some((c) => c.strand === 1 && c.pamPosition === 5),
    ).toBe(false)
    expect(
      findCandidateGuides(seqA, SPCAS9, 'circular').some(
        (c) => c.strand === 1 && c.pamPosition === 5,
      ),
    ).toBe(true)

    const j = 30
    const seqB = 'A'.repeat(30) + 'CCA' + 'A'.repeat(5) // PAM at 30, only 5nt follow it
    expect(
      findCandidateGuides(seqB, SPCAS9, 'linear').some((c) => c.strand === -1 && c.pamPosition === j),
    ).toBe(false)
    expect(
      findCandidateGuides(seqB, SPCAS9, 'circular').some(
        (c) => c.strand === -1 && c.pamPosition === j,
      ),
    ).toBe(true)
  })

  it('overlapping PAMs in a poly-G run produce the expected number of shifted candidates', () => {
    const prefix = 'A'.repeat(25)
    const run = 'AGGG' // PAM matches at local i=0 ('AGG') and i=1 ('GGG')
    const seq = prefix + run + 'A'.repeat(5)

    expect(() => findCandidateGuides(seq, SPCAS9, 'linear')).not.toThrow()
    const runCandidates = findCandidateGuides(seq, SPCAS9, 'linear')
      .filter((c) => c.strand === 1)
      .filter((c) => c.pamPosition >= prefix.length && c.pamPosition < prefix.length + run.length)
    expect(runCandidates).toHaveLength(2)
    expect(runCandidates.map((c) => c.pamSequence)).toEqual(['AGG', 'GGG'])
  })
})

describe('scoreGuide', () => {
  function candidate(overrides: Partial<GuideCandidate> = {}): GuideCandidate {
    return {
      id: 'fwd-100',
      strand: 1,
      pamPosition: 100,
      pamSequence: 'TGG',
      guideStart: 80,
      guideEnd: 100,
      guideSequence: GUIDE,
      cutPosition: 97,
      ...overrides,
    }
  }

  it('rates a favorable-GC, non-repetitive, non-overlapping, off-target-free guide as strong', () => {
    const score = scoreGuide(candidate(), 'N'.repeat(200), [], 0)
    expect(score.gcContent).toBe(50)
    expect(score.gcFavorable).toBe(true)
    expect(score.homopolymerRun).toBeNull()
    expect(score.isPolyT).toBe(false)
    expect(score.featureContext).toBeNull()
    expect(score.rating).toBe('strong')
  })

  it('downgrades one tier for unfavorable GC content', () => {
    const guideSequence = 'AT'.repeat(10) // 0% GC, no homopolymer run
    const score = scoreGuide(candidate({ guideSequence }), 'N'.repeat(200), [], 0)
    expect(score.gcFavorable).toBe(false)
    expect(score.homopolymerRun).toBeNull()
    expect(score.rating).toBe('moderate')
  })

  it('downgrades one tier for a non-poly-T homopolymer run', () => {
    const guideSequence = 'AAAA' + 'ATCG'.repeat(4) // run of >=4 A's, GC exactly 40% (favorable)
    const score = scoreGuide(candidate({ guideSequence }), 'N'.repeat(200), [], 0)
    expect(score.homopolymerRun?.base).toBe('A')
    expect(score.gcFavorable).toBe(true)
    expect(score.isPolyT).toBe(false)
    expect(score.rating).toBe('moderate')
  })

  it('rates a poly-T guide as weak outright, overriding every other factor', () => {
    const guideSequence = 'TTTT' + 'ATCG'.repeat(4)
    const cdsFeature: Feature = { id: 'cds1', type: 'CDS', name: 'gfp', start: 0, end: 60, strand: 1 }
    const c = candidate({ guideSequence, cutPosition: 45 }) // deep into the CDS, would also downgrade
    const score = scoreGuide(c, 'A'.repeat(200), [cdsFeature], 5) // offTargetCount=5 too
    expect(score.isPolyT).toBe(true)
    expect(score.rating).toBe('weak')
  })

  it('computes feature context via readingBasesWithCoords and downgrades only in the back half of the CDS', () => {
    const payload = 'ATGGAATTTTGA' // 12nt, 4 codons
    const seq = 'AAA' + payload + 'AAA' // CDS at [3, 15)
    const cdsFeature: Feature = { id: 'cds1', type: 'CDS', name: 'testCDS', start: 3, end: 15, strand: 1 }

    const early = scoreGuide(candidate({ cutPosition: 3 }), seq, [cdsFeature], 0)
    expect(early.featureContext).toEqual({ featureId: 'cds1', featureName: 'testCDS', percentIntoFeature: 0 })
    expect(early.rating).toBe('strong')

    const late = scoreGuide(candidate({ cutPosition: 12 }), seq, [cdsFeature], 0)
    expect(late.featureContext?.percentIntoFeature).toBe(75)
    expect(late.rating).toBe('moderate')
  })

  it('downgrades one tier when the exact off-target count is nonzero', () => {
    const score = scoreGuide(candidate(), 'N'.repeat(200), [], 1)
    expect(score.rating).toBe('moderate')
  })

  it('stacks multiple downgrades, clamped at weak', () => {
    const guideSequence = 'AT'.repeat(10) // unfavorable GC -> one downgrade
    const score = scoreGuide(candidate({ guideSequence }), 'N'.repeat(200), [], 1) // + off-target -> second downgrade
    expect(score.rating).toBe('weak')
  })
})

describe('buildOffTargetIndex / countExactOffTargets', () => {
  it('reports off-target count 1 for a guide duplicated once on each strand, 0 for a guide occurring nowhere else', () => {
    const dup = UNIQUE_GUIDE
    const rcDup = reverseComplement(dup)
    const seq = dup + 'TTAAGGCCTT' + rcDup // exact copy on plus strand, RC copy elsewhere

    const index = buildOffTargetIndex(seq, 'linear', 20)
    expect(countExactOffTargets(dup, index)).toBe(1)
    expect(countExactOffTargets('A'.repeat(20), index)).toBe(0)
  })

  it('still finds a circular-wraparound duplicate (one copy straddling the origin)', () => {
    const secondHalf = UNIQUE_GUIDE.slice(10)
    const firstHalf = UNIQUE_GUIDE.slice(0, 10)
    // middle is a normal copy of UNIQUE_GUIDE; firstHalf+secondHalf straddles the origin
    const seq = secondHalf + UNIQUE_GUIDE + firstHalf

    const circularIndex = buildOffTargetIndex(seq, 'circular', 20)
    expect(countExactOffTargets(UNIQUE_GUIDE, circularIndex)).toBe(1)

    const linearIndex = buildOffTargetIndex(seq, 'linear', 20)
    expect(countExactOffTargets(UNIQUE_GUIDE, linearIndex)).toBe(0)
  })
})

describe('findNearMatches', () => {
  function flip(base: string, positions: number[]): string {
    const chars = base.split('')
    for (const p of positions) {
      chars[p] = (['A', 'T', 'G', 'C'] as const).find((b) => b !== chars[p])!
    }
    return chars.join('')
  }

  const query = UNIQUE_GUIDE
  const oneMismatch = flip(query, [0])
  const threeMismatch = flip(query, [0, 5, 10])
  const filler = 'TTAAGGCCTT'
  const seq = query + filler + oneMismatch + filler + threeMismatch + filler
  const oneMismatchPos = query.length + filler.length
  const threeMismatchPos = oneMismatchPos + oneMismatch.length + filler.length

  it('finds a single-mismatch near-match at maxMismatches 1 and 2 but not 0', () => {
    expect(
      findNearMatches(query, seq, 'linear', 0).find((m) => m.position === oneMismatchPos),
    ).toBeUndefined()
    expect(findNearMatches(query, seq, 'linear', 1).find((m) => m.position === oneMismatchPos)).toMatchObject(
      { position: oneMismatchPos, strand: 1, mismatches: 1 },
    )
    expect(findNearMatches(query, seq, 'linear', 2).find((m) => m.position === oneMismatchPos)).toMatchObject(
      { position: oneMismatchPos, strand: 1, mismatches: 1 },
    )
  })

  it('excludes a 3-mismatch match at maxMismatches 2 but finds it at 3', () => {
    expect(
      findNearMatches(query, seq, 'linear', 2).find((m) => m.position === threeMismatchPos),
    ).toBeUndefined()
    expect(
      findNearMatches(query, seq, 'linear', 3).find((m) => m.position === threeMismatchPos),
    ).toMatchObject({ position: threeMismatchPos, strand: 1, mismatches: 3 })
  })

  it("never reports the guide's own exact locus (0 mismatches) as a near-match", () => {
    const results = findNearMatches(query, seq, 'linear', 2)
    expect(results.find((m) => m.position === 0 && m.strand === 1)).toBeUndefined()
  })
})
