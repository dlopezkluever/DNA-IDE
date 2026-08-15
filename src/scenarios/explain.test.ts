import { describe, it, expect } from 'vitest'
import { explainNHEJOutcome } from './explain'
import type { NHEJOutcome } from './simulate'
import type { Mutation } from '../types/models'

function outcome(overrides: Partial<NHEJOutcome> = {}): NHEJOutcome {
  return { editType: 'deletion', length: 2, position: 203, ...overrides }
}

function mutation(overrides: Partial<Mutation> = {}): Mutation {
  return {
    id: 'm1',
    type: 'deletion',
    position: 203,
    reference: 'AT',
    alternate: '',
    affectedFeatureIds: ['gfp'],
    proteinEffect: { consequence: 'frameshift' },
    createdAt: 0,
    ...overrides,
  }
}

describe('explainNHEJOutcome', () => {
  it('always leads with the repair-outcome step, 1-based display position', () => {
    const steps = explainNHEJOutcome(outcome(), mutation())
    expect(steps[0]).toEqual({ label: 'Repair outcome', value: '2bp deletion at position 204' })
  })

  it('includes a reading-frame step only when the consequence is a frameshift', () => {
    const steps = explainNHEJOutcome(outcome(), mutation({ proteinEffect: { consequence: 'frameshift' } }))
    expect(steps.find((s) => s.label === 'Reading frame')).toEqual({
      label: 'Reading frame',
      value: 'shifted by 2 — every codon downstream is scrambled',
    })
  })

  it('omits the reading-frame step for a non-frameshift consequence', () => {
    const steps = explainNHEJOutcome(outcome(), mutation({ proteinEffect: { consequence: 'nonsense' } }))
    expect(steps.find((s) => s.label === 'Reading frame')).toBeUndefined()
  })

  it('always ends with a Result step using the human-readable consequence label', () => {
    const steps = explainNHEJOutcome(outcome(), mutation({ proteinEffect: { consequence: 'nonsense' } }))
    expect(steps[steps.length - 1]).toEqual({ label: 'Result', value: 'Nonsense' })
  })

  it('falls back to "Applied" when proteinEffect is absent, without a Reading frame step', () => {
    const steps = explainNHEJOutcome(outcome(), mutation({ proteinEffect: undefined }))
    expect(steps.find((s) => s.label === 'Reading frame')).toBeUndefined()
    expect(steps[steps.length - 1]).toEqual({ label: 'Result', value: 'Applied' })
  })

  it('reports the insertion editType and length in the repair-outcome step', () => {
    const steps = explainNHEJOutcome(
      outcome({ editType: 'insertion', length: 3, position: 10, insertedBases: 'ATG' }),
      mutation({ position: 10, proteinEffect: { consequence: 'frameshift' } }),
    )
    expect(steps[0]).toEqual({ label: 'Repair outcome', value: '3bp insertion at position 11' })
  })
})
