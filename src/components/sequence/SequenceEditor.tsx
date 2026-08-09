import { useCallback, useEffect, useMemo, useRef } from 'react'
import { List, type RowComponentProps } from 'react-window'
import { useUIStore, type SearchMatch } from '../../store/uiStore'

const BASES_PER_ROW = 60
const ROW_HEIGHT = 20

const BASE_COLOR: Record<string, string> = {
  A: 'text-(--color-base-a)',
  T: 'text-(--color-base-t)',
  G: 'text-(--color-base-g)',
  C: 'text-(--color-base-c)',
}

function isInRange(index: number, range: { start: number; end: number } | null): boolean {
  if (!range) return false
  const lo = Math.min(range.start, range.end)
  const hi = Math.max(range.start, range.end)
  return index >= lo && index < hi
}

interface RowData {
  sequence: string
  selection: { start: number; end: number } | null
  searchResults: SearchMatch[]
  onBaseMouseDown: (index: number) => void
  onBaseMouseEnter: (index: number) => void
}

function SequenceRow({
  index,
  style,
  sequence,
  selection,
  searchResults,
  onBaseMouseDown,
  onBaseMouseEnter,
}: RowComponentProps<RowData>) {
  const rowStart = index * BASES_PER_ROW
  const rowBases = sequence.slice(rowStart, rowStart + BASES_PER_ROW)

  return (
    <div
      style={style}
      className="flex items-center font-mono text-[13px] leading-none whitespace-pre select-none"
    >
      <span className="mr-3 inline-block w-16 shrink-0 text-right text-(--color-text-muted)">
        {rowStart + 1}
      </span>
      <span className="flex">
        {Array.from(rowBases).map((base, i) => {
          const globalIndex = rowStart + i
          const selected = isInRange(globalIndex, selection)
          const matched = !selected && searchResults.some((r) => isInRange(globalIndex, r))
          return (
            <span
              key={i}
              onMouseDown={() => onBaseMouseDown(globalIndex)}
              onMouseEnter={() => onBaseMouseEnter(globalIndex)}
              className={`inline-block w-[9px] text-center ${BASE_COLOR[base] ?? 'text-(--color-text-primary)'} ${
                selected ? 'bg-(--color-accent-dim)' : matched ? 'bg-(--color-warn)/40' : ''
              }`}
            >
              {base}
            </span>
          )
        })}
      </span>
    </div>
  )
}

interface SequenceEditorProps {
  sequence: string
}

export function SequenceEditor({ sequence }: SequenceEditorProps) {
  const selection = useUIStore((s) => s.selection)
  const setSelection = useUIStore((s) => s.setSelection)
  const searchResults = useUIStore((s) => s.searchResults)

  const draggingRef = useRef(false)
  const anchorRef = useRef<number | null>(null)

  const setActiveFeatureId = useUIStore((s) => s.setActiveFeatureId)
  const setActiveMutationId = useUIStore((s) => s.setActiveMutationId)

  const onBaseMouseDown = useCallback(
    (index: number) => {
      draggingRef.current = true
      anchorRef.current = index
      setActiveFeatureId(null)
      setActiveMutationId(null)
      setSelection({ start: index, end: index + 1 })
    },
    [setSelection, setActiveFeatureId, setActiveMutationId],
  )

  const onBaseMouseEnter = useCallback(
    (index: number) => {
      if (!draggingRef.current || anchorRef.current === null) return
      const anchor = anchorRef.current
      setSelection({ start: Math.min(anchor, index), end: Math.max(anchor, index) + 1 })
    },
    [setSelection],
  )

  useEffect(() => {
    const onMouseUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [])

  const rowCount = Math.max(1, Math.ceil(sequence.length / BASES_PER_ROW))

  const rowProps = useMemo<RowData>(
    () => ({ sequence, selection, searchResults, onBaseMouseDown, onBaseMouseEnter }),
    [sequence, selection, searchResults, onBaseMouseDown, onBaseMouseEnter],
  )

  return (
    <div className="h-full w-full bg-(--color-bg-canvas) py-2">
      <List
        rowComponent={SequenceRow}
        rowCount={rowCount}
        rowHeight={ROW_HEIGHT}
        rowProps={rowProps}
        style={{ height: '100%', width: '100%' }}
        overscanCount={10}
      />
    </div>
  )
}
