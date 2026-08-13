export interface NHEJOutcome {
  editType: 'insertion' | 'deletion'
  length: number
  /** Plus-strand coordinate the edit is applied at — always the candidate's `cutPosition`,
   * which is already strand-agnostic (see crispr.ts's own doc comment on that field). */
  position: number
  /** Present only for insertions — random bases, not derived from anything biological. */
  insertedBases?: string
}

/** ~55/45 deletion-favored coin flip — documented, simple, not a citation. */
const DELETION_PROBABILITY = 0.55

// Illustrative weights for gameplay pacing, not a published NHEJ indel-length spectrum —
// small indels dominate real outcomes too, but these numbers are not a citation. Capped at 6bp
// so even a scenario targeting a very short CDS can't be wiped out entirely by one roll.
const INDEL_LENGTH_WEIGHTS: readonly [length: number, weight: number][] = [
  [1, 45],
  [2, 25],
  [3, 15],
  [4, 8],
  [5, 4],
  [6, 3],
]
const TOTAL_WEIGHT = INDEL_LENGTH_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0)

const BASES = ['A', 'T', 'G', 'C'] as const

function weightedLength(rng: () => number): number {
  let roll = rng() * TOTAL_WEIGHT
  for (const [length, weight] of INDEL_LENGTH_WEIGHTS) {
    if (roll < weight) return length
    roll -= weight
  }
  return INDEL_LENGTH_WEIGHTS[INDEL_LENGTH_WEIGHTS.length - 1][0]
}

function randomBases(length: number, rng: () => number): string {
  let bases = ''
  for (let i = 0; i < length; i++) {
    bases += BASES[Math.floor(rng() * BASES.length)]
  }
  return bases
}

/**
 * A plausible, documented-as-illustrative random indel generator standing in for real NHEJ
 * repair — not a research-grade mutagenesis model, same "heuristic, not a model" hedge the
 * guide-scoring spec applied to scoreGuide. Takes an injectable `rng` so callers can assert
 * exact outcomes with a seeded/mock generator instead of asserting on distributions.
 */
export function simulateNHEJRepair(
  cutPosition: number,
  rng: () => number = Math.random,
): NHEJOutcome {
  const editType: NHEJOutcome['editType'] = rng() < DELETION_PROBABILITY ? 'deletion' : 'insertion'
  const length = weightedLength(rng)

  if (editType === 'deletion') {
    return { editType, length, position: cutPosition }
  }
  return { editType, length, position: cutPosition, insertedBases: randomBases(length, rng) }
}
