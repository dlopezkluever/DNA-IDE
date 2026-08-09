# Product Requirements Document

## DNA IDE

**Working Title:** Helix IDE
**Product Type:** Desktop-first web application
**Primary Goal:** Learn molecular biology and genetic engineering concepts by building an interactive environment for inspecting, editing, comparing, and reasoning about DNA constructs.
**Target Build Time:** 3–4 weeks
**Primary User:** Technical builder learning synthetic biology
**Product Philosophy:** VS Code for genetic constructs, optimized for understanding rather than professional laboratory workflow replacement.

---

# 1. Product Summary

Helix IDE is an interactive DNA sequence workbench that allows users to load biological sequence files, inspect their annotated structure, make virtual edits, analyze the consequences of those edits, and simulate common molecular biology operations.

The product should make DNA feel less like an opaque biological artifact and more like an inspectable engineering object.

A user should be able to move fluidly between:

- raw nucleotide sequence
- annotated genetic features
- protein translation
- mutation consequences
- restriction enzyme sites
- primer design
- PCR simulation
- construct comparison
- virtual plasmid assembly
- codon optimization

The application is primarily educational and computational. It does **not** control laboratory equipment, order DNA, automate wet-lab execution, or provide workflows for modifying pathogenic organisms.

---

# 2. Why Build This

The purpose of the project is not to compete with Benchling, SnapGene, Geneious, or other mature bioinformatics products.

The purpose is to force the developer to understand the abstractions those tools hide.

By implementing the underlying logic, the developer should acquire practical familiarity with concepts including:

- DNA sequences
- nucleotides
- strands and orientation
- genes
- coding sequences
- open reading frames
- promoters
- terminators
- plasmids
- annotations
- codons
- amino acids
- translation
- mutations
- restriction enzymes
- primers
- PCR
- cloning
- Gibson-style assembly concepts
- codon usage
- protein sequence changes
- construct comparison

The success criterion is therefore partly educational:

> At the end of the project, inspecting and modifying a plasmid should feel conceptually similar to inspecting and modifying source code.

---

# 3. Product Vision

The long-term conceptual vision is:

> **An IDE where DNA is code, biological features are program structure, mutations are diffs, and molecular biology operations are development tools.**

The interface should borrow ideas from software development environments.

Examples:

| Software IDE Concept | DNA IDE Equivalent               |
| -------------------- | -------------------------------- |
| Source file          | DNA sequence                     |
| Syntax highlighting  | Feature annotation               |
| Function             | Gene/CDS                         |
| Compiler output      | Protein translation              |
| Git diff             | Sequence comparison              |
| Linter warning       | Mutation / frame / motif warning |
| Search               | Motif / sequence search          |
| Build operation      | Virtual construct assembly       |
| Dependency map       | Feature relationships            |
| Debugging            | Mutation consequence analysis    |

The analogy should guide the UX without being forced where it does not fit biologically.

---

# 4. Target User

## Primary User

A software engineer or technically capable beginner learning molecular biology and synthetic biology.

The user:

- understands programming
- may have little wet-lab experience
- wants biological intuition rather than memorized vocabulary
- learns best by building and manipulating systems
- wants to understand common genetic-engineering workflows

## Secondary User

A biology student who wants an intuitive visual tool for understanding DNA constructs.

## Explicit Non-Goals

The initial product is not intended for:

- clinical use
- diagnostic interpretation
- production laboratory management
- automated DNA ordering
- organism engineering workflows
- pathogen engineering
- human genome editing
- regulatory submission
- laboratory inventory management

---

# 5. Core User Experience

A new user opens Helix IDE.

They drag in a GenBank file.

The application immediately displays:

1. the complete DNA sequence
2. a linear feature map
3. a circular plasmid map when appropriate
4. annotated features
5. sequence length
6. GC percentage
7. predicted ORFs
8. known CDS translations

The user clicks a coding sequence.

The sequence editor highlights that region.

A side panel displays:

