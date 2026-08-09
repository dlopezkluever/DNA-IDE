import { useMemo } from 'react'
import type { Feature, FeatureType } from '../../types/models'
import { toDisplayPosition } from '../../biology/sequence'
import { useUIStore } from '../../store/uiStore'

const VIEW_WIDTH = 1000
const RULER_HEIGHT = 24
const LANE_HEIGHT = 22
const LANE_GAP = 4
const FEATURE_BAR_HEIGHT = 14

const TYPE_COLOR: Record<FeatureType, string> = {
  gene: 'var(--color-info)',
  CDS: 'var(--color-accent)',
  promoter: 'var(--color-warn)',
  terminator: 'var(--color-danger)',
  origin: 'var(--color-text-secondary)',
  regulatory: 'var(--color-base-g)',
  misc: 'var(--color-text-muted)',
}

interface Piece {
  start: number
  end: number
}

function featurePieces(feature: Feature, seqLen: number): Piece[] {
  const raw = feature.segments && feature.segments.length > 0 ? feature.segments : [{ start: feature.start, end: feature.end }]
  const pieces: Piece[] = []
  for (const r of raw) {
    if (r.end < r.start) {
      pieces.push({ start: r.start, end: seqLen })
      pieces.push({ start: 0, end: r.end })
    } else {
      pieces.push(r)
    }
  }
  return pieces
}

function assignLanes(features: Feature[], seqLen: number): Map<string, number> {
  const sorted = [...features].sort((a, b) => a.start - b.start)
  const laneEnds: number[] = []
  const laneOf = new Map<string, number>()
  for (const f of sorted) {
    const effectiveEnd = f.end < f.start ? seqLen : f.end
    let lane = laneEnds.findIndex((end) => end <= f.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(effectiveEnd)
    } else {
      laneEnds[lane] = effectiveEnd
    }
    laneOf.set(f.id, lane)
  }
  return laneOf
}

function niceStep(range: number, targetTicks = 10): number {
  if (range <= 0) return 1
  const raw = range / targetTicks
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const residual = raw / magnitude
  let step: number
  if (residual > 5) step = 10 * magnitude
  else if (residual > 2) step = 5 * magnitude
  else if (residual > 1) step = 2 * magnitude
  else step = magnitude
  return Math.max(1, Math.round(step))
}

interface LinearFeatureMapProps {
  sequenceLength: number
  features: Feature[]
}

export function LinearFeatureMap({ sequenceLength, features }: LinearFeatureMapProps) {
  const activeFeatureId = useUIStore((s) => s.activeFeatureId)
  const setActiveFeatureId = useUIStore((s) => s.setActiveFeatureId)
  const setSelection = useUIStore((s) => s.setSelection)

  const laneOf = useMemo(() => assignLanes(features, sequenceLength), [features, sequenceLength])
  const laneCount = Math.max(1, new Set(laneOf.values()).size)
  const height = RULER_HEIGHT + laneCount * (LANE_HEIGHT + LANE_GAP)

  const ticks = useMemo(() => {
    const step = niceStep(sequenceLength)
    const result: number[] = []
    for (let p = 0; p <= sequenceLength; p += step) result.push(p)
    return result
  }, [sequenceLength])

  const xOf = (pos: number) => (sequenceLength === 0 ? 0 : (pos / sequenceLength) * VIEW_WIDTH)

  if (sequenceLength === 0) return null

  return (
    <div className="w-full overflow-x-auto bg-(--color-bg-canvas) px-3 py-2">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${height}`} className="w-full" style={{ minWidth: 600 }}>
        {/* ruler */}
        <line
          x1={0}
          y1={RULER_HEIGHT - 6}
          x2={VIEW_WIDTH}
          y2={RULER_HEIGHT - 6}
          stroke="var(--color-border-strong)"
          strokeWidth={1}
        />
        {ticks.map((p) => (
          <g key={p}>
            <line
              x1={xOf(p)}
              y1={RULER_HEIGHT - 10}
              x2={xOf(p)}
              y2={RULER_HEIGHT - 6}
              stroke="var(--color-text-muted)"
              strokeWidth={1}
            />
            <text
              x={xOf(p)}
              y={RULER_HEIGHT - 12}
              fontSize={9}
              fill="var(--color-text-muted)"
              textAnchor={p === 0 ? 'start' : 'middle'}
              className="font-mono"
            >
              {toDisplayPosition(p).toLocaleString()}
            </text>
          </g>
        ))}

        {/* features */}
        {features.map((feature) => {
          const lane = laneOf.get(feature.id) ?? 0
          const y = RULER_HEIGHT + lane * (LANE_HEIGHT + LANE_GAP)
          const color = TYPE_COLOR[feature.type]
          const pieces = featurePieces(feature, sequenceLength)
          const isActive = feature.id === activeFeatureId

          return (
            <g
              key={feature.id}
              onClick={() => {
                setActiveFeatureId(feature.id)
                setSelection({ start: feature.start, end: feature.end, strand: feature.strand })
              }}
              className="cursor-pointer"
            >
              {pieces.map((piece, i) => {
                const x = xOf(piece.start)
                const w = Math.max(1, xOf(piece.end) - xOf(piece.start))
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={w}
                    height={FEATURE_BAR_HEIGHT}
                    fill={color}
                    fillOpacity={isActive ? 0.95 : 0.65}
                    stroke={isActive ? 'var(--color-text-primary)' : 'none'}
                    strokeWidth={isActive ? 1 : 0}
                    rx={2}
                  />
                )
              })}
              <text
                x={xOf(pieces[0].start) + 3}
                y={y + FEATURE_BAR_HEIGHT - 3}
                fontSize={9}
                fill="var(--color-bg-canvas)"
                className="pointer-events-none font-mono font-medium"
              >
                {feature.strand === 1 ? '▶ ' : '◀ '}
                {feature.name}
              </text>
              <title>
                {feature.name} ({feature.type}) {toDisplayPosition(feature.start)}-{feature.end}{' '}
                {feature.strand === 1 ? '+' : '-'}
              </title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
