import { useState } from 'react'
import { RESTRICTION_ENZYMES } from '../../data/restrictionEnzymes'
import { useUIStore } from '../../store/uiStore'

export function EnzymeList({ uniqueCutterIds }: { uniqueCutterIds: Set<string> }) {
  const [query, setQuery] = useState('')
  const enabledEnzymeIds = useUIStore((s) => s.enabledEnzymeIds)
  const toggleEnzyme = useUIStore((s) => s.toggleEnzyme)
  const setEnabledEnzymeIds = useUIStore((s) => s.setEnabledEnzymeIds)

  const filtered = RESTRICTION_ENZYMES.filter((e) =>
    e.name.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="flex w-52 shrink-0 flex-col border-r border-(--color-border)">
      <div className="border-b border-(--color-border) p-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search enzymes…"
          className="w-full rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-2 py-1 font-mono text-xs text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--color-accent) focus:outline-none"
        />
        <div className="mt-1.5 flex gap-2 text-[11px]">
          <button
            type="button"
            className="text-(--color-text-secondary) hover:text-(--color-accent)"
            onClick={() => setEnabledEnzymeIds(RESTRICTION_ENZYMES.map((e) => e.id))}
          >
            All
          </button>
          <button
            type="button"
            className="text-(--color-text-secondary) hover:text-(--color-accent)"
            onClick={() => setEnabledEnzymeIds([])}
          >
            None
          </button>
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {filtered.map((e) => (
          <li key={e.id}>
            <label className="flex cursor-pointer items-center gap-2 px-2 py-1 font-mono text-xs hover:bg-(--color-bg-hover)">
              <input
                type="checkbox"
                checked={enabledEnzymeIds.includes(e.id)}
                onChange={() => toggleEnzyme(e.id)}
                className="accent-(--color-accent)"
              />
              <span className="text-(--color-text-primary)">{e.name}</span>
              {uniqueCutterIds.has(e.id) && (
                <span className="ml-auto rounded bg-(--color-accent-dim) px-1 text-[9px] text-(--color-accent)">
                  unique
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
