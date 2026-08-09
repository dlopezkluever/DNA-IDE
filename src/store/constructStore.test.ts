import { describe, it, expect, beforeEach } from 'vitest'
import { useConstructStore } from './constructStore'
import type { Construct } from '../types/models'

function makeConstruct(): Construct {
  return {
    id: 'orig1',
    name: 'test',
    sequence: 'AAAATGGAATTTTGAAAA',
    topology: 'linear',
    features: [],
    mutations: [],
  }
}

beforeEach(() => {
  useConstructStore.setState({
    constructs: {},
    activeConstructId: null,
    originalConstructId: null,
    compareConstructId: null,
  })
})

describe('constructStore.applyMutation (fork-once model)', () => {
  it('forks a new "-edited" working copy on the first mutation, leaving the original untouched', () => {
    useConstructStore.getState().loadConstruct(makeConstruct())
    useConstructStore.getState().applyMutation({ type: 'substitution', position: 3, reference: 'A', alternate: 'G' })

    const state = useConstructStore.getState()
    expect(state.originalConstructId).toBe('orig1')
    expect(state.activeConstructId).toBe('orig1-edited')
    expect(state.constructs['orig1'].sequence).toBe('AAAATGGAATTTTGAAAA') // untouched
    expect(state.constructs['orig1-edited'].sequence[3]).toBe('G')
  })

  it('applies subsequent mutations in place on the same working copy, without forking again', () => {
    useConstructStore.getState().loadConstruct(makeConstruct())
    useConstructStore.getState().applyMutation({ type: 'substitution', position: 3, reference: 'A', alternate: 'G' })
    useConstructStore.getState().applyMutation({ type: 'substitution', position: 4, reference: 'T', alternate: 'C' })

    const state = useConstructStore.getState()
    expect(state.activeConstructId).toBe('orig1-edited')
    expect(Object.keys(state.constructs).sort()).toEqual(['orig1', 'orig1-edited'])
    expect(state.constructs['orig1-edited'].mutations).toHaveLength(2)
    expect(state.constructs['orig1-edited'].sequence[3]).toBe('G')
    expect(state.constructs['orig1-edited'].sequence[4]).toBe('C')
  })

  it('throws when there is no active construct', () => {
    expect(() =>
      useConstructStore.getState().applyMutation({ type: 'substitution', position: 0, reference: 'A', alternate: 'G' }),
    ).toThrow(/No active construct/)
  })

  it('loading a new construct resets the fork state', () => {
    useConstructStore.getState().loadConstruct(makeConstruct())
    useConstructStore.getState().applyMutation({ type: 'substitution', position: 3, reference: 'A', alternate: 'G' })
    useConstructStore.getState().loadConstruct({ ...makeConstruct(), id: 'orig2' })

    const state = useConstructStore.getState()
    expect(state.activeConstructId).toBe('orig2')
    expect(state.originalConstructId).toBeNull()
  })
})
