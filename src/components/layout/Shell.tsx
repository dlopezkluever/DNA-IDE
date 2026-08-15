import { useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'
import { TopBar } from './TopBar'
import { ConstructExplorer } from './ConstructExplorer'
import { Inspector } from './Inspector'
import { ViewTabs } from './ViewTabs'
import { FeatureMapStrip } from '../map/FeatureMapStrip'
import { CommandPalette } from '../palette/CommandPalette'
import { SequenceView } from '../../views/SequenceView'
import { MapView } from '../../views/MapView'
import { ProteinView } from '../../views/ProteinView'
import { MutationsView } from '../../views/MutationsView'
import { RestrictionView } from '../../views/RestrictionView'
import { PCRView } from '../../views/PCRView'
import { CompareView } from '../../views/CompareView'
import { AssemblyView } from '../../views/AssemblyView'
import { CRISPRView } from '../../views/CRISPRView'
import { ScenarioView } from '../../views/ScenarioView'
import { StructureView } from '../../views/StructureView'

export function Shell() {
  const activeView = useUIStore((s) => s.activeView)
  const isPaletteOpen = useUIStore((s) => s.isPaletteOpen)
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(!isPaletteOpen)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPaletteOpen, setPaletteOpen])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-(--color-bg-canvas) text-(--color-text-primary)">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ConstructExplorer />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {activeView === 'sequence' && <SequenceView />}
          {activeView === 'map' && <MapView />}
          {activeView === 'protein' && <ProteinView />}
          {activeView === 'mutations' && <MutationsView />}
          {activeView === 'restriction' && <RestrictionView />}
          {activeView === 'pcr' && <PCRView />}
          {activeView === 'compare' && <CompareView />}
          {activeView === 'assembly' && <AssemblyView />}
          {activeView === 'crispr' && <CRISPRView />}
          {activeView === 'scenarios' && <ScenarioView />}
          {activeView === 'structure' && <StructureView />}
        </main>
        <Inspector />
      </div>
      <FeatureMapStrip />
      <ViewTabs />
      <CommandPalette />
    </div>
  )
}
