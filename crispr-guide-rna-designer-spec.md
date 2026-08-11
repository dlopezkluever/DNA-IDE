# CRISPR Guide RNA Designer — Spec & Implementation Plan

Status: proposed, not yet built. Source: `next_steps.md` (Tier 2, "the biggest genuine gap in
the toolkit") and the explicit build request pasted alongside it. This doc grounds that
paragraph in the actual codebase — real file paths, real function signatures, real coordinate
math — so implementation can start directly from here, the same way
`command-palette-and-mutation-heatmap-spec.md` did for the two Tier 1 features (both now shipped
— `src/commands/`, `src/components/palette/`, `MutationHeatmap.tsx`, `consequenceColors.ts` all
exist in the tree today). This feature builds on top of those, not around them.

Product name used throughout the UI is **Helix IDE** (`TopBar.tsx`), not "DNA-IDE" — the repo
folder name is just where it lives on disk. This doc uses "Helix IDE."

This is explicitly additive: no existing view, store shape, or exported function signature
changes in a breaking way. One new `ViewId` union member and one new tab is the only change to
shared state shape.

---

## 0. Shared groundwork

Established conventions this feature must follow — read once, applies throughout.

- **Coordinates are 0-based, half-open `[start, end)`** everywhere in `src/biology` and the
  stores (`src/types/models.ts:1-5`). Only display components convert to GenBank's 1-based
  inclusive convention via `toDisplayPosition`/`fromDisplayPosition` (`src/biology/sequence.ts:174-180`).
- **No router.** View switching is `useUIStore((s) => s.activeView)` (`ViewId` union,
  `src/store/uiStore.ts:6-7`) + `setActiveView`, read in `src/components/layout/Shell.tsx:40-47`
  as a plain conditional-render block.
- **Selection is global, not per-view**, in `uiStore.ts`. Every view reads/writes it through one
  hook, `src/hooks/useCrossHighlight.ts` (`selectRange`, `selectFeature`). This feature must
  drive selection through `selectRange`, not by writing to `uiStore` fields directly, so it
  participates in cross-highlighting for free (clicking a candidate guide highlights it in the
  Sequence view exactly like a restriction site or ORF does today).
- **State**: Zustand 5, `useUIStore` + `useConstructStore`, no Context, no Redux. `uiStore`
  persists only `explainMode` and `enabledEnzymeIds` to `localStorage`
  (`uiStore.ts:106-110`, `partialize` whitelist). Per-view filter state (min length, GC bounds,
  etc.) is **local component `useState`**, not global store — matches `ORFList.tsx:13`'s
  `minLength` and `MutationHeatmap.tsx:70`'s `selectedCell`, neither of which live in `uiStore`.
- **Styling**: Tailwind v4, CSS-first theme in `src/index.css`, no component library. Canonical
  tokens: `--color-bg-canvas/surface/elevated/hover`, `--color-border/border-strong`,
  `--color-text-primary/secondary/muted`, `--color-accent` (green, "active/on/good") /
  `--color-accent-dim` / `--color-accent-fg`, `--color-warn` (amber) / `--color-danger` (red) /
  `--color-info` (blue). Per `DESIGN.md` §2.3: **green means "active/selected right now," never
  "clickable" or "important"** — this matters below for how guide quality ratings are colored
  (§3.7).
- **Rendering for spatial visualizations is raw inline SVG**, no charting library
  (`LinearFeatureMap.tsx`, `CircularPlasmidView.tsx`, `MutationHeatmap.tsx`) — `viewBox` +
  `w-full`/explicit width inside `overflow-x-auto`, `var(--color-*)` for fill/stroke, native
  `<title>` for tooltips.
- **Testing**: Vitest, `environment: 'node'` — only `src/biology`, `src/parsers`, `src/store`,
  `src/utils`, `src/commands` are unit-tested; there is **no component/UI test harness**. New
  pure logic (the scanning/scoring/off-target functions) must be framework-free so it fits this
  convention; new React components get a manual QA pass (§6), not unit tests.
- **The closest existing analog is `src/biology/restriction.ts`** — motif scanning across both
  strands of a topology-aware sequence, returning a flat list of matches sorted by position, fed
  into a two-pane view (`EnzymeList.tsx` sidebar + table, `RestrictionView.tsx`). This feature
  reuses that shape but is **not** a copy-paste of it — §2.2 below is explicit about where the
  algorithm genuinely differs (restriction scans for the recognition site itself; this scans for
  a 3bp landmark and extracts an *adjacent* window, which is a different slicing problem with
  real off-by-one risk if rushed).
- **Command palette and mutation heatmap already exist.** `buildCommands(ctx)`
  (`src/commands/registry.ts`) already generates one `Go to {tab}` command per entry in
  `TABS` (`src/data/viewTabs.ts`) automatically — adding a tab here means the palette's nav
  commands are free. `CommandContext` (`src/commands/types.ts`) is the seam for adding a `Run`
  command (§3.6).

---

## 1. Scope boundary

Directly from the source material and PRD §36 ("Out of Scope for V1" explicitly lists "CRISPR
guide design," "genome-scale editing," and "laboratory execution instructions" — reasonable for
a 4-week MVP, not reasonable to keep excluding forever now that the MVP is done):

**In scope (v1):**
- Scan the active construct for SpCas9 PAM sites (`NGG`) on both strands — pure client-side
  string scanning.
- Extract and score each candidate 20nt protospacer/guide using only sequence-derivable signals:
  GC content, homopolymer runs (poly-T specifically), and position relative to a CDS start.
- Flag off-target sites **within the currently loaded construct only** — exact-duplicate count
  eagerly, mismatch-tolerant near-matches on demand.
- Visualize/select candidates using the exact same cross-highlight plumbing every other tab uses.

**Explicitly out of scope (v1), and why:**
- **No genome-scale off-target prediction.** That needs an indexed reference genome for a real
  organism and a trained specificity model (e.g. CFD/MIT scores) — a different, much heavier
  product, and a real risk of the app implying lab-grade guidance it can't back up. The UI must
  say, visibly, that off-target search is construct-local only (§3.7's disclaimer copy is not
  optional).
- **No trained-model efficiency scoring** (Doench 2016/Azimuth-style on-target activity
  prediction). Scoring is limited to the three signals the source material names — everything
  computable from sequence alone, nothing that requires a fitted model. This is a hedge against
  the app quietly overstating what it knows, and it forces the scoring logic to stay in the
  "explain why" territory rather than "trust this number" territory.
- **No protocol/ordering generation** (no "here's your IDT order form," no cloning steps for
  inserting the guide into a vector). PRD §36 already rules out "exhaustive cloning-protocol
  generation" and "laboratory execution instructions" generally.
- **One nuclease system in v1: SpCas9 (NGG, 20nt guide, blunt cut 3bp upstream of PAM).** The
  data model (§2.1) is shaped so adding a second system is mostly data, but see §2.1's explicit
  callout of the one part that *isn't* just data (Cas12a's PAM sits 5′ of the protospacer, not
  3′ — a materially different scan, not a config toggle). Not building it now; not pretending
  it's free later either.

