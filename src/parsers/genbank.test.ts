import { describe, it, expect } from 'vitest'
import { parseGenBank, constructFromGenBank } from './genbank'
import { reverseComplement } from '../biology/sequence'
import { translateDNA } from '../biology/translation'

/** Formats a plain sequence into GenBank ORIGIN lines (numbered, 10-base chunks, 60/line). */
function formatOrigin(seq: string): string {
  const lines: string[] = []
  for (let i = 0; i < seq.length; i += 60) {
    const lineSeq = seq.slice(i, i + 60).toLowerCase()
    const chunks: string[] = []
    for (let j = 0; j < lineSeq.length; j += 10) chunks.push(lineSeq.slice(j, j + 10))
    const pos = i + 1
    lines.push(`${' '.repeat(Math.max(0, 8 - String(pos).length))}${pos} ${chunks.join(' ')}`)
  }
  return lines.join('\n')
}

describe('parseGenBank: simple linear CDS', () => {
  const payload = 'ATGGAATTTTGA' // ATG GAA TTT TGA -> MEF*
  const seq = 'AAA' + payload + 'AAA' // 18nt, CDS at 1-based 4..15

  const text = `LOCUS       SIMPLECDS                 18 bp    DNA     linear   SYN 01-JAN-2024
DEFINITION  Minimal synthetic CDS test fixture.
FEATURES             Location/Qualifiers
     source          1..18
                     /organism="synthetic DNA construct"
     CDS             4..15
                     /gene="testCDS"
                     /product="test protein"
ORIGIN
${formatOrigin(seq)}
//
`

  it('parses LOCUS name, topology, and description', () => {
    const { records, fileError } = parseGenBank(text)
    expect(fileError).toBeNull()
    expect(records).toHaveLength(1)
    expect(records[0].name).toBe('SIMPLECDS')
    expect(records[0].topology).toBe('linear')
    expect(records[0].description).toBe('Minimal synthetic CDS test fixture.')
  })

  it('parses the ORIGIN sequence exactly, uppercased', () => {
    const { records } = parseGenBank(text)
    expect(records[0].sequence).toBe(seq)
  })

  it('skips the "source" feature and parses the CDS with correct 0-based coordinates', () => {
    const { records } = parseGenBank(text)
    const features = records[0].features
    expect(features).toHaveLength(1)
    expect(features[0]).toMatchObject({
      type: 'CDS',
      name: 'testCDS',
      start: 3,
      end: 15,
      strand: 1,
    })
    expect(features[0].qualifiers?.product).toBe('test protein')
    expect(features[0].qualifiers?.__genbank_type).toBe('CDS')
  })

  it('translates correctly when combined with the translation engine', () => {
    const { records } = parseGenBank(text)
    const cds = records[0].features[0]
    const cdsSeq = records[0].sequence.slice(cds.start, cds.end)
    expect(translateDNA(cdsSeq, { toStop: true })).toBe('MEF*')
  })

  it('builds a Construct via constructFromGenBank', () => {
    const { records } = parseGenBank(text)
    const construct = constructFromGenBank(records[0])
    expect(construct.name).toBe('SIMPLECDS')
    expect(construct.topology).toBe('linear')
    expect(construct.sourceFormat).toBe('genbank')
    expect(construct.mutations).toEqual([])
    expect(construct.features).toHaveLength(1)
  })
})

