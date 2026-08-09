import { useMemo, useState } from 'react'
import { findORFs } from '../../biology/orf'
import { toDisplayPosition } from '../../biology/sequence'
import { useCrossHighlight } from '../../hooks/useCrossHighlight'
import type { Topology } from '../../types/models'

const MIN_LENGTH_OPTIONS = [30, 100, 300, 600]

export function ORFList({ sequence, topology }: { sequence: string; topology: Topology }) {
  const [open, setOpen] = useState(false)
  const [minLength, setMinLength] = useState(100)
  const { selectRange } = useCrossHighlight()

  const orfs = useMemo(
    () => (open ? findORFs(sequence, { topology, minLength }) : []),
    [open, sequence, topology, minLength],
  )

  return (
    <div className="mb-6 border-b border-(--color-border) pb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex items-center gap-2 font-mono text-sm text-(--color-accent) hover:underline"
      >
        {open ? '▾' : '▸'} Detected ORFs (all 6 frames)
      </button>

      {open && (
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px]">
            <span className="text-(--color-text-muted)">Min length</span>
            {MIN_LENGTH_OPTIONS.map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => setMinLength(len)}
                className={`rounded border px-1.5 py-0.5 ${
                  minLength === len
                    ? 'border-(--color-accent) text-(--color-accent)'
                    : 'border-(--color-border-strong) text-(--color-text-secondary)'
                }`}
              >
                {len}bp
              </button>
            ))}
            <span className="text-(--color-text-muted)">{orfs.length} found</span>
          </div>

          {orfs.length === 0 ? (
            <p className="text-xs text-(--color-text-muted)">
              No ORFs found at or above this length threshold.
            </p>
          ) : (
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-left text-(--color-text-muted)">
                  <th className="pr-4 pb-1">Position</th>
                  <th className="pr-4 pb-1">Strand</th>
                  <th className="pr-4 pb-1">Frame</th>
                  <th className="pr-4 pb-1">nt</th>
                  <th className="pb-1">aa</th>
                </tr>
              </thead>
              <tbody>
                {orfs.map((orf, i) => (
                  <tr
                    key={i}
                    onClick={() => selectRange(orf.start, orf.end, orf.strand)}
                    className="cursor-pointer border-t border-(--color-border) hover:bg-(--color-bg-hover)"
                  >
                    <td className="py-1 pr-4 text-(--color-text-primary)">
                      {toDisplayPosition(orf.start)}-{orf.end}
                    </td>
                    <td className="py-1 pr-4">{orf.strand === 1 ? '+' : '-'}</td>
                    <td className="py-1 pr-4">{orf.frame + 1}</td>
                    <td className="py-1 pr-4">{orf.length}</td>
                    <td className="py-1">{orf.aminoAcidLength}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
