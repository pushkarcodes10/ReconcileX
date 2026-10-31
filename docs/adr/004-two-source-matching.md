# ADR 004: Exactly Two Data Sources Per Reconciliation Run

## Status

Accepted

## Context

Organizations need to reconcile transactions originating from different systems (e.g., internal orders vs. payment gateway, or payment gateway vs. bank payouts). Reconciling arbitrary N-way multi-system records simultaneously introduces non-linear complexity and combinatorial explosion in exception classification.

## Decision

Scope each reconciliation run to exactly two data sources (Source A and Source B) with a pairwise matching model. Complex 3-way cycles (Order -> Gateway -> Bank) are executed as chained or composite two-way runs (Run 1: Order vs Gateway, Run 2: Gateway vs Bank).

## Consequences

- Clean, deterministic rule execution with unambiguous source attribution (`transaction_a_id`, `transaction_b_id`).
- Clear reason codes and confidence scores.
- Easily extensible to composite reconciliation workflows in future milestones.
