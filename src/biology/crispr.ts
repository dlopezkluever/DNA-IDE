import type { Feature, Strand, Topology } from '../types/models'
import type { PamSystem } from '../data/pamSystems'
import { reverseComplement, getSubsequence, wrapIndex, calculateGC, getFeaturePieces } from './sequence'
import { readingBasesWithCoords } from './translation'

export interface GuideCandidate {
  id: string // `${strand === 1 ? 'fwd' : 'rev'}-${pamPosition}`, deterministic, no nanoid needed
  strand: Strand
  /** 0-based plus-strand coordinate of the PAM window's lower-coordinate edge, regardless of strand. */
  pamPosition: number
  /** PAM literal, read 5'->3' on the strand it's actually on (already reverse-complemented for strand -1). */
  pamSequence: string
  /** 0-based plus-strand [start, end) of the protospacer. end < start on circular topology means it wraps the origin (sequence.ts spansOrigin convention). */
  guideStart: number
  guideEnd: number
  /** 5'->3' on the strand the guide sits on. */
  guideSequence: string
  /** Plus-strand coordinate immediately after the predicted blunt cut. */
  cutPosition: number
}

/**
 * SpCas9 requires a protospacer immediately followed, on the same strand, by PAM `NGG` (5'->3').
 * Case A (PAM on plus strand): protospacer is simply the 20nt to the left, `[i-20, i)`, no RC needed.
 * Case B (PAM on minus strand): the minus-strand PAM appears on the plus strand as `CCN`
 * (reverseComplement('NGG') === 'CCN'). Because the minus strand's 5'->3' direction runs opposite
 * to plus-strand coordinate order, the protospacer sits at *higher* plus-coordinates than the PAM
 * (`[j+3, j+23)`), and the actual guide sequence is the reverse complement of that plus-strand slice.
 * Getting case B's direction backwards is the easy mistake here — see crispr.test.ts for explicit
 * sequence-content assertions per case, not just position/strand checks.
 */
export function findCandidateGuides(
  seq: string,
  pamSystem: PamSystem,
  topology: Topology,
): GuideCandidate[] {
  const upperSeq = seq.toUpperCase()
  const len = upperSeq.length
  const { guideLength, pamPattern, cutOffsetFromPAM } = pamSystem
  const pamLen = pamPattern.length
  if (len === 0) return []

  const searchSeq =
    topology === 'circular' ? upperSeq + upperSeq.slice(0, Math.max(0, pamLen - 1)) : upperSeq

  const candidates: GuideCandidate[] = []

  // Case A: plus-strand PAM, pattern 'NGG' -> test positions [i+1, i+3) === 'GG'.
  for (let i = 0; i + pamLen <= searchSeq.length; i++) {
    if (i >= len) continue
    if (searchSeq[i + 1] !== 'G' || searchSeq[i + 2] !== 'G') continue

    const rawStart = i - guideLength
    const rawEnd = i
    if (topology === 'linear' && rawStart < 0) continue

    const guideStart = topology === 'circular' ? wrapIndex(rawStart, len) : rawStart
    const guideEnd = topology === 'circular' ? wrapIndex(rawEnd, len) : rawEnd
    const guideSequence = getSubsequence(upperSeq, guideStart, guideEnd, topology)

    candidates.push({
      id: `fwd-${i}`,
      strand: 1,
      pamPosition: i,
      pamSequence: searchSeq.slice(i, i + pamLen),
      guideStart,
      guideEnd,
      guideSequence,
      cutPosition:
        topology === 'circular' ? wrapIndex(i - cutOffsetFromPAM, len) : i - cutOffsetFromPAM,
    })
  }

  // Case B: minus-strand PAM, appears as 'CCN' on the plus strand -> test [j, j+2) === 'CC'.
  for (let j = 0; j + pamLen <= searchSeq.length; j++) {
    if (j >= len) continue
    if (searchSeq[j] !== 'C' || searchSeq[j + 1] !== 'C') continue

    const rawStart = j + pamLen
    const rawEnd = j + pamLen + guideLength
    if (topology === 'linear' && rawEnd > len) continue

    const guideStart = topology === 'circular' ? wrapIndex(rawStart, len) : rawStart
    const guideEnd = topology === 'circular' ? wrapIndex(rawEnd, len) : rawEnd
    const plusStrandWindow = getSubsequence(upperSeq, guideStart, guideEnd, topology)
    const cutRaw = j + pamLen + cutOffsetFromPAM

    candidates.push({
      id: `rev-${j}`,
      strand: -1,
      pamPosition: j,
      pamSequence: reverseComplement(searchSeq.slice(j, j + pamLen)),
      guideStart,
      guideEnd,
      guideSequence: reverseComplement(plusStrandWindow),
      cutPosition: topology === 'circular' ? wrapIndex(cutRaw, len) : cutRaw,
    })
  }

  return candidates.sort((a, b) => a.pamPosition - b.pamPosition)
}

