import { explainNHEJOutcome } from '../../scenarios/explain'
import { formatStars } from '../../scenarios/evaluate'
import type { ScenarioResult } from '../../scenarios/evaluate'
import type { NHEJOutcome } from '../../scenarios/simulate'
import type { Scenario } from '../../scenarios/types'
import { consequenceLabel } from '../../utils/format'
import { toDisplayPosition } from '../../biology/sequence'
import { ExplainBlock } from '../explain/ExplainBlock'
import type { ScoredGuide } from '../../views/CRISPRView'
import type { Mutation } from '../../types/models'

export interface AttemptOutcome {
  nhejOutcome: NHEJOutcome
  mutation: Mutation
  result: ScenarioResult
  stars: 0 | 1 | 2 | 3
  guide: ScoredGuide
}

export function CutOutcomePanel({
  scenario,
  attempt,
  explainMode,
  onRetry,
  onNext,
}: {
  scenario: Scenario
  attempt: AttemptOutcome
  explainMode: boolean
  onRetry: () => void
  onNext: () => void
}) {
  const { nhejOutcome, mutation, result, stars, guide } = attempt
  const copy = result.success ? scenario.successCopy : scenario.failureCopy

  return (
    <div className="shrink-0 border-t border-(--color-border-strong) bg-(--color-bg-elevated) p-3 font-mono text-xs">
      <p className="text-(--color-text-secondary)">
        Guide {guide.candidate.guideSequence} ({guide.candidate.strand === 1 ? '+' : '-'}) at{' '}
        {toDisplayPosition(guide.candidate.pamPosition)} · Rolled: {nhejOutcome.length}bp{' '}
        {nhejOutcome.editType} → {consequenceLabel(result.consequence)}
      </p>
      <p className={`mt-1 ${result.success ? 'text-(--color-accent)' : 'text-(--color-text-primary)'}`}>
        {copy}
      </p>
      {result.protectedFeatureHit && (
        <p className="mt-1 text-(--color-danger)">
          Collateral damage: a protected feature was also hit.
        </p>
      )}
      <p className="mt-1.5 text-(--color-text-secondary)">{formatStars(stars)}</p>

      {explainMode && (
        <div className="mt-2">
          <ExplainBlock steps={explainNHEJOutcome(nhejOutcome, mutation)} />
        </div>
      )}

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-(--color-border-strong) px-2.5 py-1 text-(--color-text-secondary) hover:bg-(--color-bg-hover)"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded border border-(--color-accent-dim) px-2.5 py-1 text-(--color-accent) hover:bg-(--color-bg-hover)"
        >
          Next Scenario
        </button>
      </div>
    </div>
  )
}
