export type OrganismId = 'ecoli' | 'human' | 'yeast'

export interface OrganismInfo {
  id: OrganismId
  name: string
}

export const ORGANISMS: OrganismInfo[] = [
  { id: 'ecoli', name: 'Escherichia coli K-12' },
  { id: 'human', name: 'Homo sapiens' },
  { id: 'yeast', name: 'Saccharomyces cerevisiae' },
]

/**
 * Codon usage frequency (per 1000 codons), sourced from the Kazusa Codon
 * Usage Database (kazusa.or.jp/codon), one of the standard public references
 * for this data. Stop codons are intentionally omitted — optimizeCodons
 * leaves the CDS's terminating stop untouched rather than swapping it for a
 * synonymous stop, so the data those decisions would need isn't required.
 */
export const CODON_USAGE: Record<OrganismId, Record<string, number>> = {
  ecoli: {
    TTT: 19.7, TTC: 15.0, TTA: 15.2, TTG: 11.9,
    TCT: 5.7, TCC: 5.5, TCA: 7.8, TCG: 8.0,
    TAT: 16.8, TAC: 14.6,
    TGT: 5.9, TGC: 8.0, TGG: 10.7,
    CTT: 11.9, CTC: 10.5, CTA: 5.3, CTG: 46.9,
    CCT: 8.4, CCC: 6.4, CCA: 6.6, CCG: 26.7,
    CAT: 15.8, CAC: 13.1, CAA: 12.1, CAG: 27.7,
    CGT: 21.1, CGC: 26.0, CGA: 4.3, CGG: 4.1,
    ATT: 30.5, ATC: 18.2, ATA: 3.7, ATG: 24.8,
    ACT: 8.0, ACC: 22.8, ACA: 6.4, ACG: 11.5,
    AAT: 21.9, AAC: 24.4, AAA: 33.2, AAG: 12.1,
    AGT: 7.2, AGC: 16.6, AGA: 1.4, AGG: 1.6,
    GTT: 16.8, GTC: 11.7, GTA: 11.5, GTG: 26.4,
    GCT: 10.7, GCC: 31.6, GCA: 21.1, GCG: 38.5,
    GAT: 37.9, GAC: 20.5, GAA: 43.7, GAG: 18.4,
    GGT: 21.3, GGC: 33.4, GGA: 9.2, GGG: 8.6,
  },
  human: {
    TTT: 17.6, TTC: 20.3, TTA: 7.7, TTG: 12.9,
    TCT: 15.2, TCC: 17.7, TCA: 12.2, TCG: 4.4,
    TAT: 12.2, TAC: 15.3,
    TGT: 10.6, TGC: 12.6, TGG: 13.2,
    CTT: 13.2, CTC: 19.6, CTA: 7.2, CTG: 39.6,
    CCT: 17.5, CCC: 19.8, CCA: 16.9, CCG: 6.9,
    CAT: 10.9, CAC: 15.1, CAA: 12.3, CAG: 34.2,
    CGT: 4.5, CGC: 10.4, CGA: 6.2, CGG: 11.4,
    ATT: 16.0, ATC: 20.8, ATA: 7.5, ATG: 22.0,
    ACT: 13.1, ACC: 18.9, ACA: 15.1, ACG: 6.1,
    AAT: 17.0, AAC: 19.1, AAA: 24.4, AAG: 31.9,
    AGT: 12.1, AGC: 19.5, AGA: 12.2, AGG: 12.0,
    GTT: 11.0, GTC: 14.5, GTA: 7.1, GTG: 28.1,
    GCT: 18.4, GCC: 27.7, GCA: 15.8, GCG: 7.4,
    GAT: 21.8, GAC: 25.1, GAA: 29.0, GAG: 39.6,
    GGT: 10.8, GGC: 22.2, GGA: 16.5, GGG: 16.5,
  },
  yeast: {
    TTT: 26.1, TTC: 18.4, TTA: 26.2, TTG: 27.2,
    TCT: 23.5, TCC: 14.2, TCA: 18.7, TCG: 8.6,
    TAT: 18.8, TAC: 14.8,
    TGT: 8.1, TGC: 4.8, TGG: 10.4,
    CTT: 12.3, CTC: 5.4, CTA: 13.4, CTG: 10.5,
    CCT: 13.5, CCC: 6.8, CCA: 18.3, CCG: 5.3,
    CAT: 13.6, CAC: 7.8, CAA: 27.3, CAG: 12.1,
    CGT: 6.4, CGC: 2.6, CGA: 3.0, CGG: 1.7,
    ATT: 30.1, ATC: 17.2, ATA: 17.8, ATG: 20.9,
    ACT: 20.3, ACC: 12.7, ACA: 17.8, ACG: 8.0,
    AAT: 35.7, AAC: 24.8, AAA: 41.9, AAG: 30.8,
    AGT: 14.2, AGC: 9.8, AGA: 21.3, AGG: 9.2,
    GTT: 22.1, GTC: 11.8, GTA: 11.8, GTG: 10.8,
    GCT: 21.2, GCC: 12.6, GCA: 16.2, GCG: 6.2,
    GAT: 37.6, GAC: 20.2, GAA: 45.6, GAG: 19.2,
    GGT: 23.9, GGC: 9.8, GGA: 10.9, GGG: 6.0,
  },
}
