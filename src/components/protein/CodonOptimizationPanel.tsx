import { useMemo, useState } from 'react'
import type { Feature } from '../../types/models'
import { optimizeCodons } from '../../biology/codons'
import { ORGANISMS, type OrganismId } from '../../data/codonUsageTables'
import { reverseComplement, getFeaturePieces } from '../../biology/sequence'

/** Extracts the reading-direction nucleotide sequence for a feature (needed since
 * optimizeCodons works on a linear reading-direction CDS, not raw plus-strand coordinates). */
function readingSequence(feature: Feature, seq: string): string {
  const pieces = getFeaturePieces(feature, seq.length)
  const parts = pieces.map((p) => seq.slice(p.start, p.end))
  return feature.strand === 1 ? parts.join('') : parts.map(reverseComplement).reverse().join('')
}

export function CodonOptimizationPanel({
  feature,
  sequence,
}: {
  feature: Feature
  sequence: string
}) {
  const [open, setOpen] = useState(false)
  const [organism, setOrganism] = useState<OrganismId>('ecoli')

  const cds = useMemo(() => readingSequence(feature, sequence), [feature, sequence])
  const result = useMemo(() => (open ? optimizeCodons(cds, organism) : null), [open, cds, organism])

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-[11px] text-(--color-text-secondary) hover:text-(--color-accent)"
      >
        {open ? '▾' : '▸'} Codon optimization
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded border border-(--color-border) bg-(--color-bg-canvas) p-2">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-(--color-text-muted)">Organism</span>
            <select
              value={organism}
              onChange={(e) => setOrganism(e.target.value as OrganismId)}
              className="rounded border border-(--color-border-strong) bg-(--color-bg-surface) px-1.5 py-0.5 text-(--color-text-primary)"
            >
              {ORGANISMS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {result && (
            <div className="space-y-1 font-mono text-[11px]">
              <div>
                <span className="text-(--color-text-muted)">Protein unchanged: </span>
                <span
                  className={
                    result.proteinUnchanged ? 'text-(--color-accent)' : 'text-(--color-danger)'
                  }
                >
                  {result.proteinUnchanged ? 'yes' : 'no'}
                </span>
              </div>
              <div>
                <span className="text-(--color-text-muted)">Codons changed: </span>
                <span className="text-(--color-text-primary)">
                  {result.changes.length} / {Math.floor(cds.length / 3)}
                </span>
              </div>
              <div>
                <span className="text-(--color-text-muted)">GC%: </span>
                <span className="text-(--color-text-primary)">
                  {result.gcBefore.toFixed(1)}% → {result.gcAfter.toFixed(1)}%
                </span>
              </div>
              <div className="max-h-40 space-y-0.5 overflow-y-auto pt-1">
                {result.changes.map((c, i) => (
                  <div key={i} className="text-(--color-text-secondary)">
                    codon {c.index + 1}: {c.before} → {c.after}
                  </div>
                ))}
              </div>
              <div className="pt-1 text-(--color-text-muted)">
                Optimized DNA is {result.optimizedDNA.length} bp; translating it with either
                sequence yields the identical protein — different DNA, same protein, because the
                genetic code is redundant.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
