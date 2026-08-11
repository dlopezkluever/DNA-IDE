import type { ViewId } from '../store/uiStore'

export const TABS: { id: ViewId; label: string }[] = [
  { id: 'sequence', label: 'Sequence' },
  { id: 'map', label: 'Map' },
  { id: 'protein', label: 'Protein' },
  { id: 'mutations', label: 'Mutations' },
  { id: 'restriction', label: 'Restriction' },
  { id: 'pcr', label: 'PCR' },
  { id: 'compare', label: 'Compare' },
  { id: 'assembly', label: 'Assembly' },
]
