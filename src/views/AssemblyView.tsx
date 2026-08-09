import { useState } from 'react'
import { useConstructStore } from '../store/constructStore'
import { useUIStore } from '../store/uiStore'
import { assembleConstruct, type AssemblyFragment } from '../biology/assembly'
import { toDisplayPosition } from '../biology/sequence'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

export function AssemblyView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const loadConstruct = useConstructStore((s) => s.loadConstruct)
  const selection = useUIStore((s) => s.selection)

  const [fragments, setFragments] = useState<AssemblyFragment[]>([])
  const [circularize, setCircularize] = useState(false)
  const [assembledName, setAssembledName] = useState('Assembled construct')

  const construct = activeConstructId ? constructs[activeConstructId] : null
  const constructList = Object.values(constructs)

  const addWholeConstruct = (id: string) => {
    const c = constructs[id]
    if (!c) return
    setFragments((f) => [
      ...f,
      { id: `${c.id}-${f.length}`, label: c.name, sequence: c.sequence, features: c.features },
    ])
  }

  const addSelection = () => {
    if (!construct || !selection) return
    const seq = construct.sequence.slice(selection.start, selection.end)
    setFragments((f) => [
      ...f,
      {
        id: `sel-${f.length}-${selection.start}`,
        label: `${construct.name} [${toDisplayPosition(selection.start)}-${selection.end}]`,
        sequence: seq,
        features: [],
      },
    ])
  }

  const removeFragment = (index: number) => setFragments((f) => f.filter((_, i) => i !== index))
  const moveFragment = (index: number, dir: -1 | 1) => {
    setFragments((f) => {
      const next = [...f]
      const target = index + dir
      if (target < 0 || target >= next.length) return f
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const assemble = () => {
    if (fragments.length === 0) return
    const result = assembleConstruct(assembledName, fragments, { circularize })
    loadConstruct(result)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-64 shrink-0 border-r border-(--color-border) p-3">
        <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
          Add Fragment
        </h3>
        <div className="mb-3 space-y-1">
          <label className="block font-mono text-[11px] text-(--color-text-muted)">
            From construct
          </label>
          <select
            value=""
            onChange={(e) => e.target.value && addWholeConstruct(e.target.value)}
            className="w-full rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-1.5 py-1 font-mono text-[11px] text-(--color-text-secondary)"
          >
            <option value="">Select…</option>
            {constructList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.sequence.length} bp)
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!construct || !selection}
          onClick={addSelection}
          className="w-full rounded border border-(--color-border-strong) px-2 py-1 font-mono text-[11px] text-(--color-text-secondary) hover:border-(--color-accent) hover:text-(--color-accent) disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add current selection
        </button>

        <h3 className="mt-6 mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
          Output
        </h3>
        <input
          type="text"
          value={assembledName}
          onChange={(e) => setAssembledName(e.target.value)}
          className="mb-2 w-full rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-2 py-1 font-mono text-xs text-(--color-text-primary)"
        />
        <label className="mb-3 flex items-center gap-1.5 font-mono text-[11px] text-(--color-text-secondary)">
          <input
            type="checkbox"
            checked={circularize}
            onChange={(e) => setCircularize(e.target.checked)}
          />
          Circularize
        </label>
        <button
          type="button"
          disabled={fragments.length === 0}
          onClick={assemble}
          className="w-full rounded border border-(--color-accent-dim) bg-(--color-accent-dim) px-2 py-1.5 font-mono text-xs text-(--color-accent) hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Assemble
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
          Fragments ({fragments.length})
        </h3>
        {fragments.length === 0 ? (
          <ViewPlaceholder
            title="No fragments yet"
            note="Add a whole construct or a selected region from the panel on the left."
          />
        ) : (
          <ul className="space-y-1.5">
            {fragments.map((f, i) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded border border-(--color-border) bg-(--color-bg-surface) px-2 py-1.5 font-mono text-xs"
              >
                <span className="text-(--color-text-muted)">{i + 1}.</span>
                <span className="flex-1 truncate text-(--color-text-primary)">{f.label}</span>
                <span className="text-(--color-text-muted)">{f.sequence.length} bp</span>
                <button
                  type="button"
                  onClick={() => moveFragment(i, -1)}
                  disabled={i === 0}
                  className="text-(--color-text-secondary) hover:text-(--color-accent) disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveFragment(i, 1)}
                  disabled={i === fragments.length - 1}
                  className="text-(--color-text-secondary) hover:text-(--color-accent) disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeFragment(i)}
                  className="text-(--color-text-muted) hover:text-(--color-danger)"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
