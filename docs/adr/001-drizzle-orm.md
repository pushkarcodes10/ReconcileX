# ADR 001: Use Drizzle ORM for Data Access

## Status

Accepted

## Context

ReconcileX requires high-throughput bulk inserts during CSV ingestion, complex matching queries across large transaction sets, and deterministic SQL migrations without runtime ORM overhead or leaky abstractions.

## Decision

Adopt Drizzle ORM as the primary SQL query builder and schema management tool.

- TypeScript-first schema definitions.
- Zero-overhead SQL generation with direct access to PostgreSQL features.
- Explicit migrations managed via `drizzle-kit`.
- Native support for connection pools and transaction boundaries.

## Consequences

- Requires writing idiomatic SQL-like queries rather than relying on Active Record or heavy repository magic.
- Clean separation between pure database schema definitions (`packages/db`) and application business logic.
