import { describe, it, expect } from 'vitest';
import { normalizePagination } from './pagination';

describe('normalizePagination', () => {
  it('normalizes flat paginated response', () => {
    const raw = {
      data: [{ id: '1' }, { id: '2' }],
      total: 10,
      page: 1,
      limit: 2,
      totalPages: 5,
      hasMore: true,
    };

    const normalized = normalizePagination(raw);
    expect(normalized.items).toEqual([{ id: '1' }, { id: '2' }]);
    expect(normalized.total).toBe(10);
    expect(normalized.page).toBe(1);
    expect(normalized.limit).toBe(2);
    expect(normalized.totalPages).toBe(5);
    expect(normalized.hasMore).toBe(true);
  });

  it('normalizes nested meta response', () => {
    const raw = {
      data: [{ id: 'a' }],
      meta: {
        total: 25,
        page: 3,
        limit: 10,
        totalPages: 3,
        hasMore: false,
      },
    };

    const normalized = normalizePagination(raw);
    expect(normalized.items).toEqual([{ id: 'a' }]);
    expect(normalized.total).toBe(25);
    expect(normalized.page).toBe(3);
    expect(normalized.limit).toBe(10);
    expect(normalized.totalPages).toBe(3);
    expect(normalized.hasMore).toBe(false);
  });

  it('normalizes raw array response', () => {
    const raw = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const normalized = normalizePagination(raw);

    expect(normalized.items).toEqual(raw);
    expect(normalized.total).toBe(3);
    expect(normalized.page).toBe(1);
    expect(normalized.limit).toBe(3);
    expect(normalized.totalPages).toBe(1);
    expect(normalized.hasMore).toBe(false);
  });

  it('handles empty or null response gracefully', () => {
    const normalized = normalizePagination(null);
    expect(normalized.items).toEqual([]);
    expect(normalized.total).toBe(0);
    expect(normalized.totalPages).toBe(1);
  });
});
