# What to Build Next on Helix IDE

## Where things stand

Helix IDE currently ships all 12 MVP features from the PRD, plus Explain Mode and three
built-in example constructs — the full "Definition of Done" (PRD §40) is met. Under the hood
there's a clean, framework-free `src/biology/` engine (sequence, translation, ORF detection,
mutations, restriction, primers, PCR, alignment, assembly, codon optimization), each module
independently unit-tested, sitting behind a Zustand store and eight IDE-style views. That
engine — not the UI — is the valuable, reusable asset. Almost everything below is really "what
new capability can I bolt onto `src/biology/` and give a tab," not a rewrite.

I pulled ideas from three places: your `my-ideas.md` list, the PRD's own §37 "Stretch
Features" (things you scoped out on purpose to hit the 4-week MVP), and my own read of what
fits the existing architecture well. I've grouped them by how big a lift they are and how well
they reuse what's already built, and elaborated most on the ones I'd actually prioritize.

---

## Tier 1 — Finish the IDE metaphor (days, not weeks)

These are cheap specifically *because* the engine underneath already exists — each one is
mostly a new view or a small addition to an existing one. All are already named in PRD §37,
so building them isn't scope creep, it's just moving from MVP to v1.1.

### Command Palette ⭐ — my top pick to build first

A `Cmd+K` overlay: type `> translate selection`, `> reverse complement`, `> find ORFs`,
`> show restriction sites`, `> compare with...` and it runs the action and/or jumps to the
right tab with the right selection already applied. Every one of these actions already exists
as a function call somewhere in the codebase (`translateFeature`, `reverseComplement`,
`findORFs`, `findRestrictionSites`...) — this is a thin dispatch layer over functions you've
already written and tested, not new biology. It's disproportionately high-leverage because
it's the single most literal expression of the product's core pitch ("VS Code for genetic
constructs") — right now the IDE analogy lives in the visual language; a command palette makes
it something you *feel* by using it. I'd timebox this to a day or two.

### Mutation Heatmap ⭐

For any selected CDS, compute all three possible substitutions at every position (there are 3
alternatives × sequence length possibilities) and classify each one with the *already-built*
`classifyMutation` engine, then render it as a color-coded grid: rows = the 4 possible bases,
columns = position, color = consequence (synonymous/missense/nonsense/frameshift). This is
literally a `for` loop wrapping `mutations.ts` plus an SVG/canvas grid — no new biological
logic at all, just running the existing single-mutation engine exhaustively. The payoff is
disproportionate: it visually proves, at a glance, facts that are otherwise abstract — that
third-codon-position mutations are overwhelmingly synonymous (this is *why* the genetic code
is called "degenerate," and why codon optimization in the Protein tab works at all), and that
mutation tolerance is wildly uneven across a gene. This is the single best "wow, I actually
understand this now" feature you could add for the effort involved.

### Construct History (git-log for DNA)

The README already describes a "fork-once mutation model" — the moment you introduce a
mutation, Helix quietly keeps your pristine original around so Compare has something to diff
against. That's 80% of a version-history feature already. Making it explicit — a small commit
graph in the left panel (`v1 original → G431A → Δ650-653 → promoter replacement → v4`, per PRD
§37) with click-to-checkout-any-version — turns an implicit implementation detail into a
feature, and it's the most direct payoff of the "git diff, but for DNA" framing from your own
idea #2. Natural pairing with the Command Palette (`> checkout v2`).

### Amino-acid property annotations

When the Mutations view shows a missense change (e.g. `Gly281Ser`), also show whether the
substitution changes charge, polarity, size, or hydrophobicity (a static lookup table per
amino acid — no algorithm needed). This is the difference between "the amino acid changed"
and "the amino acid changed from small/nonpolar to small/polar, which is usually tolerated" —
real protein-engineering intuition, for the cost of one data table and one new `<span>` in
`MutationList.tsx`.

### Genome Browser Mode

The sequence editor already virtualizes rendering via `react-window`, so raw scale isn't the
blocker — this is really about the *Map* view: right now the linear/circular feature maps
assume a plasmid-sized construct. Supporting a multi-hundred-kb genomic region means adding
pan/zoom to the linear map and probably a minimap. Worth doing only if you want to load
something bigger than a plasmid (e.g. a viral genome or a bacterial operon cluster).

---

## Tier 2 — New flagship tools (each earns its own tab)

Bigger than Tier 1, but each one reuses at least one existing module heavily and stays 100%
client-side, consistent with the current architecture.
 please make a detailed spec and implementation  plan markdown doc  to build the following feature into our application:"""
### CRISPR guide RNA designer ⭐⭐ — the biggest genuine gap in the toolkit

Your idea #1, and worth calling out specifically: the PRD explicitly listed "CRISPR guide
design" under **Out of Scope for V1** (§36) — reasonably, since cramming it into a 4-week MVP
alongside everything else would've diluted focus. But now that the MVP is done, it's the most
obvious next flagship feature, because it's the one major category of "genetic engineering
tool" the app doesn't have yet: you can currently *read*, *cut with restriction enzymes*, and
*recombine* DNA, but not *edit it at a targeted site the way modern gene editing actually
works*. Concretely, a new **CRISPR** tab would:

1. Scan the loaded construct for every occurrence of a PAM sequence (for the standard SpCas9
   system, `NGG`, on both strands) — this is pure string scanning, same shape as
   `findRestrictionSites`.
2. For each PAM hit, extract the 20 bp upstream as a candidate guide RNA sequence.
3. Score each candidate on the things that are calculable from sequence alone without a
   trained model: GC content in a favorable range, absence of runs of 4+ identical bases (poly-T
   in particular terminates transcription early for the guide itself), and distance from a
   feature's start (if you want to design a knockout, cutting near the start codon matters).
4. Flag **off-target sites within the currently loaded construct only** — i.e. does this same
   ~20mer (or a close match, allowing a couple of mismatches) occur anywhere else in *this*
   sequence — which is an honest, useful, and fully client-side computation. Deliberately do
   **not** claim to do genome-scale off-target prediction against a real organism's genome;
   that needs an indexed reference genome and real off-target scoring models, which is a
   different (and much heavier) product. Being explicit about that boundary keeps this
   squarely in the same "educational, not lab-execution-grade" lane the rest of the PRD holds
   to (§36 already rules out "laboratory execution instructions" and clinical/organism-editing
   workflows generally — keep this the same way: computational and visual, not a protocol
   generator).
5. Visualize candidate guides on the sequence/map exactly like restriction sites are today —
   this reuses the highlighting and cross-navigation patterns you already built for
   Restriction.

This is a genuinely great fit for the codebase: same shape of problem as restriction-site
finding (motif scanning + scoring + visualizatio, extends the existing UI vocabulary instead
of inventing a new one, and closes the single mosn)t obvious conceptual gap between "DNA IDE"
and "genetic engineering IDE."
"""
### Protein structure viewer + mutation mapping ⭐

Your idea #3, scoped down to something buildable client-side: pick one well-characterized
protein Helix already ships an example for (GFP is the natural choice — its structure, PDB ID
`1EMA`, is public domain and small). Render its 3D structure (a lightweight WebGL/Three.js
viewer, or even a simpler ribbon/cartoon renderer if you want to hand-roll it per the PRD's
"implement it yourself first" ethos) and, critically, wire it into the *existing* mutation
pipeline: when a mutation lands inside the GFP CDS in the Mutations tab, highlight the
corresponding residue in 3D. This turns "Gly281Ser" from a string into a point on an actual
structure, and answers the question every beginner eventually asks: *does it matter WHERE in
the protein a mutation lands, not just what it changes to?* (Answer: enormously — a mutation
in a buried structural core behaves completely differently from one on a floppy surface loop,
even if both are technically "missense.") This is the natural bridge to your idea #2 (protein
engineering workbench) — you don't need a separate app, you need this feature added to the one
you have.

