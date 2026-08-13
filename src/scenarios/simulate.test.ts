import { describe, it, expect } from 'vitest'
import { simulateNHEJRepair } from './simulate'
import { applyMutation } from '../biology/mutations'
import type { Construct } from '../types/models'

/** Replays a fixed sequence of values, one per rng() call — the DI pattern crispr.test.ts
 * avoids nondeterminism by construction rather than statistically; simulateNHEJRepair achieves
 * the same by taking rng as a parameter instead. */
function queueRng(values: number[]): () => number {
  let i = 0
  return () => {
    if (i >= values.length) throw new Error('queueRng exhausted — test queued too few values')
    return values[i++]
  }
}

describe('simulateNHEJRepair', () => {
  it('rolls a deletion with the shortest (weight-45) length for a low roll pair', () => {
    // call 1 (0.1 < 0.55) -> deletion; call 2 (0.05 * 100 = 5, falls in the [0,45) bucket) -> length 1
    const outcome = simulateNHEJRepair(204, queueRng([0.1, 0.05]))
    expect(outcome).toEqual({ editType: 'deletion', length: 1, position: 204 })
  })

  it('rolls a deletion at the weight-25 bucket boundary', () => {
    // roll = 0.46 * 100 = 46, just past the [0,45) bucket -> length 2
    const outcome = simulateNHEJRepair(50, queueRng([0.2, 0.46]))
    expect(outcome).toEqual({ editType: 'deletion', length: 2, position: 50 })
  })

  it('rolls an insertion with deterministic inserted bases for a high roll pair', () => {
    // call 1 (0.9 >= 0.55) -> insertion; call 2 (0.99 * 100 = 99, falls in the last [97,100) bucket) -> length 6
    // calls 3-8 pick each inserted base: idx = floor(rng * 4) -> 0='A' 1='T' 2='G' 3='C'
    const outcome = simulateNHEJRepair(10, queueRng([0.9, 0.99, 0.1, 0.3, 0.6, 0.9, 0.2, 0.4]))
    expect(outcome).toEqual({
      editType: 'insertion',
      length: 6,
      position: 10,
      insertedBases: 'ATGCAT',
    })
  })

  it('never attaches insertedBases to a deletion outcome', () => {
    const outcome = simulateNHEJRepair(0, queueRng([0.1, 0.05]))
    expect(outcome.insertedBases).toBeUndefined()
  })

  it('defaults to Math.random and still produces a well-formed outcome', () => {
    const outcome = simulateNHEJRepair(42)
    expect(['insertion', 'deletion']).toContain(outcome.editType)
    expect(outcome.length).toBeGreaterThanOrEqual(1)
    expect(outcome.length).toBeLessThanOrEqual(6)
    expect(outcome.position).toBe(42)
    if (outcome.editType === 'insertion') {
      expect(outcome.insertedBases).toHaveLength(outcome.length)
      expect(outcome.insertedBases).toMatch(/^[ATGC]+$/)
    } else {
      expect(outcome.insertedBases).toBeUndefined()
    }
  })

  it('documents (does not fix) the non-wrapping deletion slice near a circular construct\'s origin', () => {
    // 10bp circular construct. cutPosition=7 sits 3bp from the end -- adjacent to the origin on a
    // circular map, even though 7 isn't numerically close to 0. A real circular deletion spanning
    // the origin would remove 6bp total (indices 7,8,9,0,1,2); applyMutation's reference slice
    // (seqBefore.slice(position, position+reference.length)) does not wrap, so it silently
    // clamps to just indices 7,8,9 -- exactly the pre-existing limitation §2.3 calls out.
    const construct: Construct = {
      id: 'c1',
      name: 'tiny-circular',
      sequence: 'ATCGATCGAT',
      topology: 'circular',
      features: [],
      mutations: [],
    }
    const outcome = simulateNHEJRepair(7, queueRng([0.1, 0.99])) // deletion, length 6
    expect(outcome.length).toBe(6)

    const reference = construct.sequence.slice(outcome.position, outcome.position + outcome.length)
    expect(reference).toBe('GAT') // indices 7,8,9 only -- clamped to 3bp instead of the rolled 6bp

    const { construct: after, mutation } = applyMutation(construct, {
      type: 'deletion',
      position: outcome.position,
      reference,
      alternate: '',
    })
    expect(mutation.reference.length).toBeLessThan(outcome.length) // clamped, not the full 6bp roll
    expect(after.sequence.length).toBe(construct.sequence.length - mutation.reference.length)
  })
})
