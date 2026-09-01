/**
 * Priority + legacy-field derivation for the SuperAdmin booking-creation
 * flows. Pure functions, no DI — kept separate from bookings.service.ts so
 * the ranking/derivation rules (straight out of the Prioritization of
 * Bookings doc) are easy to find and unit test on their own.
 */

export type BookingTypeCode =
  | 'BONDED_TERMINAL'
  | 'TRUCK_PARK'
  | 'FISH_VAN_PARK'
  | 'EPT';

export type LegacyBookingCategory = 'IMPORT' | 'EXPORT' | 'EMPTY' | 'DOMESTIC';
export type LegacyTransferType =
  | 'INBOUND'
  | 'OUTBOUND'
  | 'INTER_TERMINAL'
  | 'EMPTY_RETURN'
  | 'LOCAL';

export interface PriorityInput {
  booking_type: BookingTypeCode;
  booking_category_name?: string | null;
  terminal_type?: string | null;
}

export interface PriorityResult {
  priority_rank: number;
  priority_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

const EXPORT_CATEGORY_NAMES = new Set([
  'export container',
  'export non-containerized',
]);

/**
 * Doc tiers, applied to what the Booking entity actually models:
 * 1 (HIGH)   — Fish & all Export bookings (incl. EPT, which is inherently
 *              export-processing).
 * 2 (MEDIUM) — Port Terminal destination bookings.
 * 3 (MEDIUM) — Non-Port Terminal destination bookings.
 * Utility-ticket tiers (4/5) are out of scope here — UtilityTicket already
 * has its own independent `booking_priority` field.
 */
export function computePriority(input: PriorityInput): PriorityResult {
  if (input.booking_type === 'FISH_VAN_PARK' || input.booking_type === 'EPT') {
    return { priority_rank: 1, priority_level: 'HIGH' };
  }
  const category = input.booking_category_name?.trim().toLowerCase();
  if (category && EXPORT_CATEGORY_NAMES.has(category)) {
    return { priority_rank: 1, priority_level: 'HIGH' };
  }
  if (input.terminal_type === 'PORT_TERMINAL') {
    return { priority_rank: 2, priority_level: 'MEDIUM' };
  }
  return { priority_rank: 3, priority_level: 'MEDIUM' };
}

const CATEGORY_TO_LEGACY: Record<string, LegacyBookingCategory> = {
  'import container': 'IMPORT',
  'import non-containerized': 'IMPORT',
  'export container': 'EXPORT',
  'export non-containerized': 'EXPORT',
  'empty container': 'EMPTY',
  'fmcg (non-port)': 'DOMESTIC',
  fish: 'EXPORT',
};

/**
 * The pre-existing `bookings.booking_category` column is a 4-value CHECK
 * (IMPORT/EXPORT/EMPTY/DOMESTIC) kept for backward compatibility with the
 * existing All Bookings filters — this maps the richer catalog category
 * name (or EPT, which has no category at all) down onto it.
 */
export function deriveLegacyCategory(
  bookingType: BookingTypeCode,
  categoryName?: string | null,
): LegacyBookingCategory {
  if (bookingType === 'EPT') return 'EXPORT';
  const mapped = categoryName
    ? CATEGORY_TO_LEGACY[categoryName.trim().toLowerCase()]
    : undefined;
  return mapped ?? 'DOMESTIC';
}

const CATEGORY_TO_TRANSFER: Record<string, LegacyTransferType> = {
  'import container': 'INBOUND',
  'import non-containerized': 'INBOUND',
  'export container': 'OUTBOUND',
  'export non-containerized': 'OUTBOUND',
  'empty container': 'EMPTY_RETURN',
  'fmcg (non-port)': 'LOCAL',
};

const EPT_OPERATION_TO_TRANSFER: Record<string, LegacyTransferType> = {
  LOADED_EXPORT_DELIVERY: 'OUTBOUND',
  EMPTY_CONTAINER_DELIVERY: 'EMPTY_RETURN',
  VERIFIED_EXPORT_COLLECTION: 'OUTBOUND',
  LOADED_DELIVERY_WITH_COLLECTION: 'INTER_TERMINAL',
};

export function deriveLegacyTransferType(
  bookingType: BookingTypeCode,
  categoryName?: string | null,
  eptOperationType?: string | null,
): LegacyTransferType {
  if (bookingType === 'EPT') {
    const mapped = eptOperationType
      ? EPT_OPERATION_TO_TRANSFER[eptOperationType]
      : undefined;
    return mapped ?? 'OUTBOUND';
  }
  if (bookingType === 'FISH_VAN_PARK') return 'LOCAL';
  const mapped = categoryName
    ? CATEGORY_TO_TRANSFER[categoryName.trim().toLowerCase()]
    : undefined;
  return mapped ?? 'LOCAL';
}
