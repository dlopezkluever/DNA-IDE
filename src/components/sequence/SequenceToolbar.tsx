import { useConstructStore } from '../../store/constructStore'
import { useUIStore } from '../../store/uiStore'
import { reverseComplement } from '../../biology/sequence'
import { explainReverseComplement } from '../../biology/explain'
import { ExplainBlock } from '../explain/ExplainBlock'

function findExactMatches(sequence: string, query: string): { start: number; end: number }[] {
  if (!query) return []
  const upperSeq = sequence.toUpperCase()
  const upperQuery = query.toUpperCase()
  const matches: { start: number; end: number }[] = []
  let from = 0
  while (from <= upperSeq.length - upperQuery.length) {
    const idx = upperSeq.indexOf(upperQuery, from)
    if (idx === -1) break
    matches.push({ start: idx, end: idx + upperQuery.length })
    from = idx + 1
  }
  return matches
}

export function SequenceToolbar() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const selection = useUIStore((s) => s.selection)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const searchResults = useUIStore((s) => s.searchResults)
  const setSearchResults = useUIStore((s) => s.setSearchResults)
  const explainMode = useUIStore((s) => s.explainMode)
  const showRC = useUIStore((s) => s.rcPreviewOpen)
  const setShowRC = useUIStore((s) => s.setRcPreviewOpen)

  const construct = activeConstructId ? constructs[activeConstructId] : null

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (!construct) return
    setSearchResults(findExactMatches(construct.sequence, value))
  }

  const selectedSeq =
    construct && selection ? construct.sequence.slice(selection.start, selection.end) : ''

  return (
    <div className="flex shrink-0 flex-col gap-1 border-b border-(--color-border) bg-(--color-bg-surface) px-3 py-1.5">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search sequence (exact match)…"
          className="w-64 rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-2 py-1 font-mono text-xs text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none"
        />
        {searchQuery && (
          <span className="text-xs text-(--color-text-muted)">
            {searchResults.length} match{searchResults.length === 1 ? '' : 'es'}
          </span>
        )}

        <button
          type="button"
          onClick={() => setShowRC(!showRC)}
          disabled={!selectedSeq}
          className="ml-auto rounded border border-(--color-border-strong) px-2 py-1 font-mono text-xs text-(--color-text-secondary) hover:border-(--color-text-muted) disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reverse Complement
        </button>
      </div>

      {showRC && selectedSeq && explainMode && (
        <ExplainBlock steps={explainReverseComplement(selectedSeq)} />
      )}
      {showRC && selectedSeq && !explainMode && (
        <div className="rounded border border-(--color-border) bg-(--color-bg-canvas) px-2 py-1.5 font-mono text-xs">
          <div className="text-(--color-text-muted)">
            5' <span className="text-(--color-text-primary)">{selectedSeq}</span> 3'
          </div>
          <div className="text-(--color-text-muted)">
            3' <span className="text-(--color-text-primary)">{reverseComplement(selectedSeq)}</span>{' '}
            5'
          </div>
        </div>
      )}
    </div>
  )
}
