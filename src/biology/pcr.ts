import type { Topology } from '../types/models'
import { getSubsequence, reverseComplement } from './sequence'

export type PCRErrorType = 'primer-not-found' | 'primers-face-away' | 'multiple-plausible-regions'

export interface PrimerBindingSite {
  start: number
  end: number
}

export interface PCRCandidateRegion {
  start: number
  end: number
  length: number
}

export interface PCRResult {
  success: boolean
  error?: PCRErrorType
  message?: string
  forwardBinding?: PrimerBindingSite
  reverseBinding?: PrimerBindingSite
  amplicon?: string
  ampliconStart?: number
  ampliconEnd?: number
  candidateRegions?: PCRCandidateRegion[]
}

function findAllOccurrences(haystack: string, needle: string): number[] {
  const positions: number[] = []
  if (!needle) return positions
  const upperH = haystack.toUpperCase()
  const upperN = needle.toUpperCase()
  let from = 0
  while (from <= upperH.length - upperN.length) {
    const idx = upperH.indexOf(upperN, from)
    if (idx === -1) break
    positions.push(idx)
    from = idx + 1
  }
  return positions
}

/**
 * Simulates the conceptual result of PCR: the forward primer must match the
 * template literally (top strand); the reverse primer's binding site is found
 * by searching for its reverse complement (it anneals to the top strand,
 * extending back toward the forward primer). Exact literal matching only —
 * the PRD asks for "conceptual" PCR, not mismatch-tolerant thermodynamics.
 */
export function simulatePCR(
  template: string,
  forwardPrimer: string,
  reversePrimer: string,
  topology: Topology = 'linear',
): PCRResult {
  const longest = Math.max(forwardPrimer.length, reversePrimer.length)
  const searchSeq =
    topology === 'circular' ? template + template.slice(0, Math.max(0, longest - 1)) : template

  const fwdStarts = findAllOccurrences(searchSeq, forwardPrimer).filter((s) => s < template.length)
  const revSiteStarts = findAllOccurrences(searchSeq, reverseComplement(reversePrimer)).filter(
    (s) => s < template.length,
  )

  if (fwdStarts.length === 0 || revSiteStarts.length === 0) {
    const which =
      fwdStarts.length === 0 && revSiteStarts.length === 0
        ? 'Neither primer'
        : fwdStarts.length === 0
          ? 'Forward primer'
          : 'Reverse primer'
    return { success: false, error: 'primer-not-found', message: `${which} binds the template.` }
  }

  const validPairs: PCRCandidateRegion[] = []
  for (const f of fwdStarts) {
    for (const r of revSiteStarts) {
      const revEnd = r + reversePrimer.length
      if (topology === 'circular') {
        const length = revEnd > f ? revEnd - f : template.length - f + revEnd
        validPairs.push({ start: f, end: revEnd, length })
      } else if (revEnd > f) {
        validPairs.push({ start: f, end: revEnd, length: revEnd - f })
      }
    }
  }

  if (validPairs.length === 0) {
    return {
      success: false,
      error: 'primers-face-away',
      message: 'The primers are not oriented toward each other, so no product can form.',
    }
  }

  if (validPairs.length > 1) {
    return {
      success: false,
      error: 'multiple-plausible-regions',
      message: `${validPairs.length} plausible amplification regions were found; these primers are not specific to a single product.`,
      candidateRegions: validPairs,
    }
  }

  const { start: fwdStart, end: revEnd } = validPairs[0]
  const amplicon = getSubsequence(template, fwdStart, revEnd, topology)

  return {
    success: true,
    forwardBinding: { start: fwdStart, end: fwdStart + forwardPrimer.length },
    reverseBinding: { start: revEnd - reversePrimer.length, end: revEnd },
    amplicon,
    ampliconStart: fwdStart,
    ampliconEnd: revEnd,
  }
}
