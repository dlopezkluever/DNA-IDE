import { describe, it, expect } from 'vitest'
import { alignSequences, diffFeatures } from './alignment'
import type { Feature } from '../types/models'

function reconstruct(ops: ReturnType<typeof alignSequences>, ref: string, mod: string) {
  let refOut = ''
  let modOut = ''
  for (const op of ops) {
    refOut += ref.slice(op.refStart, op.refEnd)
    modOut += mod.slice(op.modStart, op.modEnd)
  }
  return { refOut, modOut }
}

describe('alignSequences (Needleman-Wunsch path)', () => {
  it('returns a single match op for identical sequences', () => {
    const ops = alignSequences('ATGCATGC', 'ATGCATGC')
    expect(ops).toEqual([{ type: 'match', refStart: 0, refEnd: 8, modStart: 0, modEnd: 8 }])
  })

  it('detects a single substitution as match-mismatch-match', () => {
    const ref = 'ATGGGCTAT'
    const mod = 'ATGGACTAT' // position 4: G -> A
    const ops = alignSequences(ref, mod)
    expect(ops.map((o) => o.type)).toEqual(['match', 'mismatch', 'match'])
    const mismatch = ops[1]
    expect(ref.slice(mismatch.refStart, mismatch.refEnd)).toBe('G')
    expect(mod.slice(mismatch.modStart, mismatch.modEnd)).toBe('A')
  })

  it('detects a pure insertion', () => {
    const ref = 'AAATTT'
    const mod = 'AAAGGGTTT' // "GGG" inserted after position 3
    const ops = alignSequences(ref, mod)
    expect(ops.map((o) => o.type)).toEqual(['match', 'insertion', 'match'])
    expect(mod.slice(ops[1].modStart, ops[1].modEnd)).toBe('GGG')
    expect(ops[1].refStart).toBe(ops[1].refEnd) // zero-width on the reference side
  })

  it('detects a pure deletion', () => {
    const ref = 'AAAGGGTTT'
    const mod = 'AAATTT' // "GGG" deleted
    const ops = alignSequences(ref, mod)
    expect(ops.map((o) => o.type)).toEqual(['match', 'deletion', 'match'])
    expect(ref.slice(ops[1].refStart, ops[1].refEnd)).toBe('GGG')
    expect(ops[1].modStart).toBe(ops[1].modEnd)
  })

  it('reconstructs both sequences exactly from the op list', () => {
    const ref = 'ATGCCGTATTAGGCCA'
    const mod = 'ATGACGTAAGGCCAGG'
    const ops = alignSequences(ref, mod)
    const { refOut, modOut } = reconstruct(ops, ref, mod)
    expect(refOut).toBe(ref)
    expect(modOut).toBe(mod)
  })
})

describe('alignSequences (large-sequence heuristic path)', () => {
  it('falls back to prefix/suffix anchoring above the DP size limit and still finds the right diff', () => {
    const prefix = 'A'.repeat(10000)
    const suffix = 'A'.repeat(10000)
    const ref = prefix + 'X' + suffix // 20001nt
    const mod = prefix + 'Y' + suffix // 20001nt
    const ops = alignSequences(ref, mod)

    expect(ops.map((o) => o.type)).toEqual(['match', 'deletion', 'insertion', 'match'])
    expect(ref.slice(ops[1].refStart, ops[1].refEnd)).toBe('X')
    expect(mod.slice(ops[2].modStart, ops[2].modEnd)).toBe('Y')

    const { refOut, modOut } = reconstruct(ops, ref, mod)
    expect(refOut).toBe(ref)
    expect(modOut).toBe(mod)
  })
})

describe('diffFeatures', () => {
  function feature(overrides: Partial<Feature>): Feature {
    return { id: 'f1', type: 'CDS', name: 'f', start: 0, end: 10, strand: 1, ...overrides }
  }

  it('classifies unchanged, modified, added, and removed features by id', () => {
    const ref = [
      feature({ id: 'unchanged' }),
      feature({ id: 'moved', start: 0, end: 10 }),
      feature({ id: 'onlyInRef' }),
    ]
    const mod = [
      feature({ id: 'unchanged' }),
      feature({ id: 'moved', start: 5, end: 15 }),
      feature({ id: 'onlyInMod' }),
    ]
    const diff = diffFeatures(ref, mod)
    expect(diff.unchanged.map((f) => f.id)).toEqual(['unchanged'])
    expect(diff.modified.map((m) => m.before.id)).toEqual(['moved'])
    expect(diff.removed.map((f) => f.id)).toEqual(['onlyInRef'])
    expect(diff.added.map((f) => f.id)).toEqual(['onlyInMod'])
  })
})
