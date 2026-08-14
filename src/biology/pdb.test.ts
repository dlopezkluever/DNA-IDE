import { describe, it, expect } from 'vitest'
import { parsePDB, PDB_RESNAME_TO_ONE_LETTER } from './pdb'
import { AMINO_ACID_INFO } from './translation'

// Every literal line below is copied verbatim from the real, downloaded
// `scripts/structures/1EMA.pdb` (RCSB PDB, public domain) — not hand-typed to "look
// right" — so column offsets are validated against ground truth, not a from-memory
// column table (§2.1.2 of the protein-structure-viewer spec).

const ATOM_LINE_2DIGIT =
  'ATOM      2  CA  SER A   2      27.638  10.125  52.516  1.00 80.05           C  '
const ATOM_LINE_3DIGIT_RESSEQ =
  'ATOM   1756  CA  ALA A 227      40.789  22.550  45.871  1.00 19.64           C  '
const HETATM_LINE =
  'HETATM  466  N1  CRO A  66      24.077  27.513  36.610  1.00 11.86           N  '
const TER_LINE = 'TER    1772      ILE A 229                                                      '
const END_LINE = 'END'
const BLANK_LINE = ''
const HELIX_LINE =
  'HELIX    1   1 GLY A    4  PHE A    8  5                                   5    '
const SHEET_LINE =
  'SHEET    1   A11 GLY A 160  ASN A 170  0                                        '

describe('parsePDB', () => {
  it('parses an ATOM line with a single-digit resSeq', () => {
    const { atoms } = parsePDB(ATOM_LINE_2DIGIT)
    expect(atoms).toHaveLength(1)
    expect(atoms[0]).toEqual({
      serial: 2,
      name: 'CA',
      resName: 'SER',
      chainId: 'A',
      resSeq: 2,
      x: 27.638,
      y: 10.125,
      z: 52.516,
    })
  })

  it('parses an ATOM line with a 3-digit resSeq (column-width boundary)', () => {
    const { atoms } = parsePDB(ATOM_LINE_3DIGIT_RESSEQ)
    expect(atoms).toHaveLength(1)
    expect(atoms[0]).toEqual({
      serial: 1756,
      name: 'CA',
      resName: 'ALA',
      chainId: 'A',
      resSeq: 227,
      x: 40.789,
      y: 22.55,
      z: 45.871,
    })
  })

  it('ignores HETATM lines (waters/ligands/modified-residue chromophore excluded)', () => {
    const { atoms } = parsePDB(HETATM_LINE)
    expect(atoms).toHaveLength(0)
  })

  it('ignores blank, TER, and END lines rather than mis-parsing them as atoms', () => {
    const text = [ATOM_LINE_2DIGIT, TER_LINE, END_LINE, BLANK_LINE].join('\n')
    const { atoms } = parsePDB(text)
    expect(atoms).toHaveLength(1)
  })

  it('parses a HELIX line', () => {
    const { secondaryStructure } = parsePDB(HELIX_LINE)
    expect(secondaryStructure).toEqual([
      { type: 'helix', chainId: 'A', startResSeq: 4, endResSeq: 8 },
    ])
  })

  it('parses a SHEET line', () => {
    const { secondaryStructure } = parsePDB(SHEET_LINE)
    expect(secondaryStructure).toEqual([
      { type: 'sheet', chainId: 'A', startResSeq: 160, endResSeq: 170 },
    ])
  })
})

describe('PDB_RESNAME_TO_ONE_LETTER', () => {
  it('maps common 3-letter codes to their 1-letter equivalents', () => {
    expect(PDB_RESNAME_TO_ONE_LETTER['GLY']).toBe('G')
    expect(PDB_RESNAME_TO_ONE_LETTER['SER']).toBe('S')
    expect(PDB_RESNAME_TO_ONE_LETTER['ALA']).toBe('A')
    expect(PDB_RESNAME_TO_ONE_LETTER['TRP']).toBe('W')
  })

  it('round-trips against every standard amino acid in AMINO_ACID_INFO', () => {
    for (const [letter, info] of Object.entries(AMINO_ACID_INFO)) {
      if (letter === '*' || letter === 'X') continue
      expect(PDB_RESNAME_TO_ONE_LETTER[info.abbr.toUpperCase()]).toBe(letter)
    }
  })

  it('excludes the stop (*) and unknown (X) pseudo-entries', () => {
    expect(Object.values(PDB_RESNAME_TO_ONE_LETTER)).not.toContain('*')
    expect(Object.values(PDB_RESNAME_TO_ONE_LETTER)).not.toContain('X')
  })
})
