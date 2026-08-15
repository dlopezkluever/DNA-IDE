import { describe, it, expect, vi } from 'vitest'
import { buildCommands, fuzzyScore, resolveTargetCDS } from './registry'
import type { CommandContext } from './types'
import type { Construct, Feature } from '../types/models'

function feature(overrides: Partial<Feature> = {}): Feature {
  return { id: 'f1', type: 'CDS', name: 'gfp', start: 10, end: 100, strand: 1, ...overrides }
}

function construct(overrides: Partial<Construct> = {}): Construct {
  return {
    id: 'c1',
    name: 'test',
    sequence: 'A'.repeat(200),
    topology: 'linear',
    features: [feature()],
    mutations: [],
    ...overrides,
  }
}

function buildContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    activeView: 'sequence',
    setActiveView: vi.fn(),
    selection: null,
    activeFeatureId: null,
    selectFeature: vi.fn(),
    selectRange: vi.fn(),
    activeConstruct: null,
    constructs: [],
    setCompareConstruct: vi.fn(),
    toggleExplainMode: vi.fn(),
    setRcPreviewOpen: vi.fn(),
    setOrfListOpen: vi.fn(),
    setMutationHeatmapOpen: vi.fn(),
    ...overrides,
  }
}

describe('fuzzyScore', () => {
  it('matches a case-insensitive subsequence', () => {
    expect(fuzzyScore('trc', 'Translate selection')).not.toBeNull()
  })

  it('returns null when query is not a subsequence of target', () => {
    expect(fuzzyScore('xyz', 'Translate selection')).toBeNull()
  })

  it('returns 0 for an empty query (matches everything)', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })

  it('is case-insensitive', () => {
    expect(fuzzyScore('TRANS', 'translate selection')).not.toBeNull()
    expect(fuzzyScore('trans', 'TRANSLATE SELECTION')).not.toBeNull()
  })

  it('scores a tighter/earlier match higher than a scattered/later one', () => {
    const tight = fuzzyScore('ab', 'ab-----')
    const scattered = fuzzyScore('ab', '----a----b')
    expect(tight).not.toBeNull()
    expect(scattered).not.toBeNull()
    expect(tight!).toBeGreaterThan(scattered!)
  })

  it('rejects out-of-order characters', () => {
    expect(fuzzyScore('ba', 'ab')).toBeNull()
  })
})

describe('resolveTargetCDS', () => {
  it('returns null when there is no active construct', () => {
    expect(resolveTargetCDS(buildContext())).toBeNull()
  })

  it('uses activeFeatureId when it refers to a CDS', () => {
    const cds = feature({ id: 'cds1' })
    const other = feature({ id: 'misc1', type: 'misc', name: 'ori' })
    const ctx = buildContext({
      activeConstruct: construct({ features: [cds, other] }),
      activeFeatureId: 'cds1',
    })
    expect(resolveTargetCDS(ctx)).toBe(cds)
  })

  it('falls through when activeFeatureId refers to a non-CDS feature', () => {
    const cds = feature({ id: 'cds1', start: 0, end: 300 })
    const other = feature({ id: 'misc1', type: 'misc', name: 'ori' })
    const ctx = buildContext({
      activeConstruct: construct({ features: [cds, other] }),
      activeFeatureId: 'misc1',
      selection: { start: 20, end: 25 },
    })
    expect(resolveTargetCDS(ctx)).toBe(cds)
  })

  it('finds the CDS overlapping the current selection', () => {
    const cds1 = feature({ id: 'cds1', start: 0, end: 30 })
    const cds2 = feature({ id: 'cds2', start: 50, end: 80 })
    const ctx = buildContext({
      activeConstruct: construct({ features: [cds1, cds2] }),
      selection: { start: 60, end: 65 },
    })
    expect(resolveTargetCDS(ctx)).toBe(cds2)
  })

  it('uses the sole CDS when there is no selection or active feature', () => {
    const cds = feature({ id: 'cds1' })
    const ctx = buildContext({ activeConstruct: construct({ features: [cds] }) })
    expect(resolveTargetCDS(ctx)).toBe(cds)
  })

  it('returns null with multiple CDS features and no selection/active feature to disambiguate', () => {
    const cds1 = feature({ id: 'cds1', start: 0, end: 30 })
    const cds2 = feature({ id: 'cds2', start: 50, end: 80 })
    const ctx = buildContext({ activeConstruct: construct({ features: [cds1, cds2] }) })
    expect(resolveTargetCDS(ctx)).toBeNull()
  })
})

