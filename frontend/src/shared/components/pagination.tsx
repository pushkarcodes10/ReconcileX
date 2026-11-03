import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (newPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}) => {
  if (totalPages <= 1 && total <= limit) {
    return null;
  }

  const startRecord = Math.min((page - 1) * limit + 1, total);
  const endRecord = Math.min(page * limit, total);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.85rem 1.25rem',
        borderTop: '1px solid var(--rx-border)',
        backgroundColor: 'var(--rx-surface)',
        fontSize: '0.8125rem',
        color: 'var(--rx-text-secondary)',
      }}
    >
      <div>
        Showing <strong style={{ color: 'var(--rx-text-primary)' }}>{startRecord}-{endRecord}</strong> of{' '}
        <strong style={{ color: 'var(--rx-text-primary)' }}>{total}</strong> records (Page {page} of {Math.max(totalPages, 1)})
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rx-btn rx-btn-secondary rx-btn-sm"
          style={{ padding: '0.35rem 0.65rem' }}
        >
          <ChevronLeftIcon size={14} /> Previous
        </button>

        <span
          style={{
            padding: '0.2rem 0.6rem',
            backgroundColor: 'var(--rx-surface-muted)',
            borderRadius: 'var(--rx-radius-sm)',
            fontWeight: 700,
            color: 'var(--rx-text-primary)',
            fontSize: '0.8125rem',
          }}
        >
          {page} / {Math.max(totalPages, 1)}
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rx-btn rx-btn-secondary rx-btn-sm"
          style={{ padding: '0.35rem 0.65rem' }}
        >
          Next <ChevronRightIcon size={14} />
        </button>
      </div>
    </div>
  );
};
