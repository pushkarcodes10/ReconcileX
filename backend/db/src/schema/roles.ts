export const Role = {
  ADMIN: 'ADMIN',
  FINANCE_MANAGER: 'FINANCE_MANAGER',
  ANALYST: 'ANALYST',
  AUDITOR: 'AUDITOR',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
