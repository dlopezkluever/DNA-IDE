import { describe, it, expect } from 'vitest'
import { findRestrictionSites, findUniqueCutters, computeFragments } from './restriction'
import { RESTRICTION_ENZYMES } from '../data/restrictionEnzymes'

const EcoRI = RESTRICTION_ENZYMES.find((e) => e.id === 'EcoRI')!
const BsaI = RESTRICTION_ENZYMES.find((e) => e.id === 'BsaI')!

describe('findRestrictionSites', () => {
  it('finds a single palindromic site exactly once, with the correct cut position', () => {
    const seq = 'AAA' + 'GAATTC' + 'AAA' // site at 0-based 3
    const matches = findRestrictionSites(seq, [EcoRI], 'linear')
    expect(matches).toEqual([
      { enzymeId: 'EcoRI', enzymeName: 'EcoRI', position: 3, reverseStrand: false, cutPosition: 4 },
    ])
  })

  it('finds a Type IIS enzyme site in forward orientation with the cut downstream of the site', () => {
    const seq = 'AAA' + 'GGTCTC' + 'AAAAAAAAAA' // BsaI site at position 3, cuts at 3+7=10
    const matches = findRestrictionSites(seq, [BsaI], 'linear')
    expect(matches).toEqual([
      { enzymeId: 'BsaI', enzymeName: 'BsaI', position: 3, reverseStrand: false, cutPosition: 10 },
    ])
  })

  it('finds a Type IIS enzyme site in reverse orientation via its reverse complement', () => {
    // GAGACC is the reverse complement of GGTCTC (BsaI is non-palindromic)
    const seq = 'AAAAAAAAAA' + 'GAGACC' + 'AAAAAAAAAA'
    const matches = findRestrictionSites(seq, [BsaI], 'linear')
    expect(matches).toHaveLength(1)
    expect(matches[0].reverseStrand).toBe(true)
    expect(matches[0].position).toBe(10)
    // mirrored cut offset: site.length(6) - topCut(7) = -1 -> cut lands 1bp before the match start
    expect(matches[0].cutPosition).toBe(9)
  })

  it('finds a site that spans the circular origin, but not when treated as linear', () => {
    const seq = 'TTC' + 'CCCCCC' + 'GAA' // wraps to "GAA" + "TTC" = "GAATTC"
    const circularMatches = findRestrictionSites(seq, [EcoRI], 'circular')
    expect(circularMatches).toEqual([
      { enzymeId: 'EcoRI', enzymeName: 'EcoRI', position: 9, reverseStrand: false, cutPosition: 10 },
    ])
    expect(findRestrictionSites(seq, [EcoRI], 'linear')).toEqual([])
  })

  it('does not double-report a palindromic site (forward and reverse-complement search coincide)', () => {
    const seq = 'GAATTC'
    expect(findRestrictionSites(seq, [EcoRI], 'linear')).toHaveLength(1)
  })
})

describe('findUniqueCutters', () => {
  it('identifies enzymes that cut exactly once', () => {
    const matches = [
      { enzymeId: 'A', enzymeName: 'A', position: 0, reverseStrand: false, cutPosition: 0 },
      { enzymeId: 'B', enzymeName: 'B', position: 5, reverseStrand: false, cutPosition: 5 },
      { enzymeId: 'B', enzymeName: 'B', position: 15, reverseStrand: false, cutPosition: 15 },
    ]
    expect(findUniqueCutters(matches)).toEqual(new Set(['A']))
  })
})

describe('computeFragments', () => {
  it('linear: N cuts produce N+1 fragments', () => {
    const fragments = computeFragments(100, [30, 70], 'linear')
    expect(fragments).toEqual([
      { start: 0, end: 30, length: 30 },
      { start: 30, end: 70, length: 40 },
      { start: 70, end: 100, length: 30 },
    ])
  })

  it('circular: 0 cuts leaves the whole circle as one fragment', () => {
    expect(computeFragments(100, [], 'circular')).toEqual([{ start: 0, end: 100, length: 100 }])
  })

  it('circular: 1 cut linearizes to a single full-length fragment', () => {
    expect(computeFragments(100, [40], 'circular')).toEqual([{ start: 40, end: 40, length: 100 }])
  })

  it('circular: matches the PRD §13 worked example exactly (cuts at 1204 and 4981 on a 5920bp plasmid)', () => {
    // PRD 1-based positions 1,204 and 4,981 -> 0-based 1203 and 4980
    const fragments = computeFragments(5920, [1203, 4980], 'circular')
    const lengths = fragments.map((f) => f.length).sort((a, b) => a - b)
    expect(lengths).toEqual([2143, 3777])
  })

  it('deduplicates repeated cut positions', () => {
    expect(computeFragments(100, [30, 30, 70], 'linear')).toEqual([
      { start: 0, end: 30, length: 30 },
      { start: 30, end: 70, length: 40 },
      { start: 70, end: 100, length: 30 },
    ])
  })
})