---

## 2. Domain design

New module `src/biology/crispr.ts` (pure functions, framework-free, mirrors `restriction.ts`'s
shape) plus a new data file `src/data/pamSystems.ts` (mirrors `restrictionEnzymes.ts`'s shape —
static catalog data separated from the algorithm that consumes it).

### 2.1 PAM system data model

```ts
// src/data/pamSystems.ts
export interface PamSystem {
  id: string
  name: string
  /** 5'->3' recognition pattern; only 'N' (wildcard) and literal bases are needed for v1. */
  pamPattern: string
  /**
   * Which side of the protospacer the PAM sits on. Fixed at '3prime' for every system wired
   * up in v1 (SpCas9). NOT a free parameter in findCandidateGuides — see the callout below.
   */
  pamSide: '3prime'
  guideLength: number
  /** nt from the PAM-proximal edge of the protospacer to the predicted blunt cut site. */
  cutOffsetFromPAM: number
}

export const SPCAS9: PamSystem = {
  id: 'spCas9',
  name: 'SpCas9',
  pamPattern: 'NGG',
  pamSide: '3prime',
  guideLength: 20,
  cutOffsetFromPAM: 3,
}

export const PAM_SYSTEMS: PamSystem[] = [SPCAS9]
```

**Why `pamSide` is typed as a literal `'3prime'` and not wired up as a real branch anywhere:**
Cas9-family systems (SpCas9, SaCas9) have their PAM 3′ of the protospacer. Cas12a/Cpf1 has its
PAM (`TTTV`) 5′ of the protospacer *and* makes a staggered, not blunt, cut — supporting it isn't
"add a row to `PAM_SYSTEMS`," it's a second scanning algorithm with a different guide-extraction
direction and a different cut-site model. Don't let the presence of a `pamSide` field imply this
is already handled; it exists so a future `findCandidateGuides` refactor has a name for the
branch it doesn't have yet, not so v1 can claim multi-system support it doesn't have. **v1 hardcodes the
3′ NGG scan in `findCandidateGuides`** (§2.2) and only ever passes it `SPCAS9`. A PAM-system
picker in the UI is explicitly not built (§7).

### 2.2 Candidate scanning — `findCandidateGuides`

**The biology, precisely, because the sign errors are easy to make here and easy to miss in
review:** SpCas9 requires a protospacer (the 20nt matching the guide RNA) immediately followed,
on the *same strand*, by the PAM `NGG` reading 5′→3′. Two independent cases, mirror images of
each other:

**Case A — PAM on the plus strand.** `NGG` found at plus-strand `[i, i+3)` (test: `seq[i+1..i+3)
=== 'GG'`, first base is the wildcard). The protospacer is the 20nt immediately 5′ of it, which
on the plus strand (whose own 5′→3′ direction is increasing coordinate) is simply `[i-20, i)`,
read left-to-right, no reverse-complement needed.

**Case B — PAM on the minus strand.** The minus strand's 5′→3′ direction is *decreasing* plus-
coordinate. An `NGG` read in that direction, reverse-complemented back into plus-strand
left-to-right order, is `CCN` — so scan the plus strand for `CC` at `[j, j+2)` (test:
`seq[j..j+2) === 'CC'`, third base wildcard). The protospacer is 20nt immediately 5′ of the PAM
*in minus-strand reading order*, which — because minus-strand order runs opposite to plus-strand
coordinate order — means the protospacer sits at *higher* plus-coordinates than the PAM, not
lower: plus-strand range `[j+3, j+23)`, and because it's read on the minus strand, the actual
guide sequence is `reverseComplement(seq.slice(j+3, j+23))`.

This is the one place this feature is a materially different shape from `findRestrictionSites`,
worth stating plainly: restriction scanning finds a motif *and reports that motif's own
position*; CRISPR scanning finds a 2-3bp landmark and then slices out a **20nt window adjacent
to it, in a direction that depends on which strand matched**. Get case B's direction backwards —
easy to do, since the natural instinct is "PAM found going backward from position j, so the
guide must be at lower coordinates too" — and every minus-strand candidate silently reports the
wrong 20mer. This needs an explicit unit test per case (§2.2.2), not just eyeballing.

**Cut site.** SpCas9 makes a blunt cut 3 nucleotides upstream of the PAM (standard, widely
cited fact — this is a data lookup, not something to re-derive from a paper). Worked out in
plus-strand coordinates for both cases, using `restriction.ts`'s own `cutPosition` convention
(the coordinate immediately after which the cut falls — `[.., cutPosition)` is one side,
`[cutPosition, ..)` the other):

