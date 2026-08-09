import { useMemo } from 'react'
import type { Feature } from '../../types/models'
import { getFeaturePieces } from '../../biology/sequence'
import { FEATURE_TYPE_COLOR } from '../../data/featureColors'
import { useCrossHighlight } from '../../hooks/useCrossHighlight'

const SIZE = 420
const CENTER = SIZE / 2
const BACKBONE_RADIUS = 150
const FEATURE_RADIUS = 168
const ARC_WIDTH = 14

function polarToCartesian(radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) }
}

function describeArc(radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(radius, startAngle)
  const end = polarToCartesian(radius, endAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

interface CircularPlasmidViewProps {
  name: string
  sequenceLength: number
  features: Feature[]
}

export function CircularPlasmidView({ name, sequenceLength, features }: CircularPlasmidViewProps) {
  const { activeFeatureId, selectFeature } = useCrossHighlight()

  const angleOf = (pos: number) => (sequenceLength === 0 ? 0 : (pos / sequenceLength) * 360)

  const ticks = useMemo(() => {
    const count = 8
    return Array.from({ length: count }, (_, i) => Math.round((i / count) * sequenceLength))
  }, [sequenceLength])

  if (sequenceLength === 0) return null

  return (
    <div className="flex w-full items-center justify-center py-4">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
        <circle cx={CENTER} cy={CENTER} r={BACKBONE_RADIUS} fill="none" stroke="var(--color-border-strong)" strokeWidth={2} />

        {ticks.map((p) => {
          const angle = angleOf(p)
          const inner = polarToCartesian(BACKBONE_RADIUS - 4, angle)
          const outer = polarToCartesian(BACKBONE_RADIUS + 4, angle)
          const label = polarToCartesian(BACKBONE_RADIUS - 16, angle)
          return (
            <g key={p}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="var(--color-text-muted)" strokeWidth={1} />
              <text
                x={label.x}
                y={label.y}
                fontSize={9}
                fill="var(--color-text-muted)"
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-mono"
              >
                {(p + 1).toLocaleString()}
              </text>
            </g>
          )
        })}

        <text
          x={CENTER}
          y={CENTER - 6}
          textAnchor="middle"
          fontSize={13}
          fill="var(--color-text-primary)"
          className="font-mono font-semibold"
        >
          {name}
        </text>
        <text x={CENTER} y={CENTER + 12} textAnchor="middle" fontSize={11} fill="var(--color-text-muted)" className="font-mono">
          {sequenceLength.toLocaleString()} bp
        </text>

        {features.map((feature) => {
          const pieces = getFeaturePieces(feature, sequenceLength)
          const color = FEATURE_TYPE_COLOR[feature.type]
          const isActive = feature.id === activeFeatureId
          const midPos = (feature.start + (feature.end < feature.start ? sequenceLength : feature.end)) / 2
          const labelPos = polarToCartesian(FEATURE_RADIUS + 16, angleOf(midPos % sequenceLength))

          return (
            <g key={feature.id} onClick={() => selectFeature(feature)} className="cursor-pointer">
              {pieces.map((piece, i) => {
                const startAngle = angleOf(piece.start)
                const endAngle = angleOf(piece.end) || 360
                return (
                  <path
                    key={i}
                    d={describeArc(FEATURE_RADIUS, startAngle, endAngle)}
                    fill="none"
                    stroke={color}
                    strokeWidth={isActive ? ARC_WIDTH + 4 : ARC_WIDTH}
                    strokeOpacity={isActive ? 0.95 : 0.75}
                    strokeLinecap="butt"
                  />
                )
              })}
              <title>
                {feature.name} ({feature.type}) {feature.start + 1}-{feature.end}
              </title>
              <text
                x={labelPos.x}
                y={labelPos.y}
                fontSize={9}
                fill="var(--color-text-secondary)"
                textAnchor={labelPos.x > CENTER ? 'start' : labelPos.x < CENTER ? 'end' : 'middle'}
                dominantBaseline="middle"
                className="pointer-events-none font-mono"
              >
                {feature.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