- nucleotide sequence
- amino-acid translation
- reading frame
- strand orientation
- length
- start and stop codons
- annotations

The user changes one nucleotide.

Helix immediately shows:

> GAA → GTA
> Glutamate → Valine
> Missense mutation

The corresponding amino acid is highlighted in the protein view.

The user can then compare the modified construct against the original and see the mutation as a DNA-level and protein-level diff.

That interaction represents the core experience of the product.

---

# 6. Core Product Principles

## 6.1 Biology must remain visible

Do not hide important biological concepts behind buttons.

For example, when translating DNA, show:

- reading frame
- codon boundaries
- resulting amino acids

When simulating PCR, show:

- forward primer
- reverse primer
- their binding locations
- expected amplicon

## 6.2 Every operation should teach something

Whenever possible, operations should explain what happened.

Example:

Instead of:

> Mutation applied.

Show:

> Position 542 changed from G → A.
> Codon changed GGC → GAC.
> Amino acid changed Gly → Asp.
> Mutation type: missense.

## 6.3 Visual + textual representations should coexist

Users should be able to inspect a construct as:

- raw DNA
- annotated DNA
- feature map
- plasmid map
- translated protein
- sequence diff

## 6.4 Immediate feedback

Most analysis should happen locally and update immediately after sequence changes.

The product should feel like an IDE, not like submitting jobs to a bioinformatics portal.

---

# 7. MVP Scope

The MVP contains twelve core capabilities.

---

# 8. Feature 1: FASTA and GenBank Import

## Description

Users can upload biological sequence files and create a construct.

## Supported Formats

### FASTA

Parse:

- sequence identifier
- description
- nucleotide sequence

### GenBank

Parse:

- sequence
- locus information
- annotations
- feature locations
- feature types
- feature labels
- strand orientation
- CDS translation where available

## Requirements

The system must:

- accept `.fasta`, `.fa`, `.fna`, `.gb`, and `.gbk`
- normalize DNA to uppercase
- validate nucleotide characters
- preserve annotations
- identify circular versus linear constructs when metadata permits

## User Story

> As a user, I want to load an existing plasmid or DNA sequence so that I can inspect its structure.

## Acceptance Criteria

A valid GenBank file produces:

- visible sequence
- feature annotations
- sequence length
- topology
- clickable feature map

---

# 9. Feature 2: DNA Sequence Editor

## Description

A nucleotide-aware text editor forms the center of the application.

## Requirements

The editor should provide:

- monospaced DNA display
- base position numbering
- nucleotide selection
- mutation editing
- search
- reverse complement
- selected-region statistics
- feature highlighting
- codon highlighting when inside a CDS

Optional syntax coloring:

- A
- T
- G
- C

Avoid excessive coloring if it harms readability.

## Search

Support searching for:

- exact nucleotide sequence
- feature names
- short motifs

## User Story

> As a user, I want to edit a DNA sequence directly and immediately see the biological consequences.

---

# 10. Feature 3: Genetic Feature Visualization

## Description

Visualize annotated biological features along the DNA construct.

## Supported Feature Types

At minimum:

- gene
- CDS
- promoter
- terminator
- origin of replication
- regulatory region
- misc feature

## Linear Map

Display features according to sequence coordinates.

Each feature should show:

- label
- start
- end
- direction
- type

## Circular Plasmid View

For circular constructs, provide a plasmid visualization.

The user should be able to click a feature on the plasmid and jump to its location in the sequence editor.

## User Story

> As a user, I want to see the architecture of a construct instead of reading thousands of bases manually.

---

# 11. Feature 4: ORF Detection and DNA → Protein Translation

## Description

Translate DNA sequences into amino-acid sequences.

## Requirements

Support:

- all three forward reading frames
- optionally three reverse-complement reading frames
- standard genetic code
- start codon identification
- stop codon identification
- annotated CDS translation
- user-selected region translation

## Translation View

Display nucleotide codons aligned with amino acids.

Example:

```text
ATG GGT TTT GAA TAA
 M   G   F   E   *
```

