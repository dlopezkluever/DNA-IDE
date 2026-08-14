import { AMINO_ACID_INFO } from './translation'

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

/**
 * Parses ATOM (not HETATM — waters/ligands excluded) and HELIX/SHEET records. Framework-free,
 * pure string -> data, same shape as parsers/genbank.ts. Column offsets verified against a real
 * downloaded 1EMA.pdb, not trusted from the wwPDB spec alone (see pdb.test.ts).
 */
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
    } else if (record === 'HELIX') {
      secondaryStructure.push({
        type: 'helix',
        chainId: line.slice(19, 20).trim(),
        startResSeq: parseInt(line.slice(21, 25), 10),
        endResSeq: parseInt(line.slice(33, 37), 10),
      })
    } else if (record === 'SHEET') {
      secondaryStructure.push({
        type: 'sheet',
        chainId: line.slice(21, 22).trim(),
        startResSeq: parseInt(line.slice(22, 26), 10),
        endResSeq: parseInt(line.slice(33, 37), 10),
      })
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
