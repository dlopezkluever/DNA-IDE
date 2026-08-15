import { describe, it, expect } from 'vitest'
import { centroid, project, rotateX, rotateY, subtract, type Vec3 } from './geometry'

describe('rotateY', () => {
  it('is the identity at 0 radians', () => {
    const p: Vec3 = [1, 2, 3]
    expect(rotateY(p, 0)).toEqual([1, 2, 3])
  })

  it('negates x and z, keeps y, at Math.PI radians', () => {
    const p: Vec3 = [1, 2, 3]
    const [x, y, z] = rotateY(p, Math.PI)
    expect(x).toBeCloseTo(-1)
    expect(y).toBeCloseTo(2)
    expect(z).toBeCloseTo(-3)
  })
})

describe('rotateX', () => {
  it('is the identity at 0 radians', () => {
    const p: Vec3 = [1, 2, 3]
    expect(rotateX(p, 0)).toEqual([1, 2, 3])
  })

  it('negates y and z, keeps x, at Math.PI radians', () => {
    const p: Vec3 = [1, 2, 3]
    const [x, y, z] = rotateX(p, Math.PI)
    expect(x).toBeCloseTo(1)
    expect(y).toBeCloseTo(-2)
    expect(z).toBeCloseTo(-3)
  })
})

describe('centroid', () => {
  it('is the geometric center of a symmetric point set', () => {
    const points: Vec3[] = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
    ]
    expect(centroid(points)).toEqual([0, 0, 0])
  })

  it('averages an asymmetric point set correctly', () => {
    const points: Vec3[] = [
      [0, 0, 0],
      [6, 9, 12],
    ]
    expect(centroid(points)).toEqual([3, 4.5, 6])
  })
})

describe('subtract', () => {
  it('subtracts componentwise', () => {
    expect(subtract([5, 5, 5], [1, 2, 3])).toEqual([4, 3, 2])
  })
})

describe('project', () => {
  it('maps a known 3D point to a known canvas position for a known scale/center', () => {
    const result = project([1, 2, 3], 10, { x: 100, y: 100 })
    expect(result).toEqual({ x: 110, y: 80, depth: 3 })
  })

  it('flips the y axis (canvas y grows downward, world y grows upward)', () => {
    const result = project([0, 1, 0], 1, { x: 0, y: 0 })
    expect(result.y).toBe(-1)
  })

  it('leaves the origin at the canvas center when scale is applied to zero', () => {
    const result = project([0, 0, 5], 100, { x: 50, y: 50 })
    expect(result).toEqual({ x: 50, y: 50, depth: 5 })
  })
})
