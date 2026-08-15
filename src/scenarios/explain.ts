import type { Mutation } from '../types/models'
import type { ExplainStep } from '../biology/explain'
import { toDisplayPosition } from '../biology/sequence'
import { consequenceLabel } from '../utils/format'
import type { NHEJOutcome } from './simulate'

/** Same shape as explainCRISPRGuide and the other functions in biology/explain.ts, but lives
 * here since it explains a scenario outcome, not raw sequence biology. */
export function explainNHEJOutcome(outcome: NHEJOutcome, mutation: Mutation): ExplainStep[] {
  const effect = mutation.proteinEffect
  const steps: ExplainStep[] = [
    {
      label: 'Repair outcome',
      value: `${outcome.length}bp ${outcome.editType} at position ${toDisplayPosition(outcome.position)}`,
    },
  ]

  if (effect?.consequence === 'frameshift') {
    steps.push({
      label: 'Reading frame',
      value: `shifted by ${outcome.length} — every codon downstream is scrambled`,
    })
  }

  steps.push({ label: 'Result', value: effect ? consequenceLabel(effect.consequence) : 'Applied' })
  return steps
}
