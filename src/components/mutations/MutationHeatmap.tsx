import { useMemo, useState } from 'react'
import { useConstructStore } from '../../store/constructStore'
import { useUIStore } from '../../store/uiStore'
import { useCrossHighlight } from '../../hooks/useCrossHighlight'
import {
  computeMutationHeatmap,
  type HeatmapBase,
  type MutationHeatmapCell,
} from '../../biology/mutations'
import { toDisplayPosition } from '../../biology/sequence'
import { AMINO_ACID_INFO } from '../../biology/translation'
import { consequenceLabel } from '../../utils/format'
import { CONSEQUENCE_FILL } from '../../utils/consequenceColors'
import type { Consequence } from '../../types/models'

const CELL_W = 6
const CELL_H = 16
const LABEL_W = 12
const RULER_H = 14
const ROWS: HeatmapBase[] = ['A', 'T', 'G', 'C']
const ROW_LABEL_COLOR: Record<HeatmapBase, string> = {
  A: 'var(--color-base-a)',
  T: 'var(--color-base-t)',
  G: 'var(--color-base-g)',
  C: 'var(--color-base-c)',
}

const TICK_STEPS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

function pickTickStep(length: number, targetTicks = 25): number {
  for (const step of TICK_STEPS) {
    if (length / step <= targetTicks) return step
  }
  return TICK_STEPS[TICK_STEPS.length - 1]
}

/** e.g. "pos 48, C→T — GAC→GAT (Asp47Asp, Synonymous)" — the PRD §14 fact set, one line. */
function describeCell(cell: MutationHeatmapCell): string {
  const { aminoAcidBefore, aminoAcidAfter, aminoAcidPosition, codonBefore, codonAfter } =
    cell.effect
  const proteinChange =
    aminoAcidBefore && aminoAcidAfter && aminoAcidPosition
      ? `${AMINO_ACID_INFO[aminoAcidBefore]?.abbr ?? aminoAcidBefore}${aminoAcidPosition}${
          AMINO_ACID_INFO[aminoAcidAfter]?.abbr ?? aminoAcidAfter
        }`
      : null

  let text = `pos ${toDisplayPosition(cell.genomicPosition)}, ${cell.referenceBase}→${cell.alternateBase}`
  if (codonBefore && codonAfter) text += ` — ${codonBefore}→${codonAfter}`
  const tail = [proteinChange, consequenceLabel(cell.effect.consequence)].filter(Boolean)
  if (tail.length > 0) text += ` (${tail.join(', ')})`
  return text
}

const LEGEND: { label: string; consequence: Consequence }[] = [
  { label: 'synonymous', consequence: 'synonymous' },
  { label: 'missense', consequence: 'missense' },
  { label: 'nonsense', consequence: 'nonsense' },
  { label: 'start/stop-loss', consequence: 'start-loss' },
]

