import { useMemo, useState } from 'react'
import { useConstructStore } from '../store/constructStore'
import { useUIStore } from '../store/uiStore'
import { useCrossHighlight } from '../hooks/useCrossHighlight'
import { designPrimers, type Primer } from '../biology/primers'
import { simulatePCR, type PCRResult } from '../biology/pcr'
import { toDisplayPosition } from '../biology/sequence'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

const ERROR_EXPLANATIONS: Record<string, string> = {
  'primer-not-found': 'One or both primers do not match anywhere in the template.',
  'primers-face-away':
    "Both primers bind, but their 3' ends point away from each other — PCR only amplifies the region between two oppositely oriented binding sites.",
  'multiple-plausible-regions':
    'These primers bind more than one place; the reaction is not specific to a single product.',
}

function PrimerCandidateTable({
  title,
  candidates,
  onPick,
}: {
  title: string
  candidates: Primer[]
  onPick: (p: Primer) => void
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-(--color-text-muted)">{title}</div>
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-left text-(--color-text-muted)">
            <th className="pr-3 pb-1">Sequence</th>
            <th className="pr-3 pb-1">Len</th>
            <th className="pr-3 pb-1">GC%</th>
            <th className="pr-3 pb-1">Tm</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {candidates.map((p, i) => (
            <tr key={i} className="border-t border-(--color-border)">
              <td className="py-1 pr-3 text-(--color-text-primary)">{p.sequence}</td>
              <td className="py-1 pr-3">{p.length}</td>
              <td className="py-1 pr-3">{p.gcPercent.toFixed(0)}%</td>
              <td className="py-1 pr-3">{p.tm.toFixed(1)}°C</td>
              <td className="py-1">
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="rounded border border-(--color-border-strong) px-1.5 py-0.5 text-(--color-text-secondary) hover:border-(--color-accent) hover:text-(--color-accent)"
                >
                  Use
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PCRView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const selection = useUIStore((s) => s.selection)
  const { selectRange } = useCrossHighlight()

  const construct = activeConstructId ? constructs[activeConstructId] : null

  const [forwardPrimer, setForwardPrimer] = useState('')
  const [reversePrimer, setReversePrimer] = useState('')
  const [result, setResult] = useState<PCRResult | null>(null)

  const candidates = useMemo(() => {
    if (!construct || !selection) return null
    return designPrimers(
      construct.sequence,
      { start: selection.start, end: selection.end },
      { topology: construct.topology },
    )
  }, [construct, selection])

  if (!construct) {
    return (
      <ViewPlaceholder
        title="No construct loaded"
        note="Import a FASTA or GenBank file to begin."
      />
    )
  }

  const runPCR = () => {
    setResult(simulatePCR(construct.sequence, forwardPrimer, reversePrimer, construct.topology))
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <h3 className="mb-1 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
        1. Design Primers
      </h3>
      {!selection ? (
        <p className="mb-4 text-xs text-(--color-text-muted)">
          Select a target region in the Sequence view, then return here to see candidate primers.
        </p>
      ) : (
        <div className="mb-4 space-y-3">
          <p className="text-xs text-(--color-text-muted)">
            Target region {toDisplayPosition(selection.start)}-{selection.end}
          </p>
          {candidates && candidates.forward.length > 0 && (
            <PrimerCandidateTable
              title="Forward candidates"
              candidates={candidates.forward}
              onPick={(p) => setForwardPrimer(p.sequence)}
            />
          )}
          {candidates && candidates.reverse.length > 0 && (
            <PrimerCandidateTable
              title="Reverse candidates"
              candidates={candidates.reverse}
              onPick={(p) => setReversePrimer(p.sequence)}
            />
          )}
        </div>
      )}

      <h3 className="mb-1 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
        2. Simulate PCR
      </h3>
      <div className="mb-2 flex flex-col gap-2">
        <input
          type="text"
          value={forwardPrimer}
          onChange={(e) => setForwardPrimer(e.target.value.toUpperCase())}
          placeholder="Forward primer (5'->3')"
          className="w-96 rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-2 py-1 font-mono text-xs text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none"
        />
        <input
          type="text"
          value={reversePrimer}
          onChange={(e) => setReversePrimer(e.target.value.toUpperCase())}
          placeholder="Reverse primer (5'->3')"
          className="w-96 rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-2 py-1 font-mono text-xs text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none"
        />
        <button
          type="button"
          disabled={!forwardPrimer || !reversePrimer}
          onClick={runPCR}
          className="w-fit rounded border border-(--color-border-strong) px-3 py-1 font-mono text-xs text-(--color-text-secondary) hover:border-(--color-accent) hover:text-(--color-accent) disabled:cursor-not-allowed disabled:opacity-40"
        >
          Simulate PCR
        </button>
      </div>

      {result && (
        <div className="mt-3 rounded border border-(--color-border) bg-(--color-bg-surface) p-3 font-mono text-xs">
          {result.success ? (
            <>
              <div className="mb-2 text-(--color-accent)">Amplification successful</div>
              <div className="space-y-1">
                <div>
                  Forward binds:{' '}
                  <button
                    className="text-(--color-info) hover:underline"
                    onClick={() =>
                      selectRange(result.forwardBinding!.start, result.forwardBinding!.end)
                    }
                  >
                    {toDisplayPosition(result.forwardBinding!.start)}-{result.forwardBinding!.end}
                  </button>
                </div>
                <div>
                  Reverse binds:{' '}
                  <button
                    className="text-(--color-info) hover:underline"
                    onClick={() =>
                      selectRange(result.reverseBinding!.start, result.reverseBinding!.end)
                    }
                  >
                    {toDisplayPosition(result.reverseBinding!.start)}-{result.reverseBinding!.end}
                  </button>
                </div>
                <div>Amplicon length: {result.amplicon?.length.toLocaleString()} bp</div>
                <div className="mt-2 max-h-32 overflow-y-auto break-all text-(--color-text-secondary)">
                  {result.amplicon}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-1 text-(--color-danger)">
                {result.error === 'primer-not-found' && 'Primer not found'}
                {result.error === 'primers-face-away' && 'Primers face away from each other'}
                {result.error === 'multiple-plausible-regions' &&
                  'Multiple plausible binding regions'}
              </div>
              <div className="text-(--color-text-secondary)">{result.message}</div>
              <div className="mt-1 text-(--color-text-muted)">
                {result.error && ERROR_EXPLANATIONS[result.error]}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
