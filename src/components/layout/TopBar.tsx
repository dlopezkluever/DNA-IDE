import { useConstructStore } from '../../store/constructStore'
import { useUIStore } from '../../store/uiStore'
import { FileImport } from '../common/FileImport'

export function TopBar() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const explainMode = useUIStore((s) => s.explainMode)
  const toggleExplainMode = useUIStore((s) => s.toggleExplainMode)

  const activeConstruct = activeConstructId ? constructs[activeConstructId] : null

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-(--color-border) bg-(--color-bg-surface) px-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold tracking-tight text-(--color-accent)">
          Helix IDE
        </span>
        {activeConstruct && (
          <>
            <span className="text-(--color-text-muted)">/</span>
            <span className="font-mono text-sm text-(--color-text-secondary)">
              {activeConstruct.name}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <FileImport />
        <button
          type="button"
          onClick={toggleExplainMode}
          className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
            explainMode
              ? 'border-(--color-accent-dim) bg-(--color-accent-dim) text-(--color-accent)'
              : 'border-(--color-border-strong) text-(--color-text-secondary) hover:border-(--color-text-muted)'
          }`}
          title="Toggle step-by-step biological reasoning for operations"
        >
          Explain {explainMode ? 'On' : 'Off'}
        </button>
      </div>
    </header>
  )
}
