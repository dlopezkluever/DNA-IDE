import type { Mutation, Consequence } from '../types/models'
import { AMINO_ACID_INFO } from '../biology/translation'

const CONSEQUENCE_LABEL: Record<Consequence, string> = {
  synonymous: 'Synonymous',
  missense: 'Missense',
  nonsense: 'Nonsense',
  frameshift: 'Frameshift',
  noncoding: 'Noncoding',
  'start-loss': 'Start-loss',
  'stop-loss': 'Stop-loss',
  'in-frame-indel': 'In-frame indel',
}

export function consequenceLabel(consequence: Consequence): string {
  return CONSEQUENCE_LABEL[consequence] ?? consequence
}

export function aminoAcidFullName(aa?: string): string | undefined {
  if (!aa) return undefined
  return AMINO_ACID_INFO[aa]?.name ?? aa
}

/** e.g. "Gly281Ser" — matches the PRD §14 example format. */
export function formatProteinChange(mutation: Mutation): string | null {
  const effect = mutation.proteinEffect
  if (!effect?.aminoAcidBefore || !effect.aminoAcidAfter || !effect.aminoAcidPosition) return null
  const before = AMINO_ACID_INFO[effect.aminoAcidBefore]?.abbr ?? effect.aminoAcidBefore
  const after = AMINO_ACID_INFO[effect.aminoAcidAfter]?.abbr ?? effect.aminoAcidAfter
  return `${before}${effect.aminoAcidPosition}${after}`
}

export function formatDNAChange(mutation: Mutation): string {
  const ref = mutation.reference || '–'
  const alt = mutation.alternate || '–'
  return `${ref} → ${alt}`
}
