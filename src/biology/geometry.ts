// Hand-rolled, orthographic, no-library 3D math for the Structure view's Cα-trace canvas
// (§3.3.1 of the protein-structure-viewer spec). Framework-free by design, same convention
// as every other src/biology module.

export type Vec3 = [number, number, number]

export function centroid(points: Vec3[]): Vec3 {
  const sum = points.reduce<Vec3>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length]
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/** Rotation around the vertical (Y) axis — mouse-drag horizontal orbit. */
export function rotateY([x, y, z]: Vec3, radians: number): Vec3 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return [x * c + z * s, y, -x * s + z * c]
}

/** Rotation around the horizontal (X) axis — mouse-drag vertical orbit. */
export function rotateX([x, y, z]: Vec3, radians: number): Vec3 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return [x, y * c - z * s, y * s + z * c]
}

export interface Projected {
  x: number
  y: number
  depth: number // post-rotation z, for painter's-algorithm sort + depth shading only
}

/** Orthographic: x/y scaled and re-centered onto the canvas; z kept only as `depth`. */
export function project(p: Vec3, scale: number, canvasCenter: { x: number; y: number }): Projected {
  return { x: canvasCenter.x + p[0] * scale, y: canvasCenter.y - p[1] * scale, depth: p[2] }
}
