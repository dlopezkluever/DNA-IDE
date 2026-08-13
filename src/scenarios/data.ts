import type { Scenario, ScenarioProgress, ScenarioTier } from './types'

// All three launch scenarios reuse the existing example constructs verbatim
// (src/data/exampleConstructs/) -- zero new GenBank content required to ship v1.
export const SCENARIOS: Scenario[] = [
  {
    id: 'silence-the-glow',
    tier: 1,
    title: 'Silence the Glow',
    organism: 'E. coli (lab strain, GFP reporter plasmid)',
    briefing:
      "This plasmid glows green under UV — it carries a promoter, an RBS, the GFP gene, and a terminator. Knock out the glow.",
    successCopy: 'The colony stopped glowing under UV — GFP is knocked out.',
    failureCopy: 'The colony is still glowing. GFP is still functional — try a different guide.',
    exampleConstructId: 'gfp-construct',
    objective: {
      type: 'knockout',
      targetFeature: { name: 'GFP', type: 'CDS' },
      requiredConsequences: ['frameshift', 'nonsense'],
    },
  },
  {
    id: 'break-the-lock',
    tier: 1,
    title: 'Break the Lock',
    organism: 'E. coli (lab strain, antibiotic-resistance + GFP reporter plasmid)',
    briefing:
      "This plasmid also carries antibiotic resistance. Knock out resistance — but the colony needs to stay green. Don't touch GFP.",
    successCopy: 'Resistance is knocked out, and GFP is untouched — the colony is still green.',
    failureCopy:
      'Either resistance survived the cut, or the edit collateral-damaged GFP along the way.',
    exampleConstructId: 'educational-plasmid',
    objective: {
      type: 'knockout',
      targetFeature: { name: 'markerR', type: 'CDS' },
      requiredConsequences: ['frameshift', 'nonsense'],
      protectedFeatures: [{ name: 'GFP', type: 'CDS' }],
    },
  },
  {
    id: 'precision-strike',
    tier: 2,
    title: 'Precision Strike',
    organism: 'Minimal synthetic construct (teaching strain)',
    briefing:
      'This gene is tiny — only 8 codons. Very few candidate guides even reach it. Pick carefully.',
    successCopy: 'miniORF is knocked out — a clean hit on a tiny target.',
    failureCopy: 'miniORF is still intact. With so few candidates, guide choice matters here.',
    exampleConstructId: 'minimal-cds',
    objective: {
      type: 'knockout',
      targetFeature: { name: 'miniORF', type: 'CDS' },
      requiredConsequences: ['frameshift', 'nonsense'],
    },
  },
]

/** Tier 1 is always unlocked; tier N unlocks once every scenario in tier N-1 has bestStars >= 1. */
export function isTierUnlocked(tier: ScenarioTier, progress: Record<string, ScenarioProgress>): boolean {
  if (tier <= 1) return true
  const priorTier = SCENARIOS.filter((s) => s.tier === tier - 1)
  return priorTier.length > 0 && priorTier.every((s) => (progress[s.id]?.bestStars ?? 0) >= 1)
}
