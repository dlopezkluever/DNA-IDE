import { consequenceLabel } from '../../utils/format'
import type { Scenario } from '../../scenarios/types'

const DISCLAIMER =
  'These are simplified teaching scenarios on synthetic/illustrative constructs — not real ' +
  'protocols, and the repair outcome is randomly simulated, not a lab result. Off-target search ' +
  'and consequence prediction are construct-local only, same as the CRISPR tab.'

function objectiveLine(scenario: Scenario): string {
  const { targetFeature, requiredConsequences, protectedFeatures } = scenario.objective
  const target = `${targetFeature.name} (${targetFeature.type})`
  const needs = requiredConsequences.map(consequenceLabel).join(' or ')
  const protect = protectedFeatures?.length ? protectedFeatures.map((f) => f.name).join(', ') : '—'
  return `Target: ${target}   ·   Needs: ${needs}   ·   Protect: ${protect}`
}

export function ScenarioBriefing({ scenario, onExit }: { scenario: Scenario; onExit: () => void }) {
  return (
    <div className="shrink-0 border-b border-(--color-border-strong) bg-(--color-bg-elevated) px-3 py-2">
      <div className="mb-1.5 flex items-center gap-2 font-mono text-xs">
        <button
          type="button"
          onClick={onExit}
          className="text-(--color-text-muted) hover:text-(--color-accent)"
        >
          ← Exit
        </button>
        <span className="text-(--color-text-muted)">·</span>
        <span className="font-semibold text-(--color-text-primary)">{scenario.title}</span>
        <span className="text-(--color-text-muted)">— {scenario.organism}</span>
      </div>
      <p className="mb-2 max-w-2xl font-mono text-xs text-(--color-text-primary)">
        {scenario.briefing}
      </p>
      <p className="mb-2 font-mono text-xs text-(--color-accent)">{objectiveLine(scenario)}</p>
      <p className="max-w-2xl font-mono text-[11px] text-(--color-warn)">{DISCLAIMER}</p>
    </div>
  )
}
