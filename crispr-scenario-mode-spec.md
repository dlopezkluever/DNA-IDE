# CRISPR Scenario Mode — Spec & Implementation Plan

Status: proposed, not yet built. Builds directly on top of the shipped CRISPR Guide RNA
Designer (`src/biology/crispr.ts`, `src/views/CRISPRView.tsx`, `src/components/crispr/` — see
`crispr-guide-rna-designer-spec.md`, now fully implemented). This doc follows that one's own
convention: real file paths, real function signatures, grounded in the actual codebase as it
exists today, not an aspirational sketch.

**The one-line pitch:** turn the CRISPR tab from "here's a scored list of candidates" into "here's
a goal, go pick a guide, watch the cell actually try to repair the cut, and find out if it worked."
Same engine, same disclaimers, same "computational and visual, not lab-grade" lane the whole app
already commits to — just pointed at a concrete objective instead of an open-ended browse.

---

## 0. Shared groundwork

Everything in the original spec's §0 still applies (0-based half-open coordinates, no router,
global cross-highlight via `selectRange`/`selectFeature`, Zustand + `persist` for durable state,
local `useState` for view-scoped state, raw inline SVG for spatial views, Vitest on
`src/biology`/`src/parsers`/`src/store`/`src/utils`/`src/commands`). Two additions this feature
needs to be aware of going in:

- **This is a pure client-side app — no backend, no accounts, no server.** (Confirmed by
  `package.json`: Vite + Zustand + React, nothing else.) All progress, scoring, and "campaign"
  state lives in `localStorage` via the same `zustand/middleware` `persist` pattern `uiStore.ts`
  already uses. There is no multiplayer, no leaderboard, no sync — full stop, not a v2 deferral.
- **GenBank-parsed feature IDs are not stable.** `src/parsers/genbank.ts:310,404` assigns every
  feature and construct a fresh `nanoid()` at parse time. A scenario's target gene **cannot** be
  referenced by a fixed feature id in static data — it has to be resolved by matching `name` +
  `type` against the freshly-loaded construct's `features` array at scenario start (§2.2). Get
  this wrong and a scenario's objective silently never matches anything.
- **`DESIGN.md`'s "VS Code for genetic constructs" philosophy governs the visual language here
  too.** No icon library, no drop shadows/card elevation, no confetti-and-badges consumer-game
  skin — a "mission briefing" should read like a terminal readout, not a mobile-game popup. The
  existing `★` glyph already means "strong guide rating" in `GuideList.tsx`; reusing it for
  mission star-ratings needs a disambiguation rule (§3.8), not a new icon.

---

## 1. Vision & scope boundary

**The core loop:** load a scenario → read a short in-universe briefing with a concrete goal
("knock out this gene without touching that one") → use the *real* CRISPR tab (unmodified) to
evaluate candidates → commit to one → the game simulates what NHEJ repair actually does at that
cut site (this is genuinely random — real CRISPR knockouts don't have a deterministic outcome,
which is exactly why researchers screen multiple clones) → the *existing* mutation/consequence
engine (`applyMutation`, `classifyMutation`) reports what really happened → win or retry.

Nothing about the biology is fake. The only new "game" surface is framing (a goal, a narrative,
a star rating) wrapped around engine calls that already exist and are already tested.

**In scope (v1):**
- A new **Scenarios** tab with a campaign of hand-authored knockout scenarios built on the three
  *existing* example constructs (no new sequence content required to ship v1).
- A stochastic NHEJ outcome simulator — clicking "Use this guide" doesn't let you design the
  exact edit, it rolls a plausible small indel at the cut site, same as a real experiment would
  produce an unpredictable outcome per clone.
- Pass/fail evaluation against a structured objective (target gene + required consequence +
  optional "don't hit this other gene too"), using the app's existing consequence classifier —
  not a new correctness model.
- A transparent 0–3 star scoring table, retry support, and persisted campaign progress.
- A shared marker layer on `LinearFeatureMap`/`CircularPlasmidView` so candidates and the
  objective gene are visible on the actual plasmid map — this also finally resolves the original
  CRISPR spec's §3.8 open item (restriction sites and CRISPR candidates still have no map
  markers today).

