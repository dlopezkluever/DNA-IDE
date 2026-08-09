# Helix IDE (DNA IDE) — Full Build Plan

## Context

`DNA-IDE-PRD.md` specifies a 3–4 week educational project: a client-side, IDE-styled
workbench for inspecting/editing/simulating DNA constructs (FASTA/GenBank import,
feature maps, translation, ORF detection, GC analysis, restriction sites, mutation
consequences, construct diff, primer design, PCR simulation, virtual assembly, codon
optimization), plus an "Explain Mode" that surfaces the biological reasoning behind
each operation. The directory is currently empty except the PRD — this is a from-scratch
build. The goal is to implement the full MVP (PRD §§8–19 + Explain Mode §25 + example
constructs §26), matching the PRD's own suggested architecture (React/TS/Vite/Tailwind/
Zustand, a dedicated framework-free `biology/` engine, PRD §22's data model), skipping
everything explicitly marked "Out of Scope for V1" (§36) and "Stretch Features" (§37).

Stack decision: **100% client-side, no backend.** The PRD lists a Python/Biopython
backend as optional (for cross-validating homemade algorithms); we skip it entirely to
keep the stack simple, and validate correctness with hand-verified unit test fixtures
instead.

## Architecture

**Scaffold**: Vite `react-ts` template, Tailwind v4 (`@tailwindcss/vite`, config in CSS
`@theme`, no separate PostCSS step), Zustand, `react-window` (sequence virtualization),
`nanoid` (ids), Vitest (`environment: 'node'` — biology/parser logic has no DOM
dependency). ESLint flat config (template default) + `eslint-config-prettier` + a
`.prettierrc`. Scripts: `dev`, `build` (`tsc -b && vite build`), `test`, `test:watch`,
`lint`, `format`, `typecheck`.

**Folder layout**:
```
src/
  types/models.ts              # Construct, Feature, Mutation, ProteinEffect (PRD §22 + minor additive fields)
  biology/                     # framework-free domain logic, heavily unit-tested
    sequence.ts translation.ts orf.ts mutations.ts restriction.ts
    primers.ts pcr.ts codons.ts alignment.ts assembly.ts explain.ts
  parsers/fasta.ts genbank.ts
  store/constructStore.ts uiStore.ts
  hooks/useCrossHighlight.ts useDerivedTranslation.ts useDerivedORFs.ts ...
  data/restrictionEnzymes.ts codonUsageTables.ts exampleConstructs/{minimalCDS,gfpConstruct,educationalPlasmid,index}.ts
  components/{layout,sequence,map,protein,mutations,restriction,pcr,compare,assembly,common}/
  views/{Sequence,Map,Protein,Mutations,Restriction,PCR,Compare,Assembly}View.tsx
  utils/id.ts format.ts
```
Tests co-located (`sequence.test.ts` beside `sequence.ts`).

**Coordinate convention**: internal computation is 0-based half-open `[start,end)`;
GenBank's 1-based inclusive convention is converted only at the parser boundary and in
display components (`toDisplayPosition`/`fromDisplayPosition` in `sequence.ts`). Centralizing
this once is the main defense against off-by-one bugs throughout.

**State**: two Zustand stores only.
- `constructStore`: `constructs: Record<string, Construct>`, `activeConstructId`,
  `originalConstructId`, `compareConstructId`, `assembly.fragments`. Derived data
  (translation, ORFs, GC%, restriction sites) is **never stored** — computed via
  memoized selectors keyed on construct id + sequence, avoiding stale-derived-state bugs.
- `uiStore`: `activeView`, `explainMode`, `selection {start,end,strand?}`,
  `hoveredCodon`, `activeFeatureId`, `activeMutationId`, `enabledEnzymeIds`, search state.
  `explainMode`/`enabledEnzymeIds` persisted to localStorage; construct data is not.

**Mutation model (fork-once)**: the first mutation on a freshly loaded construct forks
it into a new working-copy id (`id + '-edited'`), leaving the pristine original at its
original id (`originalConstructId`); subsequent edits update the working copy in place.
Compare view is then always "`originalConstructId` vs `activeConstructId`" with no
special-casing, directly matching the PRD §39 demo (mutate → compare against original).
`applyMutation` is pure/immutable in `biology/mutations.ts`; the store just swaps in the
returned new `Construct`.

**Cross-highlighting (PRD §34)**: one shared mechanism — `uiStore.selection` plus a few
companion fields (`activeFeatureId`, `activeMutationId`, `hoveredCodon`) — read/written by
every view through a single `useCrossHighlight` hook. No component talks to another
directly; this covers every §34 bullet uniformly.

**Assembly workspace**: fragments come from a whole construct, a selected sub-region, or
a PCR product; `assembleFragments` auto-detects Gibson-style overlaps per junction
(exact suffix/prefix match) and produces a brand-new `Construct` — not a special type —
so it's immediately viewable/comparable through every existing view.

