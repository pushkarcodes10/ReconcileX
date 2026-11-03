import {
  DEFAULT_MATCHING_CONFIG,
  MatchingConfig,
  PartialMatchingConfig,
  resolveAndValidateConfig,
} from './config';
import { MatchClassification } from './types';

/**
 * Classifies a numerical match score into a deterministic confidence tier.
 * Safely maps invalid or negative scores to 'NO_MATCH'.
 */
export function classify(
  score: number,
  config?: PartialMatchingConfig | MatchingConfig,
): MatchClassification {
  if (typeof score !== 'number' || isNaN(score) || score < 0) {
    return 'NO_MATCH';
  }

  const resolved = config ? resolveAndValidateConfig(config) : DEFAULT_MATCHING_CONFIG;

  const { exact, potentialStrong, potential } = resolved.thresholds;

  if (score >= exact) {
    return 'EXACT';
  }
  if (score >= potentialStrong) {
    return 'POTENTIAL_STRONG';
  }
  if (score >= potential) {
    return 'POTENTIAL';
  }
  return 'NO_MATCH';
}
