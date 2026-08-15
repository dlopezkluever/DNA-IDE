# Protein Structure Viewer + Mutation Mapping — Spec & Implementation Plan

Status: proposed, not yet built. Source: `next_steps.md` (Tier 2, "Protein structure viewer +
mutation mapping ⭐") and the explicit build request in `new-feat.md`. This doc grounds that
paragraph in the actual codebase — real file paths, real function signatures, real coordinate
math — the same way `crispr-guide-rna-designer-spec.md` and
`command-palette-and-mutation-heatmap-spec.md` did for the features that shipped before it
(`src/biology/crispr.ts`, `src/commands/`, `MutationHeatmap.tsx` all exist in the tree today).
This feature builds on top of those, not around them — it is the fourth tab-sized addition on
the same `src/biology/` + Zustand + raw-SVG-or-canvas architecture, not a rewrite.

Product name used throughout the UI is **Helix IDE** (`TopBar.tsx`), not "DNA-IDE" — the repo
folder name is just where it lives on disk. This doc uses "Helix IDE."

This is explicitly additive: no existing view, store shape, `Construct`/`Feature`/`Mutation`
type, or exported function signature changes in a breaking way. One new `ViewId` union member,
one new tab, and two new pure `src/biology` modules are the only changes to shared state/types.

---

## 0. Shared groundwork

Established conventions this feature must follow — read once, applies throughout. (Restated
from the CRISPR spec's §0 for this doc's own self-containedness; still true today, verified
against the current tree while writing this.)

- **Coordinates are 0-based, half-open `[start, end)`** for DNA everywhere in `src/biology` and
  the stores (`src/types/models.ts:1-5`). Amino-acid positions are **1-based** throughout the
  app already (`mutations.ts`'s `aminoAcidPosition = codonIndex + 1`, `formatProteinChange`'s
  `Gly281Ser`-style output) — this feature's residue numbers follow that same 1-based amino-acid
  convention, not the DNA convention. PDB residue numbers (`resSeq`) are also natively 1-based-ish
  but **not guaranteed contiguous or starting at 1** (see §2.1's warning) — never assume
  `resSeq === aminoAcidPosition`.
- **No router.** View switching is `useUIStore((s) => s.activeView)` (`ViewId` union,
  `src/store/uiStore.ts:6-15`) + `setActiveView`, read in `src/components/layout/Shell.tsx:41-49`
  as a plain conditional-render block.
- **Selection is global, not per-view**, in `uiStore.ts`. Every view reads/writes it through one
  hook, `src/hooks/useCrossHighlight.ts` (`selectRange`, `selectCodon`). This feature must drive
  and read cross-highlight state through that hook — not invent a second highlight channel — so
  that (a) a mutation selected in the Mutations tab highlights the right residue in 3D for free,
  and (b) clicking a residue in 3D highlights the right codon back in the Sequence view for free.
  This is the literal mechanism the source material asks for ("when a mutation lands inside the
  GFP CDS in the Mutations tab, highlight the corresponding residue in 3D").
- **State**: Zustand 5, `useUIStore` + `useConstructStore`, no Context, no Redux. Per-view UI
  state (color mode, rotation, hovered residue) is **local component `useState`**, not global
  store — matches `MutationHeatmap.tsx:70`'s `selectedCell` and `ORFList.tsx:13`'s `minLength`,
  neither of which live in `uiStore`.
- **Styling**: Tailwind v4, CSS-first theme in `src/index.css` (see `DESIGN.md`). Canonical
  tokens: `--color-bg-canvas/surface/elevated/hover`, `--color-border/border-strong`,
  `--color-text-primary/secondary/muted`, `--color-accent` (green, "active/selected/on **right
  now**," never "important" or "good") / `--color-accent-dim`, `--color-warn` (amber) /
  `--color-danger` (red) / `--color-info` (blue). Per `DESIGN.md` §10.2: new semantic colors map
  onto these four existing hues, never a fifth. This matters concretely below (§3.6): secondary
  structure and burial coloring reuse `warn`/`info`/`text-secondary`, and the "this is the
  currently highlighted residue" marker reuses the same accent-green ring used for selected
  sequence bases everywhere else in the app — it is not a new color language.
- **Rendering for spatial visualizations has, until now, always been raw inline SVG, no charting
  library** (`LinearFeatureMap.tsx`, `CircularPlasmidView.tsx`, `MutationHeatmap.tsx`). **This
  feature is the first one that needs true 3D** (rotation, depth), which SVG doesn't help with
  directly — §3.3 below is explicit about why the plan is a hand-rolled `<canvas>` 2D-context
  orthographic projector (in the same "implement it yourself" spirit the whole `src/biology/`
  engine already follows — see PRD "Visualization" §: *"Avoid overengineering the visualization
  layer initially... SVG is sufficient for the first implementation"*), not a new dependency like
  three.js. `package.json` today has exactly four runtime dependencies (`nanoid`, `react`,
  `react-dom`, `react-window`) and zero visualization libraries; this feature keeps that true for
  the *shipped app* — see §7 for the one narrow, dev-only exception (a codegen script).
- **Testing**: Vitest, `environment: 'node'` — only `src/biology`, `src/parsers`, `src/store`,
  `src/utils`, `src/commands` are unit-tested; there is **no component/UI test harness**. New pure
  logic (PDB parsing, sequence-to-structure alignment mapping, the burial heuristic, the 3D
  projection math) must be framework-free so it fits this convention; the canvas component and
  view get a manual QA pass (§6), not unit tests.
- **The closest existing analog is not a rendering component, it's `alignment.ts`.** The hard
  part of this feature isn't drawing points in 3D (that's the easy, mechanical half) — it's
  correctly relating "amino acid position 65 in *this construct's* translated protein" to "the
  right 3D point in a reference structure that was solved from a *slightly different* sequence."
  `alignSequences`/`diffProteins` (`src/biology/alignment.ts`), already used by `CompareView.tsx`
  to diff two proteins, is reused directly for this (§2.2) rather than assuming positional
  identity — which, worked out below, is **not actually true for the shipped GFP example
  construct** (§1's scope note). This is the single most important correctness decision in this
  spec; skipping it and assuming `aminoAcidPosition === pdbResSeq` would make the feature *look*
  right on most residues and be silently wrong on exactly the ones most likely to matter.

---

## 1. Scope boundary

Directly from the source material, scoped down the same way the CRISPR feature was scoped down
from "genome-scale off-target prediction" to "construct-local sequence matching" — pick the
honest, buildable, 100%-client-side version and say explicitly what it isn't.

**Load-bearing fact discovered while writing this spec, not assumed:** the shipped GFP example
construct (`src/data/exampleConstructs/gfpConstruct.ts`, NCBI `U73901.1`, "GFP mutant 3") does
**not** translate to the same protein sequence as PDB `1EMA` (Ormö et al. 1996, GFP-S65T — the
structure the source material names). Translating the construct's CDS (`71..787`) and diffing
against wild-type avGFP (UniProt `P42212`) by hand while researching this spec shows it differs
at exactly two positions: **65 (S→G) and 72 (S→A)** — i.e. it's an `S65G/S72A` variant (the
"yEGFP"-style yeast-folding mutant), not `S65T`. `1EMA` itself carries `S65T` at that same
position. So the construct's residue 65 and the crystallized structure's residue 65 are *both*
real, *both* the chromophore-forming residue, and *genuinely different amino acids* — which is
precisely the kind of thing a naive "assume the numbering lines up" implementation would render
as if nothing were unusual. This is why §2.2's alignment step is not optional polish.

**In scope (v1):**
- **One protein, one structure**: the GFP CDS (whichever construct it appears in — matched by
  sequence alignment, not hardcoded to one construct id, §2.1) against PDB `1EMA`, chain A only
  (§2.1 notes `1EMA` crystallizes two copies in the asymmetric unit; only one monomer is rendered
  — GFP functions as a monomer, and rendering both would double the point count for no
  pedagogical benefit).
- A hand-rolled `<canvas>` 2D **Cα-trace** viewer: one point per residue (its alpha-carbon
  position only, not every atom), connected backbone-order, with mouse-drag orbit and
  scroll-to-zoom (§3.3) — not a full-atom or spline-ribbon renderer (see "explicitly out of
  scope" below).
- **Alignment-based residue mapping** (§2.2) between the construct's translated CDS protein and
  the structure's own resolved-residue sequence, reusing `alignSequences` — so a construct
  differing from the reference by point substitutions (like the shipped GFP construct actually
  does) still maps correctly, and a construct that diverges too far (wrong protein entirely, or
  scrambled by a frameshift) is honestly reported as unmapped rather than silently misaligned.
- **Two color modes**, both computed from data already in hand, no trained model: secondary
  structure (read directly from `1EMA`'s own `HELIX`/`SHEET` header records — a lookup, not an
  algorithm) and a **burial heuristic** (Cα neighbor-count within a radius — a cheap, honest,
  from-coordinates-only proxy for "buried core vs. surface loop," directly answering the
  pedagogical question the source material poses: *"does it matter WHERE in the protein a
  mutation lands?"*). Detailed in §2.3.
- **Bidirectional cross-highlight**: a mutation/selection active elsewhere in the app highlights
  the mapped residue in 3D (via `uiStore.selection`/`activeMutationId`, read the normal way);
  clicking a residue in 3D calls `selectCodon`/`selectRange` the normal way, highlighting the
  corresponding codon back in the Sequence view. No new highlight mechanism.
- Explain Mode integration (§2.4), command palette entry, new `structure` tab (§3.1).
- Structure data for `1EMA` is **bundled as static, pre-processed, offline data** — no runtime
  network fetch to RCSB or anywhere else (§2.1). PDB files are public domain (explicitly noted in
  the source material too), so vendoring one into the repo is not a licensing concern.

**Explicitly out of scope (v1), and why:**
- **No true ribbon/cartoon geometry** (spline-interpolated helical ribbons, arrowed β-strands —
  what SnapGene/PyMOL/Mol* render). That needs curve interpolation through the backbone plus
  oriented flat-ribbon geometry per residue, a materially bigger and more failure-prone lift than
  a point-and-line Cα trace, for a feature whose stated goal is "turn a mutation string into a
  point on a structure," not photorealistic molecular graphics. A Cα trace, colored by secondary
  structure, honestly delivers the same "where is this residue, and what kind of structural
  neighborhood is it in" information the source material asks for. Flagged as a real, reasonable
  v2 enhancement (§7), not a silently-skipped requirement.
- **No full-atom rendering** (side chains, hydrogens, ligands/waters). Cα-only both keeps the
  bundled data small (§2.1) and keeps the hand-rolled renderer's job simple (one point per
  residue, not ~8-12 per residue). A missense mutation still highlights correctly at the residue
  level — you just don't see *which* side-chain atoms specifically clash, which is genuinely
  outside what a from-scratch, no-library renderer should promise.
- **No general "paste any PDB ID" uploader.** v1 hardcodes exactly one `KnownStructure` entry
  (GFP/`1EMA`) in a small registry (§2.1) shaped so a second entry is *mostly* data — but getting
  that second entry still means downloading and preprocessing a real PDB file by hand (§2.1's
  pipeline), so this isn't "just flip a flag" the way, say, a new restriction enzyme is. Not
  claiming otherwise.
- **No structure prediction** (no AlphaFold/ESMFold call, no homology modeling). This is a viewer
  for one experimentally solved structure, matched by sequence identity — if a construct's CDS
  doesn't align well enough to `1EMA` (below the threshold in §2.2), the Structure tab says so
  plainly and shows nothing invented. Same "don't imply the app knows more than it does" posture
  §1 of the CRISPR spec commits to for off-target prediction.
- **No quantitative stability/ΔΔG prediction.** The burial heuristic (§2.3) is a coarse,
  explicitly-labeled *proxy* ("this residue has few neighbors → surface-exposed → often more
  mutation-tolerant"), not a stability score. Presenting it as a bucketed category with a
  disclosed formula, not a precise number, is deliberate — the same reasoning the CRISPR spec's
  §7 gives for keeping guide ratings three tiers instead of a numeric score.

---

## 2. Domain design

Two new pure, framework-free modules in `src/biology/` (unit-tested per §0's convention), one new
static data module in `src/data/structures/`, and one small dev-only preprocessing script.

### 2.1 Structure data: acquisition, format, and the known-structure registry

**Where the atomic data comes from.** `1EMA.pdb` is a real file on the RCSB PDB (public domain,
freely redistributable — the source material already notes this). This spec cannot and does not
fabricate atomic coordinates; the implementation step is to actually download it
(`https://files.rcsb.org/download/1EMA.pdb`) once, vendor the raw file into the repo at
`scripts/structures/1EMA.pdb` (small, ~100-200KB of text — cheap to commit, and keeping the raw
source next to the script that consumes it makes the derivation auditable/reproducible), and run
a one-off preprocessing script against it. **Do not hand-transcribe coordinates into a TS
literal** — that's exactly the kind of silent-transcription-error risk this spec's whole point is
to avoid.

**PDB `ATOM` record format** (fixed-column, like `genbank.ts` already parses a different
fixed-format text block for `ORIGIN`) — the columns below are the stable, standard ones (verify
against the actual downloaded file and the wwPDB format spec while implementing, and lock them in
with a unit test built from a handful of literal lines copied out of the real file, §2.1.2):

```
Columns  1- 6   Record name   "ATOM  " (fixed width, padded)
Columns  7-11   serial        atom serial number
Columns 13-16   name          atom name, e.g. "CA"
Column     17   altLoc        alternate location indicator
Columns 18-20   resName       residue name, e.g. "GLY"
Column     22   chainID       e.g. "A"
Columns 23-26   resSeq        residue sequence number (author numbering — NOT guaranteed to
                               start at 1 or be contiguous; GFP crystal structures commonly have
                               an unresolved/flexible N-terminus, so treat gaps as normal)
Columns 31-38   x              orthogonal Å coordinate
Columns 39-46   y
Columns 47-54   z
```

`HELIX`/`SHEET` header records use a similar fixed-column layout for their start/end residue and
chain — same approach (slice, trim, parse), verify exact offsets against the real file when
implementing rather than trusting a from-memory column table for a record type used only twice.

```ts
// src/biology/pdb.ts
export interface PDBAtom {
  serial: number
  name: string // e.g. 'CA'
  resName: string // 3-letter, upper-case, e.g. 'GLY'
  chainId: string
  resSeq: number
  x: number
  y: number
  z: number
}

export type SecondaryStructureType = 'helix' | 'sheet'

export interface SecondaryStructureRange {
  type: SecondaryStructureType
  chainId: string
  startResSeq: number
  endResSeq: number // inclusive, per PDB convention (not this codebase's usual half-open)
}

export interface ParsedPDB {
  atoms: PDBAtom[]
  secondaryStructure: SecondaryStructureRange[]
}

/** Parses ATOM (not HETATM — waters/ligands excluded) and HELIX/SHEET records. Framework-free,
 * pure string -> data, same shape as parsers/genbank.ts. */
export function parsePDB(text: string): ParsedPDB {
  const atoms: PDBAtom[] = []
  const secondaryStructure: SecondaryStructureRange[] = []

  for (const line of text.split('\n')) {
    const record = line.slice(0, 6).trimEnd()
    if (record === 'ATOM') {
      atoms.push({
        serial: parseInt(line.slice(6, 11), 10),
        name: line.slice(12, 16).trim(),
        resName: line.slice(17, 20).trim(),
        chainId: line.slice(21, 22).trim(),
        resSeq: parseInt(line.slice(22, 26), 10),
        x: parseFloat(line.slice(30, 38)),
        y: parseFloat(line.slice(38, 46)),
        z: parseFloat(line.slice(46, 54)),
      })
    } else if (record === 'HELIX' || record === 'SHEET') {
      // Exact column offsets verified against a real file during implementation (§2.1.2) —
      // sketch only; HELIX and SHEET use *different* column layouts from each other in the
      // real spec, don't assume they share offsets just because both are secondary structure.
    }
  }
  return { atoms, secondaryStructure }
}

/** 3-letter PDB resName -> 1-letter amino acid code, reusing the existing table rather than
 * hand-writing a second one. */
export const PDB_RESNAME_TO_ONE_LETTER: Record<string, string> = Object.fromEntries(
  Object.entries(AMINO_ACID_INFO)
    .filter(([letter]) => letter !== '*' && letter !== 'X')
    .map(([letter, info]) => [info.abbr.toUpperCase(), letter]),
)
```

**Why the *reference* protein sequence and residue numbers come from `ATOM` records, not
`SEQRES`.** `SEQRES` header records list the full construct sequence used experimentally,
including residues with no resolved coordinates (disordered loops, unresolved termini) — but this
feature can only ever render/highlight a residue it has an XYZ position for. Deriving the
reference protein string (and the parallel array of `resSeq` numbers, §2.2) directly from the
`CA` atoms actually present, in `resSeq` order, guarantees every reference position is drawable by
construction. This also means the reference protein's length can legitimately be a few residues
shorter than avGFP's full 238 — expected, not a parsing bug.

#### 2.1.1 Preprocessing script and the compact data module

```ts
// scripts/buildStructureData.ts (dev-only; not imported by src/, not shipped in the app bundle)
import { readFileSync, writeFileSync } from 'node:fs'
import { parsePDB, PDB_RESNAME_TO_ONE_LETTER } from '../src/biology/pdb'

const raw = readFileSync('scripts/structures/1EMA.pdb', 'utf-8')
const parsed = parsePDB(raw)
const chainAAtoms = parsed.atoms.filter((a) => a.chainId === 'A' && a.name === 'CA')
// ... map to the compact residue list + reference protein string, write src/data/structures/gfp1EMA.ts
```

Run once via a new `package.json` script (`"structures:build": "tsx scripts/buildStructureData.ts"`).
**This is the one new dependency this spec introduces** — `tsx` (or an equivalent single-purpose
TS runner), as a **devDependency only**, never imported by anything under `src/`, never part of
the shipped bundle. Everything the *browser* ships stays at today's four runtime dependencies.
Reusing `parsePDB` from `src/biology/pdb.ts` in the script (rather than duplicating parsing logic
in plain JS) keeps one tested source of truth for the format.

Output — the actual shipped data module, small and fully static:

```ts
// src/data/structures/gfp1EMA.ts (generated by scripts/buildStructureData.ts — do not hand-edit)
export interface StructureResidue {
  resSeq: number
  resName: string // 1-letter
  ss: 'helix' | 'sheet' | 'coil'
  ca: [number, number, number]
}

export const GFP_1EMA_RESIDUES: StructureResidue[] = [
  /* generated */
]
```

```ts
// src/data/structures/index.ts
import { GFP_1EMA_RESIDUES } from './gfp1EMA'

export interface KnownStructure {
  id: string
  pdbId: string
  name: string
  residues: StructureResidue[]
  /** Derived once at module load (cheap — see below), not re-derived per render. */
  referenceProtein: string
  referenceResSeqs: number[]
}

function toKnownStructure(id: string, pdbId: string, name: string, residues: StructureResidue[]): KnownStructure {
  return {
    id,
    pdbId,
    name,
    residues,
    referenceProtein: residues.map((r) => r.resName).join(''),
    referenceResSeqs: residues.map((r) => r.resSeq),
  }
}

export const KNOWN_STRUCTURES: KnownStructure[] = [
  toKnownStructure('gfp-1ema', '1EMA', 'Green Fluorescent Protein (S65T)', GFP_1EMA_RESIDUES),
]
```

#### 2.1.2 Required unit tests (`src/biology/pdb.test.ts`)

- A handful of **literal `ATOM` lines copied verbatim from the real downloaded `1EMA.pdb`** (not
  hand-typed to "look right" — copied, so column offsets are validated against ground truth) parse
  to the expected `serial`/`name`/`resName`/`chainId`/`resSeq`/`x`/`y`/`z`.
  `HETATM` lines and blank/`TER`/`END` lines are ignored, not mis-parsed as atoms.
- A literal `HELIX` line and a literal `SHEET` line (same "copied from the real file" rule) parse
  to the correct `startResSeq`/`endResSeq`/`chainId`.
- `PDB_RESNAME_TO_ONE_LETTER['GLY'] === 'G'`, `['SER'] === 'S'`, etc. — spot-check a handful
  against `AMINO_ACID_INFO`, confirming the derived reverse map round-trips.

### 2.2 Residue mapping — `buildResidueMapping`

The correctness-critical part (§0, §1's discovered fact). Reuses `alignSequences` from
`alignment.ts` exactly as `CompareView.tsx` already does for protein diffs — same function, new
caller, no changes to `alignment.ts` itself.

```ts
// src/biology/structureMapping.ts
import { alignSequences } from './alignment'

export interface ResidueMapping {
  /** Construct amino-acid position (1-based) -> reference structure resSeq. Absent for
   * construct positions that fall in a gap relative to the reference (insertion, or past a
   * frameshift/premature stop that desyncs the rest of the alignment). */
  toReference: Map<number, number>
  /** Reference resSeq -> construct amino-acid position. The inverse, for click-to-select (§3.4). */
  toConstruct: Map<number, number>
  /** Fraction of aligned (matched+mismatched, i.e. non-gap) positions that are exact identity
   * matches. Used both to display "~99% identity to 1EMA" and to gate whether this CDS counts
   * as "a match" for this structure at all (§2.2.1). */
  identity: number
}

export function buildResidueMapping(
  constructProtein: string, // stop-codon '*' already stripped, see caller note below
  referenceProtein: string,
  referenceResSeqs: number[], // referenceProtein[i] <-> referenceResSeqs[i], same length
): ResidueMapping {
  const ops = alignSequences(referenceProtein, constructProtein) // ref=reference, mod=construct
  const toReference = new Map<number, number>()
  const toConstruct = new Map<number, number>()
  let matches = 0
  let alignedLen = 0

  for (const op of ops) {
    if (op.type !== 'match' && op.type !== 'mismatch') continue // insertion/deletion: no 1:1 residue on one side
    const len = op.refEnd - op.refStart
    for (let k = 0; k < len; k++) {
      const constructPos = op.modStart + k + 1 // 1-based amino-acid position
      const refResSeq = referenceResSeqs[op.refStart + k]
      toReference.set(constructPos, refResSeq)
      toConstruct.set(refResSeq, constructPos)
    }
    alignedLen += len
    if (op.type === 'match') matches += len
  }

  return { toReference, toConstruct, identity: alignedLen === 0 ? 0 : matches / alignedLen }
}
```

**Caller must strip the trailing stop before aligning.** `translateFeature(cdsFeature,
sequence)`'s codon list ends with an `aa === '*'` entry; every other consumer in the app
(`CDSTranslationBlock`'s `proteinLength`, `computeMutationHeatmap`'s `aminoAcidLength`) already
filters it out before treating the result as "the protein." Do the same here —
`codons.filter((c) => c.aa !== '*').map((c) => c.aa).join('')` — or the aligner spends its last
operation trying to align a `*` against nothing, which would misreport `identity` for every
correctly-terminated CDS. Also worth stating plainly given §1's discovered fact: on the shipped
GFP construct this alignment is expected to produce one long run of `match` ops with exactly two
single-position `mismatch` ops at the two real `S65G`/`S72A` differences from `1EMA` — **not** a
perfect all-`match` alignment. A test asserting all-`match` against this specific construct would
be asserting something false; §2.2.2's test fixture must expect exactly this.

#### 2.2.1 Matching a construct's CDS to a known structure

Runs once per construct load / mutation (memoized), not per frame:

```ts
const IDENTITY_THRESHOLD = 0.7 // conservative "clearly homologous" cutoff; tunable, §7

export interface StructureMatch {
  cdsFeature: Feature
  structure: KnownStructure
  mapping: ResidueMapping
}

export function findStructureMatch(
  cdsFeatures: Feature[],
  sequence: string,
  knownStructures: KnownStructure[],
): StructureMatch | null {
  for (const cds of cdsFeatures) {
    const codons = translateFeature(cds, sequence)
    const proteinLen = codons.filter((c) => c.aa !== '*').length
    if (proteinLen === 0) continue
    const protein = codons
      .filter((c) => c.aa !== '*')
      .map((c) => c.aa)
      .join('')

    for (const structure of knownStructures) {
      // Cheap length pre-filter before the O(n*m) alignment — same lesson the CRISPR spec's
      // §2.4 flags for off-target search: guard against paying full alignment cost on CDS
      // features that could never plausibly match (e.g. scanning a 50kb ORF against a 238aa
      // reference). A 3x length-ratio band is generous but rules out the pathological case.
      const lenRatio = proteinLen / structure.referenceProtein.length
      if (lenRatio < 1 / 3 || lenRatio > 3) continue

      const mapping = buildResidueMapping(protein, structure.referenceProtein, structure.referenceResSeqs)
      if (mapping.identity >= IDENTITY_THRESHOLD) {
        return { cdsFeature: cds, structure, mapping }
      }
    }
  }
  return null
}
```

On the shipped GFP construct this returns a match at **236/238 ≈ 99.2% identity** (238 aligned
positions, 2 mismatches) — comfortably clear of the threshold, confirmed by hand-translating the
construct's CDS while researching this spec (§1).

#### 2.2.2 Required unit tests (`src/biology/structureMapping.test.ts`)

- **Identical sequences**: `buildResidueMapping('MSK...', 'MSK...', [1,2,3,...])` maps every
  position 1:1 to the same index, `identity === 1`.
- **Point-substitution case (the real, shipped scenario)**: a reference and construct differing
  at one or two known positions (small literal fixture, not the full 238aa) still map every
  position 1:1 (mismatch ops still produce a mapping — only insertions/deletions don't),
  `identity < 1` but close to it. This is the test that would have caught an implementation that
  only mapped `match` ops and silently dropped mismatched residues.
  Optionally: reproduce the real `S65G`/`S72A` case with the actual 238aa sequences from §1 as an
  integration-style test.
- **Insertion in the construct** (e.g. an in-frame indel introduced via the Mutations tab):
  inserted positions have no `toReference` entry; positions after the insertion still map
  correctly, shifted.
- **Frameshift / early stop**: construct protein diverges completely partway through (simulates a
  frameshift's garbage tail) — positions before the divergence map correctly, `identity` reflects
  the damage, positions in the garbled tail are either unmapped or mapped with heavy mismatch
  (assert on `identity` dropping well below `IDENTITY_THRESHOLD`, not on exact per-position
  behavior in the garbled region — that's inherently a "best-effort alignment" zone).
- `findStructureMatch`: a CDS whose protein is unrelated to GFP (e.g. a short synthetic ORF from
  `minimalCDS.ts`) returns `null`, not a bogus low-identity match. The shipped GFP construct's CDS
  returns a match with `identity` in the high-0.9x range.

### 2.3 Burial heuristic — `computeBurialScores`

Directly operationalizes the source material's pedagogical claim ("a mutation in a buried
structural core behaves completely differently from one on a floppy surface loop") with a real,
cheap, from-coordinates-only signal — not a trained model, not real solvent-accessible surface
area (computing true SASA needs full atom coordinates and a rolling-probe algorithm, genuinely out
of scope per §1's "Cα-only" decision). Cα-Cα neighbor count within a fixed radius is a standard,
well-precedented coarse proxy for burial in structural bioinformatics.

```ts
export type BurialCategory = 'buried' | 'intermediate' | 'exposed'

export interface BurialScore {
  resSeq: number
  neighborCount: number
  category: BurialCategory
}

const NEIGHBOR_RADIUS_ANGSTROM = 11 // CA-CA contact proxy radius — coarse, tunable, §7
const EXPOSED_MAX = 8 // <= this many neighbors -> exposed
const BURIED_MIN = 16 // >= this many neighbors -> buried; between the two -> intermediate

function distance(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** O(n^2) — fine at n ~ 238 (a single GFP chain, ~28k pairwise checks). Not meant to scale to
 * multi-chain complexes; multi-chain structures are explicitly out of scope (§1). */
export function computeBurialScores(residues: { resSeq: number; ca: [number, number, number] }[]): BurialScore[] {
  return residues.map((r) => {
    let neighborCount = 0
    for (const other of residues) {
      if (other.resSeq === r.resSeq) continue
      if (distance(r.ca, other.ca) <= NEIGHBOR_RADIUS_ANGSTROM) neighborCount++
    }
    const category: BurialCategory =
      neighborCount <= EXPOSED_MAX ? 'exposed' : neighborCount >= BURIED_MIN ? 'buried' : 'intermediate'
    return { resSeq: r.resSeq, neighborCount, category }
  })
}
```

Computed once per structure (the coordinates never change — mutations change the *construct*, not
the reference structure), so this can run eagerly at module init or on first Structure-tab mount
and be memoized indefinitely, unlike the mapping (§2.2) which must be recomputed per construct
edit.

**Framing this honestly in the UI (§3.6) matters as much as the number itself** — same posture as
the CRISPR spec's off-target disclaimer: label it "neighbor count (burial proxy)," not "solvent
accessibility" or "stability score," and don't let its three categories imply more biophysical
precision than a fixed-radius Cα count actually has.

#### 2.3.1 Required unit tests (`src/biology/structureMapping.test.ts`, alongside §2.2.2)

- A tight synthetic cluster of points (all within the radius of each other) scores every point
  `buried`; a set of far-apart points scores every point `exposed`.
- A residue's own position never counts as its own neighbor (off-by-one risk: the `continue` on
  `other.resSeq === r.resSeq` — assert with a fixture containing a residue with zero real
  neighbors, confirming `neighborCount === 0`, not `1`).
- Category boundaries: neighbor counts of exactly `EXPOSED_MAX` and exactly `BURIED_MIN` land in
  the documented category (boundary-inclusive, not off-by-one).

### 2.4 Explain Mode integration — `explainStructureResidue`

Same shape as the three existing functions in `src/biology/explain.ts` (`explainReverseComplement`,
`explainTranslation`, `explainMutation`, `explainCRISPRGuide`), returning `ExplainStep[]`:

```ts
// src/biology/explain.ts — new function alongside the existing four
export function explainStructureResidue(
  constructAAPosition: number,
  constructAA: string,
  match: StructureMatch,
  burial: BurialScore | null,
): ExplainStep[] {
  const refResSeq = match.mapping.toReference.get(constructAAPosition)
  const refResidue = refResSeq !== undefined
    ? match.structure.residues.find((r) => r.resSeq === refResSeq)
    : undefined
  const steps: ExplainStep[] = [
    {
      label: 'This construct',
      value: `${aminoAcidFullName(constructAA)} at position ${constructAAPosition}`,
    },
  ]
  if (refResidue) {
    steps.push({
      label: `Reference structure (${match.structure.pdbId})`,
      value:
        refResidue.resName === constructAA
          ? `Same residue (${aminoAcidFullName(refResidue.resName)}) at structure position ${refResidue.resSeq}`
          : `Different residue here: ${aminoAcidFullName(refResidue.resName)} at structure position ${refResidue.resSeq} — this construct's protein diverges from the crystallized structure at this exact position`,
    })
    steps.push({ label: 'Secondary structure', value: refResidue.ss })
  } else {
    steps.push({
      label: `Reference structure (${match.structure.pdbId})`,
      value: 'No corresponding position — falls outside the aligned region',
    })
  }
  if (burial) {
    steps.push({
      label: 'Burial (proxy)',
      value: `${burial.category} — ${burial.neighborCount} Cα neighbors within ${NEIGHBOR_RADIUS_ANGSTROM}Å`,
    })
  }
  return steps
}
```

Rendered via the existing `<ExplainBlock steps={...} />` component, gated behind
`useUIStore((s) => s.explainMode)` — no new pattern. The "different residue here" branch is not a
hedge — it is expected to fire for the shipped GFP construct's own position 65, and showing it
plainly (rather than silently rendering the construct's `G` as if it sat at a `T`-shaped point in
the reference, or vice versa) is the entire point of §2.2's alignment work.

---

## 3. UI/UX design

### 3.1 New tab wiring

| File | Change |
|---|---|
| `src/store/uiStore.ts:6-15` | Add `'structure'` to the `ViewId` union |
| `src/data/viewTabs.ts` | Add `{ id: 'structure', label: 'Structure' }` to `TABS` |
| `src/components/layout/Shell.tsx:41-49` | Add `{activeView === 'structure' && <StructureView />}` |

No new boolean gate in `uiStore` — same reasoning the CRISPR spec gives (§3.1 there): the tab
itself is the gate, `Shell.tsx` only mounts the active view, and `findStructureMatch` +
`computeBurialScores` (cheap at n≈238, §2.2/§2.3) only ever run while the Structure tab is open.

### 3.2 Layout

Two-pane split — canvas + sidebar, not a new layout idiom, modeled on the app's existing
"content area + narrow control/info column" shape (e.g. `RestrictionView.tsx`'s
`EnzymeList` sidebar):

```
┌─ Structure ──────────────────────────────────────────────┬─ Detail ──────────────┐
│  GFP · PDB 1EMA · 99% identity to this construct's CDS    │ Residue 65            │
│                                                             │ This construct: Gly   │
│           (canvas — Cα trace, drag to orbit,               │ 1EMA structure: Thr    │
│            scroll to zoom)                                 │  (differs here)        │
│                                                             │                         │
│                                                             │ Secondary structure:   │
│                                                             │  β-strand              │
│                                                             │ Burial: intermediate   │
│                                                             │  (11 neighbors)        │
│  Color: [Secondary structure] [Burial]                     │                         │
│  ⓘ Cα backbone trace only — not a full-atom or ribbon      │ [Explain block, if     │
│    rendering. See "About this view."                       │  Explain Mode is on]   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Component breakdown and the 3D math

| File | Role |
|---|---|
| `src/views/StructureView.tsx` | Orchestrates: finds the active construct's CDS/structure match (`findStructureMatch`, memoized on `[construct]`), reads `selection`/`activeMutationId` to derive the currently-highlighted residue, renders sidebar + `StructureCanvas`. Mirrors `CRISPRView.tsx`'s orchestration shape. |
| `src/biology/geometry.ts` | New, pure, tested — the minimal 3D math (§3.3.1). Framework-free by design so it's unit-testable like everything else in `src/biology`. |
| `src/components/structure/StructureCanvas.tsx` | The `<canvas>` element: pointer-drag orbit, wheel zoom, draw loop, click hit-test. Owns rotation/zoom as local `useState` — not global store (§0). |
| `src/data/structureColors.ts` | New — `SS_COLOR`/`BURIAL_COLOR` lookup tables, mirrors `featureColors.ts`/`consequenceColors.ts`'s "one lookup table per semantic category" pattern (§0, `DESIGN.md` §10.2). |

#### 3.3.1 Geometry — hand-rolled, orthographic, no library

Deliberately the simplest 3D that reads correctly, not a general-purpose 3D engine — orthographic
projection (drop `z`, keep it only for depth-sort and shading) is standard in molecular viewers
and is meaningfully simpler to get right than a perspective camera for a single small molecule.

```ts
// src/biology/geometry.ts
export type Vec3 = [number, number, number]

export function centroid(points: Vec3[]): Vec3 {
  const sum = points.reduce<Vec3>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length]
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/** Rotation around the vertical (Y) axis — mouse-drag horizontal orbit. */
export function rotateY([x, y, z]: Vec3, radians: number): Vec3 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return [x * c + z * s, y, -x * s + z * c]
}

/** Rotation around the horizontal (X) axis — mouse-drag vertical orbit. */
export function rotateX([x, y, z]: Vec3, radians: number): Vec3 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return [x, y * c - z * s, y * s + z * c]
}

export interface Projected {
  x: number
  y: number
  depth: number // post-rotation z, for painter's-algorithm sort + depth shading only
}

/** Orthographic: x/y scaled and re-centered onto the canvas; z kept only as `depth`. */
export function project(p: Vec3, scale: number, canvasCenter: { x: number; y: number }): Projected {
  return { x: canvasCenter.x + p[0] * scale, y: canvasCenter.y - p[1] * scale, depth: p[2] }
}
```

Required unit tests (`src/biology/geometry.test.ts`): `rotateY`/`rotateX` by 0 is identity; by
`Math.PI` negates the two affected axes (hand-computed values, same rigor as the CRISPR spec's
worked-example convention); `centroid` of a symmetric point set is its geometric center;
`project` correctly maps a known 3D point to a known canvas position for a known scale/center.

#### 3.3.2 `StructureCanvas.tsx` draw loop (described, not fully inlined — this part is UI, not
pure logic, and gets manual QA per §0 rather than unit tests)

1. On mount and whenever rotation/zoom/highlight/colorMode state changes, re-render into the
   canvas (no continuous animation loop — this view is static until the user interacts,
   consistent with `DESIGN.md` §7's "no motion beyond `transition-colors`" — an explicit choice
   worth stating: constantly auto-spinning would be the single biggest motion departure this app
   has ever had).
2. Compute each residue's rotated (`rotateY` then `rotateX`, current drag-accumulated angles) and
   `project`-ed position, centered on the structure's own `centroid` (computed once from
   `structure.residues`, not re-centered every frame).
3. Sort by `depth` ascending (painter's algorithm — back-to-front) and draw, per residue: a short
   line to the previous residue in `resSeq` order (the Cα backbone trace) and a small filled
   circle, radius/opacity subtly modulated by `depth` for a cheap-but-real depth cue.
4. Fill color per residue comes from the active color mode's lookup table
   (`structureColors.ts`, §3.6) — **except** the currently cross-highlighted residue (if any),
   which always renders with an accent-green ring around it regardless of color mode, matching
   the "accent = selected right now" rule (§0) rather than competing with the color-mode legend.
5. Pointer-down starts a drag (accumulate `Δx`/`Δy` into the rotation angles); wheel adjusts the
   `scale` passed to `project`, clamped to a sane min/max so the structure can't shrink to a point
   or grow off-canvas.
6. Click (pointer-up with negligible drag distance, to distinguish a click from the end of an
   orbit-drag) does a nearest-projected-point hit test within a small pixel radius (e.g. 6px) and,
   on a hit, triggers the selection callback (§3.4).

### 3.4 Cross-highlight wiring (both directions)

**Mutation/selection → highlighted residue.** `StructureView` reads `selection` and
`activeMutationId` via `useCrossHighlight()` exactly like every other view. When the active
selection's start falls inside the matched `cdsFeature`'s range, derive the amino-acid position
the same way the CRISPR spec's `findFeatureContext` derives "distance into a CDS" (§2.3 there) —
reusing `readingBasesWithCoords`, not new coordinate math:

```ts
function findAminoAcidPositionAtGenomicPosition(
  cdsFeature: Feature,
  genomicPosition: number,
  seq: string,
): number | null {
  const bases = readingBasesWithCoords(cdsFeature, seq)
  const index = bases.findIndex((b) => b.pos === genomicPosition)
  return index === -1 ? null : Math.floor(index / 3) + 1 // 1-based amino-acid position
}
```

Then `match.mapping.toReference.get(aaPosition)` gives the `resSeq` to highlight — or nothing, if
the position doesn't map (§2.2's honest-gap behavior), in which case the sidebar says so instead
of highlighting a wrong or stale residue.

**Click residue → selected codon.** The inverse: `match.mapping.toConstruct.get(resSeq)` gives the
construct's amino-acid position; `translateFeature(cdsFeature, sequence)[aaPosition - 1]` is the
corresponding `CodonInfo` (valid because `translateFeature`'s codon array is already aa-position
ordered, 1:1, for every position before the stop — no new lookup structure needed); call
`selectCodon(codon)` from `useCrossHighlight()`, the same call `CDSTranslationBlock.tsx` already
makes when a codon button is clicked. This is what makes clicking a residue in 3D highlight the
right codon in the Sequence view "for free," per §0's stated goal.

### 3.5 Command palette integration

One new command in `buildCommands` (`src/commands/registry.ts`), directly beside
`design-crispr-guides`, same minimal shape (always enabled, just navigates — the view itself
handles the "no match" case, same reasoning `calculate-gc` already uses):

```ts
commands.push({
  id: 'view-structure',
  label: 'View 3D structure',
  category: 'run',
  enabled: true,
  run: () => ctx.setActiveView('structure'),
})
```

The `Go to Structure` nav command is generated automatically once `'structure'` is added to
`TABS` (§3.1) — no separate work, same as every other tab.

### 3.6 Color modes and legend

Per `DESIGN.md` §2.5/§10.2: new lookup table, existing hues, no fifth color introduced.

```ts
// src/data/structureColors.ts
export const SS_COLOR: Record<'helix' | 'sheet' | 'coil', string> = {
  helix: 'var(--color-warn)', // amber
  sheet: 'var(--color-info)', // blue
  coil: 'var(--color-text-secondary)', // gray
}

export const BURIAL_COLOR: Record<'buried' | 'intermediate' | 'exposed', string> = {
  buried: 'var(--color-danger)', // reused here for "core," not "error" — see note below
  intermediate: 'var(--color-warn)',
  exposed: 'var(--color-info)',
}
```

Note on reusing `--color-danger` for "buried": this is the one place a status hue is repurposed
for a non-status meaning, flagged explicitly as an open decision (§7) rather than asserted as
obviously correct — `danger` red reads as "warning" to a user who's seen it mean "nonsense
mutation" or "frameshift" elsewhere in the app, which could accidentally imply "buried = bad."
Considered and not chosen: introducing a fifth hue, which `DESIGN.md` explicitly discourages.
Confirm before/while building rather than treating this pairing as final.

**"About this view" disclaimer** — persistent, visible without scrolling, same visual weight as
the CRISPR tab's off-target disclaimer (`--color-warn` note), because it draws the same kind of
honest boundary:

> This is a Cα backbone trace (one point per residue), not a full-atom or ribbon-cartoon
> rendering. Residue positions are mapped from this construct's translated protein onto PDB 1EMA
> by sequence alignment, not assumed to match numbering 1:1 — where this construct's protein
> differs from the crystallized structure, both residues are shown, not merged. "Burial" is a
> coarse neighbor-count proxy, not a computed solvent-accessibility or stability score.

### 3.7 Empty/loading states

- No construct loaded → `ViewPlaceholder` ("Import a FASTA or GenBank file to begin"), same as
  every other view.
- Construct loaded, `findStructureMatch` returns `null` → a distinct, honest placeholder: "No
  known 3D structure for this construct's proteins yet. Currently supported: GFP (PDB 1EMA)." —
  not the generic "no construct" placeholder, so a user with a real, valid construct doesn't think
  something is broken (same "distinguish the zero cases" principle the CRISPR spec's §3.9 applies
  to filtered-vs-absent candidates).
- Match found, but the currently active selection/mutation doesn't map to any residue (falls in a
  gap, or is simply outside the matched CDS) → sidebar shows the structure with its default color
  mode and a quiet note ("Nothing in the current selection maps to a structure residue"), not an
  error — this is an expected, common state (most of the app's mutations will be outside the one
  mapped CDS most of the time).

---

## 4. Files to add / change

| File | Change |
|---|---|
| `scripts/structures/1EMA.pdb` | New — vendored raw PDB file, downloaded once from RCSB (§2.1) |
| `scripts/buildStructureData.ts` | New — dev-only codegen script (§2.1.1) |
| `src/biology/pdb.ts` | New — `parsePDB`, `PDBAtom`, `SecondaryStructureRange`, `PDB_RESNAME_TO_ONE_LETTER` (§2.1) |
| `src/biology/pdb.test.ts` | New — parsing tests against real literal lines (§2.1.2) |
| `src/biology/structureMapping.ts` | New — `buildResidueMapping`, `ResidueMapping`, `findStructureMatch`, `StructureMatch`, `computeBurialScores`, `BurialScore` (§2.2, §2.3) |
| `src/biology/structureMapping.test.ts` | New — full coverage per §2.2.2, §2.3.1 |
| `src/biology/geometry.ts` | New — `rotateX`, `rotateY`, `project`, `centroid`, `subtract` (§3.3.1) |
| `src/biology/geometry.test.ts` | New — projection/rotation math tests |
| `src/biology/explain.ts` | Add `explainStructureResidue` (§2.4) |
| `src/data/structures/gfp1EMA.ts` | New — generated data (§2.1.1) |
| `src/data/structures/index.ts` | New — `KnownStructure`, `KNOWN_STRUCTURES` (§2.1) |
| `src/data/structureColors.ts` | New — `SS_COLOR`, `BURIAL_COLOR` (§3.6) |
| `src/store/uiStore.ts` | Add `'structure'` to `ViewId` union (§3.1) — no new boolean state |
| `src/data/viewTabs.ts` | Add `{ id: 'structure', label: 'Structure' }` to `TABS` |
| `src/views/StructureView.tsx` | New — orchestration (§3.3) |
| `src/components/structure/StructureCanvas.tsx` | New — canvas rendering + interaction (§3.3.2) |
| `src/components/layout/Shell.tsx` | Render `StructureView` for `activeView === 'structure'` |
| `src/commands/registry.ts` | Add `view-structure` command (§3.5) |
| `src/commands/registry.test.ts` | Add a case asserting the new command's presence/behavior |
| `package.json` | Add `tsx` devDependency; add `structures:build` script (§2.1.1) |

---

## 5. Implementation checklist (est. 5-6 days — one day longer than the CRISPR feature's 3-4,
because of the one-time real-world data acquisition step and the new geometry primitives)

**Day 0 — data acquisition (do this before writing any app code)**
1. Download `1EMA.pdb` from RCSB, vendor it at `scripts/structures/1EMA.pdb`.
2. Implement `parsePDB` (§2.1) against the real file; write `pdb.test.ts` using literal lines
   copied from it (§2.1.2) — verify `HELIX`/`SHEET` column offsets against the actual file's
   records, not from memory.
3. Implement and run `scripts/buildStructureData.ts` (§2.1.1); sanity-check the generated
   `gfp1EMA.ts` — spot-check its residue count, first/last `resSeq`, and that
   `referenceProtein` reads as a plausible GFP sequence (starts near `MSKGEE...`, ends near
   `...MDELYK`).

**Day 1 — the correctness-critical mapping logic**
4. Implement `buildResidueMapping` (§2.2). Write `structureMapping.test.ts`'s mapping tests
   *before* moving on, including the point-substitution case — this is the exact bug class §0/§1
   warn about, and it's easy to write an implementation that "looks right" against an
   all-identical fixture and is subtly wrong on real, mismatched data.
5. Implement `findStructureMatch` (§2.2.1); confirm it actually returns a match, at high identity,
   against the real shipped GFP construct (`gfpConstruct.ts`) — this is the concrete check that
   §1's discovered fact (99.2% identity, not 100%) was reasoned about correctly, not just assumed.
6. Implement `computeBurialScores` (§2.3); test boundary cases (§2.3.1).

**Day 2 — geometry + canvas skeleton**
7. Implement `geometry.ts` (§3.3.1) and its tests.
8. Build `StructureCanvas.tsx`'s draw loop against static (non-interactive) props first: render
   the GFP Cα trace, confirm by eye it looks like a recognizable GFP β-barrel silhouette from at
   least one fixed angle before adding interaction.

**Day 3 — interaction + cross-highlight**
9. Add pointer-drag orbit, wheel zoom, and click hit-test (§3.3.2).
10. Wire `StructureView.tsx`'s read side (§3.4): selection/mutation → highlighted residue.
11. Wire the write side: click residue → `selectCodon` → confirm the Sequence view actually
    highlights the right codon (round-trip test, done manually per §6).

**Day 4 — polish and integration**
12. Color modes + legend + "About this view" disclaimer (§3.6).
13. `explainStructureResidue` (§2.4), wired behind `explainMode`.
14. Tab wiring (§3.1), command palette entry (§3.5), empty states (§3.7).

**Day 5 (buffer) — manual QA pass (§6), fix whatever the eyeball check in step 8 and the
round-trip check in step 11 turned up.**

---

## 6. Manual QA checklist

No component-test harness exists in this codebase (§0) — ships with unit tests for all pure logic
(parsing, mapping, geometry) but the canvas/React layer needs a manual pass. Run against
`npm run dev`, using the shipped GFP example construct:

- [ ] Structure tab shows the GFP Cα trace on construct load; sidebar reports the real computed
      identity percentage (expect high-90s%, not 100% — see §1).
- [ ] Drag to orbit rotates smoothly in both axes; wheel zooms in/out with sane clamping (can't
      shrink to nothing or blow past the canvas).
- [ ] Selecting a mutation in the Mutations tab that falls inside the GFP CDS highlights the
      correct residue in 3D (spot-check by position — e.g. introduce a substitution at a known
      codon and confirm the highlighted point's sidebar detail reports the matching residue
      number).
- [ ] A mutation/selection *outside* the GFP CDS (or in a different construct entirely) shows the
      "nothing maps" state, not a stale or wrong highlight left over from a previous selection.
- [ ] Clicking a residue point in 3D selects the correct codon in the Sequence view (round-trip
      check against the previous bullet, in the opposite direction).
- [ ] Introduce a substitution at position 65 specifically (the real construct/structure
      divergence point, §1) and confirm the sidebar/Explain block correctly shows *both* the
      construct's residue and 1EMA's differing residue at that position, not one silently
      overwriting the other.
- [ ] Both color modes render distinctly and their legends match `structureColors.ts`.
- [ ] Loading a non-GFP example construct (`minimalCDS.ts`, `educationalPlasmid.ts`) shows the "no
      known structure" placeholder, not an error, a blank canvas, or a bogus low-confidence match.
- [ ] Introduce a frameshift mutation inside the GFP CDS and confirm the view degrades honestly
      (reduced/absent mapping past the frameshift point, not a crash or a silently wrong
      highlight).
- [ ] Explain Mode on: residue detail shows `explainStructureResidue`'s steps; off: it doesn't,
      nothing else breaks.
- [ ] Command palette: `Ctrl/Cmd+K` → "structure" surfaces both `Go to Structure` and
      `View 3D structure`; either navigates correctly.
- [ ] "About this view" disclaimer is visible without scrolling on tab open.
- [ ] Performance: no visible jank while dragging to orbit (238 points redrawn per pointer-move
      event should be trivially fast on any modern machine — if it isn't, something is
      recomputing more than it should per frame, e.g. re-running `findStructureMatch` instead of
      reading a memoized result).
- [ ] `npm test`, `npm run typecheck`, `npm run lint` all pass.

---

## 7. Open decisions (confirm before/while building — not blockers)

- **`BURIAL_COLOR.buried` reusing `--color-danger`** (§3.6): flagged as the one place this spec
  repurposes a status hue for a non-status meaning. Alternatives: a muted/darker shade of the
  existing accent-dim token instead of a "live" status color, or accepting the risk since burial
  coloring and consequence coloring never appear in the same view at the same time (no direct
  visual collision, just a learned-association risk). Not a blocker; worth a second look once it's
  on screen next to the rest of the app.
- **Identity threshold** (§2.2.1): `0.7` is conservative given the shipped construct sits at
  ~99%; could be raised (e.g. `0.9`) to be stricter about what counts as "the same protein," at
  the cost of being more brittle to a construct with a longer engineered tag/fusion. Recommend
  leaving at `0.7` initially and tightening only if a false-positive match is actually observed.
- **Burial radius/thresholds** (§2.3): `11Å` / `8` / `16` are reasonable, literature-typical-ish
  starting points for a Cα-Cα contact proxy, not independently validated for this specific
  protein. Fine to retune once real GFP output is visually sanity-checked (does the chromophore
  pocket read as "buried," do surface loops read as "exposed"?) rather than trusting the numbers
  blind.
- **Second known structure**: once `findStructureMatch`/`buildResidueMapping` exist for arbitrary
  `KnownStructure` entries, adding a second protein is "mostly data" in the sense that no new
  *code path* is needed — but §2.1's acquisition pipeline (download, vendor, regenerate) is real
  manual work per structure, not a config toggle. Worth doing only when there's an actual second
  example construct pulling for it (e.g. if a future feature ships a second well-characterized
  example protein) — not needed to ship v1.
- **Ribbon/cartoon rendering** (§1): the biggest real v2 lift named in this doc. Genuinely
  valuable (it's what makes structure viewers visually legible to non-experts at a glance) but a
  materially larger undertaking (secondary-structure-aware spline geometry) than everything else
  here combined — deliberately deferred, not silently dropped.
- **Full-atom / side-chain rendering**: same category as ribbons — a real, reasonable v2, not
  built now, mainly for data-size and renderer-complexity reasons (§1).
