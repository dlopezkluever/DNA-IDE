export type GuideSortOption = 'rating' | 'position' | 'gc'

interface GuideFiltersProps {
  gcRangeOnly: boolean
  onGcRangeOnlyChange: (value: boolean) => void
  hidePolyT: boolean
  onHidePolyTChange: (value: boolean) => void
  cdsOnly: boolean
  onCdsOnlyChange: (value: boolean) => void
  sortBy: GuideSortOption
  onSortByChange: (value: GuideSortOption) => void
  totalCount: number
  filteredCount: number
}

const SORT_OPTIONS: { value: GuideSortOption; label: string }[] = [
  { value: 'rating', label: 'Rating' },
  { value: 'position', label: 'Position' },
  { value: 'gc', label: 'GC%' },
]

export function GuideFilters({
  gcRangeOnly,
  onGcRangeOnlyChange,
  hidePolyT,
  onHidePolyTChange,
  cdsOnly,
  onCdsOnlyChange,
  sortBy,
  onSortByChange,
  totalCount,
  filteredCount,
}: GuideFiltersProps) {
  return (
    <div className="flex w-52 shrink-0 flex-col gap-3 border-r border-(--color-border) p-2">
      <div className="space-y-1.5 font-mono text-xs">
        <label className="flex cursor-pointer items-center gap-2 hover:text-(--color-accent)">
          <input
            type="checkbox"
            checked={gcRangeOnly}
            onChange={(e) => onGcRangeOnlyChange(e.target.checked)}
            className="accent-(--color-accent)"
          />
          <span className="text-(--color-text-primary)">40-60% GC only</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 hover:text-(--color-accent)">
          <input
            type="checkbox"
            checked={hidePolyT}
            onChange={(e) => onHidePolyTChange(e.target.checked)}
            className="accent-(--color-accent)"
          />
          <span className="text-(--color-text-primary)">Hide poly-T guides</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 hover:text-(--color-accent)">
          <input
            type="checkbox"
            checked={cdsOnly}
            onChange={(e) => onCdsOnlyChange(e.target.checked)}
            className="accent-(--color-accent)"
          />
          <span className="text-(--color-text-primary)">CDS-only</span>
        </label>
      </div>

      <label className="flex items-center gap-1.5 font-mono text-[11px] text-(--color-text-muted)">
        Sort
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as GuideSortOption)}
          className="rounded border border-(--color-border-strong) bg-(--color-bg-canvas) px-1.5 py-0.5 text-(--color-text-primary) focus:border-(--color-accent) focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-auto font-mono text-[11px] text-(--color-text-muted)">
        <div>{totalCount} candidates</div>
        {filteredCount !== totalCount && <div>{filteredCount} after filters</div>}
      </div>
    </div>
  )
}
