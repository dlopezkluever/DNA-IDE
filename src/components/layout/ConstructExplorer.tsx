import { useConstructStore } from '../../store/constructStore'
import { useCrossHighlight } from '../../hooks/useCrossHighlight'

const FEATURE_TYPE_COLOR: Record<string, string> = {
  gene: 'text-(--color-info)',
  CDS: 'text-(--color-accent)',
  promoter: 'text-(--color-warn)',
  terminator: 'text-(--color-danger)',
  origin: 'text-(--color-text-secondary)',
  regulatory: 'text-(--color-warn)',
  misc: 'text-(--color-text-muted)',
}

export function ConstructExplorer() {
  const constructs = useConstructStore((s) => s.constructs)
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const setActiveConstruct = useConstructStore((s) => s.setActiveConstruct)
  const { selectFeature, activeFeatureId } = useCrossHighlight()

  const constructList = Object.values(constructs)
  const activeConstruct = activeConstructId ? constructs[activeConstructId] : null

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-(--color-border) bg-(--color-bg-surface)">
      <div className="border-b border-(--color-border) px-3 py-2">
        <h2 className="text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
          Constructs
        </h2>
      </div>

      {constructList.length === 0 && (
        <p className="px-3 py-4 text-xs text-(--color-text-muted)">
          No constructs loaded. Import a FASTA file to get started.
        </p>
      )}

      <ul className="border-b border-(--color-border) py-1">
        {constructList.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setActiveConstruct(c.id)}
              className={`w-full truncate px-3 py-1 text-left font-mono text-sm ${
                c.id === activeConstructId
                  ? 'bg-(--color-bg-hover) text-(--color-accent)'
                  : 'text-(--color-text-secondary) hover:bg-(--color-bg-hover)'
              }`}
              title={c.name}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>

      {activeConstruct && (
        <div className="flex-1 px-3 py-2">
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
            Features
          </h3>
          {activeConstruct.features.length === 0 ? (
            <p className="text-xs text-(--color-text-muted)">No annotated features.</p>
          ) : (
            <ul className="space-y-0.5">
              {activeConstruct.features.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => selectFeature(f)}
                    className={`flex w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-left font-mono text-xs ${
                      f.id === activeFeatureId
                        ? 'bg-(--color-bg-hover)'
                        : 'hover:bg-(--color-bg-hover)'
                    }`}
                    title={`${f.name} (${f.type}) ${f.start + 1}-${f.end}`}
                  >
                    <span className={FEATURE_TYPE_COLOR[f.type] ?? 'text-(--color-text-muted)'}>
                      {f.strand === 1 ? '▶' : '◀'}
                    </span>
                    <span className="truncate text-(--color-text-secondary)">{f.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  )
}
