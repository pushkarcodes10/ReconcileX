export interface MatchThresholds {
  exact: number; // default: 100
  potentialStrong: number; // default: 80
  potential: number; // default: 60
}

export interface MatchWeights {
  amount: number; // default: 30
  date: number; // default: 20
  reference: number; // default: 50
  externalIdentifier: number; // default: 20
  referenceSimilar?: number; // default: 30 (smaller similarity contribution)
}

export interface MatchingConfig {
  dateToleranceDays: number; // default: 2
  thresholds: MatchThresholds;
  weights: MatchWeights;
}

export type PartialMatchingConfig = {
  dateToleranceDays?: number;
  thresholds?: Partial<MatchThresholds>;
  weights?: Partial<MatchWeights>;
};

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  dateToleranceDays: 2,
  thresholds: {
    exact: 100,
    potentialStrong: 80,
    potential: 60,
  },
  weights: {
    amount: 30,
    date: 20,
    reference: 50,
    externalIdentifier: 20,
    referenceSimilar: 30,
  },
};

/**
 * Validates and merges caller-supplied overrides with default matching configuration.
 * Enforces non-negative tolerances and sensible threshold ordering.
 */
export function resolveAndValidateConfig(customConfig?: PartialMatchingConfig): MatchingConfig {
  if (!customConfig) {
    return DEFAULT_MATCHING_CONFIG;
  }

  const resolved: MatchingConfig = {
    dateToleranceDays: customConfig.dateToleranceDays ?? DEFAULT_MATCHING_CONFIG.dateToleranceDays,
    thresholds: {
      ...DEFAULT_MATCHING_CONFIG.thresholds,
      ...(customConfig.thresholds ?? {}),
    },
    weights: {
      ...DEFAULT_MATCHING_CONFIG.weights,
      ...(customConfig.weights ?? {}),
    },
  };

  if (
    typeof resolved.dateToleranceDays !== 'number' ||
    isNaN(resolved.dateToleranceDays) ||
    resolved.dateToleranceDays < 0
  ) {
    throw new Error(
      `Invalid matching configuration: dateToleranceDays must be a non-negative number (got ${resolved.dateToleranceDays})`,
    );
  }

  const { exact, potentialStrong, potential } = resolved.thresholds;
  if (
    typeof exact !== 'number' ||
    typeof potentialStrong !== 'number' ||
    typeof potential !== 'number' ||
    isNaN(exact) ||
    isNaN(potentialStrong) ||
    isNaN(potential)
  ) {
    throw new Error(
      'Invalid matching configuration: all thresholds (exact, potentialStrong, potential) must be numbers',
    );
  }

  if (exact < potentialStrong || potentialStrong < potential || potential < 0) {
    throw new Error(
      `Invalid matching configuration: thresholds must satisfy exact >= potentialStrong >= potential >= 0 (got exact=${exact}, potentialStrong=${potentialStrong}, potential=${potential})`,
    );
  }

  for (const [key, val] of Object.entries(resolved.weights)) {
    if (typeof val === 'number' && (isNaN(val) || val < 0)) {
      throw new Error(
        `Invalid matching configuration: weight '${key}' must be a non-negative number (got ${val})`,
      );
    }
  }

  return resolved;
}
