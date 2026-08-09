import { create } from 'zustand'
import type { Construct, Mutation } from '../types/models'
import { applyMutation as applyMutationToConstruct, type MutationInput } from '../biology/mutations'

interface ConstructState {
  constructs: Record<string, Construct>
  activeConstructId: string | null
  /** Pristine source construct id, set once a working copy is forked off by the first edit. */
  originalConstructId: string | null
  compareConstructId: string | null

  loadConstruct: (construct: Construct) => void
  setActiveConstruct: (id: string | null) => void
  setCompareConstruct: (id: string | null) => void
  removeConstruct: (id: string) => void
  updateConstruct: (id: string, construct: Construct) => void
  applyMutation: (input: MutationInput) => Mutation
}

export const useConstructStore = create<ConstructState>((set, get) => ({
  constructs: {},
  activeConstructId: null,
  originalConstructId: null,
  compareConstructId: null,

  loadConstruct: (construct) =>
    set((state) => ({
      constructs: { ...state.constructs, [construct.id]: construct },
      activeConstructId: construct.id,
      originalConstructId: null,
      compareConstructId: null,
    })),

  setActiveConstruct: (id) => set({ activeConstructId: id }),

  setCompareConstruct: (id) => set({ compareConstructId: id }),

  removeConstruct: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.constructs
      return {
        constructs: rest,
        activeConstructId: state.activeConstructId === id ? null : state.activeConstructId,
        compareConstructId: state.compareConstructId === id ? null : state.compareConstructId,
        originalConstructId: state.originalConstructId === id ? null : state.originalConstructId,
      }
    }),

  updateConstruct: (id, construct) =>
    set((state) => ({ constructs: { ...state.constructs, [id]: construct } })),

  // Fork-once model: the first mutation on a freshly loaded construct forks off a
  // "-edited" working copy, leaving the pristine original in place under its own id
  // (recorded as originalConstructId) so Compare can always diff original vs. active.
  // Every subsequent mutation updates that same working copy in place.
  applyMutation: (input) => {
    const state = get()
    const activeId = state.activeConstructId
    if (!activeId) throw new Error('No active construct to mutate')

    const isFirstEdit = state.originalConstructId === null
    const workingId = isFirstEdit ? `${activeId}-edited` : activeId
    const source = state.constructs[activeId]
    const base: Construct = isFirstEdit
      ? { ...source, id: workingId, name: `${source.name} (edited)` }
      : source

    const { construct: updated, mutation } = applyMutationToConstruct(base, input)

    set((s) => ({
      constructs: { ...s.constructs, [workingId]: updated },
      activeConstructId: workingId,
      originalConstructId: isFirstEdit ? activeId : s.originalConstructId,
    }))

    return mutation
  },
}))
