import { nanoid } from 'nanoid'
import type { Construct, Feature, FeatureSegment, FeatureType, Strand, Topology } from '../types/models'

export interface GenBankRecord {
  name: string
  description: string
  sequence: string
  topology: Topology
  features: Feature[]
  /** Per-feature issues (malformed/unsupported location grammar) — the file still parses. */
  warnings: string[]
}

export interface ParseGenBankResult {
  records: GenBankRecord[]
  fileError: string | null
}

// ---------------------------------------------------------------------------
// LOCUS line
// ---------------------------------------------------------------------------

function parseLocusLine(line: string): { name: string; topology: Topology } {
  const tokens = line.trim().split(/\s+/)
  const name = tokens[1] ?? 'unnamed'
  const topology: Topology = tokens.some((t) => /^circular$/i.test(t)) ? 'circular' : 'linear'
  return { name, topology }
}

// ---------------------------------------------------------------------------
// FEATURES section
// ---------------------------------------------------------------------------

interface RawFeature {
  key: string
  location: string
  qualifiers: { key: string; value: string | true }[]
}

function stripQuotes(s: string): string {
  const t = s.trim()
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1)
  return t
}

function countQuotes(s: string): number {
  return (s.match(/"/g) ?? []).length
}

function parseFeaturesSection(
  lines: string[],
  startIndex: number,
): { rawFeatures: RawFeature[]; nextIndex: number } {
  const rawFeatures: RawFeature[] = []
  let current: RawFeature | null = null
  let pendingQualifier: { key: string; valueParts: string[] } | null = null

  const flushQualifier = () => {
    if (pendingQualifier && current) {
      current.qualifiers.push({
        key: pendingQualifier.key,
        value: stripQuotes(pendingQualifier.valueParts.join(' ')),
      })
    }
    pendingQualifier = null
  }

  let i = startIndex
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (/^\S/.test(line)) break // column-0 line: a new top-level keyword (ORIGIN, //, next LOCUS)
    if (line.trim() === '') continue

    const indentLen = /^(\s*)/.exec(line)![1].length
    const featureMatch = indentLen <= 10 ? /^\s{1,10}(\S+)\s+(\S.*)$/.exec(line) : null

    if (featureMatch) {
      flushQualifier()
      current = { key: featureMatch[1], location: featureMatch[2].trim(), qualifiers: [] }
      rawFeatures.push(current)
      continue
    }

    const trimmed = line.trim()

    if (trimmed.startsWith('/')) {
      flushQualifier()
      const eq = trimmed.indexOf('=')
      if (eq === -1) {
        current?.qualifiers.push({ key: trimmed.slice(1), value: true })
        continue
      }
      const key = trimmed.slice(1, eq)
      const rawValue = trimmed.slice(eq + 1)
      if (rawValue.startsWith('"') && countQuotes(rawValue) % 2 === 1) {
        pendingQualifier = { key, valueParts: [rawValue] }
      } else {
        current?.qualifiers.push({ key, value: stripQuotes(rawValue) })
      }
      continue
    }

    if (pendingQualifier) {
      pendingQualifier.valueParts.push(trimmed)
      const joined = pendingQualifier.valueParts.join(' ')
      if (countQuotes(joined) % 2 === 0) {
        current?.qualifiers.push({ key: pendingQualifier.key, value: stripQuotes(joined) })
        pendingQualifier = null
      }
      continue
    }

    // otherwise: a wrapped continuation of the current feature's location string
    if (current) current.location += trimmed
  }

  flushQualifier()
  return { rawFeatures, nextIndex: i }
}

// ---------------------------------------------------------------------------
// Location grammar: 123..456 | 123 | 123^124 | <123 / >456 | complement(...) | join(...)
// ---------------------------------------------------------------------------

interface ParsedLocation {
  strand: Strand
  segments: FeatureSegment[]
  partial: { start?: boolean; end?: boolean }
}

type LocationResult = { ok: true; value: ParsedLocation } | { ok: false; reason: string }

function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of str) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

