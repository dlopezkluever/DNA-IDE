import { describe, it, expect } from 'vitest'
import { resolveFeature } from './resolve'
import type { Feature } from '../types/models'

function feature(overrides: Partial<Feature> = {}): Feature {
  return { id: 'f1', type: 'CDS', name: 'GFP', start: 10, end: 100, strand: 1, ...overrides }
}

describe('resolveFeature', () => {
  it('finds a feature matching both name and type', () => {
    const gfp = feature()
    const other = feature({ id: 'f2', type: 'promoter', name: 'GFP promoter' })
    expect(resolveFeature({ name: 'GFP', type: 'CDS' }, [other, gfp])).toBe(gfp)
  })

  it('returns null when the name matches but the type does not', () => {
    const promoter = feature({ id: 'f2', type: 'promoter', name: 'GFP' })
    expect(resolveFeature({ name: 'GFP', type: 'CDS' }, [promoter])).toBeNull()
  })

  it('returns null when the type matches but the name does not', () => {
    const other = feature({ id: 'f2', name: 'markerR' })
    expect(resolveFeature({ name: 'GFP', type: 'CDS' }, [other])).toBeNull()
  })

  it('returns null against an empty feature list', () => {
    expect(resolveFeature({ name: 'GFP', type: 'CDS' }, [])).toBeNull()
  })

  it('is agnostic to feature id — matches by name+type even across different nanoid ids', () => {
    const parseOne = feature({ id: 'nanoid-abc' })
    const parseTwo = feature({ id: 'nanoid-xyz' })
    expect(resolveFeature({ name: 'GFP', type: 'CDS' }, [parseOne])?.id).toBe('nanoid-abc')
    expect(resolveFeature({ name: 'GFP', type: 'CDS' }, [parseTwo])?.id).toBe('nanoid-xyz')
  })
})
