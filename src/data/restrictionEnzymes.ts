export type OverhangType = '5-prime' | '3-prime' | 'blunt'

export interface RestrictionEnzyme {
  id: string
  name: string
  /** Recognition sequence, 5'->3' on the top strand. */
  site: string
  /** 0-based offset from the start of the site match where the top strand is cut. */
  topCut: number
  /** Same coordinate space, where the bottom strand is cut. */
  bottomCut: number
  overhang: OverhangType
}

function enzyme(name: string, site: string, topCut: number, bottomCut: number): RestrictionEnzyme {
  const overhang: OverhangType = topCut === bottomCut ? 'blunt' : topCut < bottomCut ? '5-prime' : '3-prime'
  return { id: name, name, site, topCut, bottomCut, overhang }
}

// Recognition sites and cut positions are standard, well-characterized enzyme facts.
// BsaI/BsmBI are Type IIS enzymes: they cut outside their (non-palindromic) recognition
// site, which is what makes their fragment math worth exercising separately from the
// palindromic within-site cutters above them.
export const RESTRICTION_ENZYMES: RestrictionEnzyme[] = [
  enzyme('EcoRI', 'GAATTC', 1, 5),
  enzyme('BamHI', 'GGATCC', 1, 5),
  enzyme('HindIII', 'AAGCTT', 1, 5),
  enzyme('XhoI', 'CTCGAG', 1, 5),
  enzyme('SalI', 'GTCGAC', 1, 5),
  enzyme('XbaI', 'TCTAGA', 1, 5),
  enzyme('NcoI', 'CCATGG', 1, 5),
  enzyme('NheI', 'GCTAGC', 1, 5),
  enzyme('SpeI', 'ACTAGT', 1, 5),
  enzyme('BglII', 'AGATCT', 1, 5),
  enzyme('AvrII', 'CCTAGG', 1, 5),
  enzyme('MluI', 'ACGCGT', 1, 5),
  enzyme('NotI', 'GCGGCCGC', 2, 6),
  enzyme('NdeI', 'CATATG', 2, 4),
  enzyme('ClaI', 'ATCGAT', 2, 4),
  enzyme('HaeIII', 'GGCC', 2, 2),
  enzyme('AluI', 'AGCT', 2, 2),
  enzyme('DpnI', 'GATC', 2, 2),
  enzyme('SmaI', 'CCCGGG', 3, 3),
  enzyme('EcoRV', 'GATATC', 3, 3),
  enzyme('PvuII', 'CAGCTG', 3, 3),
  enzyme('KpnI', 'GGTACC', 5, 1),
  enzyme('SacI', 'GAGCTC', 5, 1),
  enzyme('ApaI', 'GGGCCC', 5, 1),
  enzyme('NsiI', 'ATGCAT', 5, 1),
  enzyme('PstI', 'CTGCAG', 5, 1),
  enzyme('BsaI', 'GGTCTC', 7, 11),
  enzyme('BsmBI', 'CGTCTC', 7, 11),
]
