# Helix IDE — A Beginner's Guide

This guide assumes you know how to use a computer and nothing else about genetics. Every
section pairs a plain-language biology explanation with the exact button, tab, or click that
demonstrates it in the app. By the end you should be able to open a plasmid, read its parts,
edit its DNA, and understand *why* the result is what it is.

---

## 1. The 60-second mental model

Before touching the app, here's the whole picture in one paragraph:

DNA is a long text string made of only four letters — **A, T, G, C**. Certain stretches of
that string are "genes": instructions for building a protein. The cell reads a gene three
letters at a time (each triplet is called a **codon**), and each codon corresponds to one
building block of a protein (an **amino acid**). String the amino acids together and you get
a protein — the thing that actually *does* something in a cell (glows, catalyzes a reaction,
etc.). A **plasmid** is a small circular loop of DNA — separate from a cell's main
chromosome — that carries a handful of genes plus the "control" sequences that tell the cell
when and how much to read them. Genetic engineering is, at its core, editing that DNA text
and reasoning about what changes downstream: DNA → protein → behavior.

Helix IDE lets you load a real plasmid, look at every layer of that pipeline at once, edit
the text, and watch the consequences ripple through immediately — the same way you'd edit
source code and watch a compiler or linter react.

---

## 2. Getting it running

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Everything runs in your browser;
no data leaves your machine, there's no account, no server.

---

## 3. The screen, piece by piece

```
┌─────────────────────────────────────────────────────────────┐
│ Helix IDE / <construct name>              [Import] [Explain]│  ← Top bar
├───────────────┬───────────────────────────────┬─────────────┤
│ CONSTRUCTS &  │                               │  INSPECTOR   │
│ FEATURES      │      MAIN VIEW (8 tabs)       │  (stats for  │
│ (left panel)  │                               │  whatever's  │
│               │                               │  selected)   │
├───────────────┴───────────────────────────────┴─────────────┤
│                    FEATURE MAP STRIP                         │
├─────────────────────────────────────────────────────────────┤
│ Sequence Map Protein Mutations Restriction PCR Compare Assembly│  ← tabs
└─────────────────────────────────────────────────────────────┘
```

- **Top bar** — the app name, the currently loaded construct's name, an **Import** button
  (drag-and-drop a `.fasta`/`.gb` file also works anywhere on the page), and the **Explain**
  toggle (more on this in §11).
- **Left panel ("Constructs")** — a "Load example…" dropdown with three built-in constructs,
  a list of every construct you've loaded or created (assemblies, forks from mutations, etc.),
  and — once one is selected — a list of its **features** (genes, promoters, etc.). Clicking
  a feature here jumps to it everywhere else in the app.
- **Main view** — one of eight tabs, described in §5 onward. This is where you spend most of
  your time.
- **Inspector (right panel)** — read-only stats that update live: the construct's length,
  topology (linear vs. circular), and GC%; whatever feature is currently active; and whatever
  base range you have selected in the sequence.
- **Feature map strip** — a thin, always-visible bar showing where every feature sits along
  the sequence, so you never lose your place while a tab is showing something else.

**Cross-highlighting** is the app's central trick: click a feature almost anywhere (the left
panel, the feature map, the circular plasmid, a mutation row) and every other panel jumps to
match it. Get in the habit of clicking things — that's how the app teaches.

---

## 4. Your first five minutes: a guided walkthrough

This mirrors the intended "aha" moment of the whole product.

1. **Load an example.** In the left panel, open "Load example…" and pick **Educational
   Plasmid**. You now have a small circular plasmid loaded — think of it as a minimal,
   fictional version of the kind of plasmid used constantly in real labs.

2. **Look at the Map tab.** Click **Map** in the bottom tab bar. You'll see a circle (the
   plasmid) with colored arcs around it — each arc is a feature: an origin of replication
   (lets the plasmid copy itself inside a cell), a selectable marker (a gene that lets you
   filter for cells that took up the plasmid), a promoter (a DNA "switch" that turns on the
   gene next to it), and a reporter gene — here, GFP, Green Fluorescent Protein, the protein
   that makes jellyfish (and now, thanks to genetic engineering, lots of lab organisms) glow
   green. Click any arc; the sequence editor and inspector jump to that region.