Hovering over an amino acid should highlight its corresponding codon.

## ORF Detection

Identify candidate open reading frames based on start/stop codons.

Display:

- frame
- coordinates
- nucleotide length
- amino-acid length
- strand

## User Story

> As a user, I want to see how a nucleotide sequence becomes a protein.

---

# 12. Feature 5: GC Content Analysis

## Description

Calculate GC content for the complete construct and selected regions.

## Requirements

Display:

- overall GC %
- selected-region GC %
- local GC distribution

## Optional Visualization

Sliding-window GC graph across the sequence.

## User Story

> As a user, I want to understand nucleotide composition and see how GC content varies across my construct.

---

# 13. Feature 6: Restriction Site Explorer

## Description

Identify recognition sites for common restriction enzymes.

## Requirements

Maintain an internal dataset containing a curated set of common restriction enzymes.

For each site display:

- enzyme name
- recognition sequence
- position
- number of occurrences

Users should be able to:

- search enzymes
- enable/disable enzymes
- highlight all cutting locations
- identify unique cutters
- inspect the resulting virtual fragments

## Fragment Simulation

Selecting an enzyme should display expected fragment sizes.

Example:

```text
EcoRI cuts:
1,204
4,981

Fragments:
3,777 bp
2,143 bp
```

For circular DNA, fragment calculations must wrap across the origin correctly.

## User Story

> As a user, I want to understand how restriction enzymes interact with a DNA construct.

---

# 14. Feature 7: Mutation Annotation

## Description

Users can introduce mutations and inspect their consequences.

## Supported Mutation Types

- substitution
- insertion
- deletion

## Mutation Record

Each mutation should contain:

- location
- original sequence
- modified sequence
- affected feature
- affected codon when applicable
- resulting amino-acid change
- consequence category

## Consequence Categories

At minimum:

- synonymous
- missense
- nonsense
- frameshift
- noncoding
- start-loss
- stop-loss

## Example Output

```text
Mutation

Position: 842
DNA: G → A
Feature: GFP CDS
Codon: GGC → AGC
Protein: Gly281Ser
Type: Missense
```

## User Story

> As a user, I want to understand how changing DNA can change a protein.

---

# 15. Feature 8: Construct Comparison

## Description

Compare two DNA constructs similarly to a source-code diff.

## Requirements

Detect:

- substitutions
- insertions
- deletions

Display differences in:

### DNA Diff

```text
Reference: ATG GGC TAT CCA
Modified:  ATG GAC TAT CCA
               ^
```

### Feature Diff

Show:

- added features
- removed features
- modified features

### Protein Diff

When mutations affect CDS regions, show amino-acid consequences.

## User Story

> As a user, I want to compare two constructs and understand exactly what changed.

---

# 16. Feature 9: Primer Design

## Description

Provide basic educational primer design around a selected target region.

## Inputs

User selects:

- amplification region
- approximate primer length
- approximate target melting-temperature range

## Outputs

Show candidate primers with:

- sequence
- length
- GC %
- estimated melting temperature
- binding location
- orientation

## Visualization

Display forward and reverse primer binding positions on the sequence.

The initial implementation should remain a learning tool rather than attempting to replace validated laboratory primer-design software.

## User Story

> As a user, I want to understand how primers correspond to regions of DNA.

---

# 17. Feature 10: PCR Simulation

## Description

Simulate the conceptual result of PCR using selected primers and a DNA template.

## Inputs

- DNA template
- forward primer
- reverse primer

## Outputs

Display:

- primer binding sites
- primer orientation
- expected amplified region
- predicted amplicon length
- resulting nucleotide sequence

## Error States

Explain cases such as:

- primer not found
- primers face away from each other
- multiple plausible binding sites
- no valid amplification region

## Educational Visualization

The interface should emphasize that PCR amplification occurs between oppositely oriented primer-binding sites.

## User Story

> As a user, I want to see why a particular primer pair amplifies a particular region.

---

# 18. Feature 11: Virtual Plasmid Assembly

