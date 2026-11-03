import {
  Exception,
  ExceptionComment,
  ExceptionStatus,
  NewException,
  ResolutionAction,
} from '@reconcilex/db';
import { QueryExceptionsDto } from '../dto/query-exceptions.dto';

export const EXCEPTIONS_REPOSITORY = 'EXCEPTIONS_REPOSITORY';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface TransactionSummary {
  id: string;
  externalId: string;
  amountMinor: number;
  currency: string;
  transactionDate: Date;
  reference: string | null;
}

export interface RunSummary {
  id: string;
  displayId: string;
  status: string;
}

export interface ExceptionCommentWithAuthor extends ExceptionComment {
  author?: UserSummary | null;
}

export interface ExceptionWithDetails extends Exception {
  run?: RunSummary | null;
  transaction?: TransactionSummary | null;
  assignee?: UserSummary | null;
  resolver?: UserSummary | null;
  commentsCount?: number;
}

export interface ExceptionDetailWithComments extends ExceptionWithDetails {
  comments: ExceptionCommentWithAuthor[];
}

export interface IExceptionsRepository {
  createMany(items: NewException[]): Promise<Exception[]>;
  findById(orgId: string, id: string): Promise<Exception | null>;
  findDetailById(orgId: string, id: string): Promise<ExceptionDetailWithComments | null>;
  findMany(
    orgId: string,
    query: QueryExceptionsDto,
  ): Promise<{ data: ExceptionWithDetails[]; total: number }>;
  assign(
    orgId: string,
    id: string,
    assigneeId: string,
    nextStatus: ExceptionStatus,
  ): Promise<ExceptionWithDetails>;
  updateStatus(
    orgId: string,
    id: string,
    nextStatus: ExceptionStatus,
    resolution?: {
      reason?: string | null;
      action?: ResolutionAction | null;
      resolvedBy?: string | null;
      resolvedAt?: Date | null;
    },
  ): Promise<ExceptionWithDetails>;
  addComment(
    orgId: string,
    exceptionId: string,
    authorId: string,
    body: string,
  ): Promise<ExceptionCommentWithAuthor>;
  findComments(orgId: string, exceptionId: string): Promise<ExceptionCommentWithAuthor[]>;
}
