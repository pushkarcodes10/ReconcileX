import React from 'react';

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

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 0',
        marginTop: '1rem',
        borderTop: '1px solid #eee',
      }}
    >
      <div style={{ fontSize: '0.9rem', color: '#666' }}>
        Page {page} of {Math.max(totalPages, 1)} ({total} total results)
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          style={{ padding: '0.3rem 0.6rem' }}
        >
          &larr; Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          style={{ padding: '0.3rem 0.6rem' }}
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
};
