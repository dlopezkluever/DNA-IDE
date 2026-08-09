import { useMemo } from 'react'
import { slidingWindowGC, calculateGC } from '../../biology/sequence'

const VIEW_WIDTH = 1000
const HEIGHT = 60
const TARGET_SAMPLES = 500

interface GCTrackProps {
  sequence: string
}

export function GCTrack({ sequence }: GCTrackProps) {
  const windowSize = Math.max(10, Math.floor(sequence.length / 50))

  const windows = useMemo(() => {
    if (sequence.length < windowSize) return []
    const step = Math.max(1, Math.floor(sequence.length / TARGET_SAMPLES))
    return slidingWindowGC(sequence, windowSize, step)
  }, [sequence, windowSize])

  const overallGC = useMemo(() => calculateGC(sequence), [sequence])

  if (sequence.length === 0) return null

  const points = windows
    .map((w, i) => {
      const x = windows.length > 1 ? (i / (windows.length - 1)) * VIEW_WIDTH : 0
      const y = HEIGHT - (Math.min(100, w.gc) / 100) * HEIGHT
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const avgY = HEIGHT - (overallGC / 100) * HEIGHT

  return (
    <div className="w-full px-3 py-2">
      <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-(--color-text-muted)">
        <span>GC content (sliding window, {windowSize} bp)</span>
        <span>avg {overallGC.toFixed(1)}%</span>
      </div>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${HEIGHT}`} className="w-full" style={{ minWidth: 600 }}>
        <line
          x1={0}
          y1={avgY}
          x2={VIEW_WIDTH}
          y2={avgY}
          stroke="var(--color-border-strong)"
          strokeDasharray="4 3"
          strokeWidth={1}
        />
        {windows.length > 1 && (
          <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} />
        )}
      </svg>
    </div>
  )
}
