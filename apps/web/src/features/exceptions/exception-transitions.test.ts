import { describe, it, expect } from 'vitest';
import { ExceptionStatus } from '../../api/types';

function computeAllowedActions(status: ExceptionStatus) {
  const isResolved = status === 'RESOLVED';
  return {
    canStartReview: !isResolved && (status === 'OPEN' || status === 'ASSIGNED' || status === 'ESCALATED'),
    canEscalate: !isResolved && (status === 'ASSIGNED' || status === 'UNDER_REVIEW'),
    canResolve: !isResolved && (status === 'UNDER_REVIEW' || status === 'ESCALATED'),
    canReopen: isResolved,
    canAssign: !isResolved,
  };
}

describe('Exception FSM Action Permissions', () => {
  it('allows START_REVIEW and assign on OPEN exceptions', () => {
    const actions = computeAllowedActions('OPEN');
    expect(actions.canStartReview).toBe(true);
    expect(actions.canEscalate).toBe(false);
    expect(actions.canResolve).toBe(false);
    expect(actions.canReopen).toBe(false);
    expect(actions.canAssign).toBe(true);
  });

  it('allows START_REVIEW, ESCALATE, and assign on ASSIGNED exceptions', () => {
    const actions = computeAllowedActions('ASSIGNED');
    expect(actions.canStartReview).toBe(true);
    expect(actions.canEscalate).toBe(true);
    expect(actions.canResolve).toBe(false);
    expect(actions.canReopen).toBe(false);
    expect(actions.canAssign).toBe(true);
  });

  it('allows ESCALATE, RESOLVE, and assign on UNDER_REVIEW exceptions', () => {
    const actions = computeAllowedActions('UNDER_REVIEW');
    expect(actions.canStartReview).toBe(false);
    expect(actions.canEscalate).toBe(true);
    expect(actions.canResolve).toBe(true);
    expect(actions.canReopen).toBe(false);
    expect(actions.canAssign).toBe(true);
  });

  it('allows START_REVIEW, RESOLVE, and assign on ESCALATED exceptions', () => {
    const actions = computeAllowedActions('ESCALATED');
    expect(actions.canStartReview).toBe(true);
    expect(actions.canEscalate).toBe(false);
    expect(actions.canResolve).toBe(true);
    expect(actions.canReopen).toBe(false);
    expect(actions.canAssign).toBe(true);
  });

  it('allows only REOPEN on RESOLVED exceptions and blocks assignment', () => {
    const actions = computeAllowedActions('RESOLVED');
    expect(actions.canStartReview).toBe(false);
    expect(actions.canEscalate).toBe(false);
    expect(actions.canResolve).toBe(false);
    expect(actions.canReopen).toBe(true);
    expect(actions.canAssign).toBe(false);
  });
});
