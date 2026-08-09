import { describe, it, expect } from 'vitest'
import { simulatePCR } from './pcr'

describe('simulatePCR: success', () => {
  // [0,10) fwd target | [10,20) padding | [20,30) rev-site target
  const template = 'ACGTACGTAA' + 'CCCCCCCCCC' + 'TTACGTACGT'
  const forwardPrimer = 'ACGTACGTAA'
  const reversePrimer = 'ACGTACGTAA' // reverseComplement('TTACGTACGT') happens to equal this

  it('amplifies the expected region end to end', () => {
    const result = simulatePCR(template, forwardPrimer, reversePrimer, 'linear')
    expect(result.success).toBe(true)
    expect(result.forwardBinding).toEqual({ start: 0, end: 10 })
    expect(result.reverseBinding).toEqual({ start: 20, end: 30 })
    expect(result.ampliconStart).toBe(0)
    expect(result.ampliconEnd).toBe(30)
    expect(result.amplicon).toBe(template)
  })
})

describe('simulatePCR: error states', () => {
  const template = 'ACGTACGTAA' + 'CCCCCCCCCC' + 'TTACGTACGT'

  it('primer-not-found when neither primer binds', () => {
    // 'GGGGGGGGGG' and its reverse complement 'CCCCCCCCCC' both fail to appear... except the
    // template DOES contain a CCCCCCCCCC padding run, so use a primer whose reverse complement
    // ('AAAAAAAAAA') truly has no match to keep this genuinely "neither binds".
    const result = simulatePCR(template, 'GGGGGGGGGG', 'TTTTTTTTTT', 'linear')
    expect(result.success).toBe(false)
    expect(result.error).toBe('primer-not-found')
  })

  it('primer-not-found when only the forward primer binds', () => {
    const result = simulatePCR(template, 'ACGTACGTAA', 'TTTTTTTTTT', 'linear')
    expect(result.error).toBe('primer-not-found')
  })

  it('primers-face-away when both bind but point away from each other', () => {
    // forward binds at the end (position 20), "reverse" site is at the start (position 0)
    const forwardPrimer = 'TTACGTACGT'
    const reversePrimer = 'TTACGTACGT' // reverseComplement of it is 'ACGTACGTAA', found at position 0
    const result = simulatePCR(template, forwardPrimer, reversePrimer, 'linear')
    expect(result.success).toBe(false)
    expect(result.error).toBe('primers-face-away')
  })

  it('multiple-plausible-regions when the forward primer binds more than once', () => {
    const repeated = 'ACGTACGTAA' + 'ACGTACGTAA' + 'CCCCCCCCCC' + 'TTACGTACGT'
    const result = simulatePCR(repeated, 'ACGTACGTAA', 'ACGTACGTAA', 'linear')
    expect(result.success).toBe(false)
    expect(result.error).toBe('multiple-plausible-regions')
    expect(result.candidateRegions?.length).toBe(2)
  })
})

describe('simulatePCR: circular templates', () => {
  it('amplifies across the origin when the product wraps', () => {
    // fwd primer target at [15,25), rev-site target at [2,12), product wraps through position 0
    const template = 'CC' + 'TTACGTACGT' + 'CCC' + 'ACGTACGTAA' // 25nt circular
    const forwardPrimer = 'ACGTACGTAA'
    const reversePrimer = 'ACGTACGTAA' // reverseComplement('TTACGTACGT') === this

    const result = simulatePCR(template, forwardPrimer, reversePrimer, 'circular')
    expect(result.success).toBe(true)
    expect(result.ampliconStart).toBe(15)
    expect(result.ampliconEnd).toBe(12)
    expect(result.amplicon).toBe('ACGTACGTAA' + 'CC' + 'TTACGTACGT')
    expect(result.amplicon?.length).toBe(22)
  })
})
