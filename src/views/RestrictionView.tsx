import { useMemo } from 'react'
import { useConstructStore } from '../store/constructStore'
import { useUIStore } from '../store/uiStore'
import { useCrossHighlight } from '../hooks/useCrossHighlight'
import { RESTRICTION_ENZYMES } from '../data/restrictionEnzymes'
import { findRestrictionSites, findUniqueCutters, computeFragments } from '../biology/restriction'
import { toDisplayPosition } from '../biology/sequence'
import { EnzymeList } from '../components/restriction/EnzymeList'
import { ViewPlaceholder } from '../components/common/ViewPlaceholder'

export function RestrictionView() {
  const activeConstructId = useConstructStore((s) => s.activeConstructId)
  const constructs = useConstructStore((s) => s.constructs)
  const enabledEnzymeIds = useUIStore((s) => s.enabledEnzymeIds)
  const { selectRange } = useCrossHighlight()

  const construct = activeConstructId ? constructs[activeConstructId] : null

  const enabledEnzymes = useMemo(
    () => RESTRICTION_ENZYMES.filter((e) => enabledEnzymeIds.includes(e.id)),
    [enabledEnzymeIds],
  )

  const matches = useMemo(() => {
    if (!construct) return []
    return findRestrictionSites(construct.sequence, enabledEnzymes, construct.topology)
  }, [construct, enabledEnzymes])

  const uniqueCutterIds = useMemo(() => findUniqueCutters(matches), [matches])

  const fragments = useMemo(() => {
    if (!construct || matches.length === 0) return []
    return computeFragments(
      construct.sequence.length,
      matches.map((m) => m.cutPosition),
      construct.topology,
    )
  }, [construct, matches])

  if (!construct) {
    return (
      <ViewPlaceholder
        title="No construct loaded"
        note="Import a FASTA or GenBank file to begin."
      />
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <EnzymeList uniqueCutterIds={uniqueCutterIds} />
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
          Cut Sites ({matches.length})
        </h3>
        {matches.length === 0 ? (
          <p className="text-xs text-(--color-text-muted)">
            No sites found for the enabled enzymes.
          </p>
        ) : (
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-(--color-border) text-left text-(--color-text-muted)">
                <th className="py-1 pr-4">Enzyme</th>
                <th className="py-1 pr-4">Position</th>
                <th className="py-1 pr-4">Strand</th>
                <th className="py-1">Cut</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => {
                const enzyme = RESTRICTION_ENZYMES.find((e) => e.id === m.enzymeId)
                return (
                  <tr
                    key={i}
                    onClick={() => selectRange(m.position, m.position + (enzyme?.site.length ?? 1))}
                    className="cursor-pointer border-b border-(--color-border) hover:bg-(--color-bg-hover)"
                  >
                    <td className="py-1 pr-4 text-(--color-text-primary)">
                      {m.enzymeName}
                      {uniqueCutterIds.has(m.enzymeId) && (
                        <span className="ml-1 text-(--color-accent)" title="Unique cutter">
                          ★
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-4">{toDisplayPosition(m.position)}</td>
                    <td className="py-1 pr-4">{m.reverseStrand ? '-' : '+'}</td>
                    <td className="py-1">{toDisplayPosition(m.cutPosition)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {fragments.length > 0 && (
          <>
            <h3 className="mt-6 mb-2 font-mono text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">
              Fragments ({fragments.length})
            </h3>
            <ul className="space-y-0.5 font-mono text-xs">
              {[...fragments]
                .sort((a, b) => b.length - a.length)
                .map((f, i) => (
                  <li key={i} className="text-(--color-text-primary)">
                    {f.length.toLocaleString()} bp
                    <span className="ml-2 text-(--color-text-muted)">
                      ({toDisplayPosition(f.start)}-{f.end === f.start ? f.start : f.end})
                    </span>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
