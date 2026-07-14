import {
  Brackets,
  ObjectLiteral,
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';

export type PaginatedResult<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; total_pages: number };
};

/**
 * Paginates a query builder and returns data plus consistent meta. Shared by the
 * Fines, DTTR, Bookings and Utility Tickets modules (mirrors operations-shared).
 */
export function paginateQueryBuilder<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page = 1,
  limit = 20,
): Promise<PaginatedResult<T>> {
  const safePage = page > 0 ? page : 1;
  const safeLimit = limit > 0 ? Math.min(limit, 100) : 20;
  return qb
    .clone()
    .getCount()
    .then((total) =>
      qb
        .skip((safePage - 1) * safeLimit)
        .take(safeLimit)
        .getMany()
        .then((data) => ({
          data,
          meta: {
            total,
            page: safePage,
            limit: safeLimit,
            total_pages: Math.ceil(total / safeLimit),
          },
        })),
    );
}

/** Applies a case-insensitive OR search across the given columns. */
export function applySearch(
  qb: SelectQueryBuilder<ObjectLiteral>,
  alias: string,
  columns: string[],
  search?: string,
) {
  if (!search?.trim()) return;
  const term = `%${search.trim()}%`;
  qb.andWhere(
    new Brackets((where) => {
      columns.forEach((col, i) => {
        const clause = `${alias}.${col} ILIKE :search`;
        if (i === 0) where.where(clause, { search: term });
        else where.orWhere(clause, { search: term });
      });
    }),
  );
}

export async function requireEntity<T extends ObjectLiteral & { id: string }>(
  repository: Repository<T>,
  id: string,
  message: string,
): Promise<T> {
  const row = await repository.findOne({ where: { id } as never });
  if (!row) throw new NotFoundException(message);
  return row;
}

export async function saveWithConflict<T extends ObjectLiteral>(
  repository: Repository<T>,
  entity: T,
  message?: string,
): Promise<T> {
  try {
    return await repository.save(entity);
  } catch (error) {
    if (
      message &&
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code === '23505'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}

/**
 * Computes the next sequential public code (e.g. PEN-001) for the given column
 * by taking MAX of the numeric suffix and incrementing. `padding` controls the
 * zero-padded width of the numeric portion.
 */
export async function nextSequentialCode(
  repository: Repository<ObjectLiteral>,
  column: string,
  prefix: string,
  padding = 3,
): Promise<string> {
  const raw = await repository
    .createQueryBuilder('row')
    .select(
      `MAX(CAST(SUBSTRING(row.${column} FROM ${prefix.length + 2}) AS INTEGER))`,
      'max',
    )
    .where(`row.${column} ~ '^${prefix}-[0-9]+$'`)
    .getRawOne<{ max: string | null }>();
  const next = (raw?.max ? Number(raw.max) : 0) + 1;
  return `${prefix}-${String(next).padStart(padding, '0')}`;
}

/** Serializes rows into a CSV string, escaping cells as needed. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(','),
    )
    .join('\n');
}