### Sequence alignment / homology tool

`alignment.ts` already implements pairwise sequence alignment (it's what powers the DNA/protein
diffs in Compare). Promoting that into its own standalone tool — paste or pick *any* two
arbitrary sequences (not just "construct vs. its own original") and align them, with a
similarity score and visualized gaps — is a small UI addition, not new biology. Useful on its
own (e.g. "is my construct's GFP the same variant as this other one I found online") and sets
up local/BLAST-style "does this sequence look like anything in my example library" search
later if you want it.

### Gene circuit simulator

Your idea #5, and it fits unusually well because the **Assembly** view already lets you
arrange promoter/repressor/reporter fragments spatially — a **Circuit** tab could reuse that
same fragment-arranging UI, but instead of concatenating DNA, it'd interpret the arrangement
as a small system of ODEs (Hill-function-based gene expression, the standard textbook model)
and simulate expression levels over time with a simple RK4 integrator — genuinely just a
`for` loop of vector math, no library needed, keeping with the PRD's "implement it yourself"
philosophy. Recreating the classic **genetic toggle switch** or **repressilator** (both famous,
well-documented synthetic-biology circuits) and letting a user perturb concentrations and
watch the plot is a great capstone demo: it's the first place in the app where DNA parts
produce *dynamic behavior* rather than a static analysis. Biggest lift in this tier — budget
2-3 weeks — but the payoff is a fundamentally new kind of insight (circuits, not just
sequences) using an engine you mostly already have (Assembly) plus one genuinely new module
(`biology/circuit.ts`).

