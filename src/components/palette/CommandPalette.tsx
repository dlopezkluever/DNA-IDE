import { useEffect, useMemo, useRef, useState } from 'react'
import { useConstructStore } from '../../store/constructStore'
import { useUIStore } from '../../store/uiStore'
import { useCrossHighlight } from '../../hooks/useCrossHighlight'
import { buildCommands, fuzzyScore } from '../../commands/registry'
import type { CommandContext, CommandDef } from '../../commands/types'

type Mode = 'root' | 'compare-target'

export function CommandPalette() {
  const isOpen = useUIStore((s) => s.isPaletteOpen)
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen)
  const activeView = useUIStore((s) => s.activeView)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const toggleExplainMode = useUIStore((s) => s.toggleExplainMode)
  const setRcPreviewOpen = useUIStore((s) => s.setRcPreviewOpen)
  const setOrfListOpen = useUIStore((s) => s.setOrfListOpen)
  const setMutationHeatmapOpen = useUIStore((s) => s.setMutationHeatmapOpen)

  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructsById = useConstructStore((s) => s.constructs)
  const setCompareConstruct = useConstructStore((s) => s.setCompareConstruct)

  const { selection, activeFeatureId, selectFeature, selectRange } = useCrossHighlight()

  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('root')
  const inputRef = useRef<HTMLInputElement>(null)

  const constructList = useMemo(() => Object.values(constructsById), [constructsById])
  const activeConstruct = activeConstructId ? (constructsById[activeConstructId] ?? null) : null

  const ctx: CommandContext = useMemo(
    () => ({
      activeView,
      setActiveView,
      selection,
      activeFeatureId,
      selectFeature,
      selectRange,
      activeConstruct,
      constructs: constructList,
      setCompareConstruct,
      toggleExplainMode,
      setRcPreviewOpen,
      setOrfListOpen,
      setMutationHeatmapOpen,
    }),
    [
      activeView,
      setActiveView,
      selection,
      activeFeatureId,
      selectFeature,
      selectRange,
      activeConstruct,
      constructList,
      setCompareConstruct,
      toggleExplainMode,
      setRcPreviewOpen,
      setOrfListOpen,
      setMutationHeatmapOpen,
    ],
  )

  const allCommands = useMemo(() => buildCommands(ctx), [ctx])

  const rootResults = useMemo(() => {
    const scored: { command: CommandDef; score: number }[] = []
    for (const command of allCommands) {
      const score = fuzzyScore(query, command.label)
      if (score !== null) scored.push({ command, score })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.map((s) => s.command)
  }, [allCommands, query])

  const otherConstructs = useMemo(
    () => constructList.filter((c) => c.id !== activeConstructId),
    [constructList, activeConstructId],
  )

  const compareResults = useMemo(
    () =>
      otherConstructs
        .map((c) => ({ id: c.id, label: c.name }))
        .filter((item) => fuzzyScore(query, item.label) !== null),
    [otherConstructs, query],
  )

  const resultsCount = mode === 'root' ? rootResults.length : compareResults.length

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setHighlightedIndex(0)
    setMode('root')
    // Palette just mounted its content — focus the input once it's in the DOM.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [query, mode])

  if (!isOpen) return null

  const close = () => setPaletteOpen(false)

  const runRootCommand = (command: CommandDef) => {
    if (!command.enabled) return
    if (command.id === 'compare-with') {
      // Intercepted here rather than in run() — swaps the palette into its
      // compare-target sub-mode instead of executing-and-closing (§2.4).
      setMode('compare-target')
      setQuery('')
      return
    }
    command.run()
    close()
  }

  const pickCompareTarget = (id: string) => {
    setCompareConstruct(id)
    setActiveView('compare')
    close()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => (resultsCount === 0 ? 0 : (i + 1) % resultsCount))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => (resultsCount === 0 ? 0 : (i - 1 + resultsCount) % resultsCount))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (mode === 'root') {
        const command = rootResults[highlightedIndex]
        if (command) runRootCommand(command)
      } else {
        const target = compareResults[highlightedIndex]
        if (target) pickCompareTarget(target.id)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (mode === 'compare-target') {
        setMode('root')
        setQuery('')
      } else {
        close()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={close}
    >
      <div
        className="w-full max-w-lg rounded border border-(--color-border-strong) bg-(--color-bg-elevated)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-(--color-border) px-3 py-2">
          <span className="font-mono text-sm text-(--color-accent)">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'root' ? 'Type a command…' : 'Select a construct to compare with…'}
            className="w-full bg-transparent font-mono text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {mode === 'root' && !activeConstruct && (
            <div className="px-3 py-2 font-mono text-xs text-(--color-text-muted)">
              Import a FASTA or GenBank file to begin.
            </div>
          )}

          {mode === 'root'
            ? rootResults.map((command, i) => {
                const isHighlighted = i === highlightedIndex
                return (
                  <button
                    key={command.id}
                    type="button"
                    disabled={!command.enabled}
                    onClick={() => runRootCommand(command)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left font-mono text-xs transition-colors disabled:cursor-not-allowed ${
                      command.enabled
                        ? isHighlighted
                          ? 'bg-(--color-bg-hover) text-(--color-accent)'
                          : 'text-(--color-text-secondary)'
                        : 'text-(--color-text-muted) opacity-60'
                    }`}
                  >
                    <span>{command.label}</span>
                    {command.disabledReason && (
                      <span className="shrink-0 text-(--color-text-muted)">
                        {command.disabledReason}
                      </span>
                    )}
                  </button>
                )
              })
            : compareResults.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickCompareTarget(item.id)}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={`flex w-full items-center px-3 py-1.5 text-left font-mono text-xs transition-colors ${
                    i === highlightedIndex
                      ? 'bg-(--color-bg-hover) text-(--color-accent)'
                      : 'text-(--color-text-secondary)'
                  }`}
                >
                  {item.label}
                </button>
              ))}

          {resultsCount === 0 && (
            <div className="px-3 py-2 font-mono text-xs text-(--color-text-muted)">
              {mode === 'root' ? 'No matching commands.' : 'No other constructs loaded.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
