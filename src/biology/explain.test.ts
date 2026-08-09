import { describe, it, expect } from 'vitest'
import { explainReverseComplement, explainTranslation, explainMutation } from './explain'
import { translateFrame } from './translation'
import type { Mutation } from '../types/models'

describe('explainReverseComplement', () => {
  it('matches the PRD §25 worked example exactly', () => {
    const steps = explainReverseComplement('ATGCCGTA')
    expect(steps).toEqual([
      { label: 'Original', value: "5' ATGCCGTA 3'" },
      { label: 'Complement', value: "3' TACGGCAT 5'" },
      { label: 'Reverse Complement', value: "5' TACGGCAT 3'" },
    ])
  })
})

describe('explainTranslation', () => {
  it('matches the PRD §25 worked example (ATG GAA TTT TGA -> M-E-F-*)', () => {
    const steps = explainTranslation(translateFrame('ATGGAATTTTGA', 0, 1))
    expect(steps[0]).toEqual({ label: 'DNA', value: 'ATG | GAA | TTT | TGA' })
    expect(steps[2]).toEqual({ label: 'Protein', value: 'M-E-F-*' })
  })
})

describe('explainMutation', () => {
  it('matches the PRD §25 worked example shape (missense)', () => {
    const mutation: Mutation = {
      id: 'm1',
      type: 'substitution',
      position: 0,
      reference: 'A',
      alternate: 'T',
      affectedFeatureIds: [],
      createdAt: 0,
      proteinEffect: {
        consequence: 'missense',
        codonBefore: 'GAA',
        codonAfter: 'GTA',
        aminoAcidBefore: 'E',
        aminoAcidAfter: 'V',
        aminoAcidPosition: 1,
      },
    }
    const steps = explainMutation(mutation)
    expect(steps).toEqual([
      { label: 'Original codon', value: 'GAA → Glutamate' },
      { label: 'Mutation', value: 'A → T' },
      { label: 'New codon', value: 'GTA → Valine' },
      { label: 'Result', value: 'Missense' },
    ])
  })
})
