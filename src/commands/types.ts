import type { Construct, Feature, Strand } from '../types/models'
import type { Selection, ViewId } from '../store/uiStore'

/** The live values/setters a command needs, assembled from hooks by CommandPalette.tsx. */
export interface CommandContext {
  activeView: ViewId
  setActiveView: (view: ViewId) => void

  selection: Selection | null
  activeFeatureId: string | null
  selectFeature: (feature: Feature) => void
  selectRange: (start: number, end: number, strand?: Strand) => void

  activeConstruct: Construct | null
  constructs: Construct[]
  setCompareConstruct: (id: string | null) => void

  toggleExplainMode: () => void
  setRcPreviewOpen: (open: boolean) => void
  setOrfListOpen: (open: boolean) => void
  setMutationHeatmapOpen: (open: boolean) => void
}

export type CommandCategory = 'navigate' | 'run' | 'toggle'

export interface CommandDef {
  id: string
  label: string
  category: CommandCategory
  run: () => void
  enabled: boolean
  disabledReason?: string
}