3. **Translate the gene.** Click the **Protein** tab. Expand the GFP block. You'll see the
   raw DNA grouped into codons, aligned under the amino acids they produce — literally the
   process of "DNA becomes protein," laid out letter by letter.

4. **Make a mutation and watch it break something.** Go back to **Sequence**, click-drag to
   select a single base somewhere inside the GFP gene (the inspector will confirm you're
   inside "GFP"). Switch to the **Mutations** tab — your selection carries over. Type a
   different letter into the "Replacement" box and click **Substitute**. A new mutation
   appears in the list; click it to see exactly what happened: which codon changed, which
   amino acid changed, and what *category* of mutation it was (see §8).

5. **Compare before and after.** Open **Compare**. Because introducing a mutation
   automatically keeps your untouched original around, you'll see a three-layer diff: the raw
   DNA change, any feature-level change, and — if the mutation landed inside a gene — the
   resulting protein-sequence change, all in one view.

That loop — *select → mutate → see the consequence → compare* — is the app's whole reason
for existing. Everything below is a deeper tour of each tool.

---

## 5. Sequence view — the DNA text editor

This is the raw nucleotide sequence, rendered as monospaced letters, colored by base
(A/T/G/C each get a distinct color), with position numbers down the left edge (biologists
count bases starting at **1**, not 0 — the app follows that convention everywhere you see a
number on screen).

- **Select a range**: click and drag across bases. The Inspector panel immediately shows the
  selection's length and GC%.
- **Search**: type into the search box at the top. It does an exact, case-insensitive text
  match and highlights every hit — useful for finding a specific motif, primer sequence, or
  restriction site by eye.
- **Reverse complement**: select a range and click **Reverse Complement** to see its
  complementary strand read in the opposite direction. This matters because DNA is
  double-stranded and the two strands run in opposite chemical directions (labeled 5′ and 3′)
  — a concept that trips up almost everyone new to biology. Turn on Explain Mode (§11) before
  clicking it the first time; it walks through complement-then-reverse as two separate steps.

This view can smoothly handle very large sequences (it only renders the rows currently on
screen), so don't hesitate to load something big.

---

## 6. Map view — seeing the architecture instead of reading letters

Two visualizations, depending on the construct's topology:

- **Circular plasmid view** (for circular constructs): the classic "plasmid map" you've
  probably seen in a biology paper — a ring with arcs around the outside for each feature,
  arrows showing which DNA strand (direction) each feature is read from, and tick marks for
  position. Click an arc to jump to it everywhere else.
- **Linear feature map** (for linear constructs, or as a strip at the bottom of the screen
  always): the same idea stretched out as a horizontal ruler.

This tab answers the question "what is this piece of DNA actually *for*, at a glance,"
without reading a single base.

---

## 7. Protein view — reading DNA as instructions

Two sections:

