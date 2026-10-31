# ADR 003: Monetary Storage in Integer Minor Units

## Status

Accepted

## Context

Financial calculations using standard IEEE 754 floating-point numbers (`FLOAT`, `DOUBLE PRECISION`) suffer from binary rounding errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). In transaction reconciliation, exact equality comparisons are critical.

## Decision

Represent all monetary values as `BIGINT` minor units (e.g., cents, paise, pence) paired with an ISO-4217 three-letter currency code (`CHAR(3)`).

## Consequences

- No floating-point rounding errors during matching or aggregations.
- Conversions to standard currency formats (e.g., $10.50 -> 1050) happen strictly at the presentation / API boundary.
