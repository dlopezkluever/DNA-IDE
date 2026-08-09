import { MINIMAL_CDS_GENBANK } from './minimalCDS'
import { GFP_CONSTRUCT_GENBANK } from './gfpConstruct'
import { EDUCATIONAL_PLASMID_GENBANK } from './educationalPlasmid'

export interface ExampleConstruct {
  id: string
  name: string
  description: string
  genbank: string
}

export const EXAMPLE_CONSTRUCTS: ExampleConstruct[] = [
  {
    id: 'minimal-cds',
    name: 'Minimal Coding Sequence',
    description: 'A short synthetic construct: promoter, CDS, terminator.',
    genbank: MINIMAL_CDS_GENBANK,
  },
  {
    id: 'gfp-construct',
    name: 'GFP Construct',
    description: 'A real GFP coding sequence (NCBI U73901.1) for translation, mutation, and codon-optimization demos.',
    genbank: GFP_CONSTRUCT_GENBANK,
  },
  {
    id: 'educational-plasmid',
    name: 'Educational Plasmid',
    description: 'A circular plasmid with an origin, a resistance marker, and a GFP reporter.',
    genbank: EDUCATIONAL_PLASMID_GENBANK,
  },
]
