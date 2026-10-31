# ADR 002: JWT Authentication via httpOnly Secure Cookies

## Status

Accepted

## Context

ReconcileX handles sensitive financial transactions. Storing access or refresh tokens in browser `localStorage` exposes organizations to Cross-Site Scripting (XSS) token exfiltration.

## Decision

Use short-lived JWT access tokens (15 minutes) and rotating refresh tokens (7 days) delivered exclusively via `httpOnly`, `Secure`, `SameSite=Lax` cookies.

## Consequences

- Single-page application clients must send requests with credentials included (`credentials: 'include'`).
- Prevents script-based access to session tokens.
- Cross-Site Request Forgery (CSRF) is mitigated by `SameSite` cookie policy and state-changing request checks.