```
Case A: PAM at [i, i+3), guide at [i-20, i)
  5'-[ N1 ....... N17 | N18 N19 N20 ]-N-G-G-3'   (positions i-20 .. i-1, then PAM at i)
                       ^ cut between N17 (i-4) and N18 (i-3)
  cutPosition = i - pamSystem.cutOffsetFromPAM              // = i - 3

Case B: PAM (as CCN) at [j, j+3), guide at [j+3, j+23)
  reading the MINUS strand 5'->3' (i.e. decreasing plus-coordinate):
  ...-G-G-N-[ N20 N19 N18 | N17 ....... N1 ]-3'   (PAM at j..j+2, guide at j+3..j+22)
             ^ cut between N18 (j+5) and N17 (j+6)
  cutPosition = j + pamSystem.pamPattern.length + pamSystem.cutOffsetFromPAM   // = j + 3 + 3 = j + 6
```

Both land 3 nucleotides from the PAM-proximal edge of the protospacer, on the correct side, by
construction — that symmetry (`i - 3` vs `j + 6`, not the same formula) is expected, not a bug;
don't "simplify" it into one shared expression later without re-deriving it.

**Circular topology — reuse existing machinery, don't build new wraparound logic.** Two
sub-problems, handled by two different existing tools already in `src/biology/sequence.ts`:

1. *The PAM pattern itself might straddle the origin* (e.g. last base of the sequence is `G`,
   first base is `G`, forming a valid `GG` only when wrapped). Fixed with `restriction.ts`'s own
   technique (`restriction.ts:39-40`): search an extended string
   `seq + seq.slice(0, pamSystem.pamPattern.length - 1)`, only accept matches where the PAM's
   start position is `< len` (guards against reporting the same wrapped match twice).
2. *The extracted 20nt guide window might straddle the origin* (PAM near position 0 in case A,
   or near the end in case B). **No new logic needed** — `wrapIndex` and `getSubsequence`
   (`sequence.ts:106-131`) already implement exactly this: `getSubsequence`'s doc comment states
   its `end < start` convention "is the internal wraparound convention used by restriction
   fragments, PCR amplicons, and any feature without explicit segments." Compute the raw
   (possibly negative or `>= len`) `guideStart`/`guideEnd`, `wrapIndex` each independently, and
   call `getSubsequence(seq, guideStart, guideEnd, 'circular')` — it degenerates correctly to
   the non-wrapping case too (verified: if `guideEnd` wraps to exactly `0`, `getSubsequence`'s
   `seq.slice(start) + seq.slice(0, 0)` collapses to `seq.slice(start)` since the second term is
   empty — no special-casing required at the boundary).

**Linear topology:** a candidate whose guide window would extend past either end (`i - 20 < 0`
in case A, `j + 23 > len` in case B) is simply excluded — a linear molecule has no more sequence
past its ends, same reasoning `findRestrictionSites` implicitly applies by not extending
`searchSeq` at all when `topology === 'linear'`.

```ts
// src/biology/crispr.ts
import type { Feature, Strand, Topology } from '../types/models'
import type { PamSystem } from '../data/pamSystems'
import { reverseComplement, getSubsequence, wrapIndex } from './sequence'

export interface GuideCandidate {
  id: string // `${strand === 1 ? 'fwd' : 'rev'}-${pamPosition}`, deterministic, no nanoid needed
  strand: Strand
  /** 0-based plus-strand coordinate of the PAM window's lower-coordinate edge, regardless of strand. */
  pamPosition: number
  /** PAM literal, read 5'->3' on the strand it's actually on (already reverse-complemented for strand -1). */
  pamSequence: string
  /** 0-based plus-strand [start, end) of the protospacer. end < start on circular topology means it wraps the origin (sequence.ts spansOrigin convention). */
  guideStart: number
  guideEnd: number
  /** 5'->3' on the strand the guide sits on. */
  guideSequence: string
  /** Plus-strand coordinate immediately after the predicted blunt cut. */
  cutPosition: number
}

export function findCandidateGuides(
  seq: string,
  pamSystem: PamSystem,
  topology: Topology,
): GuideCandidate[] {
  const upperSeq = seq.toUpperCase()
  const len = upperSeq.length
  const { guideLength, pamPattern, cutOffsetFromPAM } = pamSystem
  const pamLen = pamPattern.length
  if (len === 0) return []

  const searchSeq =
    topology === 'circular' ? upperSeq + upperSeq.slice(0, Math.max(0, pamLen - 1)) : upperSeq

  const candidates: GuideCandidate[] = []

  // Case A: plus-strand PAM, pattern 'NGG' -> test positions [i+1, i+3) === 'GG'.
  for (let i = 0; i + pamLen <= searchSeq.length; i++) {
    if (i >= len) continue
    if (searchSeq[i + 1] !== 'G' || searchSeq[i + 2] !== 'G') continue

    const rawStart = i - guideLength
    const rawEnd = i
    const guideStart = topology === 'circular' ? wrapIndex(rawStart, len) : rawStart
    const guideEnd = topology === 'circular' ? wrapIndex(rawEnd, len) : rawEnd
    if (topology === 'linear' && rawStart < 0) continue

    const guideSequence = getSubsequence(upperSeq, guideStart, guideEnd, topology)
    candidates.push({
      id: `fwd-${i}`,
      strand: 1,
      pamPosition: i,
      pamSequence: searchSeq.slice(i, i + pamLen),
      guideStart,
      guideEnd,
      guideSequence,
      cutPosition:
        topology === 'circular' ? wrapIndex(i - cutOffsetFromPAM, len) : i - cutOffsetFromPAM,
    })
  }

  // Case B: minus-strand PAM, appears as 'CCN' on the plus strand -> test [j, j+2) === 'CC'.
  for (let j = 0; j + pamLen <= searchSeq.length; j++) {
    if (j >= len) continue
    if (searchSeq[j] !== 'C' || searchSeq[j + 1] !== 'C') continue

    const rawStart = j + pamLen
    const rawEnd = j + pamLen + guideLength
    const guideStart = topology === 'circular' ? wrapIndex(rawStart, len) : rawStart
    const guideEnd = topology === 'circular' ? wrapIndex(rawEnd, len) : rawEnd
    if (topology === 'linear' && rawEnd > len) continue

    const plusStrandWindow = getSubsequence(upperSeq, guideStart, guideEnd, topology)
    const cutRaw = j + pamLen + cutOffsetFromPAM
    candidates.push({
      id: `rev-${j}`,
      strand: -1,
      pamPosition: j,
      pamSequence: reverseComplement(searchSeq.slice(j, j + pamLen)),
      guideStart,
      guideEnd,
      guideSequence: reverseComplement(plusStrandWindow),
      cutPosition: topology === 'circular' ? wrapIndex(cutRaw, len) : cutRaw,
    })
  }

  return candidates.sort((a, b) => a.pamPosition - b.pamPosition)
}
```

