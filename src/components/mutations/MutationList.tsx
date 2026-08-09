import { useConstructStore } from '../../store/constructStore'
import { useCrossHighlight } from '../../hooks/useCrossHighlight'
import { toDisplayPosition } from '../../biology/sequence'
import { consequenceLabel, formatDNAChange, formatProteinChange } from '../../utils/format'
import type { Mutation } from '../../types/models'

const CONSEQUENCE_COLOR: Record<string, string> = {
  synonymous: 'text-(--color-text-secondary)',
  missense: 'text-(--color-warn)',
  nonsense: 'text-(--color-danger)',
  frameshift: 'text-(--color-danger)',
  noncoding: 'text-(--color-text-muted)',
  'start-loss': 'text-(--color-danger)',
  'stop-loss': 'text-(--color-danger)',
  'in-frame-indel': 'text-(--color-warn)',
}

function MutationDetail({ mutation, featureName }: { mutation: Mutation; featureName: string | null }) {
  const effect = mutation.proteinEffect
  const proteinChange = formatProteinChange(mutation)

  return (
    <div className="space-y-1 border-t border-(--color-border) bg-(--color-bg-canvas) px-3 py-2 font-mono text-xs">
      <div className="text-(--color-text-muted)">Mutation</div>
      <div>
        Position: <span className="text-(--color-text-primary)">{toDisplayPosition(mutation.position)}</span>
      </div>
      <div>
        DNA: <span className="text-(--color-text-primary)">{formatDNAChange(mutation)}</span>
      </div>
      {featureName && (
        <div>
          Feature: <span className="text-(--color-text-primary)">{featureName}</span>
        </div>
      )}
      {effect?.codonBefore && effect.codonAfter && (
        <div>
          Codon:{' '}
          <span className="text-(--color-text-primary)">
            {effect.codonBefore} → {effect.codonAfter}
          </span>
        </div>
      )}
      {proteinChange && (
        <div>
          Protein: <span className="text-(--color-text-primary)">{proteinChange}</span>
        </div>
      )}
      {effect && (
        <div>
          Type:{' '}
          <span className={CONSEQUENCE_COLOR[effect.consequence] ?? 'text-(--color-text-primary)'}>
            {consequenceLabel(effect.consequence)}
          </span>
        </div>
      )}
    </div>
  )
}

export function MutationList() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const { activeMutationId, selectMutation } = useCrossHighlight()

  const construct = activeConstructId ? constructs[activeConstructId] : null
  if (!construct) return null

  const mutations = [...construct.mutations].sort((a, b) => b.createdAt - a.createdAt)

  if (mutations.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-(--color-text-muted)">
        No mutations yet. Select a region in the Sequence view and type a base, or use the form
        above for insertions/deletions.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-(--color-border)">
      {mutations.map((m) => {
        const isActive = m.id === activeMutationId
        const featureName =
          m.affectedFeatureIds.length > 0
            ? (construct.features.find((f) => f.id === m.affectedFeatureIds[0])?.name ?? null)
            : null

        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => selectMutation(m)}
              className={`flex w-full items-center gap-3 px-3 py-1.5 text-left font-mono text-xs ${
                isActive ? 'bg-(--color-bg-hover)' : 'hover:bg-(--color-bg-hover)'
              }`}
            >
              <span className="w-14 shrink-0 text-(--color-text-muted)">
                {toDisplayPosition(m.position)}
              </span>
              <span className="w-24 shrink-0 text-(--color-text-secondary)">{formatDNAChange(m)}</span>
              {m.proteinEffect && (
                <span className={CONSEQUENCE_COLOR[m.proteinEffect.consequence] ?? ''}>
                  {consequenceLabel(m.proteinEffect.consequence)}
                </span>
              )}
            </button>
            {isActive && <MutationDetail mutation={m} featureName={featureName} />}
          </li>
        )
      })}
    </ul>
  )
}
