import { describe, it, expect } from 'vitest'
import { EXAMPLE_CONSTRUCTS } from './index'
import { parseGenBank, constructFromGenBank } from '../../parsers/genbank'
import { translateFeature } from '../../biology/translation'
import { findORFs } from '../../biology/orf'

describe('example constructs parse cleanly through the real GenBank parser', () => {
  for (const example of EXAMPLE_CONSTRUCTS) {
    it(`${example.name}: parses with no warnings and produces sane CDS translations`, () => {
      const { records, fileError } = parseGenBank(example.genbank)
      expect(fileError).toBeNull()
      expect(records).toHaveLength(1)
      const record = records[0]
      expect(record.warnings).toEqual([])

      const construct = constructFromGenBank(record)
      expect(construct.sequence.length).toBeGreaterThan(0)

      const cdsFeatures = construct.features.filter((f) => f.type === 'CDS')
      expect(cdsFeatures.length).toBeGreaterThan(0)

      for (const cds of cdsFeatures) {
        const codons = translateFeature(cds, construct.sequence)
        const protein = codons.map((c) => c.aa).join('')
        expect(protein.startsWith('M')).toBe(true)
        expect(protein.endsWith('*')).toBe(true)
        // exactly one stop, at the end -- a clean, single-ORF CDS
        expect(protein.indexOf('*')).toBe(protein.length - 1)
      }
    })
  }

  it('the GFP construct CDS is 238 residues (matching real GFP length)', () => {
    const { records } = parseGenBank(
      EXAMPLE_CONSTRUCTS.find((e) => e.id === 'gfp-construct')!.genbank,
    )
    const construct = constructFromGenBank(records[0])
    const gfp = construct.features.find((f) => f.name === 'GFP')!
    const protein = translateFeature(gfp, construct.sequence)
      .map((c) => c.aa)
      .join('')
    expect(protein.length - 1).toBe(238) // exclude the trailing stop
  })

  it('the educational plasmid is circular and findORFs locates both real CDSs', () => {
    const { records } = parseGenBank(
      EXAMPLE_CONSTRUCTS.find((e) => e.id === 'educational-plasmid')!.genbank,
    )
    const construct = constructFromGenBank(records[0])
    expect(construct.topology).toBe('circular')

    const orfs = findORFs(construct.sequence, {
      topology: 'circular',
      minLength: 200,
      strands: [1],
    })
    expect(orfs.length).toBeGreaterThanOrEqual(2)
  })
})
