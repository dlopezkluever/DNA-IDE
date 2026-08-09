import type { Topology } from '../types/models'
import { calculateGC, getSubsequence, reverseComplement } from './sequence'

/**
 * Wallace rule for short primers (<14nt): 2°C per A/T, 4°C per G/C — deterministic,
 * hand-verifiable arithmetic that's easy to show in Explain Mode. For longer,
 * more realistic primers (>=14nt) a GC%-based formula is used instead. Both
 * skip nearest-neighbor thermodynamics as overkill for an educational tool.
 */
export function calculateTm(seq: string): number {
  const upper = seq.toUpperCase()
  const at = (upper.match(/[AT]/g) ?? []).length
  const gc = (upper.match(/[GC]/g) ?? []).length
  if (upper.length < 14) {
    return 2 * at + 4 * gc
  }
  return 64.9 + (41 * (gc - 16.4)) / upper.length
}

export interface Primer {
  sequence: string
  length: number
  gcPercent: number
  tm: number
  /** 0-based half-open range on the plus strand where this primer binds. */
  start: number
  end: number
  orientation: 'forward' | 'reverse'
}

export interface DesignPrimersOptions {
  targetLength?: number
  targetTmRange?: { min: number; max: number }
  topology?: Topology
}

export interface DesignPrimersResult {
  forward: Primer[]
  reverse: Primer[]
}

function buildPrimer(sequence: string, start: number, end: number, orientation: Primer['orientation']): Primer {
  return {
    sequence,
    length: sequence.length,
    gcPercent: calculateGC(sequence),
    tm: calculateTm(sequence),
    start,
    end,
    orientation,
  }
}

/** Ranked candidate forward/reverse primers flanking `region`, near `targetLength` and `targetTmRange`. */
export function designPrimers(
  seq: string,
  region: { start: number; end: number },
  options: DesignPrimersOptions = {},
): DesignPrimersResult {
  const { targetLength = 20, targetTmRange = { min: 55, max: 65 }, topology = 'linear' } = options
  const candidateLengths = [-3, -2, -1, 0, 1, 2, 3]
    .map((d) => targetLength + d)
    .filter((l) => l >= 15 && l <= 30)

  const forward: Primer[] = []
  for (const len of candidateLengths) {
    const start = region.start
    const end = start + len
    if (topology === 'linear' && end > seq.length) continue
    forward.push(buildPrimer(getSubsequence(seq, start, end, topology), start, end, 'forward'))
  }

  const reverse: Primer[] = []
  for (const len of candidateLengths) {
    const end = region.end
    const start = end - len
    if (topology === 'linear' && start < 0) continue
    const templateSeq = getSubsequence(seq, start, end, topology)
    reverse.push(buildPrimer(reverseComplement(templateSeq), start, end, 'reverse'))
  }

  const targetTm = (targetTmRange.min + targetTmRange.max) / 2
  const byTmCloseness = (a: Primer, b: Primer) => Math.abs(a.tm - targetTm) - Math.abs(b.tm - targetTm)
  forward.sort(byTmCloseness)
  reverse.sort(byTmCloseness)

  return { forward, reverse }
}
