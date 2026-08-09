import { nanoid } from 'nanoid'
import type { Construct } from '../types/models'
import { validateSequence } from '../biology/sequence'

export interface FastaParseIssue {
  char: string
  /** 1-based source line number. */
  line: number
  /** 0-based index into the parsed sequence string. */
  sequenceIndex: number
}

export interface FastaRecord {
  id: string
  description: string
  sequence: string
  issues: FastaParseIssue[]
}

export function parseFASTA(text: string): FastaRecord[] {
  const lines = text.split(/\r\n|\r|\n/)
  const records: FastaRecord[] = []

  let header: string | null = null
  let seqChars: string[] = []
  let lineMap: number[] = []

  const flush = () => {
    if (header === null) return
    const headerContent = header.slice(1).trim()
    const spaceIdx = headerContent.search(/\s/)
    const id = spaceIdx === -1 ? headerContent : headerContent.slice(0, spaceIdx)
    const description = spaceIdx === -1 ? '' : headerContent.slice(spaceIdx + 1).trim()
    const sequence = seqChars.join('')

    const { invalidChars } = validateSequence(sequence)
    const issues: FastaParseIssue[] = invalidChars.map(({ char, index }) => ({
      char,
      line: lineMap[index],
      sequenceIndex: index,
    }))

    records.push({ id: id || 'sequence', description, sequence, issues })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1
    if (line.startsWith('>')) {
      flush()
      header = line
      seqChars = []
      lineMap = []
      continue
    }
    if (header === null) continue // content before the first header is not valid FASTA

    const stripped = line.replace(/\s/g, '').toUpperCase()
    for (const c of stripped) {
      seqChars.push(c)
      lineMap.push(lineNo)
    }
  }
  flush()

  return records
}

export function constructFromFASTA(record: FastaRecord): Construct {
  return {
    id: nanoid(),
    name: record.id,
    description: record.description || undefined,
    sequence: record.sequence,
    topology: 'linear',
    features: [],
    mutations: [],
    sourceFormat: 'fasta',
  }
}
