import { useState } from 'react'
import { useConstructStore } from '../../store/constructStore'
import { useUIStore } from '../../store/uiStore'
import { toDisplayPosition } from '../../biology/sequence'

const VALID_BASES = /^[ACGTacgt]*$/

export function MutationForm() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const applyMutation = useConstructStore((s) => s.applyMutation)
  const selection = useUIStore((s) => s.selection)
  const [alternate, setAlternate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const construct = activeConstructId ? constructs[activeConstructId] : null

  if (!construct) return null
  if (!selection) {
    return (
      <p className="px-3 py-2 text-xs text-(--color-text-muted)">
        Select a region in the Sequence view to introduce a mutation there.
      </p>
    )
  }

  const reference = construct.sequence.slice(selection.start, selection.end)
  const alternateValid = VALID_BASES.test(alternate)

  const run = (
    type: 'substitution' | 'insertion' | 'deletion',
    ref: string,
    alt: string,
    position: number,
  ) => {
    setError(null)
    try {
      applyMutation({ type, position, reference: ref, alternate: alt })
      setAlternate('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-2 border-b border-(--color-border) px-3 py-2">
      <div className="font-mono text-xs text-(--color-text-muted)">
        Selection {toDisplayPosition(selection.start)}-{selection.end} ({reference.length} bp):{' '}
        <span className="text-(--color-text-primary)">{reference || '(empty)'}</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={alternate}
          onChange={(e) => setAlternate(e.target.value.toUpperCase())}
          placeholder="Replacement / inserted bases"
          className="w-56 rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-2 py-1 font-mono text-xs text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none"
        />
        <button
          type="button"
          disabled={!alternateValid || reference.length === 0}
          onClick={() => run('substitution', reference, alternate, selection.start)}
          className="rounded border border-(--color-border-strong) px-2 py-1 font-mono text-xs text-(--color-text-secondary) hover:border-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-40"
          title="Replace the selected bases with the typed sequence"
        >
          Substitute
        </button>
        <button
          type="button"
          disabled={!alternateValid || alternate.length === 0}
          onClick={() => run('insertion', '', alternate, selection.start)}
          className="rounded border border-(--color-border-strong) px-2 py-1 font-mono text-xs text-(--color-text-secondary) hover:border-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-40"
          title="Insert the typed sequence before the selection start"
        >
          Insert Before
        </button>
        <button
          type="button"
          disabled={reference.length === 0}
          onClick={() => run('deletion', reference, '', selection.start)}
          className="rounded border border-(--color-border-strong) px-2 py-1 font-mono text-xs text-(--color-text-secondary) hover:border-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-40"
          title="Delete the selected bases"
        >
          Delete Selection
        </button>
      </div>
      {error && <div className="text-xs text-(--color-danger)">{error}</div>}
    </div>
  )
}
