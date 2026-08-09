import { useConstructStore } from '../../store/constructStore'

export function FeatureMapStrip() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const construct = activeConstructId ? constructs[activeConstructId] : null

  return (
    <div className="flex h-8 shrink-0 items-center border-t border-(--color-border) bg-(--color-bg-surface) px-3 font-mono text-xs text-(--color-text-muted)">
      {construct ? (
        <span>
          {construct.features.length} feature{construct.features.length === 1 ? '' : 's'} ·{' '}
          {construct.sequence.length.toLocaleString()} bp · {construct.topology}
        </span>
      ) : (
        <span>No construct loaded</span>
      )}
    </div>
  )
}
