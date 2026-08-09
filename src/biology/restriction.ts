import type { Topology } from '../types/models'
import type { RestrictionEnzyme } from '../data/restrictionEnzymes'
import { reverseComplement, wrapIndex } from './sequence'

export interface RestrictionMatch {
  enzymeId: string
  enzymeName: string
  /** 0-based position where the recognition site match starts, in plus-strand coordinates. */
  position: number
  reverseStrand: boolean
  /** 0-based plus-strand coordinate of the top-strand cut; used for fragment calculations. */
  cutPosition: number
}

function computeCutPosition(
  enzyme: RestrictionEnzyme,
  matchStart: number,
  reverseStrand: boolean,
  seqLength: number,
  topology: Topology,
): number {
  // A reverse-strand match means the recognition site itself sits on the minus strand;
  // mirror the cut offset from the far end of the matched site to land in the right place.
  const cutOffset = reverseStrand ? enzyme.site.length - enzyme.topCut : enzyme.topCut
  const raw = matchStart + cutOffset
  return topology === 'circular' ? wrapIndex(raw, seqLength) : raw
}

export function findRestrictionSites(
  seq: string,
  enzymes: RestrictionEnzyme[],
  topology: Topology,
): RestrictionMatch[] {
  const upperSeq = seq.toUpperCase()
  const len = upperSeq.length
  if (len === 0 || enzymes.length === 0) return []

  const longestSite = Math.max(...enzymes.map((e) => e.site.length))
  const searchSeq =
    topology === 'circular' ? upperSeq + upperSeq.slice(0, Math.max(0, longestSite - 1)) : upperSeq

  const results: RestrictionMatch[] = []

  for (const enzyme of enzymes) {
    const site = enzyme.site.toUpperCase()
    const rc = reverseComplement(site)

    for (let i = 0; i + site.length <= searchSeq.length; i++) {
      if (i < len && searchSeq.slice(i, i + site.length) === site) {
        results.push({
          enzymeId: enzyme.id,
          enzymeName: enzyme.name,
          position: i,
          reverseStrand: false,
          cutPosition: computeCutPosition(enzyme, i, false, len, topology),
        })
      }
    }

    if (rc !== site) {
      for (let i = 0; i + rc.length <= searchSeq.length; i++) {
        if (i < len && searchSeq.slice(i, i + rc.length) === rc) {
          results.push({
            enzymeId: enzyme.id,
            enzymeName: enzyme.name,
            position: i,
            reverseStrand: true,
            cutPosition: computeCutPosition(enzyme, i, true, len, topology),
          })
        }
      }
    }
  }

  return results.sort((a, b) => a.position - b.position)
}

export function findUniqueCutters(matches: RestrictionMatch[]): Set<string> {
  const counts = new Map<string, number>()
  for (const m of matches) counts.set(m.enzymeId, (counts.get(m.enzymeId) ?? 0) + 1)
  const unique = new Set<string>()
  for (const [id, count] of counts) if (count === 1) unique.add(id)
  return unique
}

export interface Fragment {
  start: number
  end: number
  length: number
}

export function computeFragments(
  seqLength: number,
  cutPositions: number[],
  topology: Topology,
): Fragment[] {
  const cuts = [...new Set(cutPositions)].sort((a, b) => a - b)

  if (topology === 'linear') {
    const boundaries = [0, ...cuts, seqLength]
    const fragments: Fragment[] = []
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i]
      const end = boundaries[i + 1]
      if (end > start) fragments.push({ start, end, length: end - start })
    }
    return fragments
  }

  if (cuts.length === 0) {
    return [{ start: 0, end: seqLength, length: seqLength }]
  }
  if (cuts.length === 1) {
    const c = cuts[0]
    return [{ start: c, end: c, length: seqLength }]
  }

  const fragments: Fragment[] = []
  for (let i = 0; i < cuts.length; i++) {
    const start = cuts[i]
    const end = cuts[(i + 1) % cuts.length]
    const length = end > start ? end - start : seqLength - start + end
    fragments.push({ start, end, length })
  }
  return fragments
}