export function MutationHeatmap() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const { selectRange } = useCrossHighlight()

  const open = useUIStore((s) => s.mutationHeatmapOpen)
  const setOpen = useUIStore((s) => s.setMutationHeatmapOpen)
  const [selectedCdsId, setSelectedCdsId] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<MutationHeatmapCell | null>(null)

  const construct = activeConstructId ? constructs[activeConstructId] : null
  const cdsFeatures = useMemo(
    () => construct?.features.filter((f) => f.type === 'CDS') ?? [],
    [construct],
  )
  const activeCdsId =
    selectedCdsId && cdsFeatures.some((f) => f.id === selectedCdsId)
      ? selectedCdsId
      : (cdsFeatures[0]?.id ?? null)
  const cdsFeature = cdsFeatures.find((f) => f.id === activeCdsId) ?? null

  // Gated behind `open`, same pattern as ORFList gating findORFs — computing/rendering
  // thousands of cells for a CDS the user never inspects would be wasted work.
  const heatmap = useMemo(
    () =>
      open && cdsFeature && construct
        ? computeMutationHeatmap(cdsFeature, construct.sequence)
        : null,
    [open, cdsFeature, construct],
  )

  const columns = useMemo(() => {
    if (!heatmap) return []
    const byColumn = new Map<number, MutationHeatmapCell[]>()
    for (const cell of heatmap.cells) {
      const col = cell.codonIndex * 3 + cell.positionInCodon
      const existing = byColumn.get(col)
      if (existing) existing.push(cell)
      else byColumn.set(col, [cell])
    }
    return Array.from({ length: heatmap.cdsLength }, (_, col) => byColumn.get(col) ?? [])
  }, [heatmap])

  const stats = useMemo(() => {
    if (!heatmap || heatmap.cells.length === 0) return null
    const counts: Partial<Record<Consequence, number>> = {}
    for (const cell of heatmap.cells) {
      counts[cell.effect.consequence] = (counts[cell.effect.consequence] ?? 0) + 1
    }
    const total = heatmap.cells.length
    const pct = (c: Consequence) => ((counts[c] ?? 0) / total) * 100
    return { synonymous: pct('synonymous'), missense: pct('missense'), nonsense: pct('nonsense') }
  }, [heatmap])

  const ticks = useMemo(() => {
    if (!heatmap || heatmap.cdsLength === 0) return []
    const step = pickTickStep(heatmap.cdsLength)
    const result: number[] = []
    for (let col = 0; col < heatmap.cdsLength; col += step) result.push(col)
    return result
  }, [heatmap])

  if (!construct) return null

  return (
    <div className="shrink-0 space-y-2 border-b border-(--color-border) px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 font-mono text-sm text-(--color-accent) hover:underline"
      >
        {open ? '▾' : '▸'} Mutation Heatmap
      </button>

      {open &&
        (cdsFeatures.length === 0 ? (
          <p className="text-xs text-(--color-text-muted)">
            No CDS features to explore mutations for.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              {cdsFeatures.length > 1 ? (
                <label className="flex items-center gap-1.5 text-(--color-text-muted)">
                  CDS
                  <select
                    value={activeCdsId ?? ''}
                    onChange={(e) => {
                      setSelectedCdsId(e.target.value)
                      setSelectedCell(null)
                    }}
                    className="rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-2 py-1 text-(--color-text-primary) focus:border-(--color-accent) focus:outline-none"
                  >
                    {cdsFeatures.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="text-(--color-text-muted)">
                  CDS <span className="text-(--color-text-primary)">{cdsFeatures[0].name}</span>
                </span>
              )}
              {stats && (
                <span className="text-(--color-text-muted)">
                  {stats.synonymous.toFixed(0)}% synonymous · {stats.missense.toFixed(0)}%
                  missense · {stats.nonsense.toFixed(0)}% nonsense
                </span>
              )}
            </div>

            {heatmap && heatmap.cdsLength > 0 && (
              <>
                <div className="overflow-x-auto rounded border border-(--color-border) bg-(--color-bg-canvas) py-1">
                  <svg
                    viewBox={`0 0 ${LABEL_W + heatmap.cdsLength * CELL_W} ${4 * CELL_H + RULER_H}`}
                    width={LABEL_W + heatmap.cdsLength * CELL_W}
                    height={4 * CELL_H + RULER_H}
                    className="block"
                  >
                    {ROWS.map((row, rowIndex) => (
                      <text
                        key={row}
                        x={2}
                        y={rowIndex * CELL_H + CELL_H / 2 + 3}
                        fontSize={9}
                        fill={ROW_LABEL_COLOR[row]}
                        className="font-mono"
                      >
                        {row}
                      </text>
                    ))}

                    {columns.map((cellsForColumn, col) => {
                      const referenceBase = cellsForColumn[0]?.referenceBase
                      const x = LABEL_W + col * CELL_W
                      return (
                        <g key={col}>
                          {ROWS.map((row, rowIndex) => {
                            const y = rowIndex * CELL_H
                            if (row === referenceBase) {
                              return (
                                <rect
                                  key={row}
                                  x={x}
                                  y={y}
                                  width={CELL_W}
                                  height={CELL_H}
                                  fill="var(--color-bg-hover)"
                                />
                              )
                            }
                            const cell = cellsForColumn.find((c) => c.alternateBase === row)
                            if (!cell) return null
                            const isSelected = selectedCell === cell
                            return (
                              <rect
                                key={row}
                                x={x}
                                y={y}
                                width={CELL_W}
                                height={CELL_H}
                                fill={CONSEQUENCE_FILL[cell.effect.consequence]}
                                opacity={isSelected ? 1 : 0.85}
                                stroke={isSelected ? 'var(--color-text-primary)' : 'none'}
                                strokeWidth={isSelected ? 1 : 0}
                                className="cursor-pointer"
                                onClick={() => {
                                  setSelectedCell(cell)
                                  selectRange(cell.genomicPosition, cell.genomicPosition + 1)
                                }}
                              >
                                <title>{describeCell(cell)}</title>
                              </rect>
                            )
                          })}
                        </g>
                      )
                    })}

                    {ticks.map((col) => (
                      <text
                        key={col}
                        x={LABEL_W + col * CELL_W}
                        y={4 * CELL_H + RULER_H - 3}
                        fontSize={9}
                        fill="var(--color-text-muted)"
                        className="font-mono"
                      >
                        {toDisplayPosition(col)}
                      </text>
                    ))}
                  </svg>
                </div>

                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-(--color-text-secondary)">
                  {LEGEND.map((item) => (
                    <span key={item.label} className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: CONSEQUENCE_FILL[item.consequence] }}
                      />
                      {item.label}
                    </span>
                  ))}
                </div>

                <div className="font-mono text-[11px] text-(--color-text-muted)">
                  {selectedCell ? (
                    <>
                      Selected:{' '}
                      <span className="text-(--color-text-primary)">
                        {describeCell(selectedCell)}
                      </span>
                    </>
                  ) : (
                    'Click a cell to see its detail.'
                  )}
                </div>
              </>
            )}
          </div>
        ))}
    </div>
  )
}
