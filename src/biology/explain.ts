import type { Mutation } from '../types/models'
import { complement, reverseComplement } from './sequence'
import { AMINO_ACID_INFO, type CodonInfo } from './translation'
import { consequenceLabel, aminoAcidFullName } from '../utils/format'

export interface ExplainStep {
  label: string
  value: string
}

/** Matches the PRD §25 "Reverse Complement" worked example format exactly. */
export function explainReverseComplement(original: string): ExplainStep[] {
  const comp = Array.from(original).map(complement).join('')
  return [
    { label: 'Original', value: `5' ${original} 3'` },
    { label: 'Complement', value: `3' ${comp} 5'` },
    { label: 'Reverse Complement', value: `5' ${reverseComplement(original)} 3'` },
  ]
}

/** Matches the PRD §25 "Translation" worked example format. Accepts any codon list
 * (from translateFrame or translateFeature), so it works for either strand. */
export function explainTranslation(codons: CodonInfo[]): ExplainStep[] {
  return [
    { label: 'DNA', value: codons.map((c) => c.seq).join(' | ') },
    {
      label: 'Codons',
      value: codons.map((c) => `${c.seq} = ${AMINO_ACID_INFO[c.aa]?.abbr ?? c.aa}`).join('\n'),
    },
    { label: 'Protein', value: codons.map((c) => c.aa).join('-') },
  ]
}

/** Matches the PRD §25 "Mutation" worked example format. */
export function explainMutation(mutation: Mutation): ExplainStep[] {
  const effect = mutation.proteinEffect
  const steps: ExplainStep[] = []

  if (effect?.codonBefore && effect.aminoAcidBefore) {
    steps.push({
      label: 'Original codon',
      value: `${effect.codonBefore} → ${aminoAcidFullName(effect.aminoAcidBefore)}`,
    })
  }
  steps.push({ label: 'Mutation', value: `${mutation.reference || '–'} → ${mutation.alternate || '–'}` })
  if (effect?.codonAfter && effect.aminoAcidAfter) {
    steps.push({
      label: 'New codon',
      value: `${effect.codonAfter} → ${aminoAcidFullName(effect.aminoAcidAfter)}`,
    })
  }
  steps.push({ label: 'Result', value: effect ? consequenceLabel(effect.consequence) : 'Applied' })
  return steps
}
