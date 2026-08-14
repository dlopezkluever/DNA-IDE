import { useMemo, useState } from 'react'
import { useConstructStore } from '../store/constructStore'
import { useUIStore } from '../store/uiStore'
import { useCrossHighlight } from '../hooks/useCrossHighlight'
import type { Feature } from '../types/models'
import { readingBasesWithCoords, translateFeature } from '../biology/translation'
import {
  findStructureMatch,
  computeBurialScores,
  type BurialScore,
} from '../biology/structureMapping'
import { explainStructureResidue } from '../biology/explain'
import { KNOWN_STRUCTURES } from '../data/structures'
import { SS_COLOR, BURIAL_COLOR } from '../data/structureColors'
import { aminoAcidFullName } from '../utils/format'
import { ExplainBlock } from '../components/explain/ExplainBlock'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'
import { StructureCanvas, type StructureColorMode } from '../components/structure/StructureCanvas'

const SS_LABEL: Record<'helix' | 'sheet' | 'coil', string> = {
  helix: 'α-helix',
  sheet: 'β-strand',
  coil: 'coil',
}

const DISCLAIMER =
  "This is a Cα backbone trace (one point per residue), not a full-atom or ribbon-cartoon " +
  "rendering. Residue positions are mapped from this construct's translated protein onto PDB " +
  '1EMA by sequence alignment, not assumed to match numbering 1:1 — where this construct\'s ' +
  'protein differs from the crystallized structure, both residues are shown, not merged. ' +
  '"Burial" is a coarse neighbor-count proxy, not a computed solvent-accessibility or ' +
  'stability score.'

/** 0-based genomic position -> 1-based amino-acid position within `cdsFeature`'s translated
 * protein, or null if the position falls outside the feature. Same technique as the CRISPR
 * spec's findFeatureContext: reuse readingBasesWithCoords rather than new coordinate math. */
function findAminoAcidPositionAtGenomicPosition(
  cdsFeature: Feature,
  genomicPosition: number,
  seq: string,
): number | null {
  const bases = readingBasesWithCoords(cdsFeature, seq)
  const index = bases.findIndex((b) => b.pos === genomicPosition)
  return index === -1 ? null : Math.floor(index / 3) + 1
}

