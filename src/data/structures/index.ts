import { GFP_1EMA_RESIDUES } from './gfp1EMA'

export interface StructureResidue {
  resSeq: number
  resName: string // 1-letter
  ss: 'helix' | 'sheet' | 'coil'
  ca: [number, number, number]
}

export interface KnownStructure {
  id: string
  pdbId: string
  name: string
  residues: StructureResidue[]
  /** Derived once at module load (cheap — see below), not re-derived per render. */
  referenceProtein: string
  referenceResSeqs: number[]
}

function toKnownStructure(
  id: string,
  pdbId: string,
  name: string,
  residues: StructureResidue[],
): KnownStructure {
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
