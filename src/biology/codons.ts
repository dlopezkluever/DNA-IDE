import { STANDARD_CODON_TABLE, translateCodon } from './translation'
import { calculateGC } from './sequence'
import { CODON_USAGE, type OrganismId } from '../data/codonUsageTables'

const CODONS_BY_AMINO_ACID: Record<string, string[]> = {}
for (const [codon, aa] of Object.entries(STANDARD_CODON_TABLE)) {
  ;(CODONS_BY_AMINO_ACID[aa] ??= []).push(codon)
}

function mostFrequentCodonFor(aminoAcid: string, organism: OrganismId): string {
  const candidates = CODONS_BY_AMINO_ACID[aminoAcid] ?? []
  const table = CODON_USAGE[organism]
  return candidates.reduce((best, codon) => ((table[codon] ?? 0) > (table[best] ?? 0) ? codon : best), candidates[0])
}

export interface CodonChange {
  /** Codon index within the CDS (0-based). */
  index: number
  /** 0-based nucleotide position within the CDS sequence. */
  position: number
  before: string
  after: string
}

export interface OptimizeCodonsResult {
  originalDNA: string
  optimizedDNA: string
  proteinUnchanged: boolean
  changes: CodonChange[]
  gcBefore: number
  gcAfter: number
}

/**
 * Deterministically swaps each codon for the organism's highest-frequency
 * synonym (PRD §35 requires deterministic analysis, so no weighted-random
 * strategy). Stop codons are left untouched.
 */
export function optimizeCodons(cds: string, organism: OrganismId): OptimizeCodonsResult {
  const codons: string[] = []
  for (let i = 0; i + 3 <= cds.length; i += 3) codons.push(cds.slice(i, i + 3))

  const changes: CodonChange[] = []
  const optimizedCodons = codons.map((codon, index) => {
    const aa = translateCodon(codon)
    if (aa === '*' || aa === 'X') return codon
    const best = mostFrequentCodonFor(aa, organism)
    if (best.toUpperCase() !== codon.toUpperCase()) {
      changes.push({ index, position: index * 3, before: codon.toUpperCase(), after: best })
    }
    return best
  })

  const optimizedDNA = optimizedCodons.join('') + cds.slice(codons.length * 3)

  return {
    originalDNA: cds,
    optimizedDNA,
    proteinUnchanged: codons.map(translateCodon).join('') === optimizedCodons.map(translateCodon).join(''),
    changes,
    gcBefore: calculateGC(cds),
    gcAfter: calculateGC(optimizedDNA),
  }
}

export interface CodonUsageEntry {
  codon: string
  aminoAcid: string
  countInSequence: number
  organismFrequency: number
  isMostFrequent: boolean
}

/** Per-codon usage in `seq` compared against the organism's reference frequencies. */
export function compareCodonUsage(seq: string, organism: OrganismId): CodonUsageEntry[] {
  const counts = new Map<string, number>()
  for (let i = 0; i + 3 <= seq.length; i += 3) {
    const codon = seq.slice(i, i + 3).toUpperCase()
    counts.set(codon, (counts.get(codon) ?? 0) + 1)
  }

  const table = CODON_USAGE[organism]
  const entries: CodonUsageEntry[] = []
  for (const [codon, count] of counts) {
    const aa = translateCodon(codon)
    if (aa === '*') continue
    entries.push({
      codon,
      aminoAcid: aa,
      countInSequence: count,
      organismFrequency: table[codon] ?? 0,
      isMostFrequent: codon === mostFrequentCodonFor(aa, organism),
    })
  }
  return entries.sort((a, b) => b.countInSequence - a.countInSequence)
}