describe('parseGenBank: circular plasmid with multiple feature types', () => {
  const promoter = 'TTGACAATTA' // 10nt
  const cds = 'ATGGAATTTAAAGGGCCCTTTAAAGAATGA' // 30nt, ATG..TGA
  const terminator = 'AATAAAGGCC' // 10nt
  const origin = 'GCGCGCGCGC' // 10nt
  const seq = promoter + cds + terminator + origin // 60nt circular

  const text = `LOCUS       CIRCPLASMID               60 bp    DNA     circular SYN 01-JAN-2024
DEFINITION  Small circular plasmid test fixture.
FEATURES             Location/Qualifiers
     source          1..60
                     /organism="synthetic DNA construct"
     promoter        1..10
                     /label="testProm"
     CDS             11..40
                     /gene="testGene"
                     /product="test protein"
     terminator      41..50
                     /label="testTerm"
     rep_origin      51..60
                     /label="testOri"
ORIGIN
${formatOrigin(seq)}
//
`

  it('parses circular topology', () => {
    const { records } = parseGenBank(text)
    expect(records[0].topology).toBe('circular')
  })

  it('parses all four non-source features with correct types and coordinates', () => {
    const { records } = parseGenBank(text)
    const features = records[0].features
    expect(features).toHaveLength(4)

    expect(features.find((f) => f.name === 'testProm')).toMatchObject({
      type: 'promoter',
      start: 0,
      end: 10,
    })
    expect(features.find((f) => f.name === 'testGene')).toMatchObject({
      type: 'CDS',
      start: 10,
      end: 40,
    })
    expect(features.find((f) => f.name === 'testTerm')).toMatchObject({
      type: 'terminator',
      start: 40,
      end: 50,
    })
    expect(features.find((f) => f.name === 'testOri')).toMatchObject({
      type: 'origin',
      start: 50,
      end: 60,
    })
  })

  it('maps the GenBank CDS translation correctly', () => {
    const { records } = parseGenBank(text)
    const cdsFeature = records[0].features.find((f) => f.type === 'CDS')!
    const cdsSeq = records[0].sequence.slice(cdsFeature.start, cdsFeature.end)
    expect(translateDNA(cdsSeq, { toStop: true }).startsWith('M')).toBe(true)
    expect(translateDNA(cdsSeq, { toStop: true }).endsWith('*')).toBe(true)
  })
})

describe('parseGenBank: join() spliced feature', () => {
  const exon1 = 'ATGGAA' // ATG GAA
  const spacer = 'CCCCCCCCCC' // 10nt, not part of the CDS
  const exon2 = 'TTTTGA' // TTT TGA
  const seq = exon1 + spacer + exon2 // 22nt; exon1 = 1..6, exon2 = 17..22

  const text = `LOCUS       JOINFEATURE               22 bp    DNA     linear   SYN 01-JAN-2024
FEATURES             Location/Qualifiers
     CDS             join(1..6,17..22)
                     /gene="splicedCDS"
ORIGIN
${formatOrigin(seq)}
//
`

  it('stores both segments and computes the overall min/max span', () => {
    const { records } = parseGenBank(text)
    const feature = records[0].features[0]
    expect(feature.start).toBe(0)
    expect(feature.end).toBe(22)
    expect(feature.segments).toEqual([
      { start: 0, end: 6 },
      { start: 16, end: 22 },
    ])
  })

  it('translates correctly when the segments are spliced together (not min/max collapsed)', () => {
    const { records } = parseGenBank(text)
    const feature = records[0].features[0]
    const spliced = feature.segments!.map((s) => records[0].sequence.slice(s.start, s.end)).join('')
    expect(spliced).toBe('ATGGAATTTTGA')
    expect(translateDNA(spliced, { toStop: true })).toBe('MEF*')
  })
})

describe('parseGenBank: complement() feature on the minus strand', () => {
  const payload = 'ATGGAATTTTGA'
  const seq = 'AAA' + reverseComplement(payload) + 'AAA' // 18nt

  const text = `LOCUS       COMPFEATURE               18 bp    DNA     linear   SYN 01-JAN-2024
FEATURES             Location/Qualifiers
     gene            complement(4..15)
                     /gene="minusStrandGene"
ORIGIN
${formatOrigin(seq)}
//
`

  it('sets strand -1 and keeps the same numeric plus-strand span as an equivalent forward feature', () => {
    const { records } = parseGenBank(text)
    const feature = records[0].features[0]
    expect(feature.strand).toBe(-1)
    expect(feature.start).toBe(3)
    expect(feature.end).toBe(15)
  })

  it('reads correctly in the minus-strand reading direction', () => {
    const { records } = parseGenBank(text)
    const feature = records[0].features[0]
    const plusStrandSpan = records[0].sequence.slice(feature.start, feature.end)
    const readingDirection = reverseComplement(plusStrandSpan)
    expect(translateDNA(readingDirection, { toStop: true })).toBe('MEF*')
  })
})