## Description

Allow users to combine sequence fragments into a new virtual construct.

The MVP should prioritize understanding construct architecture rather than implementing every cloning protocol.

## Assembly Workspace

Users can add fragments representing:

- backbone
- promoter
- coding sequence
- terminator
- other features

Fragments can be reordered visually.

## Output

Generate:

- assembled DNA sequence
- updated feature annotations
- linear construct map
- circular plasmid map where appropriate

## Gibson-Style Assembly Visualization

Optionally illustrate overlapping fragment assembly conceptually.

The product should show:

- fragment boundaries
- overlapping ends
- resulting assembled construct

It does not need to generate laboratory-ready assembly protocols.

## User Story

> As a user, I want to understand how separate pieces of DNA become a genetic construct.

---

# 19. Feature 12: Codon Optimization

## Description

Allow users to explore how multiple DNA sequences can encode the same protein.

## Inputs

- protein-coding sequence
- selected model organism from a limited built-in educational set

## Outputs

Show:

- original DNA
- optimized DNA
- unchanged protein sequence
- nucleotide differences
- codons changed
- GC-content change
- codon-usage comparison

## Educational Objective

The feature should make clear that:

> Different DNA sequences can encode the same amino-acid sequence because the genetic code is redundant.

## Constraints

For the learning-oriented MVP:

- use public codon-frequency tables
- restrict optimization to well-established model organisms
- treat the result as computational/educational
- do not automatically provide ordering or laboratory execution workflows

## User Story

> As a user, I want to see how synonymous codons can alter DNA without changing the encoded protein.

---

# 20. Workspace Architecture

The main interface should resemble an IDE.

## Proposed Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Helix IDE                                   Construct.gb    │
├───────────────┬───────────────────────────────┬─────────────┤
│               │                               │             │
│ CONSTRUCT     │        DNA EDITOR             │ INSPECTOR   │
│ EXPLORER      │                               │             │
│               │ ATGGGCTAC...                  │ Feature     │
│ Features      │                               │ CDS         │
│               │                               │             │
│ > promoter    │                               │ 1,204-2,801 │
│ > GFP         │                               │ + strand    │
│ > terminator  │                               │             │
│               │                               │ Translate   │
│               │                               │ GC          │
├───────────────┴───────────────────────────────┴─────────────┤
│                      FEATURE MAP                            │
│ ──Promoter──────▶ GFP ────────────── Terminator ─────────  │
├─────────────────────────────────────────────────────────────┤
│ Protein | Restriction | PCR | Mutations | Diff | Analysis │
└─────────────────────────────────────────────────────────────┘
```

---

# 21. Navigation

Primary views:

1. **Sequence**
2. **Map**
3. **Protein**
4. **Mutations**
5. **Restriction**
6. **PCR**
7. **Compare**
8. **Assembly**

Analysis tools should operate on the currently selected construct.

---

# 22. Core Data Model

## Construct

```typescript
interface Construct {
  id: string
  name: string
  description?: string

  sequence: string
  topology: 'linear' | 'circular'

  features: Feature[]
  mutations: Mutation[]

  sourceFormat?: 'fasta' | 'genbank' | 'manual'
}
```

## Feature

```typescript
interface Feature {
  id: string

  type: 'gene' | 'CDS' | 'promoter' | 'terminator' | 'origin' | 'regulatory' | 'misc'

  name: string

  start: number
  end: number

  strand: 1 | -1

  qualifiers?: Record<string, string | string[]>
}
```

## Mutation

```typescript
interface Mutation {
  id: string

  type: 'substitution' | 'insertion' | 'deletion'

  position: number

  reference: string
  alternate: string

  affectedFeatureIds: string[]

  proteinEffect?: ProteinEffect
}
```

## ProteinEffect

```typescript
interface ProteinEffect {
  codonBefore?: string
  codonAfter?: string

  aminoAcidBefore?: string
  aminoAcidAfter?: string

  aminoAcidPosition?: number

