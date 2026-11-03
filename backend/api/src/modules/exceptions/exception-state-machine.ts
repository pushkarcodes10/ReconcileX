import { ConflictException } from '@nestjs/common';
import { ExceptionStatus } from '@reconcilex/db';

export const ExceptionAction = {
  ASSIGN: 'ASSIGN',
  START_REVIEW: 'START_REVIEW',
  ESCALATE: 'ESCALATE',
  RESOLVE: 'RESOLVE',
  REOPEN: 'REOPEN',
} as const;

export type ExceptionAction = (typeof ExceptionAction)[keyof typeof ExceptionAction];

export class InvalidExceptionTransitionError extends ConflictException {
  constructor(currentStatus: string, action: string) {
    super({
      statusCode: 409,
      error: 'Conflict',
      message: `Invalid state transition from ${currentStatus} via action ${action}`,
      code: 'INVALID_EXCEPTION_TRANSITION',
    });
  }
}

const TRANSITION_TABLE: Record<
  ExceptionStatus,
  Partial<Record<ExceptionAction, ExceptionStatus>>
> = {
  [ExceptionStatus.OPEN]: {
    [ExceptionAction.ASSIGN]: ExceptionStatus.ASSIGNED,
    [ExceptionAction.START_REVIEW]: ExceptionStatus.UNDER_REVIEW,
  },
  [ExceptionStatus.ASSIGNED]: {
    [ExceptionAction.ASSIGN]: ExceptionStatus.ASSIGNED,
    [ExceptionAction.START_REVIEW]: ExceptionStatus.UNDER_REVIEW,
    [ExceptionAction.ESCALATE]: ExceptionStatus.ESCALATED,
  },
  [ExceptionStatus.UNDER_REVIEW]: {
    [ExceptionAction.ASSIGN]: ExceptionStatus.UNDER_REVIEW,
    [ExceptionAction.ESCALATE]: ExceptionStatus.ESCALATED,
    [ExceptionAction.RESOLVE]: ExceptionStatus.RESOLVED,
  },
  [ExceptionStatus.ESCALATED]: {
    [ExceptionAction.ASSIGN]: ExceptionStatus.ESCALATED,
    [ExceptionAction.START_REVIEW]: ExceptionStatus.UNDER_REVIEW,
    [ExceptionAction.RESOLVE]: ExceptionStatus.RESOLVED,
  },
  [ExceptionStatus.RESOLVED]: {
    [ExceptionAction.REOPEN]: ExceptionStatus.OPEN,
  },
};

export function canTransition(currentStatus: ExceptionStatus, action: ExceptionAction): boolean {
  return TRANSITION_TABLE[currentStatus]?.[action] !== undefined;
}

export function getNextStatus(
  currentStatus: ExceptionStatus,
  action: ExceptionAction,
): ExceptionStatus {
  const next = TRANSITION_TABLE[currentStatus]?.[action];
  if (!next) {
    throw new InvalidExceptionTransitionError(currentStatus, action);
  }
  return next;
}