**Explicitly out of scope (v1), and why:**
- **No HDR / precision-repair scenarios.** Modeling a homology-directed repair template
  (design a donor sequence, match homology arms, apply a *specific* edit rather than a random
  indel) is a materially different mechanic — deterministic editing, not NHEJ simulation — and
  a real design surface of its own. Flagged as a Tier 3 stretch goal (§8), not built now, and not
  pretended to be "just more scenario data" the way a second nuclease system wasn't "just a data
  row" in the original spec.
- **No new curated DNA content beyond the 3 existing example constructs.** All three launch
  scenarios (§4) are built entirely from `MINIMAL_CDS_GENBANK`, `GFP_CONSTRUCT_GENBANK`, and
  `EDUCATIONAL_PLASMID_GENBANK` (`src/data/exampleConstructs/`). Authoring new organisms/plasmids
  is pure content work, decoupled from this engineering effort — noted as a stretch goal, not a
  blocker.
- **No accounts, sync, leaderboards, or sharing infrastructure.** `localStorage` only. A
  "shareable results card" (§8) is just formatted text the user copies themselves — no backend.
- **No second nuclease system tie-in.** Scenarios target SpCas9 exclusively, matching the
  CRISPR tab's own v1 scope.

---

## 2. Domain design

New top-level module `src/scenarios/` — pure, framework-free, unit-tested, sitting alongside
`src/biology/` and `src/commands/` rather than inside either: scenario objectives and star
scoring are *game rules layered on top of* biology, not biology or command-palette logic
themselves, so they get their own home. (Add `src/scenarios` to the list of Vitest-covered
directories in `vite.config.ts`'s test include, alongside the existing five.)

### 2.1 Scenario data model

```ts
// src/scenarios/types.ts
import type { Consequence, FeatureType } from '../types/models'

export type ScenarioTier = 1 | 2 | 3

export interface FeatureMatcher {
  name: string
  type: FeatureType
}

export interface ScenarioObjective {
  type: 'knockout' // the only objective type built in v1 — see §1's HDR callout
  /** Resolved against the scenario's freshly-loaded construct at start time, NOT a fixed
   * feature id (nanoid ids aren't stable across GenBank parses — see §0). */
  targetFeature: FeatureMatcher
  /** Any one of these consequences on the target feature counts as success. */
  requiredConsequences: Consequence[]
  /** If the edit's affectedFeatureIds includes one of these, the attempt fails even if the
   * target feature was also hit correctly — "don't hit the neighbor" scenarios (§4, Scenario 2). */
  protectedFeatures?: FeatureMatcher[]
}

export interface Scenario {
  id: string
  tier: ScenarioTier
  title: string
  /** Flavor text only — never implies real-world clinical/agricultural accuracy. */
  organism: string
  briefing: string
  successCopy: string
  failureCopy: string
  /** References EXAMPLE_CONSTRUCTS by id (src/data/exampleConstructs/index.ts) — reuses existing
   * construct data rather than duplicating GenBank text. */
  exampleConstructId: string
  objective: ScenarioObjective
}
```

### 2.2 Resolving the target feature

```ts
// src/scenarios/resolve.ts
import type { Feature } from '../types/models'
import type { FeatureMatcher } from './types'

export function resolveFeature(matcher: FeatureMatcher, features: Feature[]): Feature | null {
  return features.find((f) => f.name === matcher.name && f.type === matcher.type) ?? null
}
```

Called once when a scenario's construct is freshly loaded (§3.6) and again after every reset —
never cached across attempts, since a fresh `constructFromGenBank` call mints new ids every time.

### 2.3 NHEJ cut simulation — `simulateNHEJRepair`

**The honest framing, stated up front:** real NHEJ repair is genuinely stochastic — this is *why*
a real CRISPR knockout experiment screens multiple clones rather than trusting one outcome. This
function's job is to be a plausible, *documented-as-illustrative* random indel generator, not a
research-grade mutagenesis model — same "hedge against overclaiming precision" instinct the
original spec applied to guide scoring (§2.3 there: "a heuristic, not a model").

```ts
// src/scenarios/simulate.ts
export interface NHEJOutcome {
  editType: 'insertion' | 'deletion'
  length: number
  /** Plus-strand coordinate the edit is applied at — always GuideCandidate.cutPosition, which
   * is already strand-agnostic (see crispr.ts's own doc comment on that field). */
  position: number
  /** Present only for insertions — random bases, not derived from anything biological. */
  insertedBases?: string
}

// Illustrative weights for gameplay pacing, not a published NHEJ indel-length spectrum —
// small indels dominate real outcomes too, but these numbers are not a citation.
const INDEL_LENGTH_WEIGHTS: readonly [length: number, weight: number][] = [
  [1, 45], [2, 25], [3, 15], [4, 8], [5, 4], [6, 3],
]

export function simulateNHEJRepair(
  cutPosition: number,
  rng: () => number = Math.random,
): NHEJOutcome
```

Implementation notes:
- `editType`: weighted coin flip (deletion slightly favored, ~55/45), same "documented, simple,
  not a citation" spirit.
- `length`: weighted pick from `INDEL_LENGTH_WEIGHTS` — deliberately caps at 6bp so a scenario
  targeting even the 24nt `miniORF` CDS (Scenario 3, §4) can't get wiped out entirely by one roll.
- Both branches take an **injectable `rng`** so `simulate.test.ts` can assert exact outcomes with
  a seeded/mock generator instead of asserting on distributions — same DI pattern already used
  nowhere else in this codebase but consistent with how `crispr.test.ts` avoids nondeterminism
  by construction rather than statistically.

**Applying the outcome** goes through the *existing* mutation pipeline, not a new one:

```ts
// in the calling component (§3.6), not a new biology function:
const outcome = simulateNHEJRepair(candidate.cutPosition)
const input: MutationInput =
  outcome.editType === 'insertion'
    ? { type: 'insertion', position: outcome.position, reference: '', alternate: outcome.insertedBases! }
    : {
        type: 'deletion',
        position: outcome.position,
        reference: construct.sequence.slice(outcome.position, outcome.position + outcome.length),
        alternate: '',
      }
const mutation = useConstructStore.getState().applyMutation(input)
```

`applyMutation` (`src/store/constructStore.ts`) already forks the construct, shifts feature
coordinates, and — critically — already computes `mutation.affectedFeatureIds` and
`mutation.proteinEffect` via the existing `featureOverlapsEdit`/`classifyMutation` machinery in
`src/biology/mutations.ts`. Scenario evaluation (§2.4) consumes that output directly; it does
**not** re-derive feature overlap or protein consequence itself.

**Known limitation, stated plainly rather than hidden:** `applyMutation`'s reference slice
(`seqBefore.slice(position, position + reference.length)`) does not wrap circular topology. A
deletion whose window would cross a circular construct's origin is silently clamped to the
sequence's actual end rather than wrapping — a pre-existing constraint of the reused primitive,
not new behavior this feature introduces. Given the indel cap is 6bp, this only affects
candidates whose `cutPosition` sits within 6bp of position 0 on a circular construct — rare
enough to accept as a documented edge case for v1 rather than extending `applyMutation` to support
circular-wrapping edits (a materially larger change to a shared, already-shipped store method).

### 2.4 Scenario evaluation & star scoring

```ts
// src/scenarios/evaluate.ts
import type { Consequence, Mutation } from '../types/models'
import type { GuideScore } from '../biology/crispr'
import type { ScenarioObjective } from './types'

export interface ScenarioResult {
  success: boolean
  /** The consequence actually produced, straight from mutation.proteinEffect.consequence. */
  consequence: Consequence
  /** True if a protected feature's id also appears in mutation.affectedFeatureIds. */
  protectedFeatureHit: boolean
}

export function evaluateScenarioOutcome(
  objective: ScenarioObjective,
  mutation: Mutation,
  targetFeatureId: string,
  protectedFeatureIds: string[],
): ScenarioResult
```

Logic: `success` requires `mutation.affectedFeatureIds.includes(targetFeatureId)`, the
consequence to be one of `objective.requiredConsequences`, and **no** id in
`protectedFeatureIds` present in `mutation.affectedFeatureIds`. This is a pure function over data
`applyMutation` already produced — no new biology.

**Star rating** — an explicit table, same instinct as the original spec's guide-rating
combination table (§2.3 there): legible, not a black-box formula.

| Condition | Stars |
|---|---|
| Objective not met | 0 |
| Objective met | 1 (floor, once you succeed at all) |
| ...and the guide used was `moderate` or `strong` rated | 2 |
| ...and the guide was `strong`, had 0 exact off-targets, **and** this was the first attempt | 3 |

```ts
export function computeStarRating(
  result: ScenarioResult,
  guideScore: GuideScore,
  offTargetCount: number,
  attemptNumber: number,
): 0 | 1 | 2 | 3
```

This rewards picking a genuinely good guide up front over brute-forcing retries until the RNG
cooperates — the star rating is a comment on your *guide selection*, not on your luck.

### 2.5 Progress persistence — `useScenarioStore`

```ts
// src/store/scenarioStore.ts
interface ScenarioProgress {
  bestStars: 0 | 1 | 2 | 3
  attempts: number
}

interface ScenarioState {
  progress: Record<string, ScenarioProgress> // keyed by Scenario.id
  activeScenarioId: string | null

  startScenario: (id: string) => void
  exitScenario: () => void
  recordAttempt: (scenarioId: string, stars: 0 | 1 | 2 | 3) => void
}
```

Mirrors `uiStore.ts`'s own `persist`/`partialize` pattern exactly: `partialize` whitelists only
`progress` (not `activeScenarioId`, which is session-transient like `activeView`).
`recordAttempt` takes `Math.max(existing.bestStars, stars)` — a retry can only improve your best
recorded result, never regress it, which matters once §3.3's level-select shows a best-of score.

### 2.6 Explain Mode integration — `explainNHEJOutcome`

Same shape as `explainCRISPRGuide` and the other three functions in `src/biology/explain.ts`,
but lives in `src/scenarios/` since it explains a *scenario* outcome, not raw sequence biology:

```ts
// src/scenarios/explain.ts
export function explainNHEJOutcome(outcome: NHEJOutcome, mutation: Mutation): ExplainStep[]
```

Produces steps like `{ label: 'Repair outcome', value: '2bp deletion at position 204' }`,
`{ label: 'Reading frame', value: 'shifted by 2 — every codon downstream is scrambled' }` (only
when `mutation.proteinEffect.consequence === 'frameshift'`), `{ label: 'Result', value:
consequenceLabel(mutation.proteinEffect.consequence) }` — reusing `consequenceLabel` from
`src/utils/format.ts` exactly like `explainMutation` already does. Gated behind
`useUIStore((s) => s.explainMode)`, rendered via the existing `<ExplainBlock>` — no new pattern.

#### Files

| File | Change |
|---|---|
| `src/scenarios/types.ts` | New — `Scenario`, `ScenarioObjective`, `FeatureMatcher`, `ScenarioTier` |
| `src/scenarios/data.ts` | New — `SCENARIOS: Scenario[]` (§4's three launch scenarios) |
| `src/scenarios/resolve.ts` | New — `resolveFeature` |
| `src/scenarios/simulate.ts` | New — `simulateNHEJRepair`, `NHEJOutcome` |
| `src/scenarios/evaluate.ts` | New — `evaluateScenarioOutcome`, `ScenarioResult`, `computeStarRating` |
| `src/scenarios/explain.ts` | New — `explainNHEJOutcome` |
| `src/scenarios/*.test.ts` | New — see §7 |
| `src/store/scenarioStore.ts` | New — progress persistence |

---

## 3. UI/UX design

### 3.1 New tab wiring

| File | Change |
|---|---|
| `src/store/uiStore.ts` | Add `'scenarios'` to the `ViewId` union |
| `src/data/viewTabs.ts` | Add `{ id: 'scenarios', label: 'Scenarios' }` to `TABS` |
| `src/components/layout/Shell.tsx` | Add `{activeView === 'scenarios' && <ScenarioView />}` |

"Scenarios," not "Missions" or "Challenges" — matches the existing tab register (plain nouns:
Sequence, Map, Protein, Mutations, Restriction, PCR, Compare, Assembly, CRISPR), where "Missions"
would read a register too arcade-game for `DESIGN.md`'s "lab instrument, not a marketing surface"
philosophy (§0).

### 3.2 Layout & flow

```
No active scenario                          Active scenario
┌─ Scenarios ────────────────────────┐      ┌─ ← Exit ── Silence the Glow ───────────────┐
│ TIER 1                              │      │ E. coli (lab strain, GFP reporter plasmid) │
│  ▸ Silence the Glow      ★★★        │      │                                             │
│  ▸ Break the Lock        ☆☆☆        │      │ This plasmid glows green under UV. Knock   │
│                                      │      │ out the fluorescent protein gene — a       │
│ TIER 2 (locked until Tier 1 clear)  │      │ frameshift or premature stop anywhere in    │
│  ▸ Precision Strike      🔒         │      │ GFP will do it.                            │
│                                      │      │                                             │
└──────────────────────────────────────┘      │ [ plasmid map with target gene + candidate │
                                               │   cut-site markers, §3.5 ]                  │
                                               │                                             │
                                               │ [ the real CRISPR guide table, with a new  │
                                               │   "Use this guide" action per row ]         │
                                               │                                             │
                                               │ [ CutOutcomePanel, appears after a click:   │
                                               │   "Rolled: 2bp deletion → frameshift.       │
                                               │    GFP knocked out. ★★★ — Retry / Next" ]   │
                                               └─────────────────────────────────────────────┘
```

Deliberately **not** a locked-down "game screen" that hides the rest of the IDE — the sidebar,
other tabs (Sequence, Map, Protein, Mutations…) stay fully usable while a scenario is active.
Letting the player go inspect the reading frame in the Protein view or eyeball the ORF before
committing to a guide is not scope creep, it's the actual point: a real scientist would use every
tool available before cutting, and this app already has all those tools built. Locking them out
to "gamify" the experience would be working against the codebase's own strengths.

### 3.3 Component breakdown

| File | Role |
|---|---|
| `src/views/ScenarioView.tsx` | Orchestrates: no active scenario → `ScenarioList`; active scenario → loads/resets its construct into `constructStore`, resolves target/protected features via `resolveFeature`, renders `ScenarioBriefing` + the reused `GuideList` (with `rowAction`, §3.4) + `CutOutcomePanel`. |
| `src/components/scenarios/ScenarioList.tsx` | Campaign/level-select: grouped by tier, best-stars display, tier-2+ locked until the prior tier's scenarios all have `bestStars >= 1`. |
| `src/components/scenarios/ScenarioBriefing.tsx` | Narrative + structured objective ("Target: GFP (CDS)　·　Needs: frameshift or nonsense　·　Protect: —"), persistent visible-without-scrolling, same visual weight as the CRISPR tab's off-target disclaimer. |
| `src/components/scenarios/CutOutcomePanel.tsx` | Post-attempt reveal: the rolled `NHEJOutcome`, the resulting consequence, success/failure copy, star rating, Explain Mode block (`explainNHEJOutcome`, §2.6), Retry / Next Scenario actions. |

### 3.4 Reusing `GuideList` — the `rowAction` prop

`src/components/crispr/GuideList.tsx` gains **one new optional prop**, additive only —
`CRISPRView.tsx`'s existing usage is untouched since it simply never passes it:

```ts
interface GuideListProps {
  scored: ScoredGuide[]
  sequence: string
  topology: Topology
  explainMode: boolean
  rowAction?: { label: string; onClick: (entry: ScoredGuide) => void } // NEW
}
```

When present, each row gets an extra button (`Use this guide`) calling
`rowAction.onClick(entry)`. `ScenarioView` passes this to trigger §2.3/§2.4's cut-and-evaluate
flow; the CRISPR tab proper never sets it, so its table looks exactly as it does today. This is
the same "additive only, no breaking signature change" rule the original spec held itself to.

### 3.5 Map marker layer — `LinearFeatureMap` / `CircularPlasmidView`

Resolves the original spec's §3.8 open item for real, as a byproduct of scenario mode actually
needing it (seeing candidate cut sites *and* the objective gene on the plasmid map is the whole
point of a "where do I aim" puzzle).

```ts
// shared shape, used by both map components
export interface MapMarker {
  position: number
  color: string // a var(--color-*) token — reuse RATING_STYLE's colors for CRISPR candidates
  label: string
  onClick?: () => void
}
```

Both `LinearFeatureMap` and `CircularPlasmidView` gain one new optional prop, `markers?:
MapMarker[]`, defaulting to `[]` — zero behavior change for `MapView.tsx`'s existing calls, which
don't pass it. Rendered as thin tick marks: on `LinearFeatureMap`, a short vertical line just
above the ruler (`y = RULER_HEIGHT - 14` down to `RULER_HEIGHT - 6`, reusing the existing `xOf`
helper); on `CircularPlasmidView`, a short radial tick just outside `FEATURE_RADIUS`, reusing the
existing `polarToCartesian`/`angleOf` helpers. Each marker gets a native `<title>` tooltip
(matching every other spatial view in the app) and an optional `onClick` wired to `selectRange`
for markers representing CRISPR candidates.

`ScenarioView` passes one marker per visible candidate (colored by `RATING_STYLE`, §GuideList)
plus a distinguishable marker (or a `strokeWidth` bump reusing the existing `isActive`-style
emphasis) for the resolved target feature's midpoint. This same `markers` prop is available to
`CRISPRView.tsx` too as a natural, low-cost follow-up (not required for this feature to ship,
noted in §8) — and to `RestrictionView`'s cut sites eventually, which is exactly the
"consistency, not a one-off special case" concern the original spec raised when it first
deferred this.

### 3.6 Retry & pristine-reset mechanics

A scenario's construct must reset to its pristine start state before every attempt — otherwise
retries would stack edits on top of previous failed attempts instead of re-rolling a clean cut.

```ts
function loadScenarioConstruct(scenario: Scenario) {
  const example = EXAMPLE_CONSTRUCTS.find((e) => e.id === scenario.exampleConstructId)!
  const { records } = parseGenBank(example.genbank)
  const fresh = constructFromGenBank(records[0])
  useConstructStore.getState().loadConstruct({
    ...fresh,
    id: `scenario-${scenario.id}`, // stable per-scenario id, distinct from the user's own constructs
    name: `${fresh.name} — ${scenario.title}`,
  })
}
```

Called once when `ScenarioView` mounts an active scenario, and again before every "Use this
guide" click (§2.3) and before Retry. `loadConstruct` (`src/store/constructStore.ts`) already
overwrites `constructs[id]` and resets `originalConstructId`/`compareConstructId` when called —
reloading under the same `scenario-${scenario.id}` key correctly discards the prior attempt's
`applyMutation`-forked edit with no new store logic required.

### 3.7 Command palette integration

```ts
commands.push({
  id: 'open-scenarios',
  label: 'CRISPR scenarios',
  category: 'run',
  enabled: true,
  run: () => ctx.setActiveView('scenarios'),
})
```

`Go to Scenarios` is generated automatically once `'scenarios'` is added to `TABS` (§3.1), same
as every other tab.

### 3.8 Visual & framing rules

- **Disambiguating the two `★` meanings.** `GuideList`'s `★ strong` rating glyph and the
  scenario star score both reuse `★` (per `DESIGN.md`'s "no new icon vocabulary" rule) — but they
  must never appear in the same visual context ambiguously. Rule: mission stars are always shown
  as an explicit `★★★ (3/3)` pattern (never bare glyphs) and only ever appear in
  `ScenarioList`/`CutOutcomePanel`, never inside the reused `GuideList` table itself.
- **Disclaimer copy, non-dismissible, top of `ScenarioBriefing`:**
  > These are simplified teaching scenarios on synthetic/illustrative constructs — not real
  > protocols, and the repair outcome is randomly simulated, not a lab result. Same rule as the
  > CRISPR tab: off-target search and consequence prediction are construct-local only.
  >
  > This mirrors the original CRISPR spec's §3.7 disclaimer almost verbatim, deliberately —
  > consistency in how the app talks about its own limitations matters more here, not less, once
  > there's a "win" state that could otherwise read as an endorsement of real-world accuracy.
- **No confetti, no toasts, no sound.** A win is communicated the same way a `strong` guide
  rating is: color + text (`--color-accent` for success, same as everything else "on/good" in
  this app), not a new celebratory idiom.

### 3.9 Empty / loading / locked states

- No scenario active → `ScenarioList` (never a blank view).
- A locked tier → its scenarios render but are visibly disabled (matching the CRISPR tab's own
  "no PAM sites found" muted-text treatment) with a one-line reason: "Clear Tier 1 to unlock."
- Scenario active but its construct hasn't finished loading/resetting → same `ViewPlaceholder`
  idiom every other view uses for the no-construct case, not a custom spinner.

---

## 4. Launch content — three worked scenarios

All three reuse existing example constructs verbatim — **zero new GenBank content required to
ship v1.**

### Scenario 1 — "Silence the Glow" (Tier 1)

- **Construct:** `gfp-construct` (linear, 845bp — `src/data/exampleConstructs/gfpConstruct.ts`)
- **Organism:** "*E. coli* (lab strain, GFP reporter plasmid)"
- **Briefing:** "This plasmid glows green under UV — it carries a promoter, an RBS, the GFP
  gene, and a terminator. Knock out the glow."
- **Objective:** `targetFeature: { name: 'GFP', type: 'CDS' }`,
  `requiredConsequences: ['frameshift', 'nonsense']`, no protected features.
- **Why it's a good first level:** the CDS spans nearly the whole construct (71–787 of 845bp),
  so almost any candidate inside it works — the puzzle is purely "did NHEJ give me a frameshift,"
  teaching the core lesson (indel size relative to reading frame) with nothing else to trip over.

### Scenario 2 — "Break the Lock" (Tier 1)

- **Construct:** `educational-plasmid` (circular, 2145bp — carries `markerR` *and* `GFP`)
- **Organism:** "*E. coli* (lab strain, antibiotic-resistance + GFP reporter plasmid)"
- **Briefing:** "This plasmid also carries antibiotic resistance. Knock out resistance —
  but the colony needs to stay green. Don't touch GFP."
- **Objective:** `targetFeature: { name: 'markerR', type: 'CDS' }`,
  `requiredConsequences: ['frameshift', 'nonsense']`,
  `protectedFeatures: [{ name: 'GFP', type: 'CDS' }]`.
- **Why it's here:** first scenario where *which* candidate you pick matters, not just *whether*
  it lands in the right gene — teaches that guide *position* has consequences beyond the target
  gene itself. Also the first circular-topology scenario, exercising the wraparound-aware path
  of the whole pipeline end to end.

### Scenario 3 — "Precision Strike" (Tier 2)

- **Construct:** `minimal-cds` (linear, 152bp — the CDS itself is only 24nt, 71–94)
- **Organism:** "Minimal synthetic construct (teaching strain)"
- **Briefing:** "This gene is tiny — only 8 codons. Very few candidate guides even reach it.
  Pick carefully."
- **Objective:** `targetFeature: { name: 'miniORF', type: 'CDS' }`,
  `requiredConsequences: ['frameshift', 'nonsense']`, no protected features.
- **Why it's harder:** search-space scarcity, not a new mechanic — a 24nt CDS has very few
  overlapping PAM sites, so the player has to actually read the CRISPR tab's ratings/off-target
  counts rather than picking the first "strong" row they see. Difficulty from constraint, not
  from adding rules.

---

## 5. Files to add / change

| File | Change |
|---|---|
| `src/scenarios/types.ts` | New — `Scenario`, `ScenarioObjective`, `FeatureMatcher` (§2.1) |
| `src/scenarios/data.ts` | New — `SCENARIOS` (§4) |
| `src/scenarios/resolve.ts` | New — `resolveFeature` (§2.2) |
| `src/scenarios/simulate.ts` | New — `simulateNHEJRepair`, `NHEJOutcome` (§2.3) |
| `src/scenarios/evaluate.ts` | New — `evaluateScenarioOutcome`, `computeStarRating` (§2.4) |
| `src/scenarios/explain.ts` | New — `explainNHEJOutcome` (§2.6) |
| `src/scenarios/*.test.ts` | New — full coverage (§7) |
| `src/store/scenarioStore.ts` | New — progress persistence (§2.5) |
| `src/store/uiStore.ts` | Add `'scenarios'` to `ViewId` (§3.1) |
| `src/data/viewTabs.ts` | Add `{ id: 'scenarios', label: 'Scenarios' }` |
| `src/views/ScenarioView.tsx` | New — orchestration (§3.3) |
| `src/components/scenarios/ScenarioList.tsx` | New — campaign/level-select (§3.3) |
| `src/components/scenarios/ScenarioBriefing.tsx` | New — objective card (§3.3) |
| `src/components/scenarios/CutOutcomePanel.tsx` | New — reveal + retry (§3.3) |
| `src/components/crispr/GuideList.tsx` | Add optional `rowAction` prop (§3.4) — additive only |
| `src/components/map/LinearFeatureMap.tsx` | Add optional `markers` prop (§3.5) — additive only |
| `src/components/map/CircularPlasmidView.tsx` | Add optional `markers` prop (§3.5) — additive only |
| `src/components/layout/Shell.tsx` | Render `ScenarioView` for `activeView === 'scenarios'` |
| `src/commands/registry.ts` | Add `open-scenarios` command (§3.7) |
| `src/commands/registry.test.ts` | Add a case for the new command |

---

## 6. Implementation checklist

**Phase 1 — domain logic (highest correctness risk, build and test first)**
1. `src/scenarios/types.ts`, `resolve.ts`.
2. `simulateNHEJRepair` (§2.3) — write `simulate.test.ts` with an injected deterministic `rng`
   before moving on; assert exact `editType`/`length`/`position` for known rng sequences, and the
   near-origin clamping behavior on a short sequence.
3. `evaluateScenarioOutcome` + `computeStarRating` (§2.4) — test every row of the star table
   independently, plus the protected-feature-collateral-damage failure case explicitly (this is
   the one branch that's easy to forget to wire up correctly).
4. `explainNHEJOutcome` (§2.6).

**Phase 2 — content & store**
5. `src/scenarios/data.ts` — the three launch scenarios (§4), each spot-checked by hand: load the
   referenced example construct, confirm `resolveFeature` actually finds the named CDS.
6. `scenarioStore.ts` — progress persistence, `recordAttempt`'s "only improves" invariant tested.

**Phase 3 — UI**
7. `GuideList`'s `rowAction` prop and `LinearFeatureMap`/`CircularPlasmidView`'s `markers` prop —
   additive, verify the CRISPR tab and Map view are pixel-identical to before with the new props
   omitted.
8. Wire the new tab (§3.1), build `ScenarioView` + `ScenarioList` + `ScenarioBriefing` +
   `CutOutcomePanel` (§3.2–3.6): briefing, reused guide table with the new action, cut simulation
   → evaluation → reveal → retry/next flow, disclaimer copy (§3.8).
9. Command palette entry (§3.7).

**Phase 4 — polish**
10. Manual QA pass (§7) across all three scenarios, both topologies, retry flow, Explain Mode
    on/off, locked-tier gating.

---

## 7. Manual QA checklist

- [ ] Each of the three scenarios loads its correct construct fresh (not the user's currently
      active construct) and resets cleanly on retry — no leftover mutations from a prior attempt.
- [ ] "Silence the Glow": a guide landing outside the GFP CDS never reports success, regardless
      of the rolled indel.
- [ ] "Break the Lock": a guide that would knock out `markerR` but whose cut *also* falls inside
      GFP correctly fails via `protectedFeatureHit` — spot-check by hand-picking such a guide if
      one exists among the candidates.
- [ ] "Precision Strike": confirm the CRISPR tab shows a materially smaller candidate list than
      the other two scenarios (search-space scarcity is real, not just narrative claim).
- [ ] Star rating matches §2.4's table exactly for a few hand-constructed cases (strong guide,
      0 off-targets, first attempt → 3 stars; same guide on a 2nd attempt → 2 stars max).
- [ ] `recordAttempt` never lowers a previously-recorded `bestStars` after a worse retry.
- [ ] Tier 2 stays locked until both Tier 1 scenarios show `bestStars >= 1`; unlocks immediately
      after.
- [ ] Map markers appear on both `LinearFeatureMap` (all scenarios) and `CircularPlasmidView`
      ("Break the Lock" only, circular), colored by rating, clickable to `selectRange`.
- [ ] Explain Mode on: `CutOutcomePanel` shows `explainNHEJOutcome` steps; off: it doesn't, and
      the rest of the panel is unaffected.
- [ ] Exiting a scenario mid-attempt and returning to the CRISPR/Sequence/Map tabs works
      normally — nothing about scenario mode locks or corrupts the rest of the app's state.
- [ ] `CRISPRView`'s own table (outside scenario mode) is visually unchanged — the `rowAction`/
      `markers` props being optional actually holds in practice, not just in the type signature.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` all pass.

---

## 8. Open decisions / stretch goals (confirm before/while building — not blockers)

- **HDR / precision-repair tier (Tier 3):** design a donor-template mechanic (homology arms +
  desired edit, deterministic rather than random) for "fix this broken gene" scenarios — a real
  second mechanic, not more scenario data, same weight as the original spec's Cas12a callout.
  Not built in v1.
- **Shareable results text card:** a formatted `<pre>` block ("Helix IDE — Mission Complete...")
  with a Copy button after a win, reusing `toDisplayPosition`/`consequenceLabel` for formatting.
  Pure client-side text, no backend — cheap, but not required to ship v1.
- **`CRISPRView` also passing `markers` to the map** (§3.5) now that the prop exists: natural,
  low-cost, not required for scenario mode to be complete.
- **Additional organism content packs** beyond the 3 launch scenarios: pure content-authoring
  work once the engine ships, decoupled from this implementation effort.
- **Difficulty curve tuning** (indel-length weights, which consequences count as "success," how
  many scenarios per tier): the three launch scenarios are a starting point, not a final balance
  pass — expect to adjust after the first real playtest.