  consequence: 'synonymous' | 'missense' | 'nonsense' | 'frameshift' | 'start-loss' | 'stop-loss'
}
```

---

# 23. Suggested Technical Architecture

## Frontend

Recommended:

- React
- TypeScript
- Vite
- Tailwind
- Zustand

## Visualization

Possible libraries:

- SVG/D3 for sequence and plasmid visualization
- custom canvas renderer for large sequences
- lightweight charting for GC plots

Avoid overengineering the visualization layer initially.

SVG is sufficient for the first implementation.

## Backend

The initial application can operate mostly client-side.

Optional lightweight backend:

- FastAPI
- Python
- Biopython

Python is especially useful for validating your own implementations against established biological libraries.

However, the educational objective suggests an important rule:

> Implement the basic biological algorithms yourself first, then test them against Biopython.

Examples:

- reverse complement
- translation
- ORF detection
- restriction-site matching
- GC calculation
- basic sequence alignment

This avoids turning the application into a UI wrapper around existing libraries.

---

# 24. Biological Engine

Create a dedicated domain layer.

Suggested structure:

```text
src/
  biology/
    sequence.ts
    translation.ts
    orf.ts
    mutations.ts
    restriction.ts
    primers.ts
    pcr.ts
    codons.ts
    alignment.ts
    assembly.ts
```

Each module should contain biological logic independent of React.

Example:

```typescript
translateDNA(sequence, frame)

reverseComplement(sequence)

calculateGC(sequence)

findORFs(sequence)

findRestrictionSites(sequence, enzymes)

classifyMutation(reference, alternate, cds)

simulatePCR(template, forwardPrimer, reversePrimer)
```

Unit-test this layer heavily.

This layer is arguably the most important part of the entire project because writing it is where most of the learning occurs.

---

# 25. Learning Mode

A distinguishing feature of Helix should be an optional **Explain** mode.

When enabled, biological operations expose their reasoning.

Example:

### Reverse Complement

```text
Original
5' ATGCCGTA 3'

Complement
3' TACGGCAT 5'

Reverse Complement
5' TACGGCAT 3'
```

### Translation

```text
DNA
ATG | GAA | TTT | TGA

Codons
ATG = Met
GAA = Glu
TTT = Phe
TGA = Stop

Protein
M-E-F-*
```

### Mutation

```text
Original codon
GAA → Glutamate

Mutation
A → T

New codon
GTA → Valine

Result
Missense mutation
```

This feature reinforces the core purpose of the project.

---

# 26. Example Built-In Constructs

Ship the application with a few educational examples.

Recommended:

### Example 1: Minimal Coding Sequence

A short synthetic sequence demonstrating:

- promoter
- CDS
- terminator
- translation

### Example 2: GFP Construct

Demonstrates:

- coding sequence
- protein translation
- mutations
- codon changes

### Example 3: Educational Plasmid

Demonstrates:

- circular topology
- origin
- selectable marker
- promoter
- reporter gene
- terminator
- restriction sites

Use well-characterized educational or publicly documented constructs.

---

# 27. Biological Concepts the Developer Must Understand

Before considering each subsystem complete, the developer should be able to explain the corresponding concept without relying on the UI.

## DNA Fundamentals

Understand:

- 5' and 3' orientation
- complementary bases
- double-stranded DNA
- reverse complement

## Gene Expression

Understand:

```text
DNA
 ↓ transcription
RNA
 ↓ translation
Protein
```

## Coding

Understand:

- codons
- reading frames
- start codons
- stop codons
- synonymous codons

## Features

Understand:

- promoter
- gene
- CDS
- terminator
- origin of replication

## Genetic Variation

Understand:

- substitutions
- insertions
- deletions
- synonymous mutations
- missense mutations
- nonsense mutations
- frameshifts

## Molecular Tools

Understand conceptually:

- restriction enzymes
- primers
- PCR
- DNA assembly
- plasmids

---

# 28. Development Plan

## Week 1: DNA Fundamentals

Build:

- project shell
- FASTA parser
- GenBank parser
- sequence viewer
- reverse complement
- GC calculation
- feature model
- linear feature visualization
- translation
- ORF detection

### Milestone

Load a GenBank construct and interactively inspect:

```text
DNA → features → CDS → protein
```

---

# 29. Week 2: DNA Manipulation

Build:

- sequence editing
- mutation tracking
- mutation consequence engine
- restriction-site detection
- restriction-map visualization
- sequence comparison
- DNA diff

### Milestone

Modify a nucleotide and immediately see:

```text
DNA mutation
      ↓
