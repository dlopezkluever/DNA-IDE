import { useUIStore } from '../../store/uiStore'
import { TopBar } from './TopBar'
import { ConstructExplorer } from './ConstructExplorer'
import { Inspector } from './Inspector'
import { ViewTabs } from './ViewTabs'
import { FeatureMapStrip } from '../map/FeatureMapStrip'
import { SequenceView } from '../../views/SequenceView'
import { MapView } from '../../views/MapView'
import { ProteinView } from '../../views/ProteinView'
import { MutationsView } from '../../views/MutationsView'
import { RestrictionView } from '../../views/RestrictionView'
import { PCRView } from '../../views/PCRView'
import { CompareView } from '../../views/CompareView'
import { AssemblyView } from '../../views/AssemblyView'

export function Shell() {
  const activeView = useUIStore((s) => s.activeView)

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
        </main>
        <Inspector />
      </div>
      <FeatureMapStrip />
      <ViewTabs />
    </div>
  )
}
