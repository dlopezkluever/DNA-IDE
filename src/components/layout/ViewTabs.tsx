import { useUIStore } from '../../store/uiStore'
import { TABS } from '../../data/viewTabs'

export function ViewTabs() {
  const activeView = useUIStore((s) => s.activeView)
  const setActiveView = useUIStore((s) => s.setActiveView)

  return (
    <nav className="flex h-9 shrink-0 items-stretch border-t border-(--color-border) bg-(--color-bg-surface)">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveView(tab.id)}
          className={`px-3 font-mono text-xs transition-colors ${
            activeView === tab.id
              ? 'border-t-2 border-(--color-accent) bg-(--color-bg-canvas) text-(--color-accent)'
              : 'border-t-2 border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
