import { Fragment, useMemo, useState } from 'react'
import { useCrossHighlight } from '../../hooks/useCrossHighlight'
import { findNearMatches } from '../../biology/crispr'
import { explainCRISPRGuide } from '../../biology/explain'
import { toDisplayPosition } from '../../biology/sequence'
import { SPCAS9 } from '../../data/pamSystems'
import { ExplainBlock } from '../explain/ExplainBlock'
import type { ScoredGuide } from '../../views/CRISPRView'
import type { GuideScore } from '../../biology/crispr'
import type { Topology } from '../../types/models'

const MISMATCH_OPTIONS = [0, 1, 2] as const

const RATING_STYLE: Record<GuideScore['rating'], { glyph: string; className: string }> = {
  // strong = accent green: the one case where "good" and the app's one accent color coincide,
  // matching EnzymeList's unique-cutter badge precedent (DESIGN.md §2.3 — green means
  // "active/selected right now", so a straight traffic-light red/amber/green mapping is avoided).
  strong: { glyph: '★', className: 'text-(--color-accent)' },
  moderate: { glyph: '●', className: 'text-(--color-warn)' },
  weak: { glyph: '○', className: 'text-(--color-text-muted)' },
}

function guideSpan(candidate: ScoredGuide['candidate']) {
  const spanStart = candidate.strand === 1 ? candidate.guideStart : candidate.pamPosition
  const spanEnd =
    candidate.strand === 1
      ? candidate.pamPosition + SPCAS9.pamPattern.length
      : candidate.guideEnd
  return { spanStart, spanEnd }
}

function GuideDetail({
  entry,
  sequence,
  topology,
  explainMode,
}: {
  entry: ScoredGuide
  sequence: string
  topology: Topology
  explainMode: boolean
}) {
  const [maxMismatches, setMaxMismatches] = useState<0 | 1 | 2>(1)

  // On-demand only, for the one candidate currently expanded — not eager for the whole list (§2.4 Tier 2).
  const nearMatches = useMemo(
    () => findNearMatches(entry.candidate.guideSequence, sequence, topology, maxMismatches),
    [entry.candidate.guideSequence, sequence, topology, maxMismatches],
  )

  return (
    <div className="space-y-2 border-t border-(--color-border) bg-(--color-bg-canvas) px-3 py-2 font-mono text-xs">
      {explainMode && (
        <ExplainBlock
          steps={explainCRISPRGuide(entry.candidate, entry.score, SPCAS9, entry.offTargetCount)}
        />
      )}

      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-(--color-text-muted)">Near-match tolerance</span>
        {MISMATCH_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setMaxMismatches(n)}
            className={`rounded border px-1.5 py-0.5 ${
              maxMismatches === n
                ? 'border-(--color-accent) text-(--color-accent)'
                : 'border-(--color-border-strong) text-(--color-text-secondary)'
            }`}
          >
            {n}mm
          </button>
        ))}
      </div>

      {nearMatches.length === 0 ? (
        <p className="text-[11px] text-(--color-text-muted)">
          No near-matches in this construct at this tolerance.
        </p>
      ) : (
        <ul className="space-y-0.5 text-[11px]">
          {nearMatches.map((m, i) => (
            <li key={i} className="text-(--color-text-secondary)">
              {toDisplayPosition(m.position)} ({m.strand === 1 ? '+' : '-'}) —{' '}
              {m.mismatches} mismatch{m.mismatches === 1 ? '' : 'es'}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function GuideList({
  scored,
  sequence,
  topology,
  explainMode,
}: {
  scored: ScoredGuide[]
  sequence: string
  topology: Topology
  explainMode: boolean
}) {
  const { selectRange } = useCrossHighlight()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <table className="w-full font-mono text-xs">
      <thead>
        <tr className="border-b border-(--color-border) text-left text-(--color-text-muted)">
          <th className="py-1 pr-3">Strand</th>
          <th className="py-1 pr-3">Pos</th>
          <th className="py-1 pr-3">Guide (5'→3')</th>
          <th className="py-1 pr-3">GC%</th>
          <th className="py-1 pr-3">Feature</th>
          <th className="py-1 pr-3">Off-targets</th>
          <th className="py-1">Rating</th>
        </tr>
      </thead>
      <tbody>
        {scored.map((entry) => {
          const { candidate, score, offTargetCount } = entry
          const isExpanded = expandedId === candidate.id
          const rating = RATING_STYLE[score.rating]

          return (
            <Fragment key={candidate.id}>
              <tr
                onClick={() => {
                  const { spanStart, spanEnd } = guideSpan(candidate)
                  selectRange(spanStart, spanEnd, candidate.strand)
                }}
                className="cursor-pointer border-b border-(--color-border) hover:bg-(--color-bg-hover)"
              >
                <td className="py-1 pr-3">{candidate.strand === 1 ? '+' : '-'}</td>
                <td className="py-1 pr-3 text-(--color-text-primary)">
                  {toDisplayPosition(candidate.pamPosition)}
                </td>
                <td className="py-1 pr-3 text-(--color-text-primary)">
                  {candidate.guideSequence}
                  {score.isPolyT && (
                    <span className="ml-1.5 rounded bg-(--color-bg-hover) px-1 text-[10px] text-(--color-warn)">
                      poly-T
                    </span>
                  )}
                </td>
                <td className="py-1 pr-3">{score.gcContent.toFixed(0)}%</td>
                <td className="py-1 pr-3 text-(--color-text-secondary)">
                  {score.featureContext
                    ? `${score.featureContext.featureName} · ${score.featureContext.percentIntoFeature.toFixed(0)}%`
                    : '—'}
                </td>
                <td className="py-1 pr-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedId(isExpanded ? null : candidate.id)
                    }}
                    className="text-(--color-text-secondary) hover:text-(--color-accent)"
                    title="Show off-target detail"
                  >
                    {offTargetCount} {isExpanded ? '▾' : '▸'}
                  </button>
                </td>
                <td className={`py-1 ${rating.className}`}>
                  {rating.glyph} {score.rating}
                </td>
              </tr>
              {isExpanded && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <GuideDetail
                      entry={entry}
                      sequence={sequence}
                      topology={topology}
                      explainMode={explainMode}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