export interface GuideScore {
  gcContent: number // 0-100
  gcFavorable: boolean // 40-60%, the commonly cited favorable range — a heuristic, not a model
  homopolymerRun: { base: string; length: number } | null // longest run >= 4 within the 20nt guide
  isPolyT: boolean // homopolymerRun?.base === 'T' -- Pol III (U6) terminates on ~4+ T's, kills guide transcription
  featureContext: { featureId: string; featureName: string; percentIntoFeature: number } | null
  rating: 'strong' | 'moderate' | 'weak'
}

function findHomopolymerRun(guideSequence: string): { base: string; length: number } | null {
  let best: { base: string; length: number } | null = null
  let i = 0
  while (i < guideSequence.length) {
    let j = i
    while (j < guideSequence.length && guideSequence[j] === guideSequence[i]) j++
    const length = j - i
    if (length >= 4 && (!best || length > best.length)) {
      best = { base: guideSequence[i], length }
    }
    i = j
  }
  return best
}

// mutations.ts has a private, shape-equivalent `featureOverlapsEdit(feature, editStart, editEnd,
// seqLen)`, built on the same `getFeaturePieces` primitive; this is a single-position variant
// rather than exporting and repurposing that one, since its signature is edit-range-shaped, not
// point-shaped.
function overlapsPosition(feature: Feature, position: number, seqLen: number): boolean {
  return getFeaturePieces(feature, seqLen).some((p) => position >= p.start && position < p.end)
}

function findFeatureContext(
  cutPosition: number,
  features: Feature[],
  seq: string,
): { featureId: string; featureName: string; percentIntoFeature: number } | null {
  const cds = features.find((f) => f.type === 'CDS' && overlapsPosition(f, cutPosition, seq.length))
  if (!cds) return null
  const bases = readingBasesWithCoords(cds, seq)
  const index = bases.findIndex((b) => b.pos === cutPosition)
  if (index === -1) return null
  return {
    featureId: cds.id,
    featureName: cds.name,
    percentIntoFeature: (index / bases.length) * 100,
  }
}

function downgrade(rating: GuideScore['rating']): GuideScore['rating'] {
  return rating === 'strong' ? 'moderate' : 'weak'
}

/**
 * Exactly the three sequence-derivable signals named in the source material — no trained-model
 * score, no invented fourth criterion. `offTargetCount` (computed separately per-candidate against
 * the shared construct-wide index, see buildOffTargetIndex/countExactOffTargets below) feeds the
 * rating table's last row; it isn't a property of the candidate itself, so it's passed in rather
 * than recomputed here.
 */
export function scoreGuide(
  candidate: GuideCandidate,
  seq: string,
  features: Feature[],
  offTargetCount: number,
): GuideScore {
  const gcContent = calculateGC(candidate.guideSequence)
  const gcFavorable = gcContent >= 40 && gcContent <= 60
  const homopolymerRun = findHomopolymerRun(candidate.guideSequence)
  const isPolyT = homopolymerRun?.base === 'T'
  const featureContext = findFeatureContext(candidate.cutPosition, features, seq)

  let rating: GuideScore['rating'] = 'strong'
  if (isPolyT) {
    rating = 'weak'
  } else {
    if (homopolymerRun) rating = downgrade(rating)
    if (!gcFavorable) rating = downgrade(rating)
    if (featureContext && featureContext.percentIntoFeature > 50) rating = downgrade(rating)
    if (offTargetCount > 0) rating = downgrade(rating)
  }

  return { gcContent, gcFavorable, homopolymerRun, isPolyT, featureContext, rating }
}