- **Detected ORFs** (Open Reading Frames) — the app scans the sequence in all six possible
  reading directions (3 forward, 3 reverse-complement — DNA can, in principle, be read
  starting at any of three offsets, and from either strand) and lists every stretch that
  starts with a start codon (`ATG`, i.e. Methionine) and ends with a stop codon, long enough
  to plausibly be a real gene. This is exactly how a computer (or a cell's machinery) finds
  candidate genes in a sequence with no annotations at all.
- **Annotated CDS blocks** — for every feature explicitly marked as a coding sequence in the
  file, you get its full codon-by-codon translation: DNA on top, the amino acid it produces
  underneath, e.g.

  ```
  ATG GGT TTT GAA TAA
   M   G   F   E   *
  ```

  The `*` marks the stop codon — the "end of instructions" signal, which is not itself
  translated into an amino acid.

- **Codon optimization** — expand this inside any CDS block and pick an organism (*E. coli*,
  human, or yeast). This is the single most counter-intuitive idea in the whole app: because
  most amino acids can be produced by more than one codon (the genetic code is
  **redundant/degenerate**), you can rewrite a gene's DNA almost completely while the protein
  it produces stays *byte-for-byte identical*. The panel shows exactly which codons changed
  and how the GC% shifted, with the protein sequence pinned as unchanged proof. This matters
  in real genetic engineering because different organisms have different codon "preferences"
  — a gene written for a human cell often expresses poorly in bacteria until it's optimized
  this way.

---

## 8. Mutations view — cause and effect

Select a range in **Sequence**, then come here. Three actions:

- **Substitute** — replace the selected bases with typed-in bases.
- **Insert Before** — insert typed bases immediately before the selection.
- **Delete Selection** — remove the selected bases entirely.

Every mutation you make is recorded and classified into one of these categories — the
vocabulary real geneticists use to describe what a DNA change *does*:

| Category | Meaning |
|---|---|
| **Synonymous** | The codon changed, but it still codes for the same amino acid (thanks to codon redundancy) — no protein change at all. |
| **Missense** | The codon now codes for a *different* amino acid — the protein changes at one position. |
| **Nonsense** | The codon changed into a *stop* codon — the protein gets cut short. |
| **Frameshift** | An insertion/deletion whose length isn't a multiple of 3, which shifts every codon boundary downstream — this scrambles essentially the entire rest of the protein, because the "reading grid" itself moved. |
| **Start-loss** | The mutation destroyed the gene's start codon — the cell may no longer know where to begin reading it. |
| **Stop-loss** | The mutation destroyed the gene's stop codon — translation may run on past where it should have ended. |
| **Noncoding** | The change falls outside any coding sequence — no protein-level effect to report. |

Click any mutation in the list to expand its full detail: position, DNA change, affected
codon, resulting amino-acid change, and its category — the same structured explanation a
real variant report would give you.

---

## 9. Restriction view — molecular scissors

**Restriction enzymes** are proteins (borrowed from bacteria, which use them as a defense
system) that cut DNA at very specific short recognition sequences — e.g. the enzyme EcoRI
only cuts wherever it sees `GAATTC`. They're one of the oldest and still most common tools
for physically cutting and recombining DNA in a lab.

- The left column lists a curated set of common enzymes; check/uncheck them (or use
  **All**/**None**) to control which ones are searched for.
- The main table lists every cut site found for your enabled enzymes: which enzyme, where it
  cuts, and which strand. A **★** marks *unique cutters* — enzymes that cut your construct
  exactly once, which matters a lot practically: cutting with a unique cutter linearizes a
  plasmid cleanly instead of chopping it into many pieces.
- Below that, **Fragments** shows the sizes you'd get if you cut with every currently-enabled
  enzyme simultaneously — this is the calculation behind reading a real gel-electrophoresis
  result, where fragment sizes are literally how you'd verify a cloning experiment worked.
- Click any row to jump to that location in the sequence.

---

## 10. PCR view — copying a specific region

**PCR (Polymerase Chain Reaction)** is how you make millions of copies of one specific
stretch of DNA. It works by using two short synthetic DNA snippets called **primers** — one
that binds the top strand and points "forward," one that binds the bottom strand and points
"backward" — as bookends; everything between where they bind gets copied repeatedly.

The view is a two-step workflow:

1. **Design primers** — select a target region in the **Sequence** tab first, then come back
   here. The app proposes forward- and reverse-primer candidates near the edges of your
   selection, each scored with length, GC%, and estimated melting temperature (**Tm** — the
   temperature at which a primer detaches from its target; real PCR protocols are built
   around this number). Click **Use** on any candidate to load it into the simulation below.
2. **Simulate PCR** — with a forward and reverse primer entered, click **Simulate PCR**. On
   success you'll see exactly where each primer bound and the resulting **amplicon** (the
   copied product) with its length and full sequence. On failure, the app explains *why* in
   plain language — a primer didn't match anywhere, the two primers point away from each
   other instead of toward each other (PCR only works between two inward-facing binding
   sites), or the primers match more than one place (meaning the reaction wouldn't be
   specific to a single product in real life).

This view is where "which direction is this primer facing" — one of the most persistently
confusing ideas for people new to molecular biology — becomes something you can just look at.

---

## 11. Compare view — DNA's version of a code diff

Pick a second construct from the dropdown (or, if you've made any mutations, your original
un-mutated copy is offered automatically — Helix keeps a pristine reference the moment you
touch a sequence). You get three diffs stacked vertically:

- **DNA Diff** — the literal nucleotide-level alignment, with matches, mismatches,
  insertions, and deletions marked.
- **Feature Diff** — which annotated features were added, removed, or moved.
- **Protein Diff** — for every coding sequence present in both constructs, if its translated
  protein differs at all, you get the amino-acid-level diff too.

This is deliberately built to feel like `git diff`: same underlying idea (find the minimal
set of changes between two versions of something), applied to biology instead of code.

---

## 12. Assembly view — building a construct out of parts

Real genetic engineering very often means combining pieces from different sources: a
"backbone" from one plasmid, a promoter from another, a gene of interest, a terminator. This
view lets you do that virtually:

1. In the left panel, add fragments — either an entire other loaded construct, or (select a
   range in **Sequence** first) just a piece of one.
2. Reorder fragments with the ↑/↓ buttons; remove any with ✕.
3. Name the result, optionally check **Circularize** (to produce a plasmid instead of a
   linear piece of DNA), and click **Assemble**.

The output is a brand-new construct — sequence and features stitched together in order — that
immediately appears in your construct list and can be inspected, mutated, or compared like
any other.

---

## 13. Explain Mode

The **Explain** toggle in the top bar turns on step-by-step biological reasoning wherever an
operation supports it (currently reverse complement and translation). Instead of just showing
you an answer, it shows the intermediate steps — e.g. for reverse complement:

```
Original           5' ATGCCGTA 3'
Complement          3' TACGGCAT 5'
Reverse Complement  5' TACGGCAT 3'
```

Leave it on while you're still building intuition; turn it off once an operation feels
obvious and you just want the answer.

---

## 14. Loading your own DNA

Drag a `.fasta`/`.fa`/`.fna` or `.gb`/`.gbk` file anywhere onto the window, or use the
**Import** button in the top bar.

- **FASTA** files are just an identifier line plus raw sequence — no annotations. You'll be
  able to inspect the sequence, translate it, find ORFs, etc., but there won't be any
  pre-labeled features until the app (or you, conceptually) identifies them.
- **GenBank** (`.gb`/`.gbk`) files carry rich annotations — features, their types, positions,
  strand, and sometimes pre-computed protein translations — so a GenBank file gives you the
  full experience immediately, features and all.

Good places to find real, freely available example files: NCBI GenBank, Addgene (plasmid
repository — most entries offer a GenBank download), and iGEM's registry of standard
biological parts.

---

## 15. Mini glossary

| Term | Plain-language meaning |
|---|---|
| Nucleotide / base | One letter of DNA: A, T, G, or C. |
| Strand | DNA is double-stranded; the two strands run in opposite chemical directions (5′→3′ and 3′→5′) and are complementary (A pairs with T, G pairs with C). |
| Gene | A stretch of DNA that encodes a protein (or functional RNA). |
| CDS (coding sequence) | The exact portion of a gene that gets translated into protein, from start codon to stop codon. |
| Codon | A group of 3 DNA/RNA letters; the unit the cell reads to pick one amino acid. |
| Reading frame | Which of the 3 possible letter-groupings you use to split a sequence into codons — get it wrong and you read complete nonsense. |
| ORF (open reading frame) | A candidate gene: a run of codons starting with a start codon and ending with a stop codon, with no stop codons in between. |
| Amino acid | One building block of a protein; there are 20 standard ones. |
| Promoter | A DNA sequence that acts as an "on switch," recruiting the cell's machinery to start reading the gene next to it. |
| Terminator | A DNA sequence that tells the cell's reading machinery to stop. |
| Plasmid | A small, usually circular, self-copying loop of DNA separate from an organism's main genome — the workhorse tool of genetic engineering. |
| Topology | Whether a DNA sequence is linear (has two ends) or circular (loops back on itself, like a plasmid). |
| Origin of replication | The DNA sequence a plasmid needs so the host cell knows to copy it. |
| Selectable marker | A gene (often antibiotic resistance) added to a plasmid so you can filter for cells that successfully took it up. |
| Mutation | Any change to a DNA sequence: a substitution, insertion, or deletion. |
| GC content | The percentage of a sequence that is G or C rather than A or T; affects DNA stability and is a common design constraint. |
| Restriction enzyme | A protein that cuts DNA at a specific short recognition sequence. |
| Primer | A short synthetic DNA snippet used to mark a starting point for copying DNA (as in PCR). |
| Amplicon | The DNA product copied/amplified by PCR. |
| Tm (melting temperature) | The temperature at which a primer detaches from its DNA target — a key parameter in designing real PCR reactions. |
| Codon optimization | Rewriting a gene's DNA to use an organism's preferred codons, without changing the protein it produces. |
| Missense / nonsense / synonymous / frameshift | Categories describing what effect a DNA mutation has on the resulting protein (see §8). |