codon change
      ↓
amino-acid change
      ↓
mutation classification
```

---

# 30. Week 3: Molecular Biology Tools

Build:

- primer explorer
- PCR simulation
- virtual fragments
- virtual construct assembly
- plasmid visualization

### Milestone

Select a region, design conceptual primers, simulate an amplicon, and place that fragment into a virtual construct.

---

# 31. Week 4: Biological Engineering Layer

Build:

- codon optimization
- protein diff
- explain mode
- educational examples
- UX polish
- tests
- documentation

### Final Milestone

Complete a workflow:

```text
load plasmid
     ↓
inspect genes
     ↓
translate CDS
     ↓
introduce mutation
     ↓
inspect protein consequence
     ↓
compare constructs
     ↓
inspect restriction sites
     ↓
select target region
     ↓
simulate PCR
     ↓
assemble virtual construct
     ↓
inspect final plasmid
```

---

# 32. Testing Strategy

Biological correctness matters more than visual polish.

## Unit Tests

Test:

- complement calculation
- reverse complement
- codon translation
- all standard codons
- reading frames
- GC calculation
- circular-coordinate handling
- ORF detection
- mutations
- insertion/deletion frameshifts
- restriction matching
- PCR orientation
- translation after mutations

## Reference Validation

Compare selected outputs against trusted biological software or libraries.

For example:

```text
Helix translation
vs.
Biopython translation
```

The goal is to understand the implementation while still validating correctness.

---

# 33. UX Requirements

The application should feel:

- technical
- dense but understandable
- fast
- keyboard-friendly
- inspection-oriented

Avoid making it look like a generic SaaS dashboard.

Prefer:

```text
IDE
CAD software
scientific instrumentation
developer tools
```

over:

```text
CRM
analytics dashboard
consumer app
```

The biological object itself should dominate the interface.

---

# 34. Important UX Interaction

Cross-highlighting should be used extensively.

If the user clicks an amino acid:

→ highlight its codon.

If the user clicks a gene:

→ highlight its DNA region.

If the user clicks a restriction site:

→ jump to its recognition sequence.

If the user clicks a mutation:

→ show nucleotide and protein consequences.

If the user selects a plasmid feature:

→ show the corresponding sequence.

This creates a mental connection between biological abstractions.

---

# 35. Metrics

Traditional product metrics are not especially useful because this is initially a learning project.

Instead track capability milestones.

## Biological Literacy Metrics

By completion, the developer should be able to:

- explain how DNA encodes proteins
- identify an ORF
- interpret a GenBank file
- explain a CDS
- calculate the reverse complement
- identify mutation consequences
- explain why frameshifts occur
- explain restriction sites
- explain how primers define a PCR product
- explain plasmid architecture
- explain why codon optimization can change DNA without changing protein

## Engineering Metrics

The application should:

- correctly parse representative FASTA files
- correctly parse representative GenBank files
- handle sequences of at least hundreds of thousands of bases without catastrophic UI failure
- provide deterministic analysis
- maintain mutation history
- preserve feature annotations during supported edits where logically possible

---

# 36. Out of Scope for V1

Do not build:

- user accounts
- multiplayer collaboration
- comments
- lab inventory
- electronic lab notebook functionality
- billing
- organization management
- cloud synchronization
- AI chat
- automated DNA ordering
- laboratory robotics
- CRISPR guide design
- genome-scale editing
- clinical variant interpretation
- sophisticated protein-structure prediction
- exhaustive cloning-protocol generation
- production-grade primer validation
- laboratory execution instructions

These may be useful eventually but distract from the project's learning objective.

---

# 37. Stretch Features

Only implement these if the core product is completed.

## Protein Structure Viewer

Display a known protein structure and map mutations onto it.

## Sequence Alignment

Implement global/local pairwise alignment and visualize gaps.

## Amino-Acid Properties

Show whether mutations alter:

- charge
- polarity
- size
- hydrophobicity

## Genome Browser Mode

Support longer genomic regions.

## Mutation Heatmap

Display every possible single-nucleotide mutation within a CDS and classify its resulting protein consequence.

## Construct History

Represent edits as a Git-like mutation history.

Example:

```text
v1 original
│
├── G431A
│
├── Δ650-653
│
└── promoter replacement
    │
    v4
