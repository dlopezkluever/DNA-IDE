import type { Feature } from '../../types/models'
import { translateFeature } from '../../biology/translation'
import { toDisplayPosition } from '../../biology/sequence'
import { useCrossHighlight } from '../../hooks/useCrossHighlight'

interface CDSTranslationBlockProps {
  feature: Feature
  sequence: string
}

export function CDSTranslationBlock({ feature, sequence }: CDSTranslationBlockProps) {
  const { selection, selectCodon, selectFeature } = useCrossHighlight()
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
    </div>
  )
}
