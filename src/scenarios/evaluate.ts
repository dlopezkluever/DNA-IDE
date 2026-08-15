import type { Consequence, Mutation } from '../types/models'
import type { GuideScore } from '../biology/crispr'
import type { ScenarioObjective } from './types'

export interface ScenarioResult {
  success: boolean
  /** The consequence actually produced, straight from mutation.proteinEffect.consequence. */
  consequence: Consequence
  /** True if a protected feature's id also appears in mutation.affectedFeatureIds. */
  protectedFeatureHit: boolean
}

/** A pure function over data applyMutation already produced — no new biology. */
export function evaluateScenarioOutcome(
  objective: ScenarioObjective,
  mutation: Mutation,
  targetFeatureId: string,
  protectedFeatureIds: string[],
): ScenarioResult {
  const consequence = mutation.proteinEffect?.consequence ?? 'noncoding'
  const hitTarget = mutation.affectedFeatureIds.includes(targetFeatureId)
  const consequenceMatches = objective.requiredConsequences.includes(consequence)
  const protectedFeatureHit = protectedFeatureIds.some((id) =>
    mutation.affectedFeatureIds.includes(id),
  )

  return {
    success: hitTarget && consequenceMatches && !protectedFeatureHit,
    consequence,
    protectedFeatureHit,
  }
}

/**
 * An explicit table, legible rather than a black-box formula. Order matters: the 3-star
 * condition is strictly more specific than the 2-star one (strong implies "moderate or strong"),
 * so it must be checked first.
 *
 * | Condition                                                          | Stars |
 * |---------------------------------------------------------------------|-------|
 * | Objective not met                                                  | 0     |
 * | Objective met                                                      | 1     |
 * | ...and the guide used was `moderate` or `strong` rated             | 2     |
 * | ...and `strong`, 0 exact off-targets, and this was the 1st attempt | 3     |
 */
export function computeStarRating(
  result: ScenarioResult,
  guideScore: GuideScore,
  offTargetCount: number,
  attemptNumber: number,
): 0 | 1 | 2 | 3 {
  if (!result.success) return 0
  if (guideScore.rating === 'strong' && offTargetCount === 0 && attemptNumber === 1) return 3
  if (guideScore.rating === 'strong' || guideScore.rating === 'moderate') return 2
  return 1
}

/** Explicit "★★★ (3/3)" pattern, never bare glyphs — disambiguates mission-star scores from
 * GuideList's unrelated `★ strong` rating glyph (both reuse the same `★` per DESIGN.md's
 * "no new icon vocabulary" rule, so context and format must never be ambiguous). */
export function formatStars(stars: 0 | 1 | 2 | 3): string {
  return `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} (${stars}/3)`
}
