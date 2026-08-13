import type { GuideCandidate, GuideScore } from '../../biology/crispr'
import { SPCAS9 } from '../../data/pamSystems'

// Split out of GuideList.tsx (a component-only file, for fast-refresh) so ScenarioView (§3.5)
// can reuse the same strong/moderate/weak palette for plasmid-map candidate markers instead of
// inventing a second color mapping.
export const RATING_STYLE: Record<GuideScore['rating'], { glyph: string; className: string; color: string }> = {
  // strong = accent green: the one case where "good" and the app's one accent color coincide,
  // matching EnzymeList's unique-cutter badge precedent (DESIGN.md §2.3 — green means
  // "active/selected right now", so a straight traffic-light red/amber/green mapping is avoided).
  strong: { glyph: '★', className: 'text-(--color-accent)', color: 'var(--color-accent)' },
  moderate: { glyph: '●', className: 'text-(--color-warn)', color: 'var(--color-warn)' },
  weak: { glyph: '○', className: 'text-(--color-text-muted)', color: 'var(--color-text-muted)' },
}

export function guideSpan(candidate: GuideCandidate) {
  const spanStart = candidate.strand === 1 ? candidate.guideStart : candidate.pamPosition
  const spanEnd =
    candidate.strand === 1 ? candidate.pamPosition + SPCAS9.pamPattern.length : candidate.guideEnd
  return { spanStart, spanEnd }
}
