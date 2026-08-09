import { useState, type KeyboardEvent } from 'react'
import { useConstructStore } from '../store/constructStore'
import { useUIStore } from '../store/uiStore'
import { SequenceEditor } from '../components/sequence/SequenceEditor'
import { SequenceToolbar } from '../components/sequence/SequenceToolbar'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'
import type { Mutation } from '../types/models'
import {
  consequenceLabel,
  formatDNAChange,
  formatProteinChange,
  aminoAcidFullName,
} from '../utils/format'

const VALID_BASE_KEYS = new Set(['A', 'T', 'G', 'C'])

function MutationToast({ mutation, onDismiss }: { mutation: Mutation; onDismiss: () => void }) {
  const effect = mutation.proteinEffect
  const proteinChange = formatProteinChange(mutation)
  const before = aminoAcidFullName(effect?.aminoAcidBefore)
  const after = aminoAcidFullName(effect?.aminoAcidAfter)

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-(--color-border) bg-(--color-bg-elevated) px-3 py-1.5 font-mono text-xs">
      <span className="text-(--color-text-secondary)">{formatDNAChange(mutation)}</span>
      {before && after && (
        <span className="text-(--color-text-secondary)">
          {before} → {after}
        </span>
      )}
      {proteinChange && <span className="text-(--color-text-muted)">({proteinChange})</span>}
      <span className="rounded bg-(--color-accent-dim) px-1.5 py-0.5 text-(--color-accent)">
        {effect ? consequenceLabel(effect.consequence) : 'Applied'}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-auto text-(--color-text-muted) hover:text-(--color-text-primary)"
      >
        ✕
      </button>
    </div>
  )
}

export function SequenceView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const applyMutation = useConstructStore((s) => s.applyMutation)
  const selection = useUIStore((s) => s.selection)
  const construct = activeConstructId ? constructs[activeConstructId] : null
  const [lastMutation, setLastMutation] = useState<Mutation | null>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!construct || !selection) return
    if (selection.end - selection.start !== 1) return
    const key = e.key.toUpperCase()
    if (!VALID_BASE_KEYS.has(key)) return

    const reference = construct.sequence[selection.start]
    if (key === reference) return // no-op, same base

    e.preventDefault()
    const mutation = applyMutation({
      type: 'substitution',
      position: selection.start,
      reference,
      alternate: key,
    })
    setLastMutation(mutation)
  }

  if (!construct) {
    return (
      <ViewPlaceholder title="No construct loaded" note="Import a FASTA or GenBank file to begin." />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden" tabIndex={0} onKeyDown={handleKeyDown}>
      <SequenceToolbar />
      {lastMutation && (
        <MutationToast mutation={lastMutation} onDismiss={() => setLastMutation(null)} />
      )}
      <div className="min-h-0 flex-1">
        <SequenceEditor sequence={construct.sequence} />
      </div>
      <div className="shrink-0 border-t border-(--color-border) px-3 py-1 font-mono text-[11px] text-(--color-text-muted)">
        Select a single base, then type A/T/G/C to introduce a substitution.
      </div>
    </div>
  )
}
