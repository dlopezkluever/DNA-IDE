# Command Palette & Mutation Heatmap — Spec & Implementation Plan

Status: proposed, not yet built. Source: `next_steps.md` (Tier 1, both named as the top two
picks) and `DNA-IDE-PRD.md` §37 (Stretch Features), where both are formally specified. This doc
grounds those two paragraphs in the actual codebase — real file paths, real function signatures,
real gaps — so implementation can start directly from here.

Product name used throughout the UI is **Helix IDE** (`TopBar.tsx`), not "DNA-IDE" — the repo
folder name is just where it lives on disk. This doc uses "Helix IDE."

Both features are explicitly additive: no existing view, store shape, or exported function
signature changes in a breaking way. Two small, behavior-preserving refactors are called out
below (§1.2 Mutation Heatmap, §1.1 Command Palette) because without them one feature would be
either slow or cosmetically incomplete — both are flagged with exact before/after code.

---

## 0. Shared groundwork

Both features sit on top of the same conventions; read this once before either section.

- **No router.** View switching is `useUIStore((s) => s.activeView)` (`ViewId` union) +
  `setActiveView`, read in `src/components/layout/Shell.tsx:25-32` as a plain conditional-render
  block. "Jump to a tab" is always just `useUIStore.getState().setActiveView(id)`.
- **Coordinates are 0-based, half-open `[start, end)`** everywhere in `src/biology` and the
  stores (`src/types/models.ts:1-5`). Only display components convert to GenBank's 1-based
  inclusive convention via `toDisplayPosition`/`fromDisplayPosition` (`src/biology/sequence.ts`).
- **Selection is global, not per-view**, in `uiStore.ts`: `selection: {start, end, strand?} | null`,
  `activeFeatureId`, `activeMutationId`, `hoveredCodon`. Every view reads/writes these through
  one hook, `src/hooks/useCrossHighlight.ts` (`selectRange`, `selectFeature`, `selectMutation`,
  `selectCodon`) — both new features should drive selection through this hook, not by writing to
  `uiStore` fields directly, so they participate in PRD §34 cross-highlighting for free.
