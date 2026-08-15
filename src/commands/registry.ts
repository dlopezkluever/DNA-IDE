import type { Feature } from '../types/models'
import { TABS } from '../data/viewTabs'
import type { CommandContext, CommandDef } from './types'

/**
 * Resolves "the selection" to a specific CDS feature for `Translate selection`:
 * 1. `activeFeatureId` already refers to a CDS -> use it.
 * 2. Else the first CDS feature whose range overlaps the current selection.
 * 3. Else, if the construct has exactly one CDS, use it (matches ProteinView's own
 *    single/multi-CDS handling).
 * 4. Else null -> the command is shown but disabled (§2.5).
 */
export function resolveTargetCDS(ctx: CommandContext): Feature | null {
  const construct = ctx.activeConstruct
  if (!construct) return null

  if (ctx.activeFeatureId) {
    const active = construct.features.find((f) => f.id === ctx.activeFeatureId)
    if (active && active.type === 'CDS') return active
  }

  if (ctx.selection) {
    const { start, end } = ctx.selection
    const overlapping = construct.features.find(
      (f) => f.type === 'CDS' && f.start < end && start < f.end,
    )
    if (overlapping) return overlapping
  }

  const cdsFeatures = construct.features.filter((f) => f.type === 'CDS')
  return cdsFeatures.length === 1 ? cdsFeatures[0] : null
}

/**
 * Case-insensitive subsequence match: every character of `query` must appear in `target`
 * in order, gaps allowed. Returns `null` when `query` isn't a subsequence of `target`;
 * otherwise a score where a *higher* number is a better match — runs of consecutive
 * characters and an earlier first-match position both score higher. A small, hand-written
 * stand-in for VS Code's own palette-matching heuristic.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.trim().toLowerCase()
  const t = target.toLowerCase()
  if (q.length === 0) return 0

  let qi = 0
  let firstMatch = -1
  let lastMatch = -1
  let consecutiveRun = 0
  let score = 0

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue
    if (firstMatch === -1) firstMatch = ti
    consecutiveRun = lastMatch === ti - 1 ? consecutiveRun + 1 : 0
    score += consecutiveRun * 2
    lastMatch = ti
    qi++
  }

  if (qi < q.length) return null

  score -= firstMatch
  score -= (t.length - q.length) * 0.05
  return score
}

/** Pure, framework-free: assembles the full v1 command list from a live CommandContext. */
export function buildCommands(ctx: CommandContext): CommandDef[] {
  const commands: CommandDef[] = []

  // Navigate — generated from ViewTabs' own TABS list, not hand-duplicated.
  for (const tab of TABS) {
    commands.push({
      id: `navigate-${tab.id}`,
      label: `Go to ${tab.label}`,
      category: 'navigate',
      enabled: true,
      run: () => ctx.setActiveView(tab.id),
    })
  }

  const construct = ctx.activeConstruct
  if (construct) {
    const targetCDS = resolveTargetCDS(ctx)
    commands.push({
      id: 'translate-selection',
      label: 'Translate selection',
      category: 'run',
      enabled: targetCDS !== null,
      disabledReason: targetCDS === null ? 'no CDS in this construct' : undefined,
      run: () => {
        if (!targetCDS) return
        ctx.selectFeature(targetCDS)
        ctx.setActiveView('protein')
        // Protein view needs to mount first before its CDS blocks exist in the DOM.
        // Guarded so this stays a plain, side-effect-testable function outside a browser (tests).
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            document
              .getElementById(`cds-${targetCDS.id}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          })
        }
      },
    })

    const hasSelection = !!ctx.selection && ctx.selection.end > ctx.selection.start
    commands.push({
      id: 'reverse-complement',
      label: 'Reverse complement',
      category: 'run',
      enabled: hasSelection,
      disabledReason: hasSelection ? undefined : 'select a sequence range first',
      run: () => {
        ctx.setActiveView('sequence')
        ctx.setRcPreviewOpen(true)
      },
    })

    commands.push({
      id: 'find-orfs',
      label: 'Find ORFs',
      category: 'run',
      enabled: true,
      run: () => {
        ctx.setActiveView('protein')
        ctx.setOrfListOpen(true)
      },
    })

    commands.push({
      id: 'calculate-gc',
      label: 'Calculate GC',
      category: 'run',
      enabled: true,
      run: () => ctx.setActiveView('map'),
    })

    commands.push({
      id: 'show-restriction-sites',
      label: 'Show restriction sites',
      category: 'run',
      enabled: true,
      run: () => ctx.setActiveView('restriction'),
    })

    commands.push({
      id: 'design-crispr-guides',
      label: 'Design CRISPR guides',
      category: 'run',
      enabled: true,
      run: () => ctx.setActiveView('crispr'),
    })

    const otherConstructs = ctx.constructs.filter((c) => c.id !== construct.id)
    commands.push({
      id: 'compare-with',
      label: 'Compare with…',
      category: 'run',
      enabled: otherConstructs.length > 0,
      disabledReason: otherConstructs.length > 0 ? undefined : 'no other constructs loaded',
      // CommandPalette intercepts this id before ever calling run() — selecting it swaps
      // the palette into its compare-target sub-mode instead of executing and closing (§2.4).
      run: () => {},
    })

    const cdsCount = construct.features.filter((f) => f.type === 'CDS').length
    commands.push({
      id: 'mutation-heatmap',
      label: 'Mutation heatmap',
      category: 'run',
      enabled: cdsCount > 0,
      disabledReason: cdsCount > 0 ? undefined : 'no CDS in this construct',
      run: () => {
        ctx.setActiveView('mutations')
        ctx.setMutationHeatmapOpen(true)
      },
    })
  }

  commands.push({
    id: 'toggle-explain-mode',
    label: 'Toggle Explain Mode',
    category: 'toggle',
    enabled: true,
    run: () => ctx.toggleExplainMode(),
  })

  return commands
}
