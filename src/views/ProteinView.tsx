import { useConstructStore } from '../store/constructStore'
import { CDSTranslationBlock } from '../components/protein/CDSTranslationBlock'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

export function ProteinView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const construct = activeConstructId ? constructs[activeConstructId] : null

  if (!construct) {
    return <ViewPlaceholder title="No construct loaded" note="Import a FASTA or GenBank file to begin." />
  }

  const cdsFeatures = construct.features.filter((f) => f.type === 'CDS')

  if (cdsFeatures.length === 0) {
    return (
      <ViewPlaceholder
        title="No CDS features"
        note="This construct has no annotated coding sequences to translate."
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      {cdsFeatures.map((f) => (
        <CDSTranslationBlock key={f.id} feature={f} sequence={construct.sequence} />
      ))}
    </div>
  )
}