describe('parseGenBank: fuzzy positions', () => {
  const seq = 'ACGTACGTAC' // 10nt

  const text = `LOCUS       FUZZYFEATURE              10 bp    DNA     linear   SYN 01-JAN-2024
FEATURES             Location/Qualifiers
     misc_feature    <1..>10
                     /label="fuzzyRegion"
ORIGIN
${formatOrigin(seq)}
//
`

  it('flags partial.start and partial.end without altering coordinates', () => {
    const { records } = parseGenBank(text)
    const feature = records[0].features[0]
    expect(feature.start).toBe(0)
    expect(feature.end).toBe(10)
    expect(feature.partial).toEqual({ start: true, end: true })
  })
})

describe('parseGenBank: malformed feature is skipped, not fatal', () => {
  const seq = 'AAAATGGAATTTTGAAAA' + 'GC' // pad to 20nt

  const text = `LOCUS       MALFORMED                 20 bp    DNA     linear   SYN 01-JAN-2024
FEATURES             Location/Qualifiers
     CDS             4..15
                     /gene="validCDS"
     misc_feature    not-a-real-location
                     /label="broken"
ORIGIN
${formatOrigin(seq)}
//
`

  it('still parses the valid feature and the file as a whole', () => {
    const { records, fileError } = parseGenBank(text)
    expect(fileError).toBeNull()
    expect(records).toHaveLength(1)
    const features = records[0].features
    expect(features).toHaveLength(1)
    expect(features[0].name).toBe('validCDS')
  })

  it('reports a warning identifying the skipped feature, without dropping it silently', () => {
    const { records } = parseGenBank(text)
    expect(records[0].warnings.length).toBe(1)
    expect(records[0].warnings[0]).toContain('misc_feature')
    expect(records[0].warnings[0]).toMatch(/not-a-real-location/)
  })
})

describe('parseGenBank: multi-record files and file-level errors', () => {
  const fixtureA = `LOCUS       RECORDA                   10 bp    DNA     linear   SYN 01-JAN-2024
FEATURES             Location/Qualifiers
     misc_feature    1..10
                     /label="a"
ORIGIN
${formatOrigin('ACGTACGTAC')}
//
`
  const fixtureB = `LOCUS       RECORDB                   10 bp    DNA     linear   SYN 01-JAN-2024
FEATURES             Location/Qualifiers
     misc_feature    1..10
                     /label="b"
ORIGIN
${formatOrigin('TTTTGGGGCC')}
//
`

  it('parses multiple concatenated records from one file', () => {
    const { records, fileError } = parseGenBank(fixtureA + fixtureB)
    expect(fileError).toBeNull()
    expect(records).toHaveLength(2)
    expect(records[0].name).toBe('RECORDA')
    expect(records[1].name).toBe('RECORDB')
  })

  it('reports a file-level error when nothing recognizable is found', () => {
    const { records, fileError } = parseGenBank('this is not a GenBank file at all')
    expect(records).toEqual([])
    expect(fileError).not.toBeNull()
  })
})

describe('parseGenBank: multi-line DEFINITION', () => {
  const text = `LOCUS       MULTIDEF                  10 bp    DNA     linear   SYN 01-JAN-2024
DEFINITION  This description wraps across
            multiple continuation lines.
FEATURES             Location/Qualifiers
     misc_feature    1..10
                     /label="a"
ORIGIN
${formatOrigin('ACGTACGTAC')}
//
`

  it('joins continuation lines into a single description', () => {
    const { records } = parseGenBank(text)
    expect(records[0].description).toBe(
      'This description wraps across multiple continuation lines.',
    )
  })
})
