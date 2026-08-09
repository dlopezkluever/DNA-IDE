import { useRef, useState, type DragEvent } from 'react'
import { parseFASTA, constructFromFASTA } from '../../parsers/fasta'
import { parseGenBank, constructFromGenBank } from '../../parsers/genbank'
import { useConstructStore } from '../../store/constructStore'

const FASTA_EXTENSIONS = ['.fasta', '.fa', '.fna']
const GENBANK_EXTENSIONS = ['.gb', '.gbk']

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

export function FileImport() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const loadConstruct = useConstructStore((s) => s.loadConstruct)

  const importText = (filename: string, text: string) => {
    const ext = extensionOf(filename)
    setError(null)
    setWarning(null)

    if (FASTA_EXTENSIONS.includes(ext)) {
      const records = parseFASTA(text)
      if (records.length === 0) {
        setError(`No valid FASTA records found in ${filename}`)
        return
      }
      for (const record of records) {
        loadConstruct(constructFromFASTA(record))
      }
      const invalidCount = records.reduce((n, r) => n + r.issues.length, 0)
      if (invalidCount > 0) {
        setWarning(`${filename}: ${invalidCount} unexpected character(s) in sequence data.`)
      }
      return
    }

    if (GENBANK_EXTENSIONS.includes(ext)) {
      const { records, fileError } = parseGenBank(text)
      if (fileError) {
        setError(`${filename}: ${fileError}`)
        return
      }
      for (const record of records) {
        loadConstruct(constructFromGenBank(record))
      }
      const allWarnings = records.flatMap((r) => r.warnings)
      if (allWarnings.length > 0) {
        setWarning(
          `${filename}: ${allWarnings.length} feature(s) skipped — ${allWarnings[0]}${
            allWarnings.length > 1 ? ` (+${allWarnings.length - 1} more)` : ''
          }`,
        )
      }
      return
    }

    setError(`Unsupported file type "${ext || filename}". Use .fasta, .fa, .fna, .gb, or .gbk.`)
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      file.text().then((text) => importText(file.name, text))
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className="flex items-center gap-2"
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
          dragOver
            ? 'border-(--color-accent) text-(--color-accent)'
            : 'border-(--color-border-strong) text-(--color-text-secondary) hover:border-(--color-text-muted)'
        }`}
        title="Import a FASTA or GenBank file (or drag one anywhere onto this bar)"
      >
        Import…
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".fasta,.fa,.fna,.gb,.gbk"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && (
        <span className="max-w-72 truncate text-xs text-(--color-danger)" title={error}>
          {error}
        </span>
      )}
      {!error && warning && (
        <span className="max-w-72 truncate text-xs text-(--color-warn)" title={warning}>
          {warning}
        </span>
      )}
    </div>
  )
}
