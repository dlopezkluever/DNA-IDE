import type { Consequence } from '../types/models'

type SemanticRole = 'neutral' | 'warn' | 'danger' | 'info' | 'muted'

/**
 * Single source of truth for how each mutation consequence is colored across the app.
 * `MutationList`'s text coloring and the Mutation Heatmap's cell fills both derive from
 * this one Consequence -> role mapping, so a future palette change happens in one place.
 *
 * start-loss/stop-loss get their own role (info/blue) rather than sharing nonsense's red —
 * "boundary disrupted" and "premature stop mid-gene" are different enough signals to be
 * worth distinguishing at a glance, and blue was otherwise unused in the status palette.
 */
const CONSEQUENCE_ROLE: Record<Consequence, SemanticRole> = {
  synonymous: 'neutral',
  missense: 'warn',
  nonsense: 'danger',
  frameshift: 'danger',
  noncoding: 'muted',
  'start-loss': 'info',
  'stop-loss': 'info',
  'in-frame-indel': 'warn',
}

const ROLE_FILL: Record<SemanticRole, string> = {
  neutral: 'var(--color-text-secondary)',
  warn: 'var(--color-warn)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  muted: 'var(--color-text-muted)',
}

const ROLE_TEXT_CLASS: Record<SemanticRole, string> = {
  neutral: 'text-(--color-text-secondary)',
  warn: 'text-(--color-warn)',
  danger: 'text-(--color-danger)',
  info: 'text-(--color-info)',
  muted: 'text-(--color-text-muted)',
}

function deriveMap<T>(roleMap: Record<SemanticRole, T>): Record<Consequence, T> {
  const entries = (Object.keys(CONSEQUENCE_ROLE) as Consequence[]).map(
    (consequence) => [consequence, roleMap[CONSEQUENCE_ROLE[consequence]]] as const,
  )
  return Object.fromEntries(entries) as Record<Consequence, T>
}

/** CSS `var(--color-*)` value for SVG `fill`/`stroke` (e.g. the Mutation Heatmap). */
export const CONSEQUENCE_FILL: Record<Consequence, string> = deriveMap(ROLE_FILL)

/** Tailwind arbitrary-value text-color class (e.g. `MutationList`). */
export const CONSEQUENCE_TEXT_CLASS: Record<Consequence, string> = deriveMap(ROLE_TEXT_CLASS)