---

## Tier 3 — Advanced / AI-assisted computational biology

These are heavier, and some of them break the "100% client-side, implement-it-yourself" ethos
that's made the project valuable so far — flagging that tradeoff explicitly for each.

### Directed evolution / in-silico evolution engine

Your ideas #8 and #9, and the "founder path" doc's step 3 both point here — worth building as
one feature, not two, since population-based mutation-and-selection is the same core loop
either way. Concretely: start from a parent sequence, generate N variants using the *existing*
mutation engine, score them against a chosen objective (start simple and honest: something
computable client-side like "GC% closer to a target," "fewer restriction sites for a chosen
enzyme," or reusing the Mutation Heatmap's classification to select for "more synonymous, fewer
disruptive" changes), keep the top performers, repeat, and plot the population's fitness over
generations. This stays entirely within what you can compute without a trained ML model, which
matters: it's honest about being an *optimization algorithm demo*, not a claim that it predicts
real protein fitness. It directly teaches the "founder path" doc's stated lesson — that
biological search often doesn't require mechanistic understanding, just an evaluable objective
and a search strategy — and it's a great place to let a user compare strategies side by side
(random mutation vs. hill-climbing vs. a basic genetic algorithm) on the same starting
sequence.

### AI protein mutation explorer (real protein language models)

This is your idea #3's other half — actually calling a trained protein language model (e.g. an
ESM-family model) to predict whether a mutation is stabilizing/destabilizing, rather than just
visualizing structure. Flagging honestly: this is the first idea in this whole list that can't
stay "100% client-side, implement it yourself," because these models are large and need either
a backend service or a hosted API call. If you want this, it's the natural trigger for finally
adding the "optional lightweight backend" the PRD already anticipated (§23) — but I'd treat it
as a deliberate, separate decision (do you want to introduce a backend at all?) rather than
something to reach for by default.

### Gene regulatory network visualizer

Idea #11. Interesting, but it's a genuinely different kind of tool — it's about *inferring*
relationships from external expression datasets, not inspecting a construct you loaded. I'd
treat this as a separate side-project rather than a Helix IDE tab; it doesn't share much of the
`biology/` engine.

### DNA data storage encoder (fun side quest)

Idea #12. Doesn't advance the "genetic engineering" learning goal much, but it's a genuinely
fun, self-contained weekend build (encode a small file into ATGC + error-correcting codes,
simulate random mutation, reconstruct) if you want a break from the main roadmap. Wouldn't
prioritize it, but wouldn't talk you out of it either.

---

## Tier 4 — The bigger arc (from your other notes doc)

The longer document in `my-ideas.md` (protein engineering workbench → directed evolution →
wet lab → engineered circuit → lab automation → biofoundry → DNA synthesis) is a different kind
of roadmap — it's a multi-year skills/career progression, not a feature list for this app. It's
worth naming explicitly where Helix IDE already sits on that path and where it stops:

- Helix IDE **is** that document's implicit step zero — "understand the abstractions by
  building the tools yourself" — and it's already done.
- Its **step 2** (protein engineering workbench) and **step 3** (directed evolution) map almost
  exactly onto Tier 2's structure viewer and Tier 3's evolution engine above — you don't need a
  separate app for either, you need these two features added to this one.
- Its **step 4 onward** (get into an actual lab, engineer a fluorescent circuit physically,
  build a Raspberry-Pi measurement rig, a biofoundry, eventually DNA synthesis itself) is
  genuinely outside "what to build onto this platform" — it's wet-lab and hardware work. But
  it's worth noting that the Tier 2 Circuit simulator above is a legitimate *rehearsal* for that
  step: model a circuit computationally first (predicted), then — if/when you do get into a
  physical lab — build the same circuit and plot predicted-vs-observed, exactly as that document
  describes. Building the simulator now costs you nothing and pays off twice.

---

## If I had to pick one thing to build next

**Mutation Heatmap**, immediately followed by the **Command Palette**. Both are small (days,
not weeks), both use only code you've already written and tested, and together they'll make
the app feel noticeably more like a finished tool rather than an MVP the very first time you
open it again. Once those land, **CRISPR guide designer** is the right next flagship feature —
it's the most-requested single addition (your #1 idea), it's the one category of real genetic
engineering tool the app is currently missing, and its scoring/scanning logic is a close cousin
of restriction-site finding you've already built once.
