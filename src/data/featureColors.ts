import type { FeatureType } from '../types/models'

export const FEATURE_TYPE_COLOR: Record<FeatureType, string> = {
  gene: 'var(--color-info)',
  CDS: 'var(--color-accent)',
  promoter: 'var(--color-warn)',
  terminator: 'var(--color-danger)',
  origin: 'var(--color-text-secondary)',
  regulatory: 'var(--color-base-g)',
  misc: 'var(--color-text-muted)',
}
