import { create } from 'zustand'
import type { Construct } from '../types/models'

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
}

export const useConstructStore = create<ConstructState>((set) => ({
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
}))
