/** Shared shape rendered as a thin tick mark by both LinearFeatureMap and CircularPlasmidView.
 * Used by ScenarioView (§3.5) to surface CRISPR candidates and the objective feature on the
 * actual plasmid map — a natural, low-cost follow-up for CRISPRView/RestrictionView too, but not
 * required for either to keep working (both simply omit the optional `markers` prop). */
export interface MapMarker {
  position: number
  /** A var(--color-*) token, used directly as an SVG stroke color. */
  color: string
  label: string
  onClick?: () => void
}
