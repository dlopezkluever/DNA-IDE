export const SS_COLOR: Record<'helix' | 'sheet' | 'coil', string> = {
  helix: 'var(--color-warn)', // amber
  sheet: 'var(--color-info)', // blue
  coil: 'var(--color-text-secondary)', // gray
}

// Reuses --color-danger for "buried" — the one place a status hue is repurposed for a
// non-status meaning (§3.6/§7 of the protein-structure-viewer spec, flagged as an open
// decision rather than asserted as obviously correct). Burial coloring and consequence/
// mutation coloring never appear in the same view at the same time, so there's no direct
// visual collision — just a learned-association risk worth a second look once on screen.
export const BURIAL_COLOR: Record<'buried' | 'intermediate' | 'exposed', string> = {
  buried: 'var(--color-danger)',
  intermediate: 'var(--color-warn)',
  exposed: 'var(--color-info)',
}