- **State**: Zustand 5, two stores (`useUIStore`, `useConstructStore`), no Context providers, no
  Redux. `uiStore` persists only `explainMode` and `enabledEnzymeIds` to `localStorage`
  (`uiStore.ts:84-90`, `partialize` whitelist) — any new transient UI state (palette open/closed,
  a heatmap's selected CDS) should **not** be added to that whitelist.
- **Styling**: Tailwind v4, CSS-first theme in `src/index.css`, no component library. Canonical
  tokens: `--color-bg-canvas/surface/elevated/hover`, `--color-border/border-strong`,
  `--color-text-primary/secondary/muted`, `--color-accent` (#4ade80, green) /
  `--color-accent-dim` / `--color-accent-fg`, `--color-warn` (amber) / `--color-danger` (red) /
  `--color-info` (blue), and nucleotide colors `--color-base-a/t/g/c`. Canonical button classes:
  `rounded border px-2 py-1 font-mono text-xs`, toggled between an inactive variant
  (`border-(--color-border-strong) text-(--color-text-secondary) hover:border-(--color-text-muted)`)
  and an active variant (`border-(--color-accent-dim) bg-(--color-accent-dim) text-(--color-accent)`)
  — see `TopBar.tsx`'s Explain toggle or `ORFList.tsx`'s min-length buttons.
- **No modal/overlay precedent exists anywhere in the app today** (no `Modal`, `Dialog`, `z-50`,
  `backdrop`, `<dialog>` — grepped, zero hits). The Command Palette is the first overlay UI in
  the codebase. There is also **no global keyboard shortcut listener** today — the only
  `onKeyDown` in the app is local to `SequenceView.tsx` for A/T/G/C base-typing. The palette will
  add the app's first `window.addEventListener('keydown', ...)`.
- **Rendering for spatial/"map" visualizations is raw inline SVG**, no charting library
  (`GCTrack.tsx`, `LinearFeatureMap.tsx`, `CircularPlasmidView.tsx`) — `viewBox` + `w-full` for
  responsive scaling, `var(--color-*)` for fill/stroke, native `<title>` for tooltips, click
  handlers wired to `useCrossHighlight`. The Mutation Heatmap should follow this exact pattern.
  There is no `<canvas>` usage anywhere in the app.
- **Testing**: Vitest, `environment: 'node'` (`vite.config.ts`) — only `src/biology`,
  `src/parsers`, `src/store`, `src/utils` are unit-tested; there is **no component/UI test
  harness** (`@testing-library/react` isn't installed). New pure logic (fuzzy matcher, command
  registry, heatmap computation) should be framework-free so it fits this convention; new React
  components will be manually QA'd, not unit-tested — see §4 for a manual checklist.
- **Consequence color/label convention already exists** — don't invent a new palette. It lives in
  two places today and should become the shared source both existing and new UI import from:
  - `src/components/mutations/MutationList.tsx:7-16` — `CONSEQUENCE_COLOR: Record<string, string>`
    (Tailwind **text** classes): `synonymous` → muted gray (`text-(--color-text-secondary)`,
    deliberately *not* accent green — "no visible change" reads as neutral, not "good"),
    `missense`/`in-frame-indel` → `text-(--color-warn)`, `nonsense`/`frameshift`/`start-loss`/
    `stop-loss` → `text-(--color-danger)`, `noncoding` → `text-(--color-text-muted)`.
  - `src/utils/format.ts:4-17` — `consequenceLabel(consequence)`, e.g. `'start-loss'` → `"Start-loss"`.

---

## 1. Mutation Heatmap

> "For any selected CDS, compute all three possible substitutions at every position … and
> classify each one with the already-built `classifyMutation` engine, then render it as a
> color-coded grid: rows = the 4 possible bases, columns = position, color = consequence."
> — `next_steps.md`

**Recommendation: build this one first.** It's fully self-contained inside an existing tab (no
new global UI pattern, unlike the palette's overlay+keyboard-listener), and once it exists the
Command Palette's v1 command list can include `> Mutation heatmap` for free (§2.2).

### 1.1 Why not literally "a `for` loop wrapping `mutations.ts`" as written

`classifyMutation(cdsFeature, seqBefore, seqAfter, edit)` (`src/biology/mutations.ts:110-171`) is
priced for single, occasional, user-initiated edits — it takes whole-construct `seqBefore`/
`seqAfter` strings and internally calls `extractReadingSequence(feature, seq)` (mutations.ts:74-80),
which does `getFeaturePieces(...).map(p => seq.slice(p.start, p.end))` — **O(CDS length) work per
call**, because building `seqAfter` and re-slicing it happens fresh every time.

A heatmap needs `3 × CDS_length` calls (3 alternate bases at every position). Calling
`classifyMutation` naively in a loop is therefore **O(CDS_length²)**: for a 3,000 bp CDS that's
~9,000,000 constant-factor string/array operations — noticeably slow (hundreds of ms to seconds
in a browser tab, and it re-runs on every render unless memoized); for a large gene (10 kb+) it
gets rough. This is worth fixing before shipping, not after — the fix is small.

**The fix**: everything the heatmap needs — the reference codon, its plus-strand position, and
the resulting amino acid — is already computable in O(CDS length) *total* via
`translateFeature`, without ever touching the whole-construct string. Refactor
`classifyMutation`'s substitution branch into a standalone O(1)-per-call helper, and have the
heatmap call that directly.

**Step A — extract `classifySubstitutionAtCodon`** (pure refactor, `src/biology/mutations.ts`,
zero behavior change — the existing `mutations.test.ts` suite must still pass unmodified):

```ts
// NEW — extracted verbatim from classifyMutation's substitution branch (current lines 153-170)
function classifySubstitutionAtCodon(
  codonBefore: string,
  codonAfter: string,
  codonIndex: number,
): ProteinEffect {
  const aminoAcidBefore = translateCodon(codonBefore)
  const aminoAcidAfter = translateCodon(codonAfter)
  const aminoAcidPosition = codonIndex + 1
  const base = { codonBefore, codonAfter, aminoAcidBefore, aminoAcidAfter, aminoAcidPosition }

  if (codonIndex === 0 && isStartCodon(codonBefore) && !isStartCodon(codonAfter)) {
    return { ...base, consequence: 'start-loss' }
  }
  if (aminoAcidBefore === '*' && aminoAcidAfter !== '*') {
    return { ...base, consequence: 'stop-loss' }
  }
  if (aminoAcidBefore !== '*' && aminoAcidAfter === '*') {
    return { ...base, consequence: 'nonsense' }
  }
  if (aminoAcidBefore === aminoAcidAfter) {
    return { ...base, consequence: 'synonymous' }
  }
  return { ...base, consequence: 'missense' }
}
```

`classifyMutation`'s body (current lines 144-171) shrinks to call it after computing
`codonBefore`/`codonAfter` exactly as today:

```ts
  const relPos = readingRelativePosition(cdsFeature, edit.position, seqBefore.length)
  if (relPos === null) return { consequence: 'noncoding' }

  const codonIndex = Math.floor(relPos / 3)
  const codonStart = codonIndex * 3
  const codonBefore = cdsBefore.slice(codonStart, codonStart + 3)
  const codonAfter = cdsAfter.slice(codonStart, codonStart + 3)
  if (codonBefore.length < 3 || codonAfter.length < 3) return { consequence: 'noncoding' }

  return classifySubstitutionAtCodon(codonBefore, codonAfter, codonIndex)
```

**Step B — export `readingBasesWithCoords`** (`src/biology/translation.ts:175`): currently a
private helper (`function readingBasesWithCoords(...)`, not `export function`) that already
computes exactly what the heatmap needs — reading-direction bases paired with their plus-strand
genomic position, strand- and splice-aware. Change the one keyword: `function` → `export
function`. No logic change. (This is also the function `translateFeature` itself is built on top
of, at `translation.ts:200-215` — the heatmap will use both `translateFeature`, unchanged, and
this newly-exported helper, side by side.)

**Step C — new `computeMutationHeatmap`** (`src/biology/mutations.ts`, new exported function):

```ts
export type HeatmapBase = 'A' | 'T' | 'G' | 'C'
const ALL_BASES: HeatmapBase[] = ['A', 'T', 'G', 'C']

export interface MutationHeatmapCell {
  codonIndex: number
  positionInCodon: 0 | 1 | 2
  /** Plus-strand genomic coordinate of this nucleotide (for cross-highlighting). */
  genomicPosition: number
  referenceBase: HeatmapBase
  alternateBase: HeatmapBase
  effect: ProteinEffect
}

export interface MutationHeatmapResult {
  cdsLength: number
  aminoAcidLength: number
  cells: MutationHeatmapCell[] // length === cdsLength * 3 (ref-base "row" is never a cell)
}

export function computeMutationHeatmap(cdsFeature: Feature, sequence: string): MutationHeatmapResult {
  const codons = translateFeature(cdsFeature, sequence) // O(N), already exists/tested
  const bases = readingBasesWithCoords(cdsFeature, sequence) // O(N), newly exported
  const cells: MutationHeatmapCell[] = []

  codons.forEach((codon, codonIndex) => {
    for (let p = 0; p < 3; p++) {
      const baseInfo = bases[codonIndex * 3 + p]
      if (!baseInfo) continue
      const referenceBase = baseInfo.base.toUpperCase() as HeatmapBase
      for (const alternateBase of ALL_BASES) {
        if (alternateBase === referenceBase) continue
        const mutatedCodon = codon.seq.slice(0, p) + alternateBase + codon.seq.slice(p + 1)
        const effect = classifySubstitutionAtCodon(codon.seq, mutatedCodon, codonIndex)
        cells.push({
          codonIndex,
          positionInCodon: p as 0 | 1 | 2,
          genomicPosition: baseInfo.pos,
          referenceBase,
          alternateBase,
          effect,
        })
      }
    }
  })

  const aminoAcidLength = codons.filter((c) => c.aa !== '*').length
  return { cdsLength: bases.length, aminoAcidLength, cells }
}
```

`classifySubstitutionAtCodon` needs to be reachable from this function — since it's defined in
the same file (`mutations.ts`), no export change is needed for that helper; keep it
module-private.

**Result**: total cost is O(CDS length) — one pass to build `codons`/`bases`, one pass of
`3 × CDS_length` O(1) classifications. For a 3,000 bp CDS that's ~3,000 cheap iterations instead
of ~9,000,000 — sub-millisecond instead of potentially hundreds of ms. **No virtualization or
canvas fallback is needed for compute time** with this design; §1.3 still discusses SVG node
count as a separate (much smaller) concern.

**Correctness property worth stating explicitly in the PR description**: because this reuses
`translateFeature`/`readingBasesWithCoords` rather than reimplementing strand/splice/origin-wrap
handling, a spliced or minus-strand CDS is handled identically to how the Protein tab already
handles it — no new biology, no new edge cases to hand-test.

**Note on possible consequence values**: because the heatmap only ever performs single-base
substitutions strictly inside a CDS's reading frame, `frameshift`, `in-frame-indel`, and
`noncoding` — three of the eight `Consequence` values — can never appear in heatmap output. Only
`synonymous`, `missense`, `nonsense`, `start-loss` (only possible at `codonIndex === 0`), and
`stop-loss` (only possible at the last codon, if it's a stop) occur. Worth a one-line comment on
`computeMutationHeatmap` noting this, since it's not obvious from the return type alone.

### 1.2 Data flow / where it lives

Reuse the existing selection pattern (`Inspector.tsx`, `CDSTranslationBlock.tsx`):
`useUIStore((s) => s.activeFeatureId)` combined with
`useConstructStore`'s active construct's `features.find(f => f.id === activeFeatureId && f.type === 'CDS')`.

**Placement: the Mutations tab** (`src/views/MutationsView.tsx`), as a new collapsible section
*above* the existing `MutationForm`/`MutationList`. Rationale: the tab is literally named
"Mutations," and the heatmap is exploratory ("what mutations are possible") rather than a record
of applied edits ("what mutations happened") — keeping both in one tab under clearly distinct
headings avoids inventing a second navigation destination for closely related content. (Protein
tab is a reasonable alternative given the codon-optimization tie-in mentioned in the source
paragraph — noted as an open decision in §1.6, not a blocker.)

`MutationsView.tsx` currently renders unconditionally once a construct is loaded (no per-CDS
concept at all — `MutationForm`/`MutationList` operate on the whole construct). The new section
needs its own CDS selection:
- 0 CDS features on the construct → don't render the section (or render a muted one-liner:
  "No CDS features to explore mutations for.").
2. 1 CDS feature → auto-select it, no picker shown.
- 2+ CDS features → a `<select>` styled like `CompareView.tsx`'s construct picker
  (`rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-2 py-1 …`).

### 1.3 Component design

New file: `src/components/mutations/MutationHeatmap.tsx`.

```
┌─ Mutation Heatmap ▾ ───────────────────────────────────────────────┐
│ CDS: [ gfp ▾ ]      62% synonymous · 31% missense · 7% nonsense    │
│                                                                     │
│  A  ░░▓░░░░▓░░░░░░▓▓░░░░░▓░░░ …   (scrolls horizontally)           │
│  T  ▓░░░▓▓░░▓▓▓░░░░░▓▓▓░░▓▓░ …                                     │
│  G  ░▓▓░░░▓░░░░▓▓░░░▓░░▓░░░▓ …                                     │
│  C  ░░░▓░░░░▓░░░░░░░░▓░░░░░░ …                                     │
│      1   5   10   15   20   …  (position ruler, nt, matches        │
│                                  toDisplayPosition convention)     │
│                                                                     │
│  ■ synonymous  ■ missense  ■ nonsense  ■ start/stop-loss           │
│  Selected: pos 47, C→T — GAC→GAT (Asp47Asp, synonymous)            │
└─────────────────────────────────────────────────────────────────---┘
```

- **Layout**: SVG, `viewBox="0 0 {cdsLength * CELL_W} {4 * CELL_H}"`, `className="w-full"` inside
  an `overflow-x-auto` wrapper div — same responsive/scroll idiom as `GCTrack`/`LinearFeatureMap`.
  Suggested `CELL_W = 6`, `CELL_H = 16` (tune after eyeballing a real construct).
- **Rows**: fixed order A, T, G, C (matches `--color-base-a/t/g/c` token order in `index.css`).
  Row label text at the left edge (small `<text>`, matches ruler-label styling in
  `LinearFeatureMap.tsx`).
- **Columns**: one per nucleotide position in the CDS reading frame, `cdsLength` total (not
  per-codon — matches "columns = position" from the source spec literally).
- **Cells**: for each `(row, column)`, if `row === referenceBase` at that column, render a muted
  "not applicable" cell (`fill="var(--color-bg-hover)"`, no click handler) — that's the base
  that's already there, not a mutation. Otherwise render a `<rect fill={colorFor(cell.effect.consequence)}>`
  sized `CELL_W × CELL_H`, wrapped in a native `<title>` tooltip:
  `"pos {display position}: {ref}→{alt} — {codonBefore}→{codonAfter} ({aaBefore}{pos}{aaAfter}) — {label}"`
  (reuses `formatProteinChange`-style formatting and `consequenceLabel` from `src/utils/format.ts`
  — matches the PRD §14 canonical report format: Position / DNA / Codon / Protein / Type).
- **Color mapping**: reuse the *existing* consequence semantics (§0), lifted out of
  `MutationList.tsx` into a small shared module both files import from —
  `src/utils/consequenceColors.ts`:
  ```ts
  export const CONSEQUENCE_FILL: Record<Consequence, string> = {
    synonymous: 'var(--color-text-secondary)',
    missense: 'var(--color-warn)',
    nonsense: 'var(--color-danger)',
    frameshift: 'var(--color-danger)',      // unreachable from the heatmap, kept for completeness
    noncoding: 'var(--color-text-muted)',   // unreachable from the heatmap
    'start-loss': 'var(--color-info)',
    'stop-loss': 'var(--color-info)',
    'in-frame-indel': 'var(--color-warn)',  // unreachable from the heatmap
  }
  ```
  Note this *adds* a new distinction not present in `MutationList.tsx` today: that component
  currently maps `start-loss`/`stop-loss` to red (same as `nonsense`); this spec proposes giving
  them blue (`--color-info`, currently unused anywhere in the app) instead, since visually
  distinguishing "boundary disrupted" from "premature stop mid-gene" is exactly the kind of
  at-a-glance signal the heatmap exists to provide, and blue is sitting unused in the palette.
  **If consistency with `MutationList.tsx` matters more than this distinction, keep all four
  "bad" categories red** — flagged as an open decision in §1.6, not a blocker either way.
  `MutationList.tsx`'s existing `CONSEQUENCE_COLOR` (text-class version) should re-import its
  color choices from this same module (as Tailwind arbitrary-value classes,
  e.g. `` `text-[${CONSEQUENCE_FILL[c]}]` `` isn't valid Tailwind syntax for CSS vars — instead
  keep two small parallel maps, fill (for SVG) and text-class (for existing usage), both sourced
  from one `Consequence → semantic role` mapping so a future palette change only happens in one
  place conceptually, even if the literal Tailwind class strings must stay separate.
- **Summary stat line**: cheap `cells.reduce` over the same data — `% synonymous`, `% missense`,
  `% nonsense` (skip start/stop-loss in the headline stat, they're rare and their % is noisy) —
  this is the "third-codon-position mutations are overwhelmingly synonymous" payoff made
  literally visible as a number, not just a color pattern.
- **Interaction**: `onClick` on a cell → `selectRange(genomicPosition, genomicPosition + 1)` via
  `useCrossHighlight()` — jumps/highlights the base in the Sequence view exactly like every other
  clickable element in the app. Also keep the clicked cell's detail in a small persistent text
  line below the grid (not just the SVG `<title>` hover tooltip, which is easy to miss and not
  keyboard-navigable) — store the "selected cell" in local component `useState`, not global state
  (it's presentational, scoped to this one panel).
- **Collapsed by default** (`useState(false)`, same pattern as `ORFList.tsx`) since computing +
  rendering thousands of cells for every CDS on every construct load is wasted work if the user
  never opens it — gate the `computeMutationHeatmap` call behind `open` with `useMemo`, exactly
  like `ORFList` gates `findORFs` behind its own `open` state (`ORFList.tsx:14-17`).

**DOM node count**: `cells.length = cdsLength × 3` (3 alternates per position, not 4 — the
reference-base cell isn't a `<rect>` with a click handler, though it can still render as a plain
background rect for visual continuity). A 3,000 bp CDS → ~9,000 `<rect>` elements. This is in the
same order of magnitude as `LinearFeatureMap`'s existing rect-per-feature rendering, just with
more instances — expected to render fine in practice, but **benchmark against the largest
example construct plus a synthetic large CDS (e.g. a 10 kb ORF) during implementation** (see
§1.5 step 6). If it's ever janky, the fix is display-only (windowed rendering of visible columns
via `react-window`'s horizontal capability, already a dependency, or downsampling like
`GCTrack`'s `TARGET_SAMPLES` pattern) — the compute-side fix from §1.1 already handles the actual
performance-critical part.

### 1.4 Files to add / change

| File | Change |
|---|---|
| `src/biology/translation.ts:175` | Export `readingBasesWithCoords` (add `export` keyword; no logic change) |
| `src/biology/mutations.ts` | Extract `classifySubstitutionAtCodon` (private); add `computeMutationHeatmap`, `MutationHeatmapCell`, `MutationHeatmapResult`, `HeatmapBase` (all exported) |
| `src/biology/mutations.test.ts` | New `describe('computeMutationHeatmap', ...)` block; confirm existing `classifyMutation` tests pass unmodified after the refactor |
| `src/utils/consequenceColors.ts` | New — shared consequence→color source of truth |
| `src/components/mutations/MutationList.tsx` | Re-point `CONSEQUENCE_COLOR` at the new shared module (no visual change unless the start/stop-loss color decision in §1.3 is taken) |
| `src/components/mutations/MutationHeatmap.tsx` | New — the panel described in §1.3 |
| `src/views/MutationsView.tsx` | Render `<MutationHeatmap />` above `<MutationForm />` |

### 1.5 Implementation checklist (est. 1–1.5 days)

1. Refactor `classifyMutation` → extract `classifySubstitutionAtCodon`. Run `npm test` — the
   entire existing `mutations.test.ts` suite (334 lines, plus-strand/indel/minus-strand `describe`
   blocks) must pass with zero changes. This is the safety net for the refactor.
2. Export `readingBasesWithCoords` from `translation.ts`.
3. Implement `computeMutationHeatmap` in `mutations.ts`. Write new tests in `mutations.test.ts`
   following the existing fixture style (literal `ATGGAATTTTGA`-style DNA strings): assert
   `cells.length === cdsLength * 3`; assert a mutation at codon-0 position-0 that breaks `ATG`
   produces `start-loss`; assert a mutation at the final codon that breaks a stop codon produces
   `stop-loss`; assert third-codon-position wobble positions (e.g. using a GC-rich fixture with
   known synonymous codon families) are majority-`synonymous` as a sanity/regression check tying
   directly to the feature's stated payoff.
4. Build `src/utils/consequenceColors.ts`; re-point `MutationList.tsx` at it (should be a
   no-behavior-change refactor unless the start/stop-loss color decision is taken — verify by
   eyeballing the Mutations tab before/after).
5. Build `MutationHeatmap.tsx` per §1.3; wire into `MutationsView.tsx`.
6. Manual QA (§4): open on a small example construct (fast plasmid, few hundred bp CDS) and on
   the largest example construct's biggest CDS; confirm the summary stat "feels right" against a
   known-degenerate region (e.g. eyeball a few synonymous-heavy 3rd-codon-position columns);
   confirm click → Sequence-view highlight works; confirm Explain Mode doesn't need special
   handling (it doesn't — this panel has no `ExplainBlock` integration in v1, since there's no
   single "operation" to narrate the way RC/translation/single-mutation have — could be a v2 if
   wanted, not required).
7. If step 6 shows real jank on the largest CDS, revisit the DOM-node-count fallback noted in §1.3
   before shipping; otherwise ship as-is.

### 1.6 Open decisions (confirm before/while building — not blockers)

- Placement: Mutations tab (recommended, §1.2) vs. Protein tab (stronger thematic tie to codon
  optimization, but Protein tab is already the most crowded view — ORF list + N × CDS translation
  blocks each with their own codon-optimization panel).
- start-loss/stop-loss color: new blue (`--color-info`, distinct signal) vs. matching
  `MutationList.tsx`'s existing red (full consistency with the one other place consequences are
  colored today).
- Whether to also show the heatmap for a feature selected via `activeFeatureId` regardless of
  which tab set it (e.g. clicking a CDS in the Map view could pre-select it here) — nice-to-have,
  not required for v1 since the CDS `<select>` covers the common case.

---

## 2. Command Palette

> "A `Cmd+K` overlay: type `> translate selection`, `> reverse complement`, `> find ORFs`,
> `> show restriction sites`, `> compare with...` and it runs the action and/or jumps to the
> right tab with the right selection already applied." — `next_steps.md`

### 2.1 What's genuinely a thin dispatch layer, and what isn't

Three of the six example commands are, in fact, exactly "jump to a tab" with no wrinkle, because
their target views render unconditionally from store state with no local collapse/toggle gate in
the way:

| Command | Target already store-driven? | Wrinkle |
|---|---|---|
| `> Show restriction sites` | Yes — `RestrictionView.tsx` renders the cut-site table from `enabledEnzymeIds` (store) with no local toggle. | None. |
| `> Calculate GC` | Yes — `MapView.tsx` always renders `GCTrack`. | None. |
| `> Compare with…` | Yes — `compareConstructId` already lives in `constructStore`, not local state (`CompareView.tsx:69-70`). | None — palette can call `setCompareConstruct(id)` directly. |

Two of them need a **small, explicit refactor** first, because the relevant piece of UI is
gated behind a component-local `useState` the palette has no way to reach:

| Command | Gate | Fix |
|---|---|---|
| `> Reverse complement` | `SequenceToolbar.tsx:32` — `const [showRC, setShowRC] = useState(false)`; the RC preview only renders when `showRC && selectedSeq` (line 71/74). Palette navigating to the Sequence tab alone does **not** show anything unless the user also has a selection *and* clicks the existing button. | Lift `showRC` into `uiStore` (e.g. `rcPreviewOpen: boolean`, `setRcPreviewOpen`) so both the toolbar's own button and the palette command can drive it. Small, mechanical change — `SequenceToolbar.tsx` swaps its `useState` call for the store field/setter, JSX unchanged. |
| `> Find ORFs` | `ORFList.tsx:10` — `const [open, setOpen] = useState(false)`, collapsed by default; `findORFs` only runs when `open` (line 15). | Same pattern: lift `open` into `uiStore` (e.g. `orfListOpen: boolean`). |

`> Translate selection` needs one more piece of logic, not a refactor: "the selection" must
resolve to a specific CDS `Feature` before the palette can call `selectFeature(cds)` (which is
what actually drives `CDSTranslationBlock.tsx`'s highlighted-codon display via
`useCrossHighlight`). Resolution order, in a new pure helper `resolveTargetCDS`:
1. If `activeFeatureId` is already set and refers to a CDS → use it.
2. Else if there's a range `selection` → find the first CDS feature whose range overlaps it.
3. Else if the construct has exactly one CDS → use it (matches `ProteinView.tsx`'s own
   single/multi-CDS handling).
4. Else → command is shown but disabled, with a tooltip explaining why (see §2.5).

This resolved feature is also what should be scrolled into view: give each
`CDSTranslationBlock` a DOM id (`id={`cds-${feature.id}`}`) and, after `setActiveView('protein')`,
call `document.getElementById(...)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on
a `requestAnimationFrame` (the Protein view needs to mount first).

### 2.2 v1 command set

Beyond the six PRD examples, add the eight tab-navigation commands (free, since `ViewTabs.tsx`
already has the canonical `{id, label}` list to iterate over) and an Explain Mode toggle (trivial,
already store-driven). Once §1 ships, add a Mutation Heatmap entry too.

| Palette text | Category | Precondition | Action |
|---|---|---|---|
| `Go to Sequence` / `Map` / `Protein` / `Mutations` / `Restriction` / `PCR` / `Compare` / `Assembly` | Navigate | always available | `setActiveView(id)` — generated by mapping over `ViewTabs.tsx`'s existing `TABS` array, not hand-duplicated |
| `Translate selection` | Run | active construct, resolvable CDS (§2.1) | resolve CDS → `selectFeature(cds)` + `setActiveView('protein')` + scroll into view |
| `Reverse complement` | Run | active construct, non-empty `selection` | `setActiveView('sequence')`; `setRcPreviewOpen(true)` (post store-lift) |
| `Find ORFs` | Run | active construct | `setActiveView('protein')`; `setOrfListOpen(true)` (post store-lift) |
| `Calculate GC` | Run | active construct | `setActiveView('map')` |
| `Show restriction sites` | Run | active construct | `setActiveView('restriction')` |
| `Compare with…` | Run (sub-command) | 2+ constructs loaded | opens a second palette "mode" listing other constructs by name (§2.4); picking one calls `setCompareConstruct(id)` + `setActiveView('compare')` |
| `Toggle Explain Mode` | Toggle | always | `toggleExplainMode()` |
| *(after §1 ships)* `Mutation heatmap` | Run | active construct has ≥1 CDS | `setActiveView('mutations')`; expand the heatmap section |

Not included in v1, and why: feature-name search / motif search (mentioned in PRD §9 as intended
scope for the search box, but **not actually implemented today** — only exact nucleotide-sequence
search exists in `SequenceToolbar.tsx`; teaching the palette to jump to "the *lacZ* feature" would
require building that search capability first, which is out of scope here). `> checkout v2`
(Construct History doesn't exist yet — `next_steps.md` itself notes this as a natural *future*
pairing, not a v1 requirement).

### 2.3 Architecture

New state in `uiStore.ts` (not persisted — omit from `partialize`):
```ts
isPaletteOpen: boolean
setPaletteOpen: (open: boolean) => void
rcPreviewOpen: boolean       // lifted from SequenceToolbar's local useState
setRcPreviewOpen: (open: boolean) => void
orfListOpen: boolean         // lifted from ORFList's local useState
setOrfListOpen: (open: boolean) => void
```

New files:
- **`src/commands/types.ts`** — `CommandContext` (the live values/setters a command needs:
  `activeView`, `setActiveView`, `selection`, `activeFeatureId`, `selectFeature`, `selectRange`,
  `activeConstruct: Construct | null`, `constructs: Construct[]`, `setCompareConstruct`,
  `toggleExplainMode`, `setRcPreviewOpen`, `setOrfListOpen`) and `CommandDef`
  (`{ id: string; label: string; category: 'navigate' | 'run' | 'toggle'; run: () => void; enabled: boolean; disabledReason?: string }`).
- **`src/commands/registry.ts`** — pure, framework-free function
  `buildCommands(ctx: CommandContext): CommandDef[]`, plus `resolveTargetCDS(ctx)` from §2.1 and
  a fuzzy matcher `fuzzyScore(query: string, target: string): number | null` (case-insensitive
  subsequence match: every character of `query` must appear in `target` in order, possibly with
  gaps; score = fewer/tighter gaps and earlier match position rank higher, `null` if no match at
  all — a simplified version of VS Code's own palette-matching heuristic, small enough to hand-write
  and unit test directly rather than pulling in a fuzzy-search dependency). This is the
  **testable seam**: `registry.test.ts` can construct a fake `CommandContext` with `vi.fn()` spies
  and assert e.g. "given a context with no active construct, only navigate commands are enabled"
  or "`Reverse complement` calls `setActiveView('sequence')` and `setRcPreviewOpen(true)`."
- **`src/components/palette/CommandPalette.tsx`** — the overlay itself: a fixed-position
  backdrop + centered panel (`bg-(--color-bg-elevated)`, `border-(--color-border-strong)`,
  following the PRD's own `>` prompt convention — literally render `>` as a fixed prefix glyph
  before the `<input>`, echoing VS Code's command-mode prefix and the PRD's own example command
  strings). Local component state: `query: string`, `highlightedIndex: number`, and (for the
  `Compare with…` sub-flow) `mode: 'root' | 'compare-target'`. Builds the live `CommandContext`
  from hooks (`useUIStore`, `useConstructStore`, `useCrossHighlight`), memoizes
  `buildCommands(ctx)`, filters/scores by `query` via `fuzzyScore`, renders the sorted list.
  Keyboard: `ArrowUp`/`ArrowDown` move `highlightedIndex` (clamped/wrapped), `Enter` runs the
  highlighted command's `run()` and closes, `Escape` closes without running.
- **Global shortcut listener** — add to `Shell.tsx` (simplest place, already the one file that
  owns top-level layout) via a `useEffect`: `window.addEventListener('keydown', handler)` where
  `handler` checks `(e.metaKey || e.ctrlKey) && e.key === 'k'`, calls `e.preventDefault()`, and
  toggles `isPaletteOpen`. Also handle `Escape` here (or inside `CommandPalette` itself once
  open — either works; keep it inside the palette component so the listener only exists while
  open, avoiding a second always-mounted global listener).

### 2.4 The `Compare with…` sub-command flow

Deliberately simple for v1: not a generic multi-step command stack, just one extra local state
value (`mode: 'root' | 'compare-target'`). Selecting `Compare with…` from the root list doesn't
run a command — it sets `mode = 'compare-target'`, which swaps the palette's list to
`otherConstructs.map(c => ({ id: c.id, label: c.name }))` (same `Object.values(constructs).filter(...)`
logic already in `CompareView.tsx:77`) while keeping the overlay open and the input focused.
Picking one of those calls `setCompareConstruct(id)` + `setActiveView('compare')` and closes.
`Escape` in this mode returns to `mode = 'root'` rather than closing outright (one more `Escape`
closes fully) — small, expected palette UX, not a new architectural pattern.

### 2.5 Disabled/empty states

- No construct loaded at all → only a static hint row ("Import a FASTA or GenBank file to begin"),
  matching the tone of `ViewPlaceholder` used everywhere else in the app; navigate commands can
  still be listed (switching to an empty tab is harmless) but Run commands should be hidden
  entirely rather than shown-disabled, to keep the empty-state list short and non-confusing.
- `Translate selection` with no resolvable CDS (§2.1 step 4) → **show but disable**, with
  `disabledReason` rendered as muted trailing text ("no CDS in this construct") — this is more
  informative than hiding it, since a first-time user typing "translate" should learn *why*
  nothing happens rather than finding no results at all.
- `Reverse complement` with no `selection` → same disabled-with-reason treatment
  ("select a sequence range first").

### 2.6 Explain Mode interaction

No special-casing needed. Every affected view already conditionally renders its own
`ExplainBlock` based on `useUIStore((s) => s.explainMode)` (`SequenceToolbar.tsx`,
`CDSTranslationBlock.tsx`). Since palette commands only ever call existing setters
(`setActiveView`, `selectFeature`, `setRcPreviewOpen`, …), Explain Mode's existing behavior is
inherited automatically — worth one line in the PR description, not any code.

### 2.7 Files to add / change

| File | Change |
|---|---|
| `src/store/uiStore.ts` | Add `isPaletteOpen`/`setPaletteOpen`, `rcPreviewOpen`/`setRcPreviewOpen`, `orfListOpen`/`setOrfListOpen` (all excluded from `partialize`) |
| `src/components/sequence/SequenceToolbar.tsx` | Replace local `useState` for `showRC` with the lifted `uiStore` field |
| `src/components/protein/ORFList.tsx` | Replace local `useState` for `open` with the lifted `uiStore` field |
| `src/commands/types.ts` | New — `CommandContext`, `CommandDef` |
| `src/commands/registry.ts` | New — `buildCommands`, `resolveTargetCDS`, `fuzzyScore` |
| `src/commands/registry.test.ts` | New — fuzzy matcher + command-list construction tests |
| `src/components/palette/CommandPalette.tsx` | New — overlay UI |
| `src/components/layout/Shell.tsx` | Add global `Ctrl/Cmd+K` listener; render `<CommandPalette />` |
| `src/components/protein/CDSTranslationBlock.tsx` | Add `id={`cds-${feature.id}`}` for scroll-into-view targeting |

### 2.8 Implementation checklist (est. 1–2 days, per `next_steps.md`'s own timebox)

**Day 1**
1. Lift `rcPreviewOpen` and `orfListOpen` into `uiStore`; update `SequenceToolbar.tsx`/`ORFList.tsx`.
   Manually verify both toggles still work exactly as before (this is a refactor, not a feature —
   should be visually invisible).
2. Build `src/commands/types.ts` + `registry.ts` (`fuzzyScore`, `resolveTargetCDS`,
   `buildCommands`) as pure functions. Write `registry.test.ts` alongside.
3. Build `CommandPalette.tsx` (root list only, no sub-command mode yet): overlay, input, filtered/
   scored list, keyboard nav, execute-on-Enter, close-on-Escape/backdrop-click.
4. Wire the global `Ctrl/Cmd+K` listener into `Shell.tsx`.

**Day 2**
5. Add the `Compare with…` sub-command mode (§2.4).
6. Add disabled/empty states (§2.5) and the scroll-into-view behavior for `Translate selection`.
7. Manual QA pass (§4): every command in §2.2 table, from both a fresh empty app state and a
   loaded example construct; keyboard-only navigation start to finish; confirm Escape/backdrop
   behavior; confirm the palette doesn't intercept A/T/G/C keys meant for `SequenceView`'s own
   base-typing handler when the palette is closed (it shouldn't, since the listener only opens
   on Ctrl/Cmd+K, but verify no accidental focus-stealing).

### 2.9 Open decisions

- Whether `Escape` while the palette is open but a text input elsewhere on the page also has
  focus should still open the palette on `Ctrl/Cmd+K` (yes, recommended — VS Code's own palette
  works regardless of focus location, and there's no conflicting global shortcut today).
- Whether to add a small "⌘K" affordance button somewhere in `TopBar.tsx` for discoverability
  (recommended, cheap — a muted button styled like the existing Explain toggle, e.g. next to it).

---

## 3. Suggested build order

`next_steps.md` names Command Palette "my top pick to build first" in one section and then
"Mutation Heatmap, immediately followed by the Command Palette" in its closing recommendation —
those two framings are in tension. This spec's recommendation, now that both are scoped in
detail: **Mutation Heatmap first.**

Reasons: it's fully contained inside one existing tab (no new global UI pattern to get right —
the palette is introducing the app's *first* overlay and *first* global keyboard listener, which
carries more first-time-right risk); its performance story is fully resolved by §1.1's refactor
(no open compute-perf question, unlike, say, a hypothetical naive palette-fuzzy-search over a
huge command list — which isn't actually a concern here either, but the heatmap's risk was real
and is now closed); and once it ships, the palette's v1 command list is more complete on day one
(`Mutation heatmap` slots in alongside the other five PRD examples instead of being a follow-up
PR). The palette remains the higher *symbolic* payoff per the product pitch — building it second
doesn't diminish that, it just sequences the riskier "new interaction pattern" work after a clean,
low-risk win.

## 4. Manual QA checklist

No component-test harness exists in this codebase (§0) — both features ship with unit tests for
their pure logic (`computeMutationHeatmap`, `classifySubstitutionAtCodon`, `fuzzyScore`,
`buildCommands`) but the React layer needs a manual pass before merging. Suggested checklist to
run against a loaded example construct (`npm run dev`, load one of the three built-in examples):

- [ ] Mutation Heatmap: open on a CDS, confirm row/column counts match sequence length, hover a
      cell shows the right tooltip, click a cell highlights the matching base in Sequence view,
      collapse/re-expand doesn't recompute unnecessarily (no visible lag on second open).
- [ ] Mutation Heatmap: switch the CDS selector (on a construct with 2+ CDS features) and confirm
      the grid fully updates, not just partially.
- [ ] Command Palette: `Ctrl/Cmd+K` opens from every tab; `Escape` closes; clicking the backdrop
      closes; arrow keys + Enter execute without a mouse.
- [ ] Command Palette: each of the 6 PRD example commands does what it says, including the two
      that needed the store-lift refactor (`Reverse complement`, `Find ORFs` actually open their
      panels, not just navigate).
- [ ] Command Palette: `Compare with…` sub-flow with 0, 1, and 2+ other constructs loaded.
- [ ] Command Palette: disabled states render with a reason and don't execute on Enter.
- [ ] Both features: Explain Mode on/off doesn't break anything (heatmap has no Explain
      integration by design; palette-triggered RC/translation shows Explain blocks exactly as if
      triggered manually).
- [ ] `npm test`, `npm run typecheck`, `npm run lint` all pass.
