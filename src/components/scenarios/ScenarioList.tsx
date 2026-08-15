import { useMemo } from 'react'
import { useScenarioStore } from '../../store/scenarioStore'
import { SCENARIOS, isTierUnlocked } from '../../scenarios/data'
import { formatStars } from '../../scenarios/evaluate'
import type { Scenario, ScenarioTier } from '../../scenarios/types'

const DISCLAIMER =
  'These are simplified teaching scenarios on synthetic/illustrative constructs — not real ' +
  'protocols, and the repair outcome is randomly simulated, not a lab result. Off-target search ' +
  'and consequence prediction are construct-local only, same as the CRISPR tab.'

function groupByTier(scenarios: Scenario[]): [ScenarioTier, Scenario[]][] {
  const byTier = new Map<ScenarioTier, Scenario[]>()
  for (const scenario of scenarios) {
    const list = byTier.get(scenario.tier) ?? []
    list.push(scenario)
    byTier.set(scenario.tier, list)
  }
  return [...byTier.entries()].sort(([a], [b]) => a - b)
}

export function ScenarioList() {
  const progress = useScenarioStore((s) => s.progress)
  const startScenario = useScenarioStore((s) => s.startScenario)

  const tiers = useMemo(() => groupByTier(SCENARIOS), [])

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 max-w-2xl font-mono text-[11px] text-(--color-warn)">{DISCLAIMER}</div>

      {tiers.map(([tier, scenarios]) => {
        const unlocked = isTierUnlocked(tier, progress)
        return (
          <section key={tier} className="mb-6">
            <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
              Tier {tier}
            </h3>
            <ul className="max-w-xl space-y-1.5">
              {scenarios.map((scenario) => {
                const bestStars = progress[scenario.id]?.bestStars ?? 0
                return (
                  <li key={scenario.id}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => startScenario(scenario.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left font-mono text-sm transition-colors disabled:cursor-not-allowed ${
                        unlocked
                          ? 'border-(--color-border-strong) text-(--color-text-primary) hover:bg-(--color-bg-hover) hover:border-(--color-accent-dim)'
                          : 'border-(--color-border) text-(--color-text-muted) opacity-60'
                      }`}
                    >
                      <span>{scenario.title}</span>
                      <span
                        className={
                          unlocked ? 'text-(--color-accent)' : 'text-(--color-text-muted)'
                        }
                      >
                        {formatStars(bestStars)}
                      </span>
                    </button>
                    {!unlocked && (
                      <p className="mt-0.5 pl-3 font-mono text-[11px] text-(--color-text-muted)">
                        Clear Tier {tier - 1} to unlock.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