describe('buildCommands', () => {
  it('always includes the 11 navigate commands and the Explain toggle, even with no construct', () => {
    const commands = buildCommands(buildContext())
    const navigate = commands.filter((c) => c.category === 'navigate')
    expect(navigate).toHaveLength(11)
    expect(navigate.every((c) => c.enabled)).toBe(true)
    expect(commands.find((c) => c.id === 'toggle-explain-mode')).toBeDefined()
  })

  it('hides construct-gated Run commands when there is no active construct, but keeps "open-scenarios"', () => {
    const commands = buildCommands(buildContext())
    expect(commands.some((c) => c.id === 'design-crispr-guides')).toBe(false)
    const openScenarios = commands.find((c) => c.id === 'open-scenarios')!
    expect(openScenarios.category).toBe('run')
    expect(openScenarios.enabled).toBe(true)
  })

  it('"CRISPR scenarios" runs setActiveView("scenarios")', () => {
    const ctx = buildContext()
    const openScenarios = buildCommands(ctx).find((c) => c.id === 'open-scenarios')!
    openScenarios.run()
    expect(ctx.setActiveView).toHaveBeenCalledWith('scenarios')
  })

  it('shows Run commands once a construct is active', () => {
    const ctx = buildContext({ activeConstruct: construct() })
    const commands = buildCommands(ctx)
    const ids = commands.map((c) => c.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'translate-selection',
        'reverse-complement',
        'find-orfs',
        'calculate-gc',
        'show-restriction-sites',
        'compare-with',
        'mutation-heatmap',
        'design-crispr-guides',
        'view-structure',
      ]),
    )
  })

  it('Reverse complement is disabled with a reason when there is no selection', () => {
    const ctx = buildContext({ activeConstruct: construct(), selection: null })
    const rc = buildCommands(ctx).find((c) => c.id === 'reverse-complement')!
    expect(rc.enabled).toBe(false)
    expect(rc.disabledReason).toMatch(/select a sequence range/)
  })

  it('Reverse complement runs setActiveView("sequence") and setRcPreviewOpen(true) when enabled', () => {
    const ctx = buildContext({
      activeConstruct: construct(),
      selection: { start: 5, end: 10 },
    })
    const rc = buildCommands(ctx).find((c) => c.id === 'reverse-complement')!
    expect(rc.enabled).toBe(true)
    rc.run()
    expect(ctx.setActiveView).toHaveBeenCalledWith('sequence')
    expect(ctx.setRcPreviewOpen).toHaveBeenCalledWith(true)
  })

  it('Find ORFs runs setActiveView("protein") and setOrfListOpen(true)', () => {
    const ctx = buildContext({ activeConstruct: construct() })
    const orfs = buildCommands(ctx).find((c) => c.id === 'find-orfs')!
    orfs.run()
    expect(ctx.setActiveView).toHaveBeenCalledWith('protein')
    expect(ctx.setOrfListOpen).toHaveBeenCalledWith(true)
  })

  it('Translate selection is disabled with a reason when no CDS resolves', () => {
    const cds1 = feature({ id: 'cds1', start: 0, end: 30 })
    const cds2 = feature({ id: 'cds2', start: 50, end: 80 })
    const ctx = buildContext({ activeConstruct: construct({ features: [cds1, cds2] }) })
    const translate = buildCommands(ctx).find((c) => c.id === 'translate-selection')!
    expect(translate.enabled).toBe(false)
    expect(translate.disabledReason).toMatch(/no CDS/)
  })

  it('Translate selection selects the resolved CDS and switches to the protein view', () => {
    const cds = feature({ id: 'cds1' })
    const ctx = buildContext({ activeConstruct: construct({ features: [cds] }) })
    const translate = buildCommands(ctx).find((c) => c.id === 'translate-selection')!
    expect(translate.enabled).toBe(true)
    translate.run()
    expect(ctx.selectFeature).toHaveBeenCalledWith(cds)
    expect(ctx.setActiveView).toHaveBeenCalledWith('protein')
  })

  it('Compare with… is disabled with a reason when no other constructs are loaded', () => {
    const ctx = buildContext({ activeConstruct: construct() })
    const compare = buildCommands(ctx).find((c) => c.id === 'compare-with')!
    expect(compare.enabled).toBe(false)
    expect(compare.disabledReason).toMatch(/no other constructs/)
  })

  it('Compare with… is enabled when another construct is loaded', () => {
    const active = construct({ id: 'c1' })
    const other = construct({ id: 'c2', name: 'other' })
    const ctx = buildContext({ activeConstruct: active, constructs: [active, other] })
    const compare = buildCommands(ctx).find((c) => c.id === 'compare-with')!
    expect(compare.enabled).toBe(true)
  })

  it('Mutation heatmap is enabled only when the construct has at least one CDS', () => {
    const noCds = construct({ features: [feature({ type: 'misc', name: 'ori' })] })
    const ctx = buildContext({ activeConstruct: noCds })
    const heatmap = buildCommands(ctx).find((c) => c.id === 'mutation-heatmap')!
    expect(heatmap.enabled).toBe(false)
    expect(heatmap.disabledReason).toMatch(/no CDS/)
  })

  it('Mutation heatmap runs setActiveView("mutations") and setMutationHeatmapOpen(true)', () => {
    const ctx = buildContext({ activeConstruct: construct() })
    const heatmap = buildCommands(ctx).find((c) => c.id === 'mutation-heatmap')!
    heatmap.run()
    expect(ctx.setActiveView).toHaveBeenCalledWith('mutations')
    expect(ctx.setMutationHeatmapOpen).toHaveBeenCalledWith(true)
  })

  it('Design CRISPR guides runs setActiveView("crispr")', () => {
    const ctx = buildContext({ activeConstruct: construct() })
    const crispr = buildCommands(ctx).find((c) => c.id === 'design-crispr-guides')!
    expect(crispr.enabled).toBe(true)
    crispr.run()
    expect(ctx.setActiveView).toHaveBeenCalledWith('crispr')
  })

  it('View 3D structure runs setActiveView("structure")', () => {
    const ctx = buildContext({ activeConstruct: construct() })
    const structure = buildCommands(ctx).find((c) => c.id === 'view-structure')!
    expect(structure.enabled).toBe(true)
    structure.run()
    expect(ctx.setActiveView).toHaveBeenCalledWith('structure')
  })
})
