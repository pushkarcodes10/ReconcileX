# @reconcilex/matching

A pure, deterministic, explainable financial transaction matching engine for **ReconcileX**.

> **Note**: This engine is 100% deterministic, rules-based, and explainable. It **does not** use AI, LLMs, machine learning models, or heuristic fuzzy string distance algorithms (e.g. Levenshtein). All decisions are reproducible, auditable, and traceable to explicit reason codes.

---

## Overview

The `@reconcilex/matching` package contains zero runtime external dependencies (no NestJS, no PostgreSQL, no Drizzle, no HTTP, no Redis, and no file IO). It can run synchronously in-process or be embedded within background worker jobs (e.g. BullMQ).

### Core Features

1. **Normalized Input Model**: Accepts transactions with integer minor units for amounts (`amountMinor`), eliminating floating-point errors.
2. **Deterministic Rules & Scoring**:
   - **Rule 1 (Currency Barrier)**: Strict ISO currency equality. Mismatched currencies are immediately ineligible (score `0`, reason `CURRENCY_MISMATCH`).
   - **Rule 2 (Exact Reference + Amount)**: Exact normalized reference + exact amount yields an automatic score of `100` (`EXACT`, reasons `['REFERENCE', 'AMOUNT']`).
   - **Rule 3 (Exact Amount)**: Awards configured amount weight (`+30` pts by default).
   - **Rule 4 (Date Tolerance with Linear Taper)**: Same-day awards full weight (`+20` pts). Differences within `dateToleranceDays` (default 2 days) taper linearly.
   - **Rule 5 (Reference Comparison)**: Exact normalized match awards `+50` pts; substring containment similarity awards `+30` pts (`REFERENCE_SIMILAR`).
   - **Rule 6 (External Identifier Matching)**: Awards `+20` pts if external transaction IDs or merchant/order IDs match across sets.
3. **Greedy 1:1 Matching (`matchTwoSets`)**:
   - Reconciles two transaction arrays (`setA` and `setB`).
   - Generates candidates, filters `NO_MATCH`, and sorts deterministically.
   - Enforces 1:1 matching cardinality so that no transaction matches multiple times.
   - Deterministic tie-breaking on score, classification, date delta, amount delta, and stable IDs.
   - Does not mutate input arrays or objects.
   - Deduplicates duplicate transaction IDs on first occurrence.

---

## Installation & Workspace Usage

Within the ReconcileX monorepo:

```json
{
  "dependencies": {
    "@reconcilex/matching": "workspace:*"
  }
}
```

```ts
import { matchTwoSets, scorePair, classify, DEFAULT_MATCHING_CONFIG } from '@reconcilex/matching';
```

---

## Default Configuration

```ts
export const DEFAULT_MATCHING_CONFIG = {
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
```

Callers can provide partial overrides:

```ts
const customConfig = {
  dateToleranceDays: 3,
  thresholds: {
    potential: 50,
  },
};
```

Configuration is strictly validated to ensure `dateToleranceDays >= 0`, `exact >= potentialStrong >= potential >= 0`, and all weights are non-negative.

---

## Date Taper Formula

Date differences are computed in UTC calendar days to avoid timezone shifts. For differences within `dateToleranceDays`, the score tapers linearly:

$$\text{score} = \text{Math.round}\left(\text{maxDateWeight} \times \left(1 - \frac{\text{dateDifferenceDays}}{\text{toleranceDays} + 1}\right)\right)$$

For default tolerance ($T = 2$) and max date weight ($W = 20$):

| Calendar Difference   | Points Awarded | Percentage of Max Date Weight |
| --------------------- | -------------- | ----------------------------- |
| **0 days** (same day) | **20 pts**     | 100%                          |
| **1 day**             | **13 pts**     | 65%                           |
| **2 days**            | **7 pts**      | 35%                           |
| **> 2 days**          | **0 pts**      | 0%                            |

---

## Classification Tiers

| Score Range  | Classification     | Description                                                          |
| ------------ | ------------------ | -------------------------------------------------------------------- |
| **100**      | `EXACT`            | Automatic match (e.g. Exact Reference + Exact Amount)                |
| **80 – 99**  | `POTENTIAL_STRONG` | High-confidence match (e.g. Amount + Exact Date + Reference Similar) |
| **60 – 79**  | `POTENTIAL`        | Potential match requiring review                                     |
| **Below 60** | `NO_MATCH`         | Unmatched / rejected                                                 |

---

## Standardized Reason Codes

Every scoring decision produces transparent reason codes:

- `REFERENCE`: Exact normalized reference match.
- `REFERENCE_SIMILAR`: One reference contains the other.
- `AMOUNT`: Exact integer amount minor match.
- `DATE`: Transaction date within tolerance window.
- `EXTERNAL_IDENTIFIER`: External transaction ID or merchant/order ID match.
- `CURRENCY_MISMATCH`: Currencies do not match (barrier rule).

---

## Practical Usage Example

```ts
import { matchTwoSets, MatchTransaction } from '@reconcilex/matching';

const internalOrders: MatchTransaction[] = [
  {
    id: 'ord-1001',
    externalId: 'ORD-1001',
    amountMinor: 99900, // ₹999.00
    currency: 'INR',
    transactionDate: '2026-09-15',
    reference: 'ORD-1001',
  },
];

const gatewayTransactions: MatchTransaction[] = [
  {
    id: 'txn-7832',
    externalId: 'TXN-7832',
    amountMinor: 99900, // ₹999.00
    currency: 'INR',
    transactionDate: '2026-09-15',
    reference: 'ORD-1001',
  },
];

const result = matchTwoSets(internalOrders, gatewayTransactions);

console.log(result.acceptedMatches[0]);
// Output:
// {
//   transactionAId: 'ord-1001',
//   transactionBId: 'txn-7832',
//   classification: 'EXACT',
//   score: 100,
//   reasons: ['REFERENCE', 'AMOUNT'],
//   contributions: { amount: 30, date: 20, reference: 50, externalIdentifier: 0 },
//   dateDifferenceDays: 0,
//   ...
// }
```

---

## Known Limitations

- **Scope**: Designed for pairwise (2-source) reconciliation. Multi-source N-way reconciliation (3+ sources simultaneously) is scheduled for a future milestone.
- **Pure Library**: Does not persist results to PostgreSQL or manage transaction lifecycle states. Database orchestration belongs to Phase A6 (`reconciliation_runs` and `matches` tables).
