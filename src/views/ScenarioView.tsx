import { useEffect, useMemo, useState } from 'react'
import { useConstructStore } from '../store/constructStore'
import { useUIStore } from '../store/uiStore'
import { useScenarioStore } from '../store/scenarioStore'
import { useCrossHighlight } from '../hooks/useCrossHighlight'
import { EXAMPLE_CONSTRUCTS } from '../data/exampleConstructs'
import { parseGenBank, constructFromGenBank } from '../parsers/genbank'
import {
  findCandidateGuides,
  scoreGuide,
  buildOffTargetIndex,
  countExactOffTargets,
  type GuideScore,
} from '../biology/crispr'
import { SPCAS9 } from '../data/pamSystems'
import type { MutationInput } from '../biology/mutations'
import type { Construct, Feature } from '../types/models'
import { SCENARIOS, isTierUnlocked } from '../scenarios/data'
import { resolveFeature } from '../scenarios/resolve'
import { simulateNHEJRepair } from '../scenarios/simulate'
import { evaluateScenarioOutcome, computeStarRating } from '../scenarios/evaluate'
import type { Scenario } from '../scenarios/types'
import { GuideList } from '../components/crispr/GuideList'
import { RATING_STYLE, guideSpan } from '../components/crispr/guideDisplay'
import type { ScoredGuide } from './CRISPRView'
import { LinearFeatureMap } from '../components/map/LinearFeatureMap'
import { CircularPlasmidView } from '../components/map/CircularPlasmidView'
import type { MapMarker } from '../components/map/mapMarkers'
import { ScenarioList } from '../components/scenarios/ScenarioList'
import { ScenarioBriefing } from '../components/scenarios/ScenarioBriefing'
import { CutOutcomePanel, type AttemptOutcome } from '../components/scenarios/CutOutcomePanel'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

const RATING_RANK: Record<GuideScore['rating'], number> = { strong: 0, moderate: 1, weak: 2 }

function scenarioConstructId(scenario: Scenario): string {
  return `scenario-${scenario.id}`
}

/** Parses the scenario's referenced example construct fresh — every call mints new feature ids
 * (nanoid, src/parsers/genbank.ts), so this must be re-run (and resolveFeature re-run against its
 * output) on every load/retry rather than reusing a previous parse. */
function buildScenarioConstruct(scenario: Scenario): Construct {
  const example = EXAMPLE_CONSTRUCTS.find((e) => e.id === scenario.exampleConstructId)
  if (!example) throw new Error(`Unknown example construct "${scenario.exampleConstructId}"`)
  const { records } = parseGenBank(example.genbank)
  const fresh = constructFromGenBank(records[0])
  return { ...fresh, id: scenarioConstructId(scenario), name: `${fresh.name} — ${scenario.title}` }
}