## Biology engine (per-module design)

- **`sequence.ts`**: `complement`/`reverseComplement` (full IUPAC table), `calculateGC`
  (excludes ambiguous bases from denominator), `slidingWindowGC` (O(n) running sum, not
  O(n·window)), `normalizeSequence`/`validateSequence`, circular helpers (`wrapIndex`,
  `getSubsequence` handling origin wraparound, `spansOrigin`).
- **`translation.ts`**: full 64-codon standard table, amino acid name lookup,
  `translateFrame(seq, frame, strand)` returning codons **with their own DNA coordinate
  range** — the shape cross-highlighting needs.
- **`orf.ts`**: scans 3 forward + 3 reverse frames for ATG…stop; circular topology
  scanned via extended `seq+seq` with starts capped to `[0,len)`.
- **`mutations.ts`** (highest-value module): `applyMutation` (pure), frameshift logic
  driven by `deltaLength % 3` regardless of the substitution/insertion/deletion label
  (more correct than branching on type), `shiftFeatureCoordinates`, `classifyMutation`
  handling minus-strand CDS by translating in reading order. Adds one additive 8th
  `ProteinEffect.consequence` value, `"in-frame-indel"`, for multiple-of-3 indels that
  are neither missense nor frameshift (real gap in the PRD's 7-value enum). Multi-base
  substitutions spanning the circular origin are a documented MVP limitation.
- **`restriction.ts`**: plain substring search (site + its reverse complement) over a
  curated ACGT-only enzyme dataset (no general IUPAC regex engine needed);
  `computeFragments` handles linear vs. circular (0/1/N cuts, origin wraparound).
- **`primers.ts`**: `calculateTm` — Wallace rule (`2(A+T)+4(G+C)`) for <14nt, GC-based
  formula for ≥14nt (both hand-verifiable, explainable in Explain Mode; skips
  nearest-neighbor thermodynamics as overkill). `designPrimers` returns ranked candidates
  near a target length/Tm.
- **`pcr.ts`**: forward primer matched literally; reverse primer's site found via
  `reverseComplement(reversePrimer)` search. Enumerates match pairs; 0 valid →
  `primer-not-found`/`primers-face-away`, >1 → `multiple-plausible-regions`, 1 → success.
  Exact literal matching only (no mismatch tolerance — PRD asks for "conceptual" PCR).
- **`codons.ts`**: `optimizeCodons` deterministically swaps in each organism's
  highest-frequency synonymous codon (matches PRD §35's "deterministic analysis"
  requirement — no weighted-random strategy).
- **`alignment.ts`**: Needleman-Wunsch DP diff for sequences ≤~20kb (typical plasmid
  size); a fast prefix/suffix-anchor heuristic above that, since true O(n·m) DP cannot
  meet the "hundreds of thousands of bases" requirement (PRD §35). Also diffs feature
  lists (id-based, since mutations preserve feature ids) and translated protein strings.
- **`assembly.ts`**: concatenates fragments, re-offsets features by cumulative length,
  auto-detects per-junction overlaps.
- **`explain.ts`**: small formatter module that turns the above operations' inputs/outputs
  into the step-by-step text blocks described in PRD §25.

## Parsers

- **`fasta.ts`**: multi-record capable, permissive line-endings, strict alphabet
  validation with char+line reporting (not silent dropping). Topology defaults `linear`.
- **`genbank.ts`** (highest parsing risk — dedicated phase): whitespace-tokenized LOCUS
  line (not fixed-column), line-based FEATURES state machine, location grammar support
  for `123..456`, single-base, `complement(...)`, `join(...)` (stored as
  `Feature.segments`, **not** collapsed to min/max — required for correctness on
  spliced/origin-wrapping features), fuzzy `<`/`>` (→ `Feature.partial`), `123^124`.
  `order(...)`/`one-of(...)`/cross-record refs/`gap()` explicitly unsupported — skip
  that single feature with a warning rather than failing the whole file. Qualifiers
  parsed incl. multi-line quoted values; feature `type` mapped to the PRD's 7-value union
  with the original GenBank key preserved in `qualifiers['__genbank_type']`. Hard failure
  only if no LOCUS/ORIGIN structure is found at all. 5–6 hand-authored fixture files
  (simple CDS, circular plasmid, `join()`, `complement()`, fuzzy position, one
  intentionally malformed feature) each get a dedicated Vitest case.

## Rendering strategy for large sequences (PRD §35: hundreds of thousands of bases)

- **Sequence editor**: row-virtualized via `react-window`'s `FixedSizeList` (~60–80
  bases/row) — bounded DOM node count regardless of sequence length. Selection highlight
  is a single global range clamped per-row, O(visible rows) per update.