Note this reports **overlapping candidates for runs of `G`s or `C`s** (e.g. `AGGG` matches at
both `i=0` and `i=1`, PAMs `AGG` and `GGG`) — expected, biologically real (a poly-G stretch
genuinely offers multiple valid, shifted PAM sites), not a bug to dedupe. Worth one explicit test
confirming no crash/off-by-one on such a run rather than assuming it "probably works."

#### 2.2.1 Files

| File | Change |
|---|---|
| `src/data/pamSystems.ts` | New — `PamSystem`, `SPCAS9`, `PAM_SYSTEMS` |
| `src/biology/crispr.ts` | New — `findCandidateGuides`, `GuideCandidate` (§2.2), `scoreGuide`, `GuideScore` (§2.3), off-target functions (§2.4) |

#### 2.2.2 Required unit tests (`src/biology/crispr.test.ts`, follow `restriction.test.ts`'s fixture style)

- Case A: a single `NGG` in a short linear sequence produces exactly one forward candidate with
  the correct `guideSequence` (literal 20nt slice) and `cutPosition` (worked numeric example,
  asserted against a hand-computed value — same rigor as `restriction.test.ts:9-15`).
- Case B: a single `CCN` produces exactly one reverse candidate whose `guideSequence` is the
  reverse complement of the corresponding plus-strand slice, not the plus-strand slice itself
  (this is the exact bug class §2.2 warns about — a test that only checks strand/position and
  not the actual sequence content would miss a swapped-direction bug).
