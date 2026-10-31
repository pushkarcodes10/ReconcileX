# ADR 005: JobService Abstraction for Asynchronous Workloads

## Status

Accepted

## Context

Reconciliation and CSV processing are CPU-intensive operations that must eventually run on distributed background workers. However, Milestone A focuses on core API correctness and deterministic matching without adding Redis and BullMQ infrastructure dependencies on day one.

## Decision

Introduce a `JobService` interface with a `jobs` database table as the source of truth for job lifecycle, progress tracking, idempotency, and state persistence.

- In Milestone A, `JobService` executes jobs in-process (synchronously or via event-loop deferral).
- In Milestone B, the same `JobService` interface swaps to BullMQ background workers with Redis without altering controller or domain logic.

## Consequences

- No day-one Redis dependency for running tests or standard API workflows.
- Zero architectural refactoring required when distributed workers are introduced in Milestone B.
