import type { Feature } from '../types/models'

export type DiffOpType = 'match' | 'mismatch' | 'insertion' | 'deletion'

export interface DiffOp {
  type: DiffOpType
  refStart: number
  refEnd: number
  modStart: number
  modEnd: number
}

const MATCH_SCORE = 1
const MISMATCH_SCORE = -1
const GAP_PENALTY = -2

/** Above this size, true O(n*m) DP is infeasible (PRD §35 requires handling
 * sequences of hundreds of thousands of bases) — fall back to a fast
 * prefix/suffix anchor heuristic instead. */
const NW_SIZE_LIMIT = 20000

interface RawOp {
  type: DiffOpType
  refIdx?: number
  modIdx?: number
}

function coalesce(rawOps: RawOp[]): DiffOp[] {
  const result: DiffOp[] = []
  let refPos = 0
  let modPos = 0
  for (const op of rawOps) {
    const refLen = op.refIdx !== undefined ? 1 : 0
    const modLen = op.modIdx !== undefined ? 1 : 0
    const last = result[result.length - 1]
    if (last && last.type === op.type) {
      last.refEnd += refLen
      last.modEnd += modLen
    } else {
      result.push({ type: op.type, refStart: refPos, refEnd: refPos + refLen, modStart: modPos, modEnd: modPos + modLen })
    }
    refPos += refLen
    modPos += modLen
  }
  return result
}

function needlemanWunsch(ref: string, mod: string): DiffOp[] {
  const n = ref.length
  const m = mod.length
  const score = new Int32Array((n + 1) * (m + 1))
  const idx = (i: number, j: number) => i * (m + 1) + j

  for (let i = 0; i <= n; i++) score[idx(i, 0)] = i * GAP_PENALTY
  for (let j = 0; j <= m; j++) score[idx(0, j)] = j * GAP_PENALTY

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = score[idx(i - 1, j - 1)] + (ref[i - 1] === mod[j - 1] ? MATCH_SCORE : MISMATCH_SCORE)
      const up = score[idx(i - 1, j)] + GAP_PENALTY
      const left = score[idx(i, j - 1)] + GAP_PENALTY
      score[idx(i, j)] = Math.max(diag, up, left)
    }
  }

  const rawOps: RawOp[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && score[idx(i, j)] === score[idx(i - 1, j - 1)] + (ref[i - 1] === mod[j - 1] ? MATCH_SCORE : MISMATCH_SCORE)) {
      rawOps.push({ type: ref[i - 1] === mod[j - 1] ? 'match' : 'mismatch', refIdx: i - 1, modIdx: j - 1 })
      i--
      j--
    } else if (i > 0 && score[idx(i, j)] === score[idx(i - 1, j)] + GAP_PENALTY) {
      rawOps.push({ type: 'deletion', refIdx: i - 1 })
      i--
    } else {
      rawOps.push({ type: 'insertion', modIdx: j - 1 })
      j--
    }
  }
  rawOps.reverse()
  return coalesce(rawOps)
}

function anchorHeuristic(ref: string, mod: string): DiffOp[] {
  const maxPrefix = Math.min(ref.length, mod.length)
  let prefixLen = 0
  while (prefixLen < maxPrefix && ref[prefixLen] === mod[prefixLen]) prefixLen++

  const maxSuffix = Math.min(ref.length, mod.length) - prefixLen
  let suffixLen = 0
  while (suffixLen < maxSuffix && ref[ref.length - 1 - suffixLen] === mod[mod.length - 1 - suffixLen]) suffixLen++

  const ops: DiffOp[] = []
  if (prefixLen > 0) ops.push({ type: 'match', refStart: 0, refEnd: prefixLen, modStart: 0, modEnd: prefixLen })

  const refMidStart = prefixLen
  const refMidEnd = ref.length - suffixLen
  const modMidStart = prefixLen
  const modMidEnd = mod.length - suffixLen
  if (refMidEnd > refMidStart) {
    ops.push({ type: 'deletion', refStart: refMidStart, refEnd: refMidEnd, modStart: modMidStart, modEnd: modMidStart })
  }
  if (modMidEnd > modMidStart) {
    ops.push({ type: 'insertion', refStart: refMidEnd, refEnd: refMidEnd, modStart: modMidStart, modEnd: modMidEnd })
  }

  if (suffixLen > 0) {
    ops.push({
      type: 'match',
      refStart: ref.length - suffixLen,
      refEnd: ref.length,
      modStart: mod.length - suffixLen,
      modEnd: mod.length,
    })
  }
  return ops
}

export function alignSequences(reference: string, modified: string): DiffOp[] {
  if (reference.length <= NW_SIZE_LIMIT && modified.length <= NW_SIZE_LIMIT) {
    return needlemanWunsch(reference, modified)
  }
  return anchorHeuristic(reference, modified)
}

export function diffProteins(referenceProtein: string, modifiedProtein: string): DiffOp[] {
  return alignSequences(referenceProtein, modifiedProtein)
}

export interface FeatureDiff {
  added: Feature[]
  removed: Feature[]
  modified: { before: Feature; after: Feature }[]
  unchanged: Feature[]
}

function featureRangeKey(f: Feature): string {
  return `${f.start}:${f.end}:${f.strand}:${JSON.stringify(f.segments ?? null)}`
}

/** Id-based matching (mutations preserve feature ids across edits — see the store's fork-once model). */
export function diffFeatures(refFeatures: Feature[], modFeatures: Feature[]): FeatureDiff {
  const refById = new Map(refFeatures.map((f) => [f.id, f]))
  const modById = new Map(modFeatures.map((f) => [f.id, f]))

  const added: Feature[] = []
  const removed: Feature[] = []
  const modified: { before: Feature; after: Feature }[] = []
  const unchanged: Feature[] = []

  for (const [id, refF] of refById) {
    const modF = modById.get(id)
    if (!modF) {
      removed.push(refF)
    } else if (featureRangeKey(refF) !== featureRangeKey(modF)) {
      modified.push({ before: refF, after: modF })
    } else {
      unchanged.push(refF)
    }
  }
  for (const [id, modF] of modById) {
    if (!refById.has(id)) added.push(modF)
  }

  return { added, removed, modified, unchanged }
}
