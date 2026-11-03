import { describe, expect, it } from 'vitest';
import { ExceptionStatus } from '@reconcilex/db';
import {
  ExceptionAction,
  InvalidExceptionTransitionError,
  canTransition,
  getNextStatus,
} from '../src/modules/exceptions/exception-state-machine';

describe('Exception Finite State Machine', () => {
  describe('Valid transitions', () => {
    it('OPEN -> ASSIGN -> ASSIGNED', () => {
      expect(canTransition(ExceptionStatus.OPEN, ExceptionAction.ASSIGN)).toBe(true);
      expect(getNextStatus(ExceptionStatus.OPEN, ExceptionAction.ASSIGN)).toBe(
        ExceptionStatus.ASSIGNED,
      );
    });

    it('OPEN -> START_REVIEW -> UNDER_REVIEW', () => {
      expect(canTransition(ExceptionStatus.OPEN, ExceptionAction.START_REVIEW)).toBe(true);
      expect(getNextStatus(ExceptionStatus.OPEN, ExceptionAction.START_REVIEW)).toBe(
        ExceptionStatus.UNDER_REVIEW,
      );
    });

    it('ASSIGNED -> ASSIGN -> ASSIGNED (reassign)', () => {
      expect(canTransition(ExceptionStatus.ASSIGNED, ExceptionAction.ASSIGN)).toBe(true);
      expect(getNextStatus(ExceptionStatus.ASSIGNED, ExceptionAction.ASSIGN)).toBe(
        ExceptionStatus.ASSIGNED,
      );
    });

    it('ASSIGNED -> START_REVIEW -> UNDER_REVIEW', () => {
      expect(canTransition(ExceptionStatus.ASSIGNED, ExceptionAction.START_REVIEW)).toBe(true);
      expect(getNextStatus(ExceptionStatus.ASSIGNED, ExceptionAction.START_REVIEW)).toBe(
        ExceptionStatus.UNDER_REVIEW,
      );
    });

    it('ASSIGNED -> ESCALATE -> ESCALATED', () => {
      expect(canTransition(ExceptionStatus.ASSIGNED, ExceptionAction.ESCALATE)).toBe(true);
      expect(getNextStatus(ExceptionStatus.ASSIGNED, ExceptionAction.ESCALATE)).toBe(
        ExceptionStatus.ESCALATED,
      );
    });

    it('UNDER_REVIEW -> ASSIGN -> UNDER_REVIEW (reassign)', () => {
      expect(canTransition(ExceptionStatus.UNDER_REVIEW, ExceptionAction.ASSIGN)).toBe(true);
      expect(getNextStatus(ExceptionStatus.UNDER_REVIEW, ExceptionAction.ASSIGN)).toBe(
        ExceptionStatus.UNDER_REVIEW,
      );
    });

    it('UNDER_REVIEW -> ESCALATE -> ESCALATED', () => {
      expect(canTransition(ExceptionStatus.UNDER_REVIEW, ExceptionAction.ESCALATE)).toBe(true);
      expect(getNextStatus(ExceptionStatus.UNDER_REVIEW, ExceptionAction.ESCALATE)).toBe(
        ExceptionStatus.ESCALATED,
      );
    });

    it('UNDER_REVIEW -> RESOLVE -> RESOLVED', () => {
      expect(canTransition(ExceptionStatus.UNDER_REVIEW, ExceptionAction.RESOLVE)).toBe(true);
      expect(getNextStatus(ExceptionStatus.UNDER_REVIEW, ExceptionAction.RESOLVE)).toBe(
        ExceptionStatus.RESOLVED,
      );
    });

    it('ESCALATED -> ASSIGN -> ESCALATED (reassign)', () => {
      expect(canTransition(ExceptionStatus.ESCALATED, ExceptionAction.ASSIGN)).toBe(true);
      expect(getNextStatus(ExceptionStatus.ESCALATED, ExceptionAction.ASSIGN)).toBe(
        ExceptionStatus.ESCALATED,
      );
    });

    it('ESCALATED -> START_REVIEW -> UNDER_REVIEW', () => {
      expect(canTransition(ExceptionStatus.ESCALATED, ExceptionAction.START_REVIEW)).toBe(true);
      expect(getNextStatus(ExceptionStatus.ESCALATED, ExceptionAction.START_REVIEW)).toBe(
        ExceptionStatus.UNDER_REVIEW,
      );
    });

    it('ESCALATED -> RESOLVE -> RESOLVED', () => {
      expect(canTransition(ExceptionStatus.ESCALATED, ExceptionAction.RESOLVE)).toBe(true);
      expect(getNextStatus(ExceptionStatus.ESCALATED, ExceptionAction.RESOLVE)).toBe(
        ExceptionStatus.RESOLVED,
      );
    });

    it('RESOLVED -> REOPEN -> OPEN', () => {
      expect(canTransition(ExceptionStatus.RESOLVED, ExceptionAction.REOPEN)).toBe(true);
      expect(getNextStatus(ExceptionStatus.RESOLVED, ExceptionAction.REOPEN)).toBe(
        ExceptionStatus.OPEN,
      );
    });
  });

  describe('Forbidden transitions', () => {
    it('OPEN -> RESOLVE throws InvalidExceptionTransitionError', () => {
      expect(canTransition(ExceptionStatus.OPEN, ExceptionAction.RESOLVE)).toBe(false);
      expect(() => getNextStatus(ExceptionStatus.OPEN, ExceptionAction.RESOLVE)).toThrow(
        InvalidExceptionTransitionError,
      );
    });

    it('OPEN -> ESCALATE throws InvalidExceptionTransitionError', () => {
      expect(canTransition(ExceptionStatus.OPEN, ExceptionAction.ESCALATE)).toBe(false);
      expect(() => getNextStatus(ExceptionStatus.OPEN, ExceptionAction.ESCALATE)).toThrow(
        InvalidExceptionTransitionError,
      );
    });

    it('ASSIGNED -> RESOLVE throws InvalidExceptionTransitionError', () => {
      expect(canTransition(ExceptionStatus.ASSIGNED, ExceptionAction.RESOLVE)).toBe(false);
      expect(() => getNextStatus(ExceptionStatus.ASSIGNED, ExceptionAction.RESOLVE)).toThrow(
        InvalidExceptionTransitionError,
      );
    });

    it('RESOLVED -> ASSIGN throws InvalidExceptionTransitionError', () => {
      expect(canTransition(ExceptionStatus.RESOLVED, ExceptionAction.ASSIGN)).toBe(false);
      expect(() => getNextStatus(ExceptionStatus.RESOLVED, ExceptionAction.ASSIGN)).toThrow(
        InvalidExceptionTransitionError,
      );
    });

    it('RESOLVED -> START_REVIEW throws InvalidExceptionTransitionError', () => {
      expect(canTransition(ExceptionStatus.RESOLVED, ExceptionAction.START_REVIEW)).toBe(false);
      expect(() => getNextStatus(ExceptionStatus.RESOLVED, ExceptionAction.START_REVIEW)).toThrow(
        InvalidExceptionTransitionError,
      );
    });

    it('RESOLVED -> ESCALATE throws InvalidExceptionTransitionError', () => {
      expect(canTransition(ExceptionStatus.RESOLVED, ExceptionAction.ESCALATE)).toBe(false);
      expect(() => getNextStatus(ExceptionStatus.RESOLVED, ExceptionAction.ESCALATE)).toThrow(
        InvalidExceptionTransitionError,
      );
    });

    it('UNDER_REVIEW -> REOPEN throws InvalidExceptionTransitionError', () => {
      expect(canTransition(ExceptionStatus.UNDER_REVIEW, ExceptionAction.REOPEN)).toBe(false);
      expect(() => getNextStatus(ExceptionStatus.UNDER_REVIEW, ExceptionAction.REOPEN)).toThrow(
        InvalidExceptionTransitionError,
      );
    });
  });
});
