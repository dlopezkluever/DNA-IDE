import { describe, it, expect } from 'vitest'
import { parseFASTA, constructFromFASTA } from './fasta'

describe('parseFASTA', () => {
  it('parses a single record with id and description', () => {
    const text = '>seq1 an example description\nATGCATGC\nATGC\n'
    const records = parseFASTA(text)
    expect(records).toHaveLength(1)
    expect(records[0].id).toBe('seq1')
    expect(records[0].description).toBe('an example description')
    expect(records[0].sequence).toBe('ATGCATGCATGC')
    expect(records[0].issues).toEqual([])
  })

  it('parses multiple records', () => {
    const text = '>a\nATGC\n>b desc\nGGCC\n'
    const records = parseFASTA(text)
    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ id: 'a', description: '', sequence: 'ATGC' })
    expect(records[1]).toMatchObject({ id: 'b', description: 'desc', sequence: 'GGCC' })
  })

  it('handles a header with no description', () => {
    const records = parseFASTA('>onlyid\nATGC\n')
    expect(records[0].id).toBe('onlyid')
    expect(records[0].description).toBe('')
  })

  it('handles CRLF line endings', () => {
    const records = parseFASTA('>seq1\r\nATGC\r\nGGCC\r\n')
    expect(records[0].sequence).toBe('ATGCGGCC')
  })

  it('uppercases lowercase input', () => {
    const records = parseFASTA('>seq1\natgc\n')
    expect(records[0].sequence).toBe('ATGC')
  })

  it('ignores content before the first header', () => {
    const records = parseFASTA('; a comment line\nATGC\n>seq1\nGGCC\n')
    expect(records).toHaveLength(1)
    expect(records[0].sequence).toBe('GGCC')
  })

  it('flags invalid characters with line number and sequence index, without dropping them', () => {
    const records = parseFASTA('>bad\nATGX\nATGC\n')
    expect(records[0].sequence).toBe('ATGXATGC')
    expect(records[0].issues).toEqual([{ char: 'X', line: 2, sequenceIndex: 3 }])
  })

  it('returns an empty array for text with no headers', () => {
    expect(parseFASTA('ATGCATGC')).toEqual([])
  })
})

describe('constructFromFASTA', () => {
  it('builds a linear, unannotated construct from a record', () => {
    const [record] = parseFASTA('>plasmidX a test construct\nATGCATGC\n')
    const construct = constructFromFASTA(record)
    expect(construct.name).toBe('plasmidX')
    expect(construct.description).toBe('a test construct')
    expect(construct.sequence).toBe('ATGCATGC')
    expect(construct.topology).toBe('linear')
    expect(construct.features).toEqual([])
    expect(construct.mutations).toEqual([])
    expect(construct.sourceFormat).toBe('fasta')
    expect(typeof construct.id).toBe('string')
    expect(construct.id.length).toBeGreaterThan(0)
  })

  it('leaves description undefined when the FASTA header has none', () => {
    const [record] = parseFASTA('>seq1\nATGC\n')
    const construct = constructFromFASTA(record)
    expect(construct.description).toBeUndefined()
  })
})
