import { describe, it, expect } from 'vitest'
import { SCENARIOS, isTierUnlocked } from './data'
import { resolveFeature } from './resolve'
import { EXAMPLE_CONSTRUCTS } from '../data/exampleConstructs'
import { parseGenBank, constructFromGenBank } from '../parsers/genbank'
import type { ScenarioProgress } from './types'

describe('SCENARIOS content', () => {
  for (const scenario of SCENARIOS) {
    it(`"${scenario.title}": targetFeature (and any protectedFeatures) resolve against its real construct`, () => {
      const example = EXAMPLE_CONSTRUCTS.find((e) => e.id === scenario.exampleConstructId)
      expect(example).toBeDefined()

      const { records, fileError } = parseGenBank(example!.genbank)
      expect(fileError).toBeNull()
      const construct = constructFromGenBank(records[0])

      const target = resolveFeature(scenario.objective.targetFeature, construct.features)
      expect(target).not.toBeNull()
      expect(target?.type).toBe('CDS')

      for (const matcher of scenario.objective.protectedFeatures ?? []) {
        const protectedFeature = resolveFeature(matcher, construct.features)
        expect(protectedFeature).not.toBeNull()
        expect(protectedFeature?.id).not.toBe(target?.id)
      }
    })
  }

  it('"Break the Lock" runs on a circular construct — exercises the wraparound-aware path', () => {
    const scenario = SCENARIOS.find((s) => s.id === 'break-the-lock')!
    const example = EXAMPLE_CONSTRUCTS.find((e) => e.id === scenario.exampleConstructId)!
    const { records } = parseGenBank(example.genbank)
    expect(constructFromGenBank(records[0]).topology).toBe('circular')
  })

  it('"Precision Strike" targets a materially shorter CDS than the other two scenarios (search-space scarcity)', () => {
    const precision = SCENARIOS.find((s) => s.id === 'precision-strike')!
    const glow = SCENARIOS.find((s) => s.id === 'silence-the-glow')!

    function cdsLength(scenarioId: string, targetName: string): number {
      const scenario = SCENARIOS.find((s) => s.id === scenarioId)!
      const example = EXAMPLE_CONSTRUCTS.find((e) => e.id === scenario.exampleConstructId)!
      const { records } = parseGenBank(example.genbank)
      const construct = constructFromGenBank(records[0])
      const feature = construct.features.find((f) => f.name === targetName)!
      return feature.end - feature.start
    }

    expect(cdsLength(precision.id, 'miniORF')).toBeLessThan(cdsLength(glow.id, 'GFP'))
  })

  it('every scenario requires frameshift or nonsense as its knockout consequence', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.objective.requiredConsequences).toEqual(
        expect.arrayContaining(['frameshift', 'nonsense']),
      )
    }
  })

  it('scenario ids are unique', () => {
    const ids = SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('isTierUnlocked', () => {
  it('tier 1 is always unlocked, even with no progress at all', () => {
    expect(isTierUnlocked(1, {})).toBe(true)
  })

  it('tier 2 is locked until every tier-1 scenario has bestStars >= 1', () => {
    const progress: Record<string, ScenarioProgress> = {
      'silence-the-glow': { bestStars: 2, attempts: 1 },
    }
    expect(isTierUnlocked(2, progress)).toBe(false)
  })

  it('tier 2 unlocks once all tier-1 scenarios clear', () => {
    const progress: Record<string, ScenarioProgress> = {
      'silence-the-glow': { bestStars: 1, attempts: 3 },
      'break-the-lock': { bestStars: 2, attempts: 1 },
    }
    expect(isTierUnlocked(2, progress)).toBe(true)
  })

  it('a bestStars of 0 (recorded but never succeeded) does not count as cleared', () => {
    const progress: Record<string, ScenarioProgress> = {
      'silence-the-glow': { bestStars: 0, attempts: 5 },
      'break-the-lock': { bestStars: 2, attempts: 1 },
    }
    expect(isTierUnlocked(2, progress)).toBe(false)
  })
})
