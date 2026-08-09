import { nanoid } from 'nanoid'
import type { Construct, Feature, FeatureSegment, Mutation, MutationType, ProteinEffect } from '../types/models'
import { getFeaturePieces, reverseComplement } from './sequence'
import { isStartCodon, translateCodon, translateDNA } from './translation'

export interface MutationInput {
  type: MutationType
  /** 0-based position where `reference` begins (or where `alternate` is inserted, for a pure insertion). */
  position: number
  reference: string
  alternate: string
}

export interface MutationEdit {
  position: number
  reference: string
  alternate: string
}

export interface ApplyMutationResult {
  construct: Construct
  mutation: Mutation
}

function shiftRange(range: { start: number; end: number }, position: number, deltaLength: number) {
  if (range.end <= position) return range
  if (range.start >= position) return { start: range.start + deltaLength, end: range.end + deltaLength }
  return { start: range.start, end: range.end + deltaLength }
}

/** Features entirely before `position` are untouched; features starting at/after it shift by deltaLength;
 * a feature containing `position` keeps its start and shifts only its end. */
function shiftFeature(feature: Feature, position: number, deltaLength: number): Feature {
  if (deltaLength === 0) return feature
  if (feature.segments && feature.segments.length > 0) {
    const segments = feature.segments.map((s) => shiftRange(s, position, deltaLength))
    return {
      ...feature,
      start: Math.min(...segments.map((s) => s.start)),
      end: Math.max(...segments.map((s) => s.end)),
      segments,
    }
  }
  const { start, end } = shiftRange(feature, position, deltaLength)
  return { ...feature, start, end }
}

export function shiftFeatureCoordinates(features: Feature[], position: number, deltaLength: number): Feature[] {
  return features.map((f) => shiftFeature(f, position, deltaLength))
}

function featureOverlapsEdit(feature: Feature, editStart: number, editEnd: number, seqLen: number): boolean {
  return getFeaturePieces(feature, seqLen).some((p) => editStart < p.end && p.start < editEnd)
}

/** Reading-direction (5'->3') nucleotide sequence for a feature, honoring strand and multi-segment splicing. */
function extractReadingSequence(feature: Feature, seq: string): string {
  const pieces = getFeaturePieces(feature, seq.length)
  const plusStrandParts = pieces.map((p) => seq.slice(p.start, p.end))
  return feature.strand === 1 ? plusStrandParts.join('') : plusStrandParts.map(reverseComplement).reverse().join('')
}

/**
 * 0-based offset of `position` within the feature's reading-direction sequence
 * (as produced by extractReadingSequence), or null if position falls outside the feature.
 */
function readingRelativePosition(feature: Feature, position: number, seqLen: number): number | null {
  const pieces = getFeaturePieces(feature, seqLen)
  if (feature.strand === 1) {
    let offset = 0
    for (const p of pieces) {
      if (position >= p.start && position < p.end) return offset + (position - p.start)
      offset += p.end - p.start
    }
    return null
  }
  // Minus strand: pieces are read in reverse order, and within each piece in decreasing coordinate.
  let offset = 0
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i]
    if (position >= p.start && position < p.end) return offset + (p.end - 1 - position)
    offset += p.end - p.start
  }
  return null
}

export function classifyMutation(
  cdsFeature: Feature,
  seqBefore: string,
  seqAfter: string,
  edit: MutationEdit,
): ProteinEffect {
  const deltaLength = edit.alternate.length - edit.reference.length

  if (deltaLength % 3 !== 0) {
    return { consequence: 'frameshift' }
  }

  const cdsBefore = extractReadingSequence(cdsFeature, seqBefore)
  const shiftedFeature = deltaLength === 0 ? cdsFeature : shiftFeature(cdsFeature, edit.position, deltaLength)
  const cdsAfter = extractReadingSequence(shiftedFeature, seqAfter)

  if (deltaLength !== 0) {
    const startBefore = cdsBefore.slice(0, 3)
    const startAfter = cdsAfter.slice(0, 3)
    if (isStartCodon(startBefore) && !isStartCodon(startAfter)) {
      return {
        consequence: 'start-loss',
        codonBefore: startBefore,
        codonAfter: startAfter,
        aminoAcidPosition: 1,
      }
    }
    if (!translateDNA(cdsAfter, { toStop: true }).endsWith('*')) {
      return { consequence: 'stop-loss' }
    }
    return { consequence: 'in-frame-indel' }
  }

  const relPos = readingRelativePosition(cdsFeature, edit.position, seqBefore.length)
  if (relPos === null) return { consequence: 'noncoding' }

  const codonIndex = Math.floor(relPos / 3)
  const codonStart = codonIndex * 3
  const codonBefore = cdsBefore.slice(codonStart, codonStart + 3)
  const codonAfter = cdsAfter.slice(codonStart, codonStart + 3)
  if (codonBefore.length < 3 || codonAfter.length < 3) return { consequence: 'noncoding' }

  const aminoAcidBefore = translateCodon(codonBefore)
  const aminoAcidAfter = translateCodon(codonAfter)
  const aminoAcidPosition = codonIndex + 1
  const base = { codonBefore, codonAfter, aminoAcidBefore, aminoAcidAfter, aminoAcidPosition }

  if (codonIndex === 0 && isStartCodon(codonBefore) && !isStartCodon(codonAfter)) {
    return { ...base, consequence: 'start-loss' }
  }
  if (aminoAcidBefore === '*' && aminoAcidAfter !== '*') {
    return { ...base, consequence: 'stop-loss' }
  }
  if (aminoAcidBefore !== '*' && aminoAcidAfter === '*') {
    return { ...base, consequence: 'nonsense' }
  }
  if (aminoAcidBefore === aminoAcidAfter) {
    return { ...base, consequence: 'synonymous' }
  }
  return { ...base, consequence: 'missense' }
}

export function applyMutation(construct: Construct, input: MutationInput): ApplyMutationResult {
  const { type, position, reference, alternate } = input
  const seqBefore = construct.sequence

  const actualRef = seqBefore.slice(position, position + reference.length)
  if (reference.length > 0 && actualRef.toUpperCase() !== reference.toUpperCase()) {
    throw new Error(
      `Reference mismatch at position ${position}: expected "${reference}", found "${actualRef}"`,
    )
  }

  const seqAfter = seqBefore.slice(0, position) + alternate + seqBefore.slice(position + reference.length)
  const deltaLength = alternate.length - reference.length
  const editEnd = position + reference.length

  const affectedFeatures = construct.features.filter((f) =>
    featureOverlapsEdit(f, position, editEnd, seqBefore.length),
  )
  const shiftedFeatures = shiftFeatureCoordinates(construct.features, position, deltaLength)

  const edit: MutationEdit = { position, reference, alternate }
  const affectedCDS = affectedFeatures.filter((f) => f.type === 'CDS')
  const proteinEffect: ProteinEffect =
    affectedCDS.length > 0
      ? classifyMutation(affectedCDS[0], seqBefore, seqAfter, edit)
      : { consequence: 'noncoding' }

  const mutation: Mutation = {
    id: nanoid(),
    type,
    position,
    reference,
    alternate,
    affectedFeatureIds: affectedFeatures.map((f) => f.id),
    proteinEffect,
    createdAt: Date.now(),
  }

  const newConstruct: Construct = {
    ...construct,
    sequence: seqAfter,
    features: shiftedFeatures,
    mutations: [...construct.mutations, mutation],
  }

  return { construct: newConstruct, mutation }
}

export type { FeatureSegment }
