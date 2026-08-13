import type { Consequence, FeatureType } from '../types/models'

export type ScenarioTier = 1 | 2 | 3

export interface FeatureMatcher {
  name: string
  type: FeatureType
}

export interface ScenarioObjective {
  type: 'knockout'
  /** Resolved against the scenario's freshly-loaded construct at start time, NOT a fixed
   * feature id (nanoid ids aren't stable across GenBank parses — see resolve.ts). */
  targetFeature: FeatureMatcher
  /** Any one of these consequences on the target feature counts as success. */
  requiredConsequences: Consequence[]
  /** If the edit's affectedFeatureIds includes one of these, the attempt fails even if the
   * target feature was also hit correctly — "don't hit the neighbor" scenarios. */
  protectedFeatures?: FeatureMatcher[]
}

export interface Scenario {
  id: string
  tier: ScenarioTier
  title: string
  /** Flavor text only — never implies real-world clinical/agricultural accuracy. */
  organism: string
  briefing: string
  successCopy: string
  failureCopy: string
  /** References EXAMPLE_CONSTRUCTS by id (src/data/exampleConstructs/index.ts) — reuses existing
   * construct data rather than duplicating GenBank text. */
  exampleConstructId: string
  objective: ScenarioObjective
}

export interface ScenarioProgress {
  bestStars: 0 | 1 | 2 | 3
  attempts: number
}
