import { useMemo } from 'react'
import { useConstructStore } from '../store/constructStore'
import { alignSequences, diffFeatures, diffProteins } from '../biology/alignment'
import { translateFeature } from '../biology/translation'
import { toDisplayPosition } from '../biology/sequence'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

function translateFeatureToStop(feature: { start: number; end: number; strand: 1 | -1; segments?: { start: number; end: number }[] }, seq: string): string {
  const codons = translateFeature(feature, seq)
  let protein = ''
  for (const c of codons) {
    protein += c.aa
    if (c.aa === '*') break
  }
  return protein
}

const OP_COLOR: Record<string, string> = {
  match: 'text-(--color-text-muted)',
  mismatch: 'bg-(--color-danger)/30 text-(--color-danger)',
  insertion: 'bg-(--color-accent-dim) text-(--color-accent)',
  deletion: 'bg-(--color-danger)/20 text-(--color-danger) line-through',
}

function SequenceDiff({ ops, ref, mod }: { ops: ReturnType<typeof alignSequences>; ref: string; mod: string }) {
  return (
    <div className="space-y-1 overflow-x-auto whitespace-pre font-mono text-xs">
      <div>
        <span className="mr-2 text-(--color-text-muted)">ref</span>
        {ops.map((op, i) => (
          <span key={i} className={OP_COLOR[op.type]}>
            {ref.slice(op.refStart, op.refEnd) || (op.type === 'insertion' ? '·'.repeat(op.modEnd - op.modStart) : '')}
          </span>
        ))}
      </div>
      <div>
        <span className="mr-2 text-(--color-text-muted)">mod</span>
        {ops.map((op, i) => (
          <span key={i} className={OP_COLOR[op.type]}>
            {mod.slice(op.modStart, op.modEnd) || (op.type === 'deletion' ? '·'.repeat(op.refEnd - op.refStart) : '')}
          </span>
        ))}
      </div>
    </div>
  )
}

export function CompareView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const originalConstructId = useConstructStore((s) => s.originalConstructId)
  const compareConstructId = useConstructStore((s) => s.compareConstructId)
  const setCompareConstruct = useConstructStore((s) => s.setCompareConstruct)
  const constructs = useConstructStore((s) => s.constructs)

  const modConstruct = activeConstructId ? constructs[activeConstructId] : null
  const referenceId = compareConstructId ?? originalConstructId
  const refConstruct = referenceId ? constructs[referenceId] : null

  const otherConstructs = Object.values(constructs).filter((c) => c.id !== activeConstructId)

  const dnaOps = useMemo(() => {
    if (!refConstruct || !modConstruct) return null
    return alignSequences(refConstruct.sequence, modConstruct.sequence)
  }, [refConstruct, modConstruct])

  const featureDiff = useMemo(() => {
    if (!refConstruct || !modConstruct) return null
    return diffFeatures(refConstruct.features, modConstruct.features)
  }, [refConstruct, modConstruct])

  const proteinDiffs = useMemo(() => {
    if (!refConstruct || !modConstruct) return []
    // Every CDS present in both constructs (by id) is checked, not just ones whose
    // coordinates moved — a plain substitution changes protein content without
    // shifting the feature's start/end at all.
    const modById = new Map(modConstruct.features.map((f) => [f.id, f]))
    const results: { name: string; ops: ReturnType<typeof alignSequences>; before: string; after: string }[] = []
    for (const before of refConstruct.features) {
      if (before.type !== 'CDS') continue
      const after = modById.get(before.id)
      if (!after) continue
      const beforeProtein = translateFeatureToStop(before, refConstruct.sequence)
      const afterProtein = translateFeatureToStop(after, modConstruct.sequence)
      if (beforeProtein === afterProtein) continue
      results.push({ name: before.name, ops: diffProteins(beforeProtein, afterProtein), before: beforeProtein, after: afterProtein })
    }
    return results
  }, [refConstruct, modConstruct])

  if (!modConstruct) {
    return (
      <ViewPlaceholder title="No construct loaded" note="Import a FASTA or GenBank file to begin." />
    )
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-4 flex items-center gap-2 font-mono text-xs">
        <span className="text-(--color-text-muted)">Compare</span>
        <select
          value={referenceId ?? ''}
          onChange={(e) => setCompareConstruct(e.target.value || null)}
          className="rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-2 py-1 text-(--color-text-primary)"
        >
          <option value="">Select a construct…</option>
          {otherConstructs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-(--color-text-muted)">against</span>
        <span className="text-(--color-accent)">{modConstruct.name}</span>
      </div>

      {!refConstruct ? (
        <p className="text-xs text-(--color-text-muted)">
          {originalConstructId
            ? 'Loading…'
            : 'No comparison target yet. Introduce a mutation (which forks a working copy automatically) or pick a second construct above.'}
        </p>
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
              DNA Diff
            </h3>
            {dnaOps && <SequenceDiff ops={dnaOps} ref={refConstruct.sequence} mod={modConstruct.sequence} />}
          </section>

          <section>
            <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
              Feature Diff
            </h3>
            {featureDiff && (
              <div className="space-y-1 font-mono text-xs">
                {featureDiff.added.map((f) => (
                  <div key={f.id} className="text-(--color-accent)">+ {f.name} ({toDisplayPosition(f.start)}-{f.end})</div>
                ))}
                {featureDiff.removed.map((f) => (
                  <div key={f.id} className="text-(--color-danger)">- {f.name} ({toDisplayPosition(f.start)}-{f.end})</div>
                ))}
                {featureDiff.modified.map(({ before, after }) => (
                  <div key={before.id} className="text-(--color-warn)">
                    ~ {before.name}: {toDisplayPosition(before.start)}-{before.end} →{' '}
                    {toDisplayPosition(after.start)}-{after.end}
                  </div>
                ))}
                {featureDiff.added.length === 0 && featureDiff.removed.length === 0 && featureDiff.modified.length === 0 && (
                  <div className="text-(--color-text-muted)">No feature changes.</div>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
              Protein Diff
            </h3>
            {proteinDiffs.length === 0 ? (
              <div className="font-mono text-xs text-(--color-text-muted)">No protein-level changes.</div>
            ) : (
              <div className="space-y-3">
                {proteinDiffs.map((pd) => (
                  <div key={pd.name}>
                    <div className="mb-1 font-mono text-xs text-(--color-text-secondary)">{pd.name}</div>
                    <SequenceDiff ops={pd.ops} ref={pd.before} mod={pd.after} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