function parseSimpleRange(str: string): ParsedLocation | null {
  const m = /^(<)?(\d+)(?:(\.\.|\^)(>)?(\d+))?$/.exec(str)
  if (!m) return null
  const [, ltMark, num1Str, sep, gtMark, num2Str] = m
  const num1 = parseInt(num1Str, 10)
  const partial: { start?: boolean; end?: boolean } = {}
  if (ltMark) partial.start = true
  if (gtMark) partial.end = true

  if (!sep) {
    return { strand: 1, segments: [{ start: num1 - 1, end: num1 }], partial }
  }
  if (sep === '^') {
    return { strand: 1, segments: [{ start: num1, end: num1 }], partial }
  }
  const num2 = parseInt(num2Str, 10)
  return { strand: 1, segments: [{ start: num1 - 1, end: num2 }], partial }
}

function parseExpr(str: string): ParsedLocation | null {
  if (str.startsWith('complement(') && str.endsWith(')')) {
    const inner = parseExpr(str.slice('complement('.length, -1))
    if (!inner) return null
    return { strand: inner.strand === 1 ? -1 : 1, segments: inner.segments, partial: inner.partial }
  }

  if (str.startsWith('join(') && str.endsWith(')')) {
    const parts = splitTopLevelCommas(str.slice('join('.length, -1))
    if (parts.length === 0) return null
    const segments: FeatureSegment[] = []
    const partial: { start?: boolean; end?: boolean } = {}
    for (let idx = 0; idx < parts.length; idx++) {
      const parsedPart = parseExpr(parts[idx])
      if (!parsedPart || parsedPart.strand !== 1) return null
      segments.push(...parsedPart.segments)
      if (idx === 0 && parsedPart.partial.start) partial.start = true
      if (idx === parts.length - 1 && parsedPart.partial.end) partial.end = true
    }
    return { strand: 1, segments, partial }
  }

  return parseSimpleRange(str)
}

function parseLocationString(rawInput: string): LocationResult {
  const s = rawInput.replace(/\s+/g, '')
  if (s.length === 0) return { ok: false, reason: 'empty location' }
  if (s.includes(':')) return { ok: false, reason: 'cross-record references are not supported' }
  if (/^order\(/.test(s)) return { ok: false, reason: 'order() is not supported' }
  if (/^one-of\(/.test(s)) return { ok: false, reason: 'one-of() is not supported' }
  if (s.includes('gap(')) return { ok: false, reason: 'gap() is not supported' }

  const parsed = parseExpr(s)
  if (!parsed) return { ok: false, reason: `could not parse location grammar "${rawInput}"` }
  return { ok: true, value: parsed }
}

// ---------------------------------------------------------------------------
// ORIGIN section
// ---------------------------------------------------------------------------

function parseOriginSection(lines: string[], startIndex: number): { chars: string[]; nextIndex: number } {
  const chars: string[] = []
  let i = startIndex
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (/^\/\/\s*$/.test(line)) break
    if (/^LOCUS\s/.test(line)) break
    const withoutLineNumber = line.replace(/^\s*\d+\s*/, '')
    for (const ch of withoutLineNumber) {
      if (/[A-Za-z]/.test(ch)) chars.push(ch.toUpperCase())
    }
  }
  return { chars, nextIndex: i }
}

// ---------------------------------------------------------------------------
// Feature assembly
// ---------------------------------------------------------------------------

const GENBANK_TYPE_MAP: Record<string, FeatureType> = {
  gene: 'gene',
  CDS: 'CDS',
  promoter: 'promoter',
  terminator: 'terminator',
  rep_origin: 'origin',
  oriT: 'origin',
  regulatory: 'regulatory',
  RBS: 'regulatory',
  protein_bind: 'regulatory',
  primer_bind: 'regulatory',
  polyA_signal: 'regulatory',
  enhancer: 'regulatory',
  CAAT_signal: 'regulatory',
  TATA_signal: 'regulatory',
}

function mapFeatureType(genbankKey: string): FeatureType {
  return GENBANK_TYPE_MAP[genbankKey] ?? 'misc'
}

function groupQualifiers(
  raw: { key: string; value: string | true }[],
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const { key, value } of raw) {
    const v = value === true ? '' : value
    const existing = result[key]
    if (existing === undefined) {
      result[key] = v
    } else {
      result[key] = Array.isArray(existing) ? [...existing, v] : [existing, v]
    }
  }
  return result
}

