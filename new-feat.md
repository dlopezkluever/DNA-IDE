please make a detailed spec and implementation plan for this feature (put the plan in a markdown file) ->
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


(From my idea 3: 
# 3. Recreate directed evolution entirely in software

**Time: ~3–4 weeks**

This one I'd particularly recommend for you.

Build:

**Evolution-as-an-optimization-algorithm.**

Start with a known protein.

Generate:

```text
parent sequence
     ↓
1000 variants
     ↓
fitness prediction
     ↓
select best 50
     ↓
mutate/recombine
     ↓
1000 descendants
     ↓
repeat
```

Visualize the resulting fitness landscape.

Then compare different strategies:

* random mutation
* hill climbing
* evolutionary algorithms
* Bayesian optimization
* LLM/protein-model-guided mutation

You're essentially recreating **directed evolution computationally**.

That teaches an extremely important principle:

Biology frequently doesn't require understanding every mechanism first. You can search enormous biological design spaces experimentally.

**Founder skill gained:** biological optimization.))