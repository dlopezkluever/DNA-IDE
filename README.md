# Helix IDE

An interactive DNA sequence workbench — VS Code for genetic constructs. Load a FASTA or
GenBank file, inspect its annotated structure, edit the sequence directly, and watch the
biological consequences (translation, mutation classification, restriction sites, PCR,
codon optimization) update immediately. See `DNA-IDE-PRD.md` for the full product spec.

100% client-side — no backend, nothing leaves the browser.

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run test      # run the biology-engine + parser unit tests (Vitest)
npm run build     # typecheck + production build
npm run lint       # oxlint
npm run typecheck  # tsc --noEmit
npm run format     # prettier --write
```

Then open the app and either drag in a `.fasta`/`.gb` file, or pick one of the three
built-in examples from the "Load example…" dropdown in the Constructs panel.

## Architecture

- **`src/biology/`** — framework-free domain logic (the actual point of this project;
  see `DNA-IDE-PRD.md` §24). Every module is unit-tested independently of React:
  `sequence.ts`, `translation.ts`, `orf.ts`, `mutations.ts`, `restriction.ts`,
  `primers.ts`, `pcr.ts`, `alignment.ts`, `assembly.ts`, `codons.ts`, `explain.ts`.
- **`src/parsers/`** — hand-rolled FASTA and GenBank flat-file parsers (no external
  bioinformatics library).
- **`src/store/`** — two Zustand stores: `constructStore` (loaded constructs, the
  fork-once mutation model) and `uiStore` (active view, selection, Explain Mode).
- **`src/components/` / `src/views/`** — the IDE shell (construct explorer / sequence
  editor / inspector) and the eight primary views (Sequence, Map, Protein, Mutations,
  Restriction, PCR, Compare, Assembly).
- **`src/data/`** — the curated restriction enzyme set, codon usage tables (real
  frequencies from the Kazusa Codon Usage Database), and the three example constructs.

Coordinates are 0-based half-open `[start, end)` everywhere internally; GenBank's
1-based inclusive convention is converted only at the parser boundary and in display
components (`toDisplayPosition`/`fromDisplayPosition` in `biology/sequence.ts`).

## Demo script

The `DNA-IDE-PRD.md` §39 story, playable end to end today:

1. Load the **Educational Plasmid** example — inspect its origin, marker, promoter, and
   GFP reporter on the circular map.
2. Open **Protein**, expand the GFP block, turn on **Explain** to see the codon-by-codon
   translation.
3. Back in **Sequence**, select a base inside the GFP CDS and type a new letter — watch
   the mutation's classification (missense / nonsense / frameshift / …) appear
   immediately.
4. Open **Compare** — the pristine original and your edited working copy are diffed at
   the DNA, feature, and protein level automatically.
5. Open **Restriction** to see cut sites and fragment sizes; **PCR** to design primers
   around a region and simulate amplification.
6. Open **Assembly**, add two constructs as fragments, and assemble them into a new one.
7. Back in **Protein**, expand **Codon optimization** on the GFP block and switch
   organisms — same protein, different DNA.
