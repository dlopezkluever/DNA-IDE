import { describe, it, expect } from 'vitest'
import { evaluateScenarioOutcome, computeStarRating, formatStars } from './evaluate'
import type { GuideScore } from '../biology/crispr'
import type { Mutation } from '../types/models'
import type { ScenarioObjective } from './types'

function mutation(overrides: Partial<Mutation> = {}): Mutation {
  return {
    id: 'm1',
    type: 'deletion',
    position: 10,
    reference: 'AT',
    alternate: '',
    affectedFeatureIds: ['target-id'],
    proteinEffect: { consequence: 'frameshift' },
    createdAt: 0,
    ...overrides,
  }
}

function objective(overrides: Partial<ScenarioObjective> = {}): ScenarioObjective {
  return {
    type: 'knockout',
    targetFeature: { name: 'GFP', type: 'CDS' },
    requiredConsequences: ['frameshift', 'nonsense'],
    ...overrides,
  }
}

function guideScore(rating: GuideScore['rating']): GuideScore {
  return {
    gcContent: 50,
    gcFavorable: true,
    homopolymerRun: null,
    isPolyT: false,
    featureContext: null,
    rating,
  }
}

describe('evaluateScenarioOutcome', () => {
  it('succeeds when the mutation hits the target feature with a required consequence and no protected hit', () => {
    const result = evaluateScenarioOutcome(objective(), mutation(), 'target-id', [])
    expect(result).toEqual({ success: true, consequence: 'frameshift', protectedFeatureHit: false })
  })

  it('fails when the mutation misses the target feature entirely', () => {
    const result = evaluateScenarioOutcome(
      objective(),
      mutation({ affectedFeatureIds: ['some-other-feature'] }),
      'target-id',
      [],
    )
    expect(result.success).toBe(false)
  })

  it('fails when the target is hit but the consequence is not in the required list', () => {
    const result = evaluateScenarioOutcome(
      objective(),
      mutation({ proteinEffect: { consequence: 'synonymous' } }),
      'target-id',
      [],
    )
    expect(result.success).toBe(false)
    expect(result.consequence).toBe('synonymous')
  })

  it('fails via protectedFeatureHit even when the target was also hit correctly — the collateral-damage case', () => {
    const result = evaluateScenarioOutcome(
      objective({ protectedFeatures: [{ name: 'GFP', type: 'CDS' }] }),
      mutation({ affectedFeatureIds: ['target-id', 'protected-id'] }),
      'target-id',
      ['protected-id'],
    )
    expect(result.protectedFeatureHit).toBe(true)
    expect(result.success).toBe(false)
  })

  it('succeeds when a protected feature is configured but not actually hit', () => {
    const result = evaluateScenarioOutcome(
      objective({ protectedFeatures: [{ name: 'GFP', type: 'CDS' }] }),
      mutation({ affectedFeatureIds: ['target-id'] }),
      'target-id',
      ['protected-id'],
    )
    expect(result.protectedFeatureHit).toBe(false)
    expect(result.success).toBe(true)
  })

  it('falls back to "noncoding" when proteinEffect is absent', () => {
    const result = evaluateScenarioOutcome(
      objective(),
      mutation({ proteinEffect: undefined }),
      'target-id',
      [],
    )
    expect(result.consequence).toBe('noncoding')
    expect(result.success).toBe(false)
  })
})

describe('computeStarRating', () => {
  it('0 stars when the objective was not met, regardless of guide quality', () => {
    const result = { success: false, consequence: 'missense' as const, protectedFeatureHit: false }
    expect(computeStarRating(result, guideScore('strong'), 0, 1)).toBe(0)
  })

  it('1 star (floor) on success with a weak guide', () => {
    const result = { success: true, consequence: 'frameshift' as const, protectedFeatureHit: false }
    expect(computeStarRating(result, guideScore('weak'), 3, 1)).toBe(1)
  })

  it('2 stars on success with a moderate guide', () => {
    const result = { success: true, consequence: 'frameshift' as const, protectedFeatureHit: false }
    expect(computeStarRating(result, guideScore('moderate'), 0, 1)).toBe(2)
  })

  it('2 stars (not 3) on success with a strong guide that has off-targets', () => {
    const result = { success: true, consequence: 'frameshift' as const, protectedFeatureHit: false }
    expect(computeStarRating(result, guideScore('strong'), 1, 1)).toBe(2)
  })

  it('2 stars (not 3) on success with a strong, off-target-free guide on a retry (2nd attempt)', () => {
    const result = { success: true, consequence: 'frameshift' as const, protectedFeatureHit: false }
    expect(computeStarRating(result, guideScore('strong'), 0, 2)).toBe(2)
  })

  it('3 stars only for strong + 0 off-targets + first attempt, all three at once', () => {
    const result = { success: true, consequence: 'frameshift' as const, protectedFeatureHit: false }
    expect(computeStarRating(result, guideScore('strong'), 0, 1)).toBe(3)
  })
})

describe('formatStars', () => {
  it('renders the explicit filled/empty glyph + fraction pattern, never bare glyphs', () => {
    expect(formatStars(0)).toBe('☆☆☆ (0/3)')
    expect(formatStars(1)).toBe('★☆☆ (1/3)')
    expect(formatStars(2)).toBe('★★☆ (2/3)')
    expect(formatStars(3)).toBe('★★★ (3/3)')
  })
})
