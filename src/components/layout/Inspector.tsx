import { useConstructStore } from '../../store/constructStore'
import { useUIStore } from '../../store/uiStore'
import { calculateGC, toDisplayPosition } from '../../biology/sequence'

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-xs text-(--color-text-muted)">{label}</span>
      <span className="font-mono text-xs text-(--color-text-primary)">{value}</span>
    </div>
  )
}

export function Inspector() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const selection = useUIStore((s) => s.selection)
  const activeFeatureId = useUIStore((s) => s.activeFeatureId)

  const construct = activeConstructId ? constructs[activeConstructId] : null

  if (!construct) {
    return (
      <aside className="w-64 shrink-0 border-l border-(--color-border) bg-(--color-bg-surface) p-3">
        <p className="text-xs text-(--color-text-muted)">Nothing selected.</p>
      </aside>
    )
  }

  const activeFeature = activeFeatureId
    ? construct.features.find((f) => f.id === activeFeatureId)
    : null

  const selectedSeq = selection ? construct.sequence.slice(selection.start, selection.end) : null

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-l border-(--color-border) bg-(--color-bg-surface) p-3">
      <h2 className="mb-1 text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
        Construct
      </h2>
      <StatRow label="Name" value={construct.name} />
      <StatRow label="Length" value={`${construct.sequence.length.toLocaleString()} bp`} />
      <StatRow label="Topology" value={construct.topology} />
      <StatRow label="GC%" value={`${calculateGC(construct.sequence).toFixed(1)}%`} />

      {activeFeature && (
        <>
          <h2 className="mt-4 mb-1 text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
            Feature
          </h2>
          <StatRow label="Name" value={activeFeature.name} />
          <StatRow label="Type" value={activeFeature.type} />
          <StatRow
            label="Range"
            value={`${toDisplayPosition(activeFeature.start)}-${activeFeature.end}`}
          />
          <StatRow label="Strand" value={activeFeature.strand === 1 ? '+' : '-'} />
        </>
      )}

      {selection && selectedSeq !== null && (
        <>
          <h2 className="mt-4 mb-1 text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
            Selection
          </h2>
          <StatRow
            label="Range"
            value={`${toDisplayPosition(selection.start)}-${selection.end}`}
          />
          <StatRow label="Length" value={`${selectedSeq.length} bp`} />
          {selectedSeq.length > 0 && (
            <StatRow label="GC%" value={`${calculateGC(selectedSeq).toFixed(1)}%`} />
          )}
        </>
      )}
    </aside>
  )
}
