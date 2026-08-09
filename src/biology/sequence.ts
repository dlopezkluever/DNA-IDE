import type { Topology, FeatureSegment } from '../types/models'

const COMPLEMENT_MAP: Record<string, string> = {
  A: 'T',
  T: 'A',
  C: 'G',
  G: 'C',
  R: 'Y',
  Y: 'R',
  S: 'S',
  W: 'W',
  K: 'M',
  M: 'K',
  B: 'V',
  V: 'B',
  D: 'H',
  H: 'D',
  N: 'N',
}

const VALID_BASES = new Set(Object.keys(COMPLEMENT_MAP))

export function complement(base: string): string {
  return COMPLEMENT_MAP[base.toUpperCase()] ?? 'N'
}

export function reverseComplement(seq: string): string {
  let result = ''
  for (let i = seq.length - 1; i >= 0; i--) {
    result += complement(seq[i])
  }
  return result
}

export function calculateGC(seq: string): number {
  let gc = 0
  let atgc = 0
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i].toUpperCase()
    if (c === 'G' || c === 'C') {
      gc++
      atgc++
    } else if (c === 'A' || c === 'T') {
      atgc++
    }
  }
  return atgc === 0 ? 0 : (gc / atgc) * 100
}

export interface GCWindow {
  start: number
  end: number
  gc: number
}

/**
 * O(n) via prefix sums, so callers can slide a window across sequences of
 * hundreds of thousands of bases without an O(n * windowSize) recompute.
 */
export function slidingWindowGC(seq: string, windowSize: number, step = 1): GCWindow[] {
  const n = seq.length
  if (n === 0) return []
  if (windowSize <= 0 || windowSize > n) {
    return [{ start: 0, end: n, gc: calculateGC(seq) }]
  }

  const prefixGC = new Float64Array(n + 1)
  const prefixATGC = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) {
    const c = seq[i].toUpperCase()
    const isGC = c === 'G' || c === 'C' ? 1 : 0
    const isATGC = isGC || c === 'A' || c === 'T' ? 1 : 0
    prefixGC[i + 1] = prefixGC[i] + isGC
    prefixATGC[i + 1] = prefixATGC[i] + isATGC
  }

  const windows: GCWindow[] = []
  for (let start = 0; start + windowSize <= n; start += step) {
    const end = start + windowSize
    const gcCount = prefixGC[end] - prefixGC[start]
    const atgcCount = prefixATGC[end] - prefixATGC[start]
    windows.push({ start, end, gc: atgcCount === 0 ? 0 : (gcCount / atgcCount) * 100 })
  }
  return windows
}

export function normalizeSequence(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '')
}

export interface InvalidChar {
  char: string
  index: number
}

export function validateSequence(seq: string): { valid: boolean; invalidChars: InvalidChar[] } {
  const invalidChars: InvalidChar[] = []
  for (let i = 0; i < seq.length; i++) {
    if (!VALID_BASES.has(seq[i].toUpperCase())) {
      invalidChars.push({ char: seq[i], index: i })
    }
  }
  return { valid: invalidChars.length === 0, invalidChars }
}

export function wrapIndex(i: number, len: number): number {
  if (len <= 0) return 0
  return ((i % len) + len) % len
}

/**
 * `end < start` on a circular topology means the range wraps through the
 * origin (this is the internal wraparound convention used by restriction
 * fragments, PCR amplicons, and any feature without explicit `segments`).
 */
export function spansOrigin(range: { start: number; end: number }): boolean {
  return range.end < range.start
}

export function getSubsequence(
  seq: string,
  start: number,
  end: number,
  topology: Topology,
): string {
  const len = seq.length
  if (topology === 'linear' || end >= start) {
    return seq.slice(Math.max(0, start), Math.min(len, end))
  }
  return seq.slice(start) + seq.slice(0, end)
}

function segmentLength(seg: FeatureSegment, seqLen: number): number {
  return seg.end >= seg.start ? seg.end - seg.start : seqLen - seg.start + seg.end
}

export function featureLength(
  feature: { start: number; end: number; segments?: FeatureSegment[] },
  seqLen: number,
): number {
  if (feature.segments && feature.segments.length > 0) {
    return feature.segments.reduce((sum, seg) => sum + segmentLength(seg, seqLen), 0)
  }
  return spansOrigin(feature) ? seqLen - feature.start + feature.end : feature.end - feature.start
}

/** GenBank display coordinates are 1-based inclusive; internal ones are 0-based half-open. */
export function toDisplayPosition(i: number): number {
  return i + 1
}

export function fromDisplayPosition(p: number): number {
  return p - 1
}
