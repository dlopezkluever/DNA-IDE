import { useConstructStore } from '../store/constructStore'
import { LinearFeatureMap } from '../components/map/LinearFeatureMap'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

export function MapView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const construct = activeConstructId ? constructs[activeConstructId] : null

  if (!construct) {
    return <ViewPlaceholder title="No construct loaded" note="Import a FASTA or GenBank file to begin." />
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-(--color-border) px-3 py-2 font-mono text-xs text-(--color-text-muted)">
        Linear map · circular plasmid view arrives in Phase 5
      </div>
      <LinearFeatureMap sequenceLength={construct.sequence.length} features={construct.features} />
    </div>
  )
}