export function ScenarioView() {
  const activeScenarioId = useScenarioStore((s) => s.activeScenarioId)
  const startScenario = useScenarioStore((s) => s.startScenario)
  const exitScenario = useScenarioStore((s) => s.exitScenario)
  const recordAttempt = useScenarioStore((s) => s.recordAttempt)
  const progress = useScenarioStore((s) => s.progress)
  const explainMode = useUIStore((s) => s.explainMode)
  const { selectRange } = useCrossHighlight()

  const [pristineConstruct, setPristineConstruct] = useState<Construct | null>(null)
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null)
  const [attemptNumber, setAttemptNumber] = useState(1)

  const scenario = activeScenarioId ? (SCENARIOS.find((s) => s.id === activeScenarioId) ?? null) : null

  function resetScenario(s: Scenario): Construct {
    const built = buildScenarioConstruct(s)
    useConstructStore.getState().loadConstruct(built)
    setPristineConstruct(built)
    setOutcome(null)
    return built
  }

  useEffect(() => {
    if (!scenario) {
      setPristineConstruct(null)
      setOutcome(null)
      return
    }
    resetScenario(scenario)
    setAttemptNumber(1)
    // Reset only when switching to a different scenario — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario?.id])

  const isConstructReady =
    !!scenario && !!pristineConstruct && pristineConstruct.id === scenarioConstructId(scenario)

  const targetFeature = useMemo(
    () =>
      scenario && isConstructReady
        ? resolveFeature(scenario.objective.targetFeature, pristineConstruct!.features)
        : null,
    [scenario, isConstructReady, pristineConstruct],
  )

  const scored = useMemo<ScoredGuide[]>(() => {
    if (!isConstructReady) return []
    const construct = pristineConstruct!
    const candidates = findCandidateGuides(construct.sequence, SPCAS9, construct.topology)
    const offTargetIndex = buildOffTargetIndex(construct.sequence, construct.topology, SPCAS9.guideLength)
    return candidates
      .map((candidate) => {
        const offTargetCount = countExactOffTargets(candidate.guideSequence, offTargetIndex)
        const score = scoreGuide(candidate, construct.sequence, construct.features, offTargetCount)
        return { candidate, score, offTargetCount }
      })
      .sort((a, b) => RATING_RANK[a.score.rating] - RATING_RANK[b.score.rating])
  }, [isConstructReady, pristineConstruct])

  const markers = useMemo<MapMarker[]>(() => {
    if (!isConstructReady) return []
    const construct = pristineConstruct!
    const seqLen = construct.sequence.length
    const candidateMarkers: MapMarker[] = scored.map(({ candidate, score }) => {
      const { spanStart, spanEnd } = guideSpan(candidate)
      return {
        position: candidate.cutPosition,
        color: RATING_STYLE[score.rating].color,
        label: `${candidate.guideSequence} (${score.rating})`,
        onClick: () => selectRange(spanStart, spanEnd, candidate.strand),
      }
    })
    if (targetFeature) {
      const effectiveEnd = targetFeature.end < targetFeature.start ? seqLen : targetFeature.end
      const midpoint = seqLen === 0 ? 0 : Math.floor((targetFeature.start + effectiveEnd) / 2) % seqLen
      candidateMarkers.push({
        position: midpoint,
        color: 'var(--color-danger)',
        label: `Target: ${targetFeature.name}`,
      })
    }
    return candidateMarkers
  }, [isConstructReady, pristineConstruct, scored, targetFeature, selectRange])

  if (!scenario) {
    return <ScenarioList />
  }

  if (!isConstructReady || !pristineConstruct) {
    return <ViewPlaceholder title="Loading scenario…" note="Setting up a fresh construct." />
  }

  function handleUseGuide(entry: ScoredGuide) {
    if (!scenario) return
    const construct = resetScenario(scenario)
    const target = resolveFeature(scenario.objective.targetFeature, construct.features)
    if (!target) return // scenario-authoring bug (target name/type doesn't resolve) — nothing to do

    const protectedIds = (scenario.objective.protectedFeatures ?? [])
      .map((matcher) => resolveFeature(matcher, construct.features))
      .filter((f): f is Feature => f !== null)
      .map((f) => f.id)

    const nhejOutcome = simulateNHEJRepair(entry.candidate.cutPosition)
    const input: MutationInput =
      nhejOutcome.editType === 'insertion'
        ? { type: 'insertion', position: nhejOutcome.position, reference: '', alternate: nhejOutcome.insertedBases! }
        : {
            type: 'deletion',
            position: nhejOutcome.position,
            reference: construct.sequence.slice(
              nhejOutcome.position,
              nhejOutcome.position + nhejOutcome.length,
            ),
            alternate: '',
          }
    const mutation = useConstructStore.getState().applyMutation(input)
    const result = evaluateScenarioOutcome(scenario.objective, mutation, target.id, protectedIds)
    const stars = computeStarRating(result, entry.score, entry.offTargetCount, attemptNumber)

    recordAttempt(scenario.id, stars)
    setOutcome({ nhejOutcome, mutation, result, stars, guide: entry })
    setAttemptNumber((n) => n + 1)
  }

  function handleRetry() {
    if (scenario) resetScenario(scenario)
  }

  function handleNext() {
    if (!scenario) return
    const idx = SCENARIOS.findIndex((s) => s.id === scenario.id)
    const next = SCENARIOS.slice(idx + 1).find((s) => isTierUnlocked(s.tier, progress))
    if (next) startScenario(next.id)
    else exitScenario()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScenarioBriefing scenario={scenario} onExit={exitScenario} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="shrink-0">
          {pristineConstruct.topology === 'circular' ? (
            <CircularPlasmidView
              name={pristineConstruct.name}
              sequenceLength={pristineConstruct.sequence.length}
              features={pristineConstruct.features}
              markers={markers}
            />
          ) : (
            <LinearFeatureMap
              sequenceLength={pristineConstruct.sequence.length}
              features={pristineConstruct.features}
              markers={markers}
            />
          )}
        </div>
        <div className="flex-1 p-3">
          {scored.length === 0 ? (
            <p className="text-xs text-(--color-text-muted)">
              No SpCas9 PAM sites (NGG) found in this construct.
            </p>
          ) : (
            <GuideList
              scored={scored}
              sequence={pristineConstruct.sequence}
              topology={pristineConstruct.topology}
              explainMode={explainMode}
              rowAction={{ label: 'Use this guide', onClick: handleUseGuide }}
            />
          )}
        </div>
      </div>
      {outcome && (
        <CutOutcomePanel
          scenario={scenario}
          attempt={outcome}
          explainMode={explainMode}
          onRetry={handleRetry}
          onNext={handleNext}
        />
      )}
    </div>
  )
}
