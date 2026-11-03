import { PaginatedResult } from './types';

export interface RawPaginatedWithMeta<T> {
  data: T[];
  meta: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasMore?: boolean;
    count?: number;
  };
}

export interface RawPaginatedFlat<T> {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasMore?: boolean;
}

export function normalizePagination<T>(
  response: RawPaginatedWithMeta<T> | RawPaginatedFlat<T> | T[] | unknown,
  fallbackPage = 1,
  fallbackLimit = 20
): PaginatedResult<T> {
  if (!response) {
    return {
      items: [],
      total: 0,
      page: fallbackPage,
      limit: fallbackLimit,
      totalPages: 1,
      hasMore: false,
    };
  }

  // Handle plain array response (e.g. data-sources without page/limit params)
  if (Array.isArray(response)) {
    return {
      items: response as T[],
      total: response.length,
      page: 1,
      limit: response.length || fallbackLimit,
      totalPages: 1,
      hasMore: false,
    };
  }

  const obj = response as Record<string, any>;
  const items = Array.isArray(obj.data) ? (obj.data as T[]) : [];

  // Check nested meta structure { data, meta }
  if (obj.meta && typeof obj.meta === 'object') {
    const total = Number(obj.meta.total ?? obj.meta.count ?? items.length);
    const page = Number(obj.meta.page ?? fallbackPage);
    const limit = Number(obj.meta.limit ?? fallbackLimit);
    const totalPages = Number(obj.meta.totalPages ?? Math.max(1, Math.ceil(total / (limit || 1))));
    const hasMore = typeof obj.meta.hasMore === 'boolean' ? obj.meta.hasMore : page < totalPages;

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasMore,
    };
  }

  // Check flat structure { data, total, page, limit, totalPages }
  const total = Number(obj.total ?? items.length);
  const page = Number(obj.page ?? fallbackPage);
  const limit = Number(obj.limit ?? fallbackLimit);
  const totalPages = Number(obj.totalPages ?? Math.max(1, Math.ceil(total / (limit || 1))));
  const hasMore = typeof obj.hasMore === 'boolean' ? obj.hasMore : page < totalPages;

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasMore,
  };
}
