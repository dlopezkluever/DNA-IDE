import { useMemo, useState } from 'react'
import { useConstructStore } from '../store/constructStore'
import { useUIStore } from '../store/uiStore'
import {
  findCandidateGuides,
  scoreGuide,
  buildOffTargetIndex,
  countExactOffTargets,
  type GuideCandidate,
  type GuideScore,
} from '../biology/crispr'
import { SPCAS9 } from '../data/pamSystems'
import { GuideFilters, type GuideSortOption } from '../components/crispr/GuideFilters'
import { GuideList } from '../components/crispr/GuideList'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

export interface ScoredGuide {
  candidate: GuideCandidate
  score: GuideScore
  offTargetCount: number
}

const RATING_RANK: Record<GuideScore['rating'], number> = { strong: 0, moderate: 1, weak: 2 }

export function CRISPRView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const explainMode = useUIStore((s) => s.explainMode)

  const [gcRangeOnly, setGcRangeOnly] = useState(false)
  const [hidePolyT, setHidePolyT] = useState(false)
  const [cdsOnly, setCdsOnly] = useState(false)
  const [sortBy, setSortBy] = useState<GuideSortOption>('rating')

  const construct = activeConstructId ? constructs[activeConstructId] : null

  const candidates = useMemo(
    () => (construct ? findCandidateGuides(construct.sequence, SPCAS9, construct.topology) : []),
    [construct],
  )

  const offTargetIndex = useMemo(
    () =>
      construct
        ? buildOffTargetIndex(construct.sequence, construct.topology, SPCAS9.guideLength)
        : null,
    [construct],
  )

  // Only ever runs while the CRISPR tab is mounted (§3.1) — the tab itself is the gate,
  // same as RestrictionView only computing findRestrictionSites while mounted.
  const scored = useMemo<ScoredGuide[]>(() => {
    if (!construct || !offTargetIndex) return []
    return candidates.map((candidate) => {
      const offTargetCount = countExactOffTargets(candidate.guideSequence, offTargetIndex)
      const score = scoreGuide(candidate, construct.sequence, construct.features, offTargetCount)
      return { candidate, score, offTargetCount }
    })
  }, [construct, offTargetIndex, candidates])

  const filtered = useMemo(
    () =>
      scored.filter(({ score }) => {
        if (gcRangeOnly && !score.gcFavorable) return false
        if (hidePolyT && score.isPolyT) return false
        if (cdsOnly && !score.featureContext) return false
        return true
      }),
    [scored, gcRangeOnly, hidePolyT, cdsOnly],
  )

  const sorted = useMemo(() => {
    const list = [...filtered]
    if (sortBy === 'rating') {
      list.sort((a, b) => RATING_RANK[a.score.rating] - RATING_RANK[b.score.rating])
    } else if (sortBy === 'gc') {
      list.sort((a, b) => b.score.gcContent - a.score.gcContent)
    } else {
      list.sort((a, b) => a.candidate.pamPosition - b.candidate.pamPosition)
    }
    return list
  }, [filtered, sortBy])

  if (!construct) {
    return (
      <ViewPlaceholder
        title="No construct loaded"
        note="Import a FASTA or GenBank file to begin."
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-(--color-border-strong) bg-(--color-bg-elevated) px-3 py-2 font-mono text-[11px] text-(--color-warn)">
        Off-target matches are searched only within this loaded construct — not against a
        reference genome. This tool does not predict real-world off-target editing risk; it flags
        sequence matches for exploration, not lab-grade guide validation.
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <GuideFilters
          gcRangeOnly={gcRangeOnly}
          onGcRangeOnlyChange={setGcRangeOnly}
          hidePolyT={hidePolyT}
          onHidePolyTChange={setHidePolyT}
          cdsOnly={cdsOnly}
          onCdsOnlyChange={setCdsOnly}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          totalCount={scored.length}
          filteredCount={sorted.length}
        />
        <div className="flex-1 overflow-y-auto p-3">
          {scored.length === 0 ? (
            <p className="text-xs text-(--color-text-muted)">
              No SpCas9 PAM sites (NGG) found in this construct.
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-xs text-(--color-text-muted)">
              {scored.length} candidates hidden by filters. Loosen a filter in the sidebar to see
              them.
            </p>
          ) : (
            <GuideList
              scored={sorted}
              sequence={construct.sequence}
              topology={construct.topology}
              explainMode={explainMode}
            />
          )}
        </div>
      </div>
    </div>
  )
}