/**
 * Tier 1 — exact-duplicate count, eager, O(length) total. One hash map of every exact 20mer
 * substring (both strands, circular-aware via the same right-padding trick as findCandidateGuides)
 * to its occurrence count, built once per construct load. Each candidate's off-target count is
 * then an O(1) lookup. This deliberately does NOT check for a nearby compatible PAM at the
 * off-target locus (a real off-target additionally needs one to be cleavable) — it answers "does
 * this same ~20mer occur anywhere else in this sequence," a stated simplification, not full
 * off-target viability modeling.
 */
export function buildOffTargetIndex(
  seq: string,
  topology: Topology,
  guideLength: number,
): Map<string, number> {
  const upperSeq = seq.toUpperCase()
  const len = upperSeq.length
  const pad = topology === 'circular' ? guideLength - 1 : 0
  const extended = upperSeq + upperSeq.slice(0, pad)
  const index = new Map<string, number>()

  const addWindows = (s: string) => {
    for (let i = 0; i + guideLength <= s.length && i < len; i++) {
      const kmer = s.slice(i, i + guideLength)
      index.set(kmer, (index.get(kmer) ?? 0) + 1)
    }
  }
  addWindows(extended)
  addWindows(reverseComplement(extended)) // opposite-strand occurrences count too

  return index
}

export function countExactOffTargets(guideSequence: string, index: Map<string, number>): number {
  return Math.max(0, (index.get(guideSequence.toUpperCase()) ?? 0) - 1)
}

export interface NearMatch {
  /** 0-based plus-strand coordinate of the near-match window's lower-coordinate edge. */
  position: number
  /** Which strand the near-match reads on: +1 compares the window directly to the guide,
   * -1 compares it to the guide's reverse complement (a minus-strand reading of that window). */
  strand: Strand
  mismatches: number
}

function countMismatches(a: string, b: string): number {
  let mismatches = 0
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) mismatches++
  }
  return mismatches
}

/**
 * Tier 2 — mismatch-tolerant near-matches, on demand, per candidate. O(length x guideLength),
 * fast enough for a single click (only ever runs for the one candidate the user is inspecting).
 * Every window is compared against the guide itself (plus-strand reading) and, independently,
 * against the guide's reverse complement (a minus-strand reading of that same window) — this
 * keeps `position` a plain plus-strand coordinate for both strands, rather than requiring the
 * caller to interpret coordinates in a reverse-complemented frame. An exact match (mismatches
 * === 0) is already counted by Tier 1 and is excluded here to avoid double-reporting.
 */
export function findNearMatches(
  guideSequence: string,
  seq: string,
  topology: Topology,
  maxMismatches: number,
): NearMatch[] {
  const query = guideSequence.toUpperCase()
  const guideLength = query.length
  const upperSeq = seq.toUpperCase()
  const len = upperSeq.length
  if (len === 0 || guideLength === 0) return []

  const rcQuery = reverseComplement(query)
  const pad = topology === 'circular' ? guideLength - 1 : 0
  const extended = upperSeq + upperSeq.slice(0, pad)

  const results: NearMatch[] = []
  for (let i = 0; i + guideLength <= extended.length && i < len; i++) {
    const window = extended.slice(i, i + guideLength)

    const mismatchesPlus = countMismatches(query, window)
    if (mismatchesPlus > 0 && mismatchesPlus <= maxMismatches) {
      results.push({ position: i, strand: 1, mismatches: mismatchesPlus })
    }

    const mismatchesMinus = countMismatches(rcQuery, window)
    if (mismatchesMinus > 0 && mismatchesMinus <= maxMismatches) {
      results.push({ position: i, strand: -1, mismatches: mismatchesMinus })
    }
  }

  return results.sort((a, b) => a.position - b.position)
}
