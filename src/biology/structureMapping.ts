import type { Feature } from '../types/models'
import { alignSequences } from './alignment'
import { translateFeature } from './translation'
import type { KnownStructure } from '../data/structures'

export interface ResidueMapping {
  /** Construct amino-acid position (1-based) -> reference structure resSeq. Absent for
   * construct positions that fall in a gap relative to the reference (insertion, or past a
   * frameshift/premature stop that desyncs the rest of the alignment). */
  toReference: Map<number, number>
  /** Reference resSeq -> construct amino-acid position. The inverse, for click-to-select. */
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
      // Cheap length pre-filter before the O(n*m) alignment — guards against paying full
      // alignment cost on CDS features that could never plausibly match (e.g. scanning a
      // 50kb ORF against a 238aa reference). A 3x length-ratio band is generous but rules
      // out the pathological case.
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
 * multi-chain complexes; multi-chain structures are explicitly out of scope. */
export function computeBurialScores(
  residues: { resSeq: number; ca: [number, number, number] }[],
): BurialScore[] {
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

export { NEIGHBOR_RADIUS_ANGSTROM, IDENTITY_THRESHOLD }