- Expensive derived recomputation (ORF scan, multi-enzyme restriction scan) is debounced;
  raw keystroke rendering is not.
- **Linear feature map / circular plasmid view**: single SVG, coordinate-mapped
  (`x = start/length × width` or angle-based), feature-count-bound so inherently cheap.
- **GC chart**: O(n) sliding-window computation, but always rendered at a fixed sample
  count (~500–1000 points) regardless of raw length; viewport zoom triggers a finer
  recompute over just the visible sub-range.
- Dedicated performance-validation checkpoint (Phase 8) against a synthetic ~300–500kb
  sequence.

## Data: restriction enzymes & codon usage

- **28 curated enzymes** in `data/restrictionEnzymes.ts`: EcoRI, BamHI, HindIII, XhoI,
  SalI, XbaI, NcoI, NheI, SpeI, BglII, AvrII, MluI, NotI, NdeI, ClaI, HaeIII, AluI, DpnI,
  SmaI, EcoRV, PvuII, KpnI, SacI, ApaI, NsiI, PstI, plus **BsaI and BsmBI** (Type IIS,
  offset/non-symmetric cutters outside their recognition site — exercises the fragment
  math properly and ties into Golden-Gate-style assembly).
- **Codon usage tables** for *E. coli* K-12, *H. sapiens*, *S. cerevisiae* in
  `data/codonUsageTables.ts`. Real published frequency values (Kazusa CUTG or equivalent
  public table) will be looked up via WebFetch while building this module rather than
  hand-typed from memory; if a fetch is unavailable, fall back to well-established
  qualitative rank orderings (correct #1-per-amino-acid preference), since
  `optimizeCodons`'s `most-frequent` strategy only depends on rank order, not exact
  decimals — and this fallback will be clearly noted in a code comment if used.

## Execution phases (each ends with `npm run build && npm run test` + a `dev` smoke check)

Phases 1, 3, and 4 are the highest-risk items (circular coordinate math, GenBank
parsing, mutation/frameshift classification) and are sequenced early, before anything
else is built on top of them.

0. **Scaffold** — Vite+React+TS+Tailwind v4+Zustand+react-window+Vitest wired; folder
   skeleton; ESLint/Prettier; `git init` + initial commit.
1. **Foundational math** — `types/models.ts`, `sequence.ts`, `translation.ts` with
   exhaustive tests (reverse-complement round trips, GC% on known sequences, circular
   wraparound, all 64 codons, multi-frame translation). Hard gate before continuing.
2. **ORFs, FASTA, shell** — `orf.ts`, `fasta.ts`, both stores (minimal), 3-pane IDE
   layout (PRD §20), virtualized `SequenceEditor` built with `react-window` from the start.
3. **GenBank parser** — full location grammar, fixture-driven tests, first real SVG
   (`LinearFeatureMap`). Hard go/no-go gate: real multi-feature files must render at
   correct positions before mutation work begins.
4. **Mutation engine + cross-highlighting** — `mutations.ts` full classification,
   fork-once store model, `useCrossHighlight`, `TranslationView`. Table-driven tests
   across every consequence category, indel lengths 1–6, minus-strand CDS, origin-
   spanning features.
5. **Restriction sites, GC chart, circular map** — enzyme dataset, `restriction.ts`,
   `GCTrack`, `CircularPlasmidView`, `RestrictionView`; BsaI offset-cutter and circular
   wraparound fragment tests.
6. **Primers, PCR, Compare/Diff** — `primers.ts`, `pcr.ts`, `alignment.ts`, `PCRView`,
   `CompareView`. Tests: Tm known values, all 4 PCR error states, alignment correctness
   at both size regimes.
7. **Assembly, codon optimization, examples, Explain Mode** — `assembly.ts`,
   `codons.ts` (+ real codon-usage data), 3 hand-authored example GenBank constructs
   (minimal CDS, GFP construct, educational plasmid — also a regression test of the
   Phase 3 parser), `AssemblyView`, `explain.ts` + `ExplainBlock` wiring throughout.
8. **Performance validation + polish** — synthetic 300–500kb sequence exercised through
   parsing/restriction-scan/ORF-scan/editor responsiveness; lint/format/`tsc --noEmit`
   clean; README; manually run the full PRD §39 demo script end-to-end.

## Verification

- After every phase: `npm run build`, `npm run test` (Vitest), and a manual `npm run dev`
  check of the feature just added.
- Biology engine correctness leans on hand-verified unit fixtures (standard codon table,
  known GC%/Tm values, hand-traced restriction fragments) rather than an external
  reference implementation, per the no-backend decision.
- Final acceptance = PRD §40's 16-point Definition of Done, exercised live via the §39
  demo script (load plasmid → inspect → translate → mutate → compare → restriction
  sites → primers → PCR → assemble → inspect final plasmid → codon-optimize).
