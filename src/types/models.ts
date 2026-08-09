// Core domain model for Helix IDE.
//
// Coordinates are 0-based, half-open [start, end) everywhere in this codebase.
// GenBank's 1-based inclusive convention is converted at the parser boundary and
// in display components only (see biology/sequence.ts toDisplayPosition/fromDisplayPosition).

export type Topology = 'linear' | 'circular'

export type FeatureType =
  'gene' | 'CDS' | 'promoter' | 'terminator' | 'origin' | 'regulatory' | 'misc'

export type Strand = 1 | -1

export interface FeatureSegment {
  start: number
  end: number
}

export interface Feature {
  id: string

  type: FeatureType

  name: string

  start: number
  end: number

  strand: Strand

  /**
   * Present when the feature is a GenBank join(...) of multiple ranges
   * (e.g. a CDS spliced across the plasmid origin). When present, `start`/`end`
   * are the overall min/max span and `segments` holds the true sub-ranges in
   * transcription order — translation/rendering must use segments when present.
   */
  segments?: FeatureSegment[]

  /** Fuzzy boundary markers from GenBank `<1` / `>200` style locations. */
  partial?: { start?: boolean; end?: boolean }

  qualifiers?: Record<string, string | string[]>
}

export type MutationType = 'substitution' | 'insertion' | 'deletion'

export interface Mutation {
  id: string

  type: MutationType

  position: number

  reference: string
  alternate: string

  affectedFeatureIds: string[]

  proteinEffect?: ProteinEffect

  /** Order mutations were applied, for the mutation history list. */
  createdAt: number
}

export type Consequence =
  | 'synonymous'
  | 'missense'
  | 'nonsense'
  | 'frameshift'
  | 'noncoding'
  | 'start-loss'
  | 'stop-loss'
  /** Additive 8th category: an in-frame (multiple-of-3) insertion/deletion —
   * neither missense (no single substituted codon) nor frameshift. */
  | 'in-frame-indel'

export interface ProteinEffect {
  codonBefore?: string
  codonAfter?: string

  aminoAcidBefore?: string
  aminoAcidAfter?: string

  aminoAcidPosition?: number

  consequence: Consequence
}

export type SourceFormat = 'fasta' | 'genbank' | 'manual'

export interface Construct {
  id: string
  name: string
  description?: string

  sequence: string
  topology: Topology

  features: Feature[]
  mutations: Mutation[]

  sourceFormat?: SourceFormat
}
