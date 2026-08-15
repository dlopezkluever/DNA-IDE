import type { Feature } from '../types/models'
import type { FeatureMatcher } from './types'

/**
 * GenBank-parsed feature ids are minted fresh (nanoid) on every parse (src/parsers/genbank.ts),
 * so a scenario's target/protected features can't be referenced by a fixed id in static data —
 * they're matched by name+type against whichever construct was just loaded. Must be called again
 * after every reset, never cached across attempts.
 */
export function resolveFeature(matcher: FeatureMatcher, features: Feature[]): Feature | null {
  return features.find((f) => f.name === matcher.name && f.type === matcher.type) ?? null
}
