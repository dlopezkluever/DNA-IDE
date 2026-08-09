import { useConstructStore } from '../store/constructStore'
import { MutationForm } from '../components/mutations/MutationForm'
import { MutationList } from '../components/mutations/MutationList'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

export function MutationsView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)

  if (!activeConstructId) {
    return (
      <ViewPlaceholder
        title="No construct loaded"
        note="Import a FASTA or GenBank file to begin."
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <MutationForm />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MutationList />
      </div>
    </div>
  )
}
