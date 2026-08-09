import type { Strand, Topology } from '../types/models'
import { reverseComplement, getSubsequence, featureLength } from './sequence'
import { isStartCodon, isStopCodon, translateDNA } from './translation'

export interface ORF {
  /** 0-based half-open range on the plus strand; end < start means the ORF wraps the origin (circular only). */
  start: number
  end: number
  strand: Strand
  frame: 0 | 1 | 2
  /** Nucleotide length including the stop codon. */
  length: number
  /** Protein length excluding the trailing stop. */
  aminoAcidLength: number
  /** Includes the trailing '*'. */
  proteinSequence: string
}

export interface FindORFsOptions {
  topology?: Topology
  /** Minimum nucleotide length (including stop codon) to report. */
  minLength?: number
  strands?: Strand[]
}

interface ReadingHit {
  start: number
  end: number
}

/** Stateful walk: opens on the first ATG, closes on the next in-frame stop. */
function scanReadingFrame(readingSeq: string, frame: 0 | 1 | 2): ReadingHit[] {
  const hits: ReadingHit[] = []
  let orfStart: number | null = null
  for (let i = frame; i + 3 <= readingSeq.length; i += 3) {
    const codon = readingSeq.slice(i, i + 3)
    if (orfStart === null) {
      if (isStartCodon(codon)) orfStart = i
    } else if (isStopCodon(codon)) {
      hits.push({ start: orfStart, end: i + 3 })
      orfStart = null
    }
  }
  return hits
}

function buildORF(
  seq: string,
  start: number,
  end: number,
  strand: Strand,
  frame: 0 | 1 | 2,
  topology: Topology,
): ORF {
  const length = featureLength({ start, end }, seq.length)
  const plusStrandNt = getSubsequence(seq, start, end, topology)
  const readingNt = strand === 1 ? plusStrandNt : reverseComplement(plusStrandNt)
  const proteinSequence = translateDNA(readingNt, { frame: 0, strand: 1 })
  const aminoAcidLength = proteinSequence.endsWith('*')
    ? proteinSequence.length - 1
    : proteinSequence.length
  return { start, end, strand, frame, length, aminoAcidLength, proteinSequence }
}

const FRAMES = [0, 1, 2] as const

export function findORFs(seq: string, options: FindORFsOptions = {}): ORF[] {
  const { topology = 'linear', minLength = 100, strands = [1, -1] } = options
  const L = seq.length
  const orfs: ORF[] = []

  for (const strand of strands) {
    for (const frame of FRAMES) {
      if (topology === 'linear') {
        const readingSeq = strand === 1 ? seq : reverseComplement(seq)
        for (const hit of scanReadingFrame(readingSeq, frame)) {
          const start = strand === 1 ? hit.start : L - hit.end
          const end = strand === 1 ? hit.end : L - hit.start
          orfs.push(buildORF(seq, start, end, strand, frame, topology))
        }
        continue
      }

      // Circular: scan a doubled reading sequence so ORFs spanning the
      // origin are found, but only keep the copy anchored in [0, L) and
      // discard the periodic echo plus any ORF longer than the genome itself.
      const readingSeqDoubled = strand === 1 ? seq + seq : reverseComplement(seq) + reverseComplement(seq)
      for (const hit of scanReadingFrame(readingSeqDoubled, frame)) {
        const extStart = strand === 1 ? hit.start : 2 * L - hit.end
        const extEnd = strand === 1 ? hit.end : 2 * L - hit.start
        if (extStart >= L) continue
        const length = extEnd - extStart
        if (length >= L) continue
        const start = extStart
        const end = extEnd <= L ? extEnd : extEnd - L
        orfs.push(buildORF(seq, start, end, strand, frame, topology))
      }
    }
  }

  return orfs.filter((orf) => orf.length >= minLength).sort((a, b) => a.start - b.start)
}