- Circular: a PAM whose 2-letter core straddles the origin is found once, not zero or twice
  (mirrors `restriction.test.ts:36-49`'s circular-origin test); a guide window that wraps the
  origin (either direction) is extracted correctly via `getSubsequence`.
- Linear: candidates near either end whose guide window would run off the sequence are excluded,
  not clamped or wrapped.
- Overlapping PAMs in a poly-G/poly-C run produce the expected number of shifted candidates.

### 2.3 Scoring — `scoreGuide`

Exactly the three signals named in the source material — no trained-model score, no invented
fourth criterion.

```ts
export interface GuideScore {
  gcContent: number // 0-100
  gcFavorable: boolean // 40-60%, the commonly cited favorable range — a heuristic, not a model
  homopolymerRun: { base: string; length: number } | null // longest run >= 4 within the 20nt guide
  isPolyT: boolean // homopolymerRun?.base === 'T' -- Pol III (U6) terminates on ~4+ T's, kills guide transcription
  featureContext: { featureId: string; featureName: string; percentIntoFeature: number } | null
  rating: 'strong' | 'moderate' | 'weak'
}

export function scoreGuide(
  candidate: GuideCandidate,
  seq: string,
  features: Feature[],
): GuideScore
```

**GC content**: `calculateGC(candidate.guideSequence)` (already exists, `sequence.ts:35-48`) —
reuse it directly, don't reimplement. `gcFavorable = gcContent >= 40 && gcContent <= 60`.

**Homopolymer run**: scan the 20nt guide for the longest run of one repeated base; flag if
`length >= 4`. Cheap linear scan, no library.

**Feature context — reuse `readingBasesWithCoords`, don't rebuild strand/splice math.** "How far
into the CDS does this cut land" needs to account for strand direction and (if present) spliced
segments — exactly what `readingBasesWithCoords(feature, seq)` (`translation.ts:175-193`,
already exported for the Mutation Heatmap) already computes: an ordered, strand- and splice-aware
list of `{ base, pos }` in 5′→3′ reading order. Find the CDS feature(s) overlapping
`candidate.cutPosition`; for the first match, find the index of `cutPosition` in its
`readingBasesWithCoords` output — that index *is* "distance from the start," correctly handling
minus-strand and spliced CDS features for free:

```ts
// Overlap test itself is new — there's no exported "does position X fall within feature Y"
// helper today. mutations.ts has a private, shape-equivalent `featureOverlapsEdit(feature,
// editStart, editEnd, seqLen)` (mutations.ts:64-77), built on the same `getFeaturePieces`
// primitive; write a single-position variant here rather than exporting and repurposing that
// one, since its signature is edit-range-shaped, not point-shaped.
function overlapsPosition(feature: Feature, position: number, seqLen: number): boolean {
  return getFeaturePieces(feature, seqLen).some((p) => position >= p.start && position < p.end)
}

function findFeatureContext(cutPosition: number, features: Feature[], seq: string) {
  const cds = features.find(
    (f) => f.type === 'CDS' && overlapsPosition(f, cutPosition, seq.length),
  )
  if (!cds) return null
  const bases = readingBasesWithCoords(cds, seq)
  const index = bases.findIndex((b) => b.pos === cutPosition)
  if (index === -1) return null
  return {
    featureId: cds.id,
    featureName: cds.name,
    percentIntoFeature: (index / bases.length) * 100,
  }
}
```

**Rating combination** (explicit table, so "strong/moderate/weak" isn't a black box):

| Condition | Effect |
|---|---|
| Start at `strong` | baseline |
| `isPolyT` (guide itself won't transcribe cleanly off U6) | straight to `weak` — this is the one condition serious enough to override everything else, since a guide that doesn't transcribe doesn't matter how good anything else about it is |
| `homopolymerRun` present but not poly-T (e.g. `AAAA`, `GGGG`) | downgrade one tier |
| `!gcFavorable` | downgrade one tier |
| `featureContext` present and `percentIntoFeature > 50` (cutting in the back half of the CDS — a truncated protein from a late frameshift is more likely to retain partial function) | downgrade one tier |
| exact off-target count (§2.4) `> 0` | downgrade one tier |

`downgrade` clamps at `weak` (never below); multiple downgrades stack normally
(`strong` → `moderate` → `weak`). This is a simple, legible heuristic, not a numeric score —
deliberately, to avoid implying more precision than sequence-only signals can honestly support.

### 2.4 Off-target detection

Directly from the source material's point 4: flag occurrences of the same (or near-match) 20mer
**elsewhere in the currently loaded construct**, explicitly not against any reference genome.

**Two tiers, for a concrete performance reason — read this before implementing the naive version
for every candidate eagerly.** A construct can be "hundreds of thousands of bases" (PRD §35
engineering metric) with, roughly, one PAM every ~8bp per strand — on a 300kb construct that's on
the order of tens of thousands of candidates. Any per-candidate off-target search that itself
scans the whole sequence is `O(candidates × length)`, i.e. `O(length²)` — for 300k bases that's
~10^10 character comparisons, seconds-to-minutes in a browser tab, and it would re-run on every
filter change unless carefully memoized. This is the same shape of mistake
`command-palette-and-mutation-heatmap-spec.md` §1.1 caught for the Mutation Heatmap before it was
built — catch it here before building, not after.

**Tier 1 — exact-duplicate count, eager, `O(length)` total.** Build one hash map, once per
construct load (memoized on `[sequence, topology]`), from every exact 20mer substring (both
strands, circular-aware via the same right-padding trick as §2.2) to its occurrence count. Each
candidate's exact off-target count is then an `O(1)` lookup minus one (for its own primary site).
Cheap enough to compute unconditionally for the whole candidate list, same tier as `GCTrack`'s
prefix-sum pass.

```ts
export function buildOffTargetIndex(
  seq: string,
  topology: Topology,
  guideLength: number,
): Map<string, number> {
  const upperSeq = seq.toUpperCase()
  const len = upperSeq.length
  const pad = topology === 'circular' ? guideLength - 1 : 0
  const extended = upperSeq + upperSeq.slice(0, pad)
  const index = new Map<string, number>()

  const addWindows = (s: string) => {
    for (let i = 0; i + guideLength <= s.length && i < len; i++) {
      const kmer = s.slice(i, i + guideLength)
      index.set(kmer, (index.get(kmer) ?? 0) + 1)
    }
  }
  addWindows(extended)
  addWindows(reverseComplement(extended)) // opposite-strand occurrences count too (§2.4 note)

  return index
}

export function countExactOffTargets(guideSequence: string, index: Map<string, number>): number {
  return Math.max(0, (index.get(guideSequence.toUpperCase()) ?? 0) - 1)
}
```

Note on the reverse-complement pass: a candidate's off-target count includes occurrences of the
*same 20nt sequence* on either strand of the construct, not just its own strand — the same gRNA
can in principle bind either orientation wherever that sequence occurs. This deliberately does
**not** check whether an off-target locus has its own adjacent PAM (a real off-target additionally
needs a nearby compatible PAM to actually be cleavable) — the source material asks specifically
for "does this same ~20mer... occur anywhere else in this sequence," not full off-target
viability modeling. Documented as a stated simplification, not a silent gap (§3.7's disclaimer
copy should say "sequence match," not "predicted off-target site").

**Tier 2 — mismatch-tolerant near-matches, on demand, per candidate.** Computed only when a user
explicitly expands a specific candidate's detail (§3.5) — not eagerly for the whole list. At that
point a naive `O(length × guideLength)` scan (slide a 20-wide window across both strands,
Hamming-distance against the query) is fast enough for a single click: even at 300k bases that's
~6M char comparisons, comfortably sub-100ms, and it only ever runs for the one candidate the user
is actively looking at.

```ts
export interface NearMatch {
  position: number
  strand: Strand
  mismatches: number
}

export function findNearMatches(
  guideSequence: string,
  seq: string,
  topology: Topology,
  maxMismatches: number,
): NearMatch[]
```

Implementation: same right-padding-for-circular technique as §2.2/Tier 1; for each window, count
mismatches against `guideSequence` (and separately against the reverse-complement window for the
opposite strand), keep windows with `mismatches <= maxMismatches` and `mismatches > 0` (an exact
match is already counted in Tier 1, don't double-report it here). Expose `maxMismatches` as a
small fixed choice in the UI (0/1/2), not a free-form input — mirrors `ORFList.tsx`'s
`MIN_LENGTH_OPTIONS` button-row pattern (§3.5).

#### Files

| File | Change |
|---|---|
| `src/biology/crispr.ts` | Add `buildOffTargetIndex`, `countExactOffTargets`, `findNearMatches`, `NearMatch` |

#### Required unit tests

- `buildOffTargetIndex`/`countExactOffTargets`: a sequence with a deliberately duplicated 20mer
  (once on each strand) reports off-target count `1` for a guide matching either copy, `0` for a
  guide occurring nowhere else. Circular wraparound duplicate (one copy straddling the origin) is
  still found.
- `findNearMatches`: a guide with a single deliberate mismatch elsewhere in the sequence is found
  at `maxMismatches: 1` and `2` but not `0`; a match with 3 mismatches is excluded at
  `maxMismatches: 2`; the guide's own exact locus never appears in the near-match list (it's
  `mismatches === 0`, filtered out per the "don't double-report Tier 1" rule above).

### 2.5 Explain Mode integration — `explainCRISPRGuide`

Cheap, and it's exactly the kind of "computational and visual, not a protocol generator" framing
§1 commits to — showing *why* a cut lands where it does is pedagogy, not a lab instruction. Same
shape as the three existing functions in `src/biology/explain.ts` (`explainReverseComplement`,
`explainTranslation`, `explainMutation`), returning `ExplainStep[]`:

```ts
// src/biology/explain.ts — new function alongside the existing three
export function explainCRISPRGuide(
  candidate: GuideCandidate,
  score: GuideScore,
  pamSystem: PamSystem,
  offTargetCount: number,
): ExplainStep[] {
  return [
    { label: 'PAM', value: `${candidate.pamSequence} at position ${toDisplayPosition(candidate.pamPosition)} (${candidate.strand === 1 ? '+' : '-'} strand)` },
    { label: 'Protospacer (guide RNA)', value: `5' ${candidate.guideSequence} 3'` },
    { label: 'Predicted cut site', value: `${pamSystem.cutOffsetFromPAM}bp upstream of the PAM, blunt` },
    { label: 'GC content', value: `${score.gcContent.toFixed(0)}% ${score.gcFavorable ? '(favorable range)' : '(outside 40-60% favorable range)'}` },
    { label: 'Off-target matches in this construct', value: String(offTargetCount) },
  ]
}
```

(`offTargetCount` isn't a field on `GuideCandidate` itself — it's computed separately per-candidate
via `countExactOffTargets` against the shared index, §2.4 — so it's passed in rather than read off
the candidate, same as `score`.)

Rendered via the existing `<ExplainBlock steps={...} />` component, gated behind
`useUIStore((s) => s.explainMode)` exactly like `SequenceView.tsx`'s mutation toast and
`MutationsView`'s (implicit, via `MutationList`) explain integration — no new pattern.

---

## 3. UI/UX design

### 3.1 New tab wiring

| File | Change |
|---|---|
| `src/store/uiStore.ts:6-7` | Add `'crispr'` to the `ViewId` union |
| `src/data/viewTabs.ts` | Add `{ id: 'crispr', label: 'CRISPR' }` to `TABS` |
| `src/components/layout/Shell.tsx:40-47` | Add `{activeView === 'crispr' && <CRISPRView />}` |

No new boolean gate is needed in `uiStore` (unlike Mutation Heatmap's `mutationHeatmapOpen` or
ORF List's `orfListOpen`) — **the tab itself is the gate.** `Shell.tsx` only mounts the active
view's component, so `findCandidateGuides`/`scoreGuide`/`buildOffTargetIndex` only ever run when
the CRISPR tab is actually open, the same way `RestrictionView` only computes
`findRestrictionSites` while mounted. This is a simplification worth calling out precisely
because it's easy to reflexively copy the heatmap's `open`-boolean pattern here without noticing
it's solving a problem (a section living *inside* an always-mounted view) this feature doesn't
have.

### 3.2 Layout

Two-pane split, directly modeled on `RestrictionView.tsx` (`EnzymeList` sidebar + table), not a
new layout idiom:

```
┌─ Filters ──────────┬─ Candidate Guides (SpCas9, NGG) ─────────────────────────────────┐
│ GC range            │ ⚠ Off-target search is limited to this construct only — not a   │
│  ☑ 40-60% only       │   reference genome. See "About off-target search" below.        │
│                      │                                                                  │
│ ☑ Hide poly-T guides │ Strand Pos    Guide (5'->3')         GC%  Feature       Rating  │
│ ☐ CDS-only           │   +    142    GACGTTAGCATGGCTAGCTA   55%  gfp · 4%      ★ strong │
│                      │   -    203    TTGGCATCGATCGGGATCCA   50%  gfp · 12%     ● moderate│
│ Sort: [Rating ▾]     │   +    310    AAAATCGCTAGGCTAGGCTA   45%  —             ● moderate│
│                      │   -    488    poly-T flagged...      35%  gfp · 61%     ○ weak    │
│ 214 candidates       │  ...                                                             │
│ 38 after filters     │  (row click -> highlights guide+PAM in Sequence view)            │
└──────────────────────┴──────────────────────────────────────────────────────────────────┘
```

### 3.3 Component breakdown

| File | Role |
|---|---|
| `src/views/CRISPRView.tsx` | Orchestrates: reads active construct, memoizes `findCandidateGuides` → `scoreGuide` per candidate → `buildOffTargetIndex`, applies filters/sort, renders the two panes. Mirrors `RestrictionView.tsx`'s structure exactly. |
| `src/components/crispr/GuideFilters.tsx` | Sidebar: GC-range toggle, hide-poly-T toggle, CDS-only toggle, sort select. Mirrors `EnzymeList.tsx`'s sidebar shell (search box replaced with these controls, same `w-52 shrink-0 border-r` container). |
| `src/components/crispr/GuideList.tsx` | The table + row detail expansion (§3.5). Mirrors `RestrictionView.tsx`'s inline table (not worth its own file if it stays this simple — open decision, §7). |

`CRISPRView.tsx` computation shape:

```ts
const candidates = useMemo(
  () => (construct ? findCandidateGuides(construct.sequence, SPCAS9, construct.topology) : []),
  [construct],
)
const offTargetIndex = useMemo(
  () => (construct ? buildOffTargetIndex(construct.sequence, construct.topology, SPCAS9.guideLength) : null),
  [construct],
)
const scored = useMemo(
  () =>
    construct && offTargetIndex
      ? candidates.map((c) => ({
          candidate: c,
          score: scoreGuide(c, construct.sequence, construct.features),
          offTargetCount: countExactOffTargets(c.guideSequence, offTargetIndex),
        }))
      : [],
  [construct, candidates, offTargetIndex],
)
```

Filtering/sorting on `scored` is a plain `.filter().sort()` in the view, local `useState` for
filter values — no store involvement, same as `ORFList`'s `minLength`.

### 3.4 Row interaction

Click a row → highlight the *whole* protospacer+PAM span (not just the 20nt guide) via
`selectRange`, matching restriction sites highlighting their full recognition site
(`RestrictionView.tsx:76`: `selectRange(m.position, m.position + site.length)`):

```ts
const spanStart = candidate.strand === 1 ? candidate.guideStart : candidate.pamPosition
const spanEnd = candidate.strand === 1
  ? candidate.pamPosition + SPCAS9.pamPattern.length
  : candidate.guideEnd
selectRange(spanStart, spanEnd, candidate.strand)
```

(For circular-wrapped candidates, `selectRange`/the Sequence view's `isInRange` already handles
`end < start` as a wrapped selection — same as every other selectable range in the app; no new
logic here either.)

### 3.5 Off-target detail expansion

Clicking a row selects it (§3.4); a **separate** small "off-targets" affordance per row (e.g. a
button showing the exact count, click to expand) triggers the on-demand Tier 2 search (§2.4),
local `useState<GuideCandidate | null>` for "which row's detail is expanded" — same pattern as
`MutationHeatmap.tsx`'s `selectedCell` state. Mismatch tolerance is a 3-button row (`0`/`1`/`2`),
styled exactly like `ORFList.tsx:35-48`'s `MIN_LENGTH_OPTIONS` buttons. Expanded detail lists each
near-match's position, strand, and mismatch count/positions (which bases differ) — enough to be
concretely useful without pretending it's genome-scale.

### 3.6 Command palette integration

One new command in `buildCommands` (`src/commands/registry.ts`), directly beside
`show-restriction-sites` (`registry.ts:140-146`), same shape:

```ts
commands.push({
  id: 'design-crispr-guides',
  label: 'Design CRISPR guides',
  category: 'run',
  enabled: true,
  run: () => ctx.setActiveView('crispr'),
})
```

The `Go to CRISPR` nav command is generated automatically once `'crispr'` is added to `TABS`
(§3.1) — no separate work.

### 3.7 Disclaimer copy and rating color

**Disclaimer** — persistent, not dismissible, visible without scrolling (top of `CRISPRView`,
same visual weight as a `--color-warn` note):

> Off-target matches are searched only within this loaded construct — not against a reference
> genome. This tool does not predict real-world off-target editing risk; it flags sequence
> matches for exploration, not lab-grade guide validation.

This is load-bearing, not boilerplate — it's the exact line the source material's point 4 asks
for explicitly ("Deliberately do not claim to do genome-scale off-target prediction... being
explicit about that boundary keeps this squarely in the same educational... lane").

**Rating color**, per `DESIGN.md` §2.3's rule that green means "active/on right now," not
"good/bad" — worth getting right rather than reflexively reaching for the traffic-light mapping
used for mutation consequences (`consequenceColors.ts`). A guide's rating isn't a live toggle
state, it's a quality judgment, closer in kind to how `EnzymeList.tsx` marks unique cutters
(`--color-accent` badge, `EnzymeList.tsx:53-57`) than to consequence severity. Proposed:
`strong` → `--color-accent` (this is the one case where "good" and "the app's one accent color"
coincide, consistent with unique-cutter badges), `moderate` → `--color-warn`, `weak` →
`--color-text-muted` (not `--color-danger` — a weak guide isn't an error state the way a
frameshift is; it's just not a great pick, and reserving red for actual errors/danger keeps that
color meaningful elsewhere). Flagged as an open decision (§7), not a blocker.

### 3.8 Map visualization — v1 scope decision

The source material's point 5 says to visualize candidates "on the sequence/map exactly like
restriction sites are today." Worth checking that claim against the actual code before building
to it: **restriction sites are not currently drawn on `LinearFeatureMap` or
`CircularPlasmidView`** — `RestrictionView.tsx` only renders a table; clicking a row calls
`selectRange`, which highlights the match in the Sequence view via `SequenceEditor.tsx`'s
`isInRange` background-color logic. There is no restriction-site marker layer on either map
component today (verified by reading both — `LinearFeatureMap.tsx` renders only its `features`
prop, `CircularPlasmidView.tsx` likewise).

**v1 recommendation: match what restriction sites actually do, not the aspirational
description** — table + click-to-highlight-in-Sequence-view, full parity with the existing
pattern's *actual* behavior. Adding a marker layer to `LinearFeatureMap` is a reasonable follow-up
(both restriction sites and CRISPR candidates could share one new "markers" prop — an array of
`{ position, color, label }` rendered as thin tick lines above the feature lanes — but that's a
change to a shared, already-shipped component, and doing it for one caller (CRISPR) while
restriction sites still don't get it would be an inconsistent half-step). Noted as an open
decision (§7), not built in v1.

### 3.9 Empty/loading states

- No construct loaded → `ViewPlaceholder` ("Import a FASTA or GenBank file to begin"), same as
  every other view.
- Construct loaded, zero PAM sites found (only possible on a very short sequence) → muted
  one-line message, same tone as `RestrictionView.tsx:56-59`'s "No sites found."
- Filters active and zero candidates match → distinguish from "zero candidates exist" (e.g. "38
  of 214 candidates hidden by filters" vs "no PAM sites in this construct") so a first-time user
  doesn't think the scan itself failed.

---

## 4. Files to add / change

| File | Change |
|---|---|
| `src/data/pamSystems.ts` | New — `PamSystem`, `SPCAS9`, `PAM_SYSTEMS` (§2.1) |
| `src/biology/crispr.ts` | New — `findCandidateGuides`, `GuideCandidate` (§2.2); `scoreGuide`, `GuideScore` (§2.3); `buildOffTargetIndex`, `countExactOffTargets`, `findNearMatches`, `NearMatch` (§2.4) |
| `src/biology/crispr.test.ts` | New — full coverage per §2.2.2 and §2.4's test lists |
| `src/biology/explain.ts` | Add `explainCRISPRGuide` (§2.5) |
| `src/store/uiStore.ts` | Add `'crispr'` to `ViewId` union (§3.1) — no new boolean state |
| `src/data/viewTabs.ts` | Add `{ id: 'crispr', label: 'CRISPR' }` to `TABS` |
| `src/views/CRISPRView.tsx` | New — orchestration (§3.3) |
| `src/components/crispr/GuideFilters.tsx` | New — sidebar filters (§3.3) |
| `src/components/crispr/GuideList.tsx` | New — table + off-target detail expansion (§3.3, §3.5) |
| `src/components/layout/Shell.tsx` | Render `CRISPRView` for `activeView === 'crispr'` |
| `src/commands/registry.ts` | Add `design-crispr-guides` command (§3.6) |
| `src/commands/registry.test.ts` | Add a case asserting the new command's presence/behavior |

---

## 5. Implementation checklist (est. 3-4 days)

**Day 1 — domain logic, the part with real correctness risk**
1. Build `src/data/pamSystems.ts`.
2. Implement `findCandidateGuides` (§2.2). Write `crispr.test.ts`'s scanning tests *before*
   moving on — case B's direction (§2.2's warning) is exactly the kind of bug that looks fine at
   a glance and is wrong.
3. Implement `scoreGuide` (§2.3), including the `readingBasesWithCoords` reuse for feature
   context. Test against a small literal-DNA CDS fixture, same style as `mutations.test.ts`.

**Day 2 — off-target detection**
4. Implement `buildOffTargetIndex`/`countExactOffTargets` (Tier 1). Test with a deliberately
   duplicated 20mer, including a circular-wraparound duplicate.
5. Implement `findNearMatches` (Tier 2). Test mismatch-tolerance boundaries.
6. Benchmark: run `findCandidateGuides` + `scoreGuide` + `buildOffTargetIndex` against the
   largest example construct plus a synthetic large construct (~50-100kb) to sanity-check the
   `O(length)` claims in §2.4 hold in practice, not just in theory.

**Day 3 — UI**
7. Wire the new tab (§3.1): `uiStore.ts`, `viewTabs.ts`, `Shell.tsx`.
8. Build `CRISPRView.tsx` + `GuideFilters.tsx` + `GuideList.tsx` (§3.2-3.5): table, filters, sort,
   row click → `selectRange`, disclaimer copy (§3.7).
9. Add `explainCRISPRGuide` (§2.5) and wire it behind `explainMode` in the row detail panel.

**Day 4 — polish and integration**
10. Off-target detail expansion UI (§3.5): mismatch-tolerance buttons, near-match list.
11. Command palette entry (§3.6).
12. Manual QA pass (§6).

---

## 6. Manual QA checklist

No component-test harness exists in this codebase (§0) — ships with unit tests for all pure logic
but the React layer needs a manual pass. Run against `npm run dev`, each of the three built-in
example constructs:

- [ ] Candidate count and a handful of spot-checked guide sequences match a hand-scan of a short
      stretch of the loaded sequence (pick a visible `NGG`/`CCN` in the Sequence view, verify the
      app reports the same 20mer).
- [ ] A minus-strand candidate's reported guide sequence is genuinely the reverse complement of
      the corresponding plus-strand slice, not an accidental plus-strand echo (§2.2's warning,
      checked by eye, not just by test).
- [ ] Row click highlights the guide+PAM span in the Sequence view, correctly spanning the origin
      for a circular construct's wrapped candidate if one exists in the example data.
- [ ] Filters (GC range, hide-poly-T, CDS-only) each visibly change the candidate list and the
      "N of M" count updates correctly.
- [ ] A guide overlapping a CDS shows a sane `percentIntoFeature` (spot check one manually).
- [ ] Off-target: a candidate whose 20mer is deliberately duplicated (construct a quick test
      construct, or introduce a duplicate via the Mutations tab) shows a nonzero exact count; the
      on-demand near-match expansion returns results consistent with the mismatch tolerance
      selected.
- [ ] Disclaimer text is visible without scrolling on tab open.
- [ ] Explain Mode on: row detail shows the `explainCRISPRGuide` steps; off: it doesn't, and
      nothing else breaks.
- [ ] Command palette: `Ctrl/Cmd+K` → "crispr" surfaces both `Go to CRISPR` and
      `Design CRISPR guides`; either navigates correctly.
- [ ] Performance: no visible jank switching into the CRISPR tab on the largest example
      construct.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` all pass.

---

## 7. Open decisions (confirm before/while building — not blockers)

- **Rating color** (§3.7): `strong` = accent green (recommended, matches unique-cutter badge
  precedent) vs. reusing the mutation-consequence red/amber/gray palette wholesale for
  consistency with `consequenceColors.ts`.
- **Map markers** (§3.8): ship v1 with table-only parity to restriction sites' *actual* current
  behavior (recommended) vs. building a shared marker layer for `LinearFeatureMap` now and
  retrofitting restriction sites to use it too (bigger, touches a shipped component, not required
  for this feature to be useful).
- **`GuideList.tsx` as its own file vs. inlined in `CRISPRView.tsx`**: split out only if the table
  + detail-expansion logic gets large enough to warrant it (`RestrictionView.tsx` keeps its table
  inline at a similar size) — decide during implementation, not up front.
- **Whether to add a second PAM system's *data* (e.g. SaCas9, `NNGRRT`, still 3′-side) now that
  the scan logic is written**: cheap once §2.2's plus/minus-strand branches exist for arbitrary
  IUPAC patterns (currently hardcoded to literal `GG`/`CC` checks, not a general IUPAC matcher) —
  worth doing only if there's an actual use case pulling for it; not needed to ship v1.
- **Whether `scoreGuide`'s rating combination table (§2.3) should be exposed as a numeric score**
  instead of three tiers, for finer sorting. Recommendation: keep it three tiers — a numeric
  score built from three heuristics would imply more precision than the inputs support, which is
  exactly the overstatement §1 commits to avoiding.
