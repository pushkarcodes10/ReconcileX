# ADR 006: Duplicate Flagging and Quarantine Policy

## Status

Accepted

## Context

Financial data frequently contains repeated transactions. Some represent true duplicates caused by system retries or accidental re-ingestion, while others represent legitimate recurring charges (e.g., dual monthly subscription payments or split invoices).

## Decision

Do not automatically delete suspected duplicate transactions. Instead:

- Detect duplicates based on natural business keys (`external_id`, reference, timestamp proximity, amount).
- Flag and isolate duplicates into a `duplicate_candidates` quarantine table with status `FLAGGED`.
- Allow finance analysts and managers to inspect and either dismiss or confirm duplicates.

## Consequences

- Prevents silent data loss of legitimate business records.
- Provides complete transparency and auditability for financial reconciliation.
