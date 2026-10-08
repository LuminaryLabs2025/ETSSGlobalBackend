import { BadRequestException } from '@nestjs/common';

export const DATE_PRESETS = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
  'CUSTOM',
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

/**
 * Resolves the e-Revenue / OCC date filter. DAILY = since midnight today,
 * WEEKLY / MONTHLY / YEARLY = the last 7 / 30 / 365 days, CUSTOM (or no
 * preset with explicit dates) = date_from 00:00 → date_to 23:59:59.999.
 * Date-only strings are widened to whole days; full ISO timestamps are used
 * as given. No preset and no dates = unbounded.
 */
export function resolveDateRange(params: {
  date_preset?: DatePreset;
  date_from?: string;
  date_to?: string;
}): { from?: Date; to?: Date } {
  const now = new Date();
  switch (params.date_preset) {
    case 'DAILY': {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    case 'WEEKLY':
      return { from: daysAgo(now, 7), to: now };
    case 'MONTHLY':
      return { from: daysAgo(now, 30), to: now };
    case 'YEARLY':
      return { from: daysAgo(now, 365), to: now };
    default: {
      if (params.date_preset === 'CUSTOM' && !params.date_from) {
        throw new BadRequestException(
          'date_from is required when date_preset is CUSTOM',
        );
      }
      const from = params.date_from
        ? parseBoundary(params.date_from, 'start')
        : undefined;
      const to = params.date_to
        ? parseBoundary(params.date_to, 'end')
        : undefined;
      if (from && to && from > to) {
        throw new BadRequestException('date_from must be before date_to');
      }
      return { from, to };
    }
  }
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function parseBoundary(value: string, edge: 'start' | 'end'): Date {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDateOnly
    ? new Date(`${value}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return date;
}
