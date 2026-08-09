import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Strand } from '../types/models'
import { RESTRICTION_ENZYMES } from '../data/restrictionEnzymes'

export type ViewId =
  'sequence' | 'map' | 'protein' | 'mutations' | 'restriction' | 'pcr' | 'compare' | 'assembly'

export interface Selection {
  start: number
  end: number
  strand?: Strand
}

export interface SearchMatch {
  start: number
  end: number
}

interface UIState {
  activeView: ViewId
  explainMode: boolean

  selection: Selection | null
  hoveredCodon: { start: number; end: number } | null
  activeFeatureId: string | null
  activeMutationId: string | null

  enabledEnzymeIds: string[]

  searchQuery: string
  searchResults: SearchMatch[]

  setActiveView: (view: ViewId) => void
  toggleExplainMode: () => void

  setSelection: (selection: Selection | null) => void
  setHoveredCodon: (codon: { start: number; end: number } | null) => void
  setActiveFeatureId: (id: string | null) => void
  setActiveMutationId: (id: string | null) => void

  setEnabledEnzymeIds: (ids: string[]) => void
  toggleEnzyme: (id: string) => void

  setSearchQuery: (query: string) => void
  setSearchResults: (results: SearchMatch[]) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeView: 'sequence',
      explainMode: false,

      selection: null,
      hoveredCodon: null,
      activeFeatureId: null,
      activeMutationId: null,

      enabledEnzymeIds: RESTRICTION_ENZYMES.map((e) => e.id),

      searchQuery: '',
      searchResults: [],

      setActiveView: (view) => set({ activeView: view }),
      toggleExplainMode: () => set((state) => ({ explainMode: !state.explainMode })),

      setSelection: (selection) => set({ selection }),
      setHoveredCodon: (hoveredCodon) => set({ hoveredCodon }),
      setActiveFeatureId: (activeFeatureId) => set({ activeFeatureId }),
      setActiveMutationId: (activeMutationId) => set({ activeMutationId }),

      setEnabledEnzymeIds: (enabledEnzymeIds) => set({ enabledEnzymeIds }),
      toggleEnzyme: (id) =>
        set((state) => ({
          enabledEnzymeIds: state.enabledEnzymeIds.includes(id)
            ? state.enabledEnzymeIds.filter((e) => e !== id)
            : [...state.enabledEnzymeIds, id],
        })),

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSearchResults: (searchResults) => set({ searchResults }),
    }),
    {
      name: 'helix-ide-ui',
      partialize: (state) => ({
        explainMode: state.explainMode,
        enabledEnzymeIds: state.enabledEnzymeIds,
      }),
    },
  ),
)
