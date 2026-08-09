import { useConstructStore } from '../store/constructStore'
import { SequenceEditor } from '../components/sequence/SequenceEditor'
import { SequenceToolbar } from '../components/sequence/SequenceToolbar'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

export function SequenceView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const construct = activeConstructId ? constructs[activeConstructId] : null

  if (!construct) {
    return <ViewPlaceholder title="No construct loaded" note="Import a FASTA file to begin." />
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <SequenceToolbar />
      <div className="min-h-0 flex-1">
        <SequenceEditor sequence={construct.sequence} />
      </div>
    </div>
  )
}
