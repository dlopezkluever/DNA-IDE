import { useConstructStore } from '../../store/constructStore'
import { LinearFeatureMap } from './LinearFeatureMap'

export function FeatureMapStrip() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const construct = activeConstructId ? constructs[activeConstructId] : null

  if (!construct) {
    return (
      <div className="flex h-8 shrink-0 items-center border-t border-(--color-border) bg-(--color-bg-surface) px-3 font-mono text-xs text-(--color-text-muted)">
        No construct loaded
      </div>
    )
  }

  return (
    <div className="flex max-h-40 shrink-0 flex-col border-t border-(--color-border) bg-(--color-bg-surface)">
      <div className="px-3 pt-1 font-mono text-[11px] text-(--color-text-muted)">
        {construct.features.length} feature{construct.features.length === 1 ? '' : 's'} ·{' '}
        {construct.sequence.length.toLocaleString()} bp · {construct.topology}
      </div>
      <LinearFeatureMap sequenceLength={construct.sequence.length} features={construct.features} />
    </div>
  )
}