export function StructureView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const explainMode = useUIStore((s) => s.explainMode)
  const { selection, selectCodon } = useCrossHighlight()

  const [colorMode, setColorMode] = useState<StructureColorMode>('secondary-structure')

  const construct = activeConstructId ? constructs[activeConstructId] : null

  // Only ever runs while the Structure tab is mounted (§3.1) — cheap at n≈238 either way.
  const match = useMemo(() => {
    if (!construct) return null
    const cdsFeatures = construct.features.filter((f) => f.type === 'CDS')
    return findStructureMatch(cdsFeatures, construct.sequence, KNOWN_STRUCTURES)
  }, [construct])

  // The reference structure's own coordinates never change — computed once per structure id,
  // not re-derived per construct edit (§2.3).
  const burialScores = useMemo<BurialScore[]>(
    () => (match ? computeBurialScores(match.structure.residues) : []),
    [match],
  )
  const burialByResSeq = useMemo(
    () => new Map(burialScores.map((b) => [b.resSeq, b])),
    [burialScores],
  )

  const codons = useMemo(
    () => (match && construct ? translateFeature(match.cdsFeature, construct.sequence) : []),
    [match, construct],
  )

  const highlightedAAPosition = useMemo(() => {
    if (!match || !construct || !selection) return null
    return findAminoAcidPositionAtGenomicPosition(match.cdsFeature, selection.start, construct.sequence)
  }, [match, construct, selection])

  const highlightedResSeq =
    highlightedAAPosition !== null && match
      ? (match.mapping.toReference.get(highlightedAAPosition) ?? null)
      : null

  function handleSelectResidue(resSeq: number) {
    if (!match) return
    const aaPos = match.mapping.toConstruct.get(resSeq)
    if (aaPos === undefined) return
    const codon = codons[aaPos - 1]
    if (!codon) return
    selectCodon(codon)
  }

  if (!construct) {
    return (
      <ViewPlaceholder
        title="No construct loaded"
        note="Import a FASTA or GenBank file to begin."
      />
    )
  }

  if (!match) {
    return (
      <ViewPlaceholder
        title="No known 3D structure for this construct"
        note="Currently supported: GFP (PDB 1EMA). No CDS in this construct aligns closely enough to a known structure."
      />
    )
  }

  const constructAA = highlightedAAPosition !== null ? codons[highlightedAAPosition - 1]?.aa : undefined
  const refResidue =
    highlightedResSeq !== null
      ? match.structure.residues.find((r) => r.resSeq === highlightedResSeq)
      : undefined
  const burial = highlightedResSeq !== null ? (burialByResSeq.get(highlightedResSeq) ?? null) : null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-(--color-border-strong) bg-(--color-bg-elevated) px-3 py-2 font-mono text-[11px] text-(--color-warn)">
        {DISCLAIMER}
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-(--color-border) bg-(--color-bg-surface) px-3 py-2 font-mono text-xs">
            <span className="text-(--color-accent)">{match.cdsFeature.name}</span>
            <span className="text-(--color-text-muted)"> · PDB {match.structure.pdbId} · </span>
            <span className="text-(--color-text-primary)">
              {(match.mapping.identity * 100).toFixed(0)}%
            </span>
            <span className="text-(--color-text-muted)"> identity to this construct's CDS</span>
          </div>

          <div className="min-h-0 flex-1 bg-(--color-bg-canvas)">
            <StructureCanvas
              residues={match.structure.residues}
              colorMode={colorMode}
              burialByResSeq={burialByResSeq}
              highlightedResSeq={highlightedResSeq}
              onSelectResidue={handleSelectResidue}
            />
          </div>

          <div className="shrink-0 space-y-2 border-t border-(--color-border) bg-(--color-bg-surface) px-3 py-2">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-(--color-text-muted)">Color:</span>
              {(
                [
                  ['secondary-structure', 'Secondary structure'],
                  ['burial', 'Burial'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setColorMode(mode)}
                  className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
                    colorMode === mode
                      ? 'border-(--color-accent-dim) bg-(--color-accent-dim) text-(--color-accent)'
                      : 'border-(--color-border-strong) text-(--color-text-secondary) hover:border-(--color-text-muted)'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-(--color-text-secondary)">
              {colorMode === 'secondary-structure'
                ? (Object.entries(SS_LABEL) as [keyof typeof SS_LABEL, string][]).map(
                    ([key, label]) => (
                      <span key={key} className="flex items-center gap-1">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: SS_COLOR[key] }}
                        />
                        {label}
                      </span>
                    ),
                  )
                : (['buried', 'intermediate', 'exposed'] as const).map((key) => (
                    <span key={key} className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: BURIAL_COLOR[key] }}
                      />
                      {key}
                    </span>
                  ))}
            </div>
          </div>
        </div>

        <div className="w-64 shrink-0 overflow-y-auto border-l border-(--color-border) bg-(--color-bg-surface) p-3">
          <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
            Detail
          </h3>
          {highlightedAAPosition === null || constructAA === undefined ? (
            <p className="text-xs text-(--color-text-muted)">
              Nothing in the current selection maps to a structure residue.
            </p>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              <div className="text-(--color-text-primary)">Residue {highlightedAAPosition}</div>
              <div className="flex justify-between items-baseline">
                <span className="text-(--color-text-muted)">This construct</span>
                <span className="text-(--color-text-primary)">{aminoAcidFullName(constructAA)}</span>
              </div>
              {refResidue ? (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className="text-(--color-text-muted)">{match.structure.pdbId} structure</span>
                    <span
                      className={
                        refResidue.resName === constructAA
                          ? 'text-(--color-text-primary)'
                          : 'text-(--color-warn)'
                      }
                    >
                      {aminoAcidFullName(refResidue.resName)}
                      {refResidue.resName !== constructAA ? ' (differs here)' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-(--color-text-muted)">Secondary structure</span>
                    <span style={{ color: SS_COLOR[refResidue.ss] }}>{SS_LABEL[refResidue.ss]}</span>
                  </div>
                </>
              ) : (
                <p className="text-(--color-text-muted)">
                  No corresponding position in {match.structure.pdbId} — falls outside the aligned
                  region.
                </p>
              )}
              {burial && (
                <div className="flex justify-between items-baseline">
                  <span className="text-(--color-text-muted)">Burial (proxy)</span>
                  <span style={{ color: BURIAL_COLOR[burial.category] }}>
                    {burial.category} ({burial.neighborCount})
                  </span>
                </div>
              )}
              {explainMode && (
                <div className="pt-1">
                  <ExplainBlock
                    steps={explainStructureResidue(highlightedAAPosition, constructAA, match, burial)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
