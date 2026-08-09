import { nanoid } from 'nanoid'
import type { Construct, Feature, Topology } from '../types/models'

export interface AssemblyFragment {
  id: string
  label: string
  sequence: string
  /** Feature coordinates local to this fragment's own sequence (re-offset on assembly). */
  features: Feature[]
}

export interface AssembleOptions {
  circularize?: boolean
  minOverlap?: number
  maxOverlap?: number
}

export interface JunctionInfo {
  overlapLength: number
}

export interface AssembleResult {
  sequence: string
  features: Feature[]
  junctions: JunctionInfo[]
}

/** Longest suffix of `a` that exactly matches a prefix of `b`, within [minOverlap, maxOverlap] — a Gibson-style homology overlap. */
function computeJunctionOverlap(a: string, b: string, minOverlap: number, maxOverlap: number): number {
  const maxPossible = Math.min(maxOverlap, a.length, b.length)
  const upperA = a.toUpperCase()
  const upperB = b.toUpperCase()
  for (let len = maxPossible; len >= minOverlap; len--) {
    if (upperA.slice(upperA.length - len) === upperB.slice(0, len)) return len
  }
  return 0
}

function shiftFeatureFor(fragmentId: string, feature: Feature, offset: number): Feature {
  return {
    ...feature,
    id: `${fragmentId}:${feature.id}`,
    start: feature.start + offset,
    end: feature.end + offset,
    segments: feature.segments?.map((s) => ({ start: s.start + offset, end: s.end + offset })),
  }
}

export function assembleFragments(
  fragments: AssemblyFragment[],
  options: AssembleOptions = {},
): AssembleResult {
  const { circularize = false, minOverlap = 8, maxOverlap = 40 } = options
  if (fragments.length === 0) return { sequence: '', features: [], junctions: [] }

  let sequence = fragments[0].sequence
  let features = fragments[0].features.map((f) => shiftFeatureFor(fragments[0].id, f, 0))
  const junctions: JunctionInfo[] = []

  for (let i = 1; i < fragments.length; i++) {
    const frag = fragments[i]
    const overlap = computeJunctionOverlap(sequence, frag.sequence, minOverlap, maxOverlap)
    const offset = sequence.length - overlap
    sequence += frag.sequence.slice(overlap)
    features = [...features, ...frag.features.map((f) => shiftFeatureFor(frag.id, f, offset))]
    junctions.push({ overlapLength: overlap })
  }

  if (circularize) {
    const overlap = computeJunctionOverlap(sequence, fragments[0].sequence, minOverlap, maxOverlap)
    if (overlap > 0) sequence = sequence.slice(0, sequence.length - overlap)
    junctions.push({ overlapLength: overlap })
  }

  return { sequence, features, junctions }
}

export function assembleConstruct(
  name: string,
  fragments: AssemblyFragment[],
  options: AssembleOptions = {},
): Construct {
  const result = assembleFragments(fragments, options)
  const topology: Topology = options.circularize ? 'circular' : 'linear'
  return {
    id: nanoid(),
    name,
    sequence: result.sequence,
    topology,
    features: result.features,
    mutations: [],
    sourceFormat: 'manual',
  }
}