```

## Command Palette

Examples:

```text
> Translate selection
> Reverse complement
> Find ORFs
> Calculate GC
> Show restriction sites
> Compare with...
```

This would strengthen the IDE metaphor considerably.

---

# 38. Recommended "Hard Parts"

Do not avoid the following by immediately installing libraries.

These are exactly the parts worth implementing yourself:

### 1. Reverse complement

Simple, but fundamental.

### 2. Translation

Implement the codon table.

### 3. Reading frames

Understand why frame matters.

### 4. ORF detection

Learn how coding regions emerge from sequence.

### 5. Mutation consequences

Probably the highest-value algorithm in the project.

### 6. Circular coordinates

Important for understanding plasmids.

### 7. Restriction-site matching

Connect sequence motifs with molecular tools.

### 8. Primer orientation

Forces understanding of DNA strand directionality.

### 9. PCR product calculation

Connects primers, strands and amplification.

### 10. Sequence alignment

Introduces biological comparison.

Use external libraries afterward as reference implementations.

---

# 39. Suggested Final Demo

The final demo should tell a biological story rather than merely show features.

Example:

## Step 1

Open a GFP-containing plasmid.

Explain its architecture:

```text
origin
promoter
GFP
terminator
marker
```

## Step 2

Inspect the GFP CDS.

Translate it.

## Step 3

Introduce a nucleotide substitution.

Show:

```text
DNA change
→ codon change
→ amino-acid change
→ missense mutation
```

## Step 4

Compare the mutant against the original.

## Step 5

Inspect restriction sites around the GFP sequence.

## Step 6

Select the GFP region and simulate primer placement and PCR.

## Step 7

Insert the resulting virtual fragment into another educational backbone.

## Step 8

Visualize the final plasmid.

## Step 9

Perform codon optimization and demonstrate that:

```text
DNA changed substantially

but

protein sequence remained identical
```

That ten-minute demo would demonstrate substantially more biological understanding than a generic bioinformatics CRUD application.

---

# 40. Definition of Done

The project is complete when a user can:

1. import FASTA and GenBank files
2. inspect annotated genetic features
3. navigate DNA visually
4. translate DNA into protein
5. detect ORFs
6. calculate GC content
7. inspect restriction sites
8. introduce mutations
9. understand mutation consequences
10. compare two constructs
11. explore primer placement
12. simulate PCR
13. assemble virtual constructs
14. inspect circular plasmids
15. perform basic codon optimization
16. understand the biological reasoning behind each operation

---

# 41. Ultimate Learning Outcome

The true product is not Helix IDE.

The true product is the developer's mental model of biology.

After building the application, concepts such as:

```text
promoter
CDS
ORF
codon
plasmid
primer
restriction site
amplicon
mutation
translation
expression
assembly
```

should no longer feel like disconnected biological vocabulary.

They should form one interconnected engineering system:

```text
DNA sequence
     ↓
genetic architecture
     ↓
gene expression
     ↓
protein
     ↓
phenotype

while

mutation + recombination + assembly

allow the underlying program to be changed.
```

That mental model is the prerequisite for progressing from software developer interested in biotech to someone capable of reasoning seriously about biological engineering.
