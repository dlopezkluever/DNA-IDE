import type { Strand } from '../types/models'
import { reverseComplement } from './sequence'

// Standard genetic code (NCBI translation table 1).
export const STANDARD_CODON_TABLE: Record<string, string> = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L',
  CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
  CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
  CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
}

export const AMINO_ACID_INFO: Record<string, { abbr: string; name: string }> = {
  A: { abbr: 'Ala', name: 'Alanine' },
  R: { abbr: 'Arg', name: 'Arginine' },
  N: { abbr: 'Asn', name: 'Asparagine' },
  D: { abbr: 'Asp', name: 'Aspartate' },
  C: { abbr: 'Cys', name: 'Cysteine' },
  Q: { abbr: 'Gln', name: 'Glutamine' },
  E: { abbr: 'Glu', name: 'Glutamate' },
  G: { abbr: 'Gly', name: 'Glycine' },
  H: { abbr: 'His', name: 'Histidine' },
  I: { abbr: 'Ile', name: 'Isoleucine' },
  L: { abbr: 'Leu', name: 'Leucine' },
  K: { abbr: 'Lys', name: 'Lysine' },
  M: { abbr: 'Met', name: 'Methionine' },
  F: { abbr: 'Phe', name: 'Phenylalanine' },
  P: { abbr: 'Pro', name: 'Proline' },
  S: { abbr: 'Ser', name: 'Serine' },
  T: { abbr: 'Thr', name: 'Threonine' },
  W: { abbr: 'Trp', name: 'Tryptophan' },
  Y: { abbr: 'Tyr', name: 'Tyrosine' },
  V: { abbr: 'Val', name: 'Valine' },
  '*': { abbr: 'Ter', name: 'Stop' },
  X: { abbr: 'Xaa', name: 'Unknown' },
}

export const START_CODON = 'ATG'
export const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA'])

export function isStartCodon(codon: string): boolean {
  return codon.toUpperCase() === START_CODON
}

export function isStopCodon(codon: string): boolean {
  return STOP_CODONS.has(codon.toUpperCase())
}

export function translateCodon(codon: string): string {
  const c = codon.toUpperCase()
  if (c.length !== 3) return 'X'
  return STANDARD_CODON_TABLE[c] ?? 'X'
}

export interface CodonInfo {
  seq: string
  aa: string
  /** 0-based half-open range on the ORIGINAL plus-strand sequence, start < end regardless of strand. */
  start: number
  end: number
}

/**
 * Frame is a 0-based offset into the reading direction's sequence (the plus
 * strand for strand=1, its reverse complement for strand=-1). Each codon
 * carries its own plus-strand coordinate range so callers (cross-highlighting,
 * mutation classification) never have to re-derive it.
 */
export function translateFrame(seq: string, frame: 0 | 1 | 2, strand: Strand): CodonInfo[] {
  const readingSeq = strand === 1 ? seq : reverseComplement(seq)
  const len = seq.length
  const codons: CodonInfo[] = []

  for (let i = frame; i + 3 <= readingSeq.length; i += 3) {
    const codonSeq = readingSeq.slice(i, i + 3)
    const aa = translateCodon(codonSeq)
    const start = strand === 1 ? i : len - (i + 3)
    const end = strand === 1 ? i + 3 : len - i
    codons.push({ seq: codonSeq, aa, start, end })
  }
  return codons
}

export interface TranslateOptions {
  frame?: 0 | 1 | 2
  strand?: Strand
  /** Stop scanning (inclusive of the '*') at the first stop codon encountered. */
  toStop?: boolean
}

export function translateDNA(seq: string, options: TranslateOptions = {}): string {
  const { frame = 0, strand = 1, toStop = false } = options
  const codons = translateFrame(seq, frame, strand)
  let protein = ''
  for (const codon of codons) {
    protein += codon.aa
    if (toStop && codon.aa === '*') break
  }
  return protein
}
