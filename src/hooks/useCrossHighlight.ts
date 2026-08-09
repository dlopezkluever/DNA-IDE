import { useCallback } from 'react'
import { useUIStore } from '../store/uiStore'
import type { Feature, Mutation, Strand } from '../types/models'

/**
 * The single shared mechanism behind PRD §34's cross-highlighting: every view
 * reads and writes the same uiStore selection/active-id fields through this
 * hook, so clicking a feature/codon/mutation in any panel highlights it
 * everywhere else without views knowing about each other directly.
 */
export function useCrossHighlight() {
  const selection = useUIStore((s) => s.selection)
  const setSelection = useUIStore((s) => s.setSelection)
  const activeFeatureId = useUIStore((s) => s.activeFeatureId)
  const setActiveFeatureId = useUIStore((s) => s.setActiveFeatureId)
  const activeMutationId = useUIStore((s) => s.activeMutationId)
  const setActiveMutationId = useUIStore((s) => s.setActiveMutationId)
  const hoveredCodon = useUIStore((s) => s.hoveredCodon)
  const setHoveredCodon = useUIStore((s) => s.setHoveredCodon)

  const selectRange = useCallback(
    (start: number, end: number, strand?: Strand) => {
      setActiveFeatureId(null)
      setActiveMutationId(null)
      setSelection({ start, end, strand })
    },
    [setSelection, setActiveFeatureId, setActiveMutationId],
  )

  const selectFeature = useCallback(
    (feature: Feature) => {
      setActiveFeatureId(feature.id)
      setActiveMutationId(null)
      setSelection({ start: feature.start, end: feature.end, strand: feature.strand })
    },
    [setActiveFeatureId, setActiveMutationId, setSelection],
  )

  const selectMutation = useCallback(
    (mutation: Mutation) => {
      setActiveMutationId(mutation.id)
      setActiveFeatureId(null)
      const width = Math.max(mutation.reference.length, mutation.alternate.length, 1)
      setSelection({ start: mutation.position, end: mutation.position + width })
    },
    [setActiveMutationId, setActiveFeatureId, setSelection],
  )

  const selectCodon = useCallback(
    (codon: { start: number; end: number }) => {
      setHoveredCodon(codon)
      setSelection({ start: codon.start, end: codon.end })
    },
    [setHoveredCodon, setSelection],
  )

  return {
    selection,
    activeFeatureId,
    activeMutationId,
    hoveredCodon,
    selectRange,
    selectFeature,
    selectMutation,
    selectCodon,
    setHoveredCodon,
  }
}
