import { useConstructStore } from '../store/constructStore'
import { LinearFeatureMap } from '../components/map/LinearFeatureMap'
import { CircularPlasmidView } from '../components/map/CircularPlasmidView'
import { GCTrack } from '../components/map/GCTrack'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

export function MapView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const construct = activeConstructId ? constructs[activeConstructId] : null

  if (!construct) {
    return (
      <ViewPlaceholder title="No construct loaded" note="Import a FASTA or GenBank file to begin." />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <LinearFeatureMap sequenceLength={construct.sequence.length} features={construct.features} />
      <GCTrack sequence={construct.sequence} />
      {construct.topology === 'circular' ? (
        <CircularPlasmidView
          name={construct.name}
          sequenceLength={construct.sequence.length}
          features={construct.features}
        />
      ) : (
        <div className="px-3 py-4 font-mono text-xs text-(--color-text-muted)">
          Linear construct — circular plasmid view applies only to circular topology.
        </div>
      )}
    </div>
  )
}