function firstQualifier(q: Record<string, string | string[]>, key: string): string | undefined {
  const v = q[key]
  return Array.isArray(v) ? v[0] : v
}

function buildFeatures(rawFeatures: RawFeature[]): { features: Feature[]; warnings: string[] } {
  const features: Feature[] = []
  const warnings: string[] = []

  for (const raw of rawFeatures) {
    if (raw.key === 'source') continue // whole-sequence bookkeeping, not a displayable feature

    const parsed = parseLocationString(raw.location)
    if (!parsed.ok) {
      warnings.push(`Skipped "${raw.key}" at "${raw.location}": ${parsed.reason}`)
      continue
    }
    const { segments, strand, partial } = parsed.value

    const start = Math.min(...segments.map((s) => s.start))
    const end = Math.max(...segments.map((s) => s.end))

    const qualifiers = groupQualifiers(raw.qualifiers)
    qualifiers['__genbank_type'] = raw.key

    const name =
      firstQualifier(qualifiers, 'gene') ??
      firstQualifier(qualifiers, 'label') ??
      firstQualifier(qualifiers, 'product') ??
      raw.key

    features.push({
      id: nanoid(),
      type: mapFeatureType(raw.key),
      name,
      start,
      end,
      strand,
      segments: segments.length > 1 ? segments : undefined,
      partial: partial.start || partial.end ? partial : undefined,
      qualifiers,
    })
  }

  return { features, warnings }
}

// ---------------------------------------------------------------------------
// Top-level parse
// ---------------------------------------------------------------------------

export function parseGenBank(text: string): ParseGenBankResult {
  const lines = text.split(/\r\n|\r|\n/)
  const records: GenBankRecord[] = []

  let i = 0
  while (i < lines.length) {
    while (i < lines.length && !/^LOCUS\s/.test(lines[i])) i++
    if (i >= lines.length) break

    const locus = parseLocusLine(lines[i])
    i++

    let description = ''
    let sawFeatures = false
    let sawOrigin = false
    let rawFeatures: RawFeature[] = []
    let sequenceChars: string[] = []

    while (i < lines.length && !/^\/\/\s*$/.test(lines[i]) && !/^LOCUS\s/.test(lines[i])) {
      const line = lines[i]

      if (/^FEATURES\b/.test(line)) {
        sawFeatures = true
        i++
        const res = parseFeaturesSection(lines, i)
        rawFeatures = res.rawFeatures
        i = res.nextIndex
        continue
      }

      if (/^ORIGIN\b/.test(line)) {
        sawOrigin = true
        i++
        const res = parseOriginSection(lines, i)
        sequenceChars = res.chars
        i = res.nextIndex
        continue
      }

      if (/^DEFINITION\s+/.test(line)) {
        description = line.replace(/^DEFINITION\s+/, '').trim()
        i++
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
          description += ' ' + lines[i].trim()
          i++
        }
        continue
      }

      i++
    }

    if (i < lines.length && /^\/\/\s*$/.test(lines[i])) i++

    if (!sawFeatures && !sawOrigin) continue

    const { features, warnings } = buildFeatures(rawFeatures)

    records.push({
      name: locus.name,
      description,
      sequence: sequenceChars.join(''),
      topology: locus.topology,
      features,
      warnings,
    })
  }

  const fileError =
    records.length === 0 ? 'No recognizable GenBank LOCUS/ORIGIN structure found.' : null
  return { records, fileError }
}

export function constructFromGenBank(record: GenBankRecord): Construct {
  return {
    id: nanoid(),
    name: record.name,
    description: record.description || undefined,
    sequence: record.sequence,
    topology: record.topology,
    features: record.features,
    mutations: [],
    sourceFormat: 'genbank',
  }
}
