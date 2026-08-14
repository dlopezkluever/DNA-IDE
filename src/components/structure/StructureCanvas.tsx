import { useEffect, useMemo, useRef, useState } from 'react'
import type { StructureResidue } from '../../data/structures'
import type { BurialScore } from '../../biology/structureMapping'
import { centroid, project, rotateX, rotateY, subtract, type Vec3 } from '../../biology/geometry'
import { SS_COLOR, BURIAL_COLOR } from '../../data/structureColors'

export type StructureColorMode = 'secondary-structure' | 'burial'

interface StructureCanvasProps {
  residues: StructureResidue[]
  colorMode: StructureColorMode
  burialByResSeq: Map<number, BurialScore>
  /** The structure resSeq to draw an accent-green highlight ring around, if any. */
  highlightedResSeq: number | null
  onSelectResidue: (resSeq: number) => void
}

const MIN_SCALE = 2
const MAX_SCALE = 40
const DEFAULT_SCALE = 10
const DRAG_THRESHOLD_PX = 4 // pointerdown->pointerup movement below this counts as a click, not a drag
const HIT_RADIUS_PX = 6
const POINT_RADIUS = 3.5

interface ProjectedResidue {
  resSeq: number
  residue: StructureResidue
  x: number
  y: number
  depth: number
}

const VAR_PATTERN = /^var\((--[\w-]+)\)$/

/**
 * Canvas 2D's `fillStyle`/`strokeStyle` cannot resolve `var(--token)` CSS custom properties —
 * unlike CSS/SVG elsewhere in the app, an unresolved canvas color silently falls back to
 * opaque black rather than erroring, which would make every colored point on this canvas
 * black. Every other visualization in this app is SVG (browser-resolved natively); this is
 * the first raw-canvas one, so this resolution step is new but necessary.
 */
function resolveCSSColor(value: string): string {
  const match = value.match(VAR_PATTERN)
  if (!match) return value
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || '#888'
}

export function StructureCanvas({
  residues,
  colorMode,
  burialByResSeq,
  highlightedResSeq,
  onSelectResidue,
}: StructureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [rotation, setRotation] = useState({ x: -0.3, y: 0.5 })
  const [scale, setScale] = useState(DEFAULT_SCALE)

  const dragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startRotation: { x: number; y: number }
    maxMove: number
  } | null>(null)
  const projectedRef = useRef<ProjectedResidue[]>([])

  const structureCentroid = useMemo<Vec3>(() => centroid(residues.map((r) => r.ca)), [residues])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setContainerSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Static until the user interacts (no continuous animation loop, per DESIGN.md §7) — redraws
  // only when rotation/zoom/highlight/colorMode/size actually change.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = containerSize
    if (width === 0 || height === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const center = { x: width / 2, y: height / 2 }

    // Resolved once per draw (a handful of lookups), not per point.
    const resolvedSS = { helix: resolveCSSColor(SS_COLOR.helix), sheet: resolveCSSColor(SS_COLOR.sheet), coil: resolveCSSColor(SS_COLOR.coil) }
    const resolvedBurial = {
      buried: resolveCSSColor(BURIAL_COLOR.buried),
      intermediate: resolveCSSColor(BURIAL_COLOR.intermediate),
      exposed: resolveCSSColor(BURIAL_COLOR.exposed),
    }
    const resolvedAccent = resolveCSSColor('var(--color-accent)')

    const projected: ProjectedResidue[] = residues.map((r) => {
      const centered = subtract(r.ca, structureCentroid)
      const rotated = rotateX(rotateY(centered, rotation.y), rotation.x)
      const p = project(rotated, scale, center)
      return { resSeq: r.resSeq, residue: r, x: p.x, y: p.y, depth: p.depth }
    })
    projectedRef.current = projected

    let minDepth = Infinity
    let maxDepth = -Infinity
    for (const p of projected) {
      if (p.depth < minDepth) minDepth = p.depth
      if (p.depth > maxDepth) maxDepth = p.depth
    }
    const depthRange = maxDepth - minDepth || 1
    const depthT = (depth: number) => (depth - minDepth) / depthRange // 0 (back) .. 1 (front)

    // Backbone trace, drawn in resSeq/array order (not depth order) so the line follows the chain.
    ctx.strokeStyle = 'rgba(154, 164, 184, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    projected.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()

    // Painter's algorithm: back-to-front so nearer residues draw over farther ones.
    const sorted = [...projected].sort((a, b) => a.depth - b.depth)
    for (const p of sorted) {
      const t = depthT(p.depth)
      const radius = POINT_RADIUS * (0.7 + 0.3 * t)
      const opacity = 0.65 + 0.35 * t

      const color =
        colorMode === 'secondary-structure'
          ? resolvedSS[p.residue.ss]
          : resolvedBurial[burialByResSeq.get(p.resSeq)?.category ?? 'exposed']

      ctx.globalAlpha = opacity
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      if (p.resSeq === highlightedResSeq) {
        ctx.strokeStyle = resolvedAccent
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }, [residues, structureCentroid, rotation, scale, colorMode, burialByResSeq, highlightedResSeq, containerSize])

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRotation: rotation,
      maxMove: 0,
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startClientX
    const dy = e.clientY - drag.startClientY
    drag.maxMove = Math.max(drag.maxMove, Math.hypot(dx, dy))
    setRotation({
      x: drag.startRotation.x + dy * 0.01,
      y: drag.startRotation.y + dx * 0.01,
    })
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.pointerId !== e.pointerId) return

    if (drag.maxMove < DRAG_THRESHOLD_PX) {
      const rect = e.currentTarget.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      let nearest: ProjectedResidue | null = null
      let nearestDist = Infinity
      for (const p of projectedRef.current) {
        const d = Math.hypot(p.x - px, p.y - py)
        if (d < nearestDist) {
          nearestDist = d
          nearest = p
        }
      }
      if (nearest && nearestDist <= HIT_RADIUS_PX) {
        onSelectResidue(nearest.resSeq)
      }
    }
  }

  // React attaches `onWheel` as a passive DOM listener, so `preventDefault()` there is a no-op
  // (and logs a console warning) — it would zoom the structure *and* scroll the page underneath
  // it. A native listener with `{ passive: false }` is required to actually suppress page scroll.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (e.deltaY < 0 ? 1.1 : 0.9))))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  )
}
