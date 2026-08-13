import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScenarioProgress } from '../scenarios/types'

export type { ScenarioProgress }

interface ScenarioState {
  progress: Record<string, ScenarioProgress>
  /** Session-transient, like uiStore's activeView — never persisted. */
  activeScenarioId: string | null

  startScenario: (id: string) => void
  exitScenario: () => void
  recordAttempt: (scenarioId: string, stars: 0 | 1 | 2 | 3) => void
}

export const useScenarioStore = create<ScenarioState>()(
  persist(
    (set) => ({
      progress: {},
      activeScenarioId: null,

      startScenario: (id) => set({ activeScenarioId: id }),
      exitScenario: () => set({ activeScenarioId: null }),

      // A retry can only improve your best recorded result, never regress it.
      recordAttempt: (scenarioId, stars) =>
        set((state) => {
          const existing = state.progress[scenarioId]
          const bestStars = Math.max(existing?.bestStars ?? 0, stars) as 0 | 1 | 2 | 3
          const attempts = (existing?.attempts ?? 0) + 1
          return {
            progress: { ...state.progress, [scenarioId]: { bestStars, attempts } },
          }
        }),
    }),
    {
      name: 'helix-ide-scenarios',
      partialize: (state) => ({ progress: state.progress }),
    },
  ),
)
