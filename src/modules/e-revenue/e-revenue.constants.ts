import type { PaymentType } from '../../database/entities';
import type { RevenueSplit } from '../../database/entities/payments.entities';

/** Revenue recipients, in the fee-schedule column order. */
export const REVENUE_RECIPIENTS: { key: keyof RevenueSplit; label: string }[] =
  [
    { key: 'facility', label: 'Facility' },
    { key: 'transit_park', label: 'Transit Park / Pregate' },
    { key: 'npa', label: 'NPA' },
    { key: 'etss', label: 'Maritime ETSS' },
    { key: 'tow_company', label: 'Tow Truck Company' },
  ];

/** A PaymentType's revenue-recipient percentages as a fee-line split snapshot. */
export function paymentTypeSplit(
  row: Pick<
    PaymentType,
    | 'facility_percentage'
    | 'transit_park_percentage'
    | 'npa_percentage'
    | 'etss_percentage'
    | 'tow_company_percentage'
  >,
): RevenueSplit {
  return {
    facility: Number(row.facility_percentage ?? 0),
    transit_park: Number(row.transit_park_percentage ?? 0),
    npa: Number(row.npa_percentage ?? 0),
    etss: Number(row.etss_percentage ?? 100),
    tow_company: Number(row.tow_company_percentage ?? 0),
  };
}

export const PAYMENT_SOURCES = [
  'BOOKING',
  'UTILITY_TICKET',
  'PENALTY',
  'TOW_TRUCK_REQUEST',
  'DEMURRAGE',
] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  BOOKING: 'Bookings',
  UTILITY_TICKET: 'Utility Tickets',
  PENALTY: 'Penalties',
  TOW_TRUCK_REQUEST: 'Tow Truck Requests',
  DEMURRAGE: 'Demurrage',
};

/**
 * Invoice.payable_type → e-Revenue payment source. Only BOOKING raises
 * invoices today; utility tickets, penalties, tow requests and demurrage
 * start flowing into the ledger as soon as their modules raise invoices
 * with these payable types (and RevenueLedgerService gets a context
 * resolver for them).
 */
export const PAYABLE_TYPE_TO_SOURCE: Record<string, PaymentSource> = {
  BOOKING: 'BOOKING',
  UTILITY_TICKET: 'UTILITY_TICKET',
  PENALTY: 'PENALTY',
  TOW_TRUCK_REQUEST: 'TOW_TRUCK_REQUEST',
  DEMURRAGE: 'DEMURRAGE',
};

export const PAYMENT_METHODS = [
  'CARD',
  'BANK_TRANSFER',
  'USSD',
  'WALLET',
  'PAYSTACK',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const REVENUE_STATUSES = [
  'PENDING',
  'SUCCESSFUL',
  'FAILED',
  'ABANDONED',
] as const;

/** Maps a Paystack `channel` to the e-Revenue payment method. PAYSTACK = channel not (yet) reported. */
export function paymentMethodFromChannel(
  channel: string | null | undefined,
): PaymentMethod {
  switch ((channel ?? '').toLowerCase()) {
    case 'card':
      return 'CARD';
    case 'bank':
    case 'bank_transfer':
    case 'dedicated_nuban':
      return 'BANK_TRANSFER';
    case 'ussd':
      return 'USSD';
    case 'wallet':
      return 'WALLET';
    default:
      return 'PAYSTACK';
  }
}

/** Route ids match the frontend's ERevenueModule ("etss" | "npa" | "facilities" | "transit" | "tow"). */
export const REVENUE_MODULES = [
  'etss',
  'npa',
  'facilities',
  'transit',
  'tow',
] as const;
export type RevenueModule = (typeof REVENUE_MODULES)[number];

export type ShareColumn =
  | 'etss_share'
  | 'npa_share'
  | 'facility_share'
  | 'transit_park_share'
  | 'tow_company_share';

export interface RevenueModuleConfig {
  title: string;
  /** The share this tab reports as "Amount Due to …". */
  dueColumn: ShareColumn;
  /** Column amount_min/amount_max filter on (the amount the tab displays). */
  amountColumn: 'amount_paid' | ShareColumn;
  /** Sources this tab shows cards for (and restricts the ledger to). */
  sources: PaymentSource[];
  /** Extra WHERE restricting the ledger to rows this beneficiary earns from. */
  where?: string;
  /** Pie chart grouping. */
  breakdown:
    | { kind: 'source' }
    | { kind: 'beneficiary'; idColumn: string; nameColumn: string };
}

export const REVENUE_MODULE_CONFIG: Record<RevenueModule, RevenueModuleConfig> =
  {
    etss: {
      title: 'Maritime-ETSS',
      dueColumn: 'etss_share',
      amountColumn: 'amount_paid',
      sources: [...PAYMENT_SOURCES],
      breakdown: { kind: 'source' },
    },
    npa: {
      title: 'Nigeria Ports Authority (NPA)',
      dueColumn: 'npa_share',
      amountColumn: 'npa_share',
      sources: ['BOOKING', 'UTILITY_TICKET', 'TOW_TRUCK_REQUEST', 'PENALTY'],
      where: 'r.npa_share > 0',
      breakdown: { kind: 'source' },
    },
    facilities: {
      title: 'Facilities',
      dueColumn: 'facility_share',
      amountColumn: 'facility_share',
      sources: ['BOOKING', 'DEMURRAGE'],
      where: 'r.facility_id IS NOT NULL AND r.facility_share > 0',
      breakdown: {
        kind: 'beneficiary',
        idColumn: 'facility_id',
        nameColumn: 'facility_name',
      },
    },
    transit: {
      title: 'Transit Parks',
      dueColumn: 'transit_park_share',
      amountColumn: 'transit_park_share',
      sources: ['BOOKING', 'DEMURRAGE'],
      where: 'r.transit_park_id IS NOT NULL AND r.transit_park_share > 0',
      breakdown: {
        kind: 'beneficiary',
        idColumn: 'transit_park_id',
        nameColumn: 'transit_park_name',
      },
    },
    tow: {
      title: 'Tow Truck Companies',
      dueColumn: 'tow_company_share',
      amountColumn: 'tow_company_share',
      sources: ['TOW_TRUCK_REQUEST'],
      where: 'r.tow_company_id IS NOT NULL AND r.tow_company_share > 0',
      breakdown: {
        kind: 'beneficiary',
        idColumn: 'tow_company_id',
        nameColumn: 'tow_company_name',
      },
    },
  };
