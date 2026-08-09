import type { Feature } from '../../types/models'
import { translateFeature } from '../../biology/translation'
import { toDisplayPosition } from '../../biology/sequence'
import { explainTranslation } from '../../biology/explain'
import { useCrossHighlight } from '../../hooks/useCrossHighlight'
import { useUIStore } from '../../store/uiStore'
import { ExplainBlock } from '../explain/ExplainBlock'
import { CodonOptimizationPanel } from './CodonOptimizationPanel'

interface CDSTranslationBlockProps {
  feature: Feature
  sequence: string
}

const EXPLAIN_CODON_LIMIT = 12

export function CDSTranslationBlock({ feature, sequence }: CDSTranslationBlockProps) {
  const { selection, selectCodon, selectFeature } = useCrossHighlight()
  const explainMode = useUIStore((s) => s.explainMode)
  const codons = translateFeature(feature, sequence)
  const proteinLength = codons.filter((c) => c.aa !== '*').length

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => selectFeature(feature)}
        className="mb-2 flex items-center gap-2 font-mono text-sm text-(--color-accent) hover:underline"
      >
        {feature.name}
        <span className="text-xs text-(--color-text-muted)">
          {toDisplayPosition(feature.start)}-{feature.end} · {feature.strand === 1 ? '+' : '-'} ·{' '}
          {proteinLength} aa
        </span>
      </button>
      <div className="flex flex-wrap gap-x-0.5 gap-y-2">
        {codons.map((codon, i) => {
          const isSelected = selection?.start === codon.start && selection?.end === codon.end
          return (
            <button
              key={i}
              type="button"
              onClick={() => selectCodon(codon)}
              className={`flex flex-col items-center rounded px-1 py-0.5 font-mono text-[11px] transition-colors ${
                isSelected ? 'bg-(--color-accent-dim)' : 'hover:bg-(--color-bg-hover)'
              }`}
              title={`Codon ${i + 1}: ${codon.seq} -> ${codon.aa}`}
            >
              <span className="text-(--color-text-secondary)">{codon.seq}</span>
              <span className={codon.aa === '*' ? 'text-(--color-danger)' : 'text-(--color-accent)'}>
                {codon.aa}
              </span>
            </button>
          )
        })}
      </div>
      {explainMode && (
        <div className="mt-2">
          <ExplainBlock steps={explainTranslation(codons.slice(0, EXPLAIN_CODON_LIMIT))} />
          {codons.length > EXPLAIN_CODON_LIMIT && (
            <div className="mt-1 text-[10px] text-(--color-text-muted)">
              Showing the first {EXPLAIN_CODON_LIMIT} of {codons.length} codons.
            </div>
          )}
        </div>
      )}
      <CodonOptimizationPanel feature={feature} sequence={sequence} />
    </div>
  )
}
