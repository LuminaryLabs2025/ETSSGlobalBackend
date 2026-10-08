/**
 * e-Revenue fee schedule from the product owner ("e-Revenue for Maritime
 * ETSS" sheet): each use case's amount, payer and revenue-recipient split.
 * Seeded once as Payment Types — SuperAdmin edits amounts/splits afterwards
 * in App Options → Payment Types, and the seed never overwrites those edits.
 *
 * Payment Type names are unique and a payment type links to one form, so
 * per-form rows are seeded for use cases shared by several booking forms
 * (Facility Bay, Matching Fee). A booking's invoice is the sum of the ACTIVE
 * payment types on its form, one fee line each.
 *
 * Not seeded: "Annual Subscription for each Facility or Transit Park"
 * (50,000) — it has no payment flow and no recipient split defined yet.
 */
export interface FeeScheduleSeedRow {
  name: string;
  service_name: string;
  linked_form: string;
  revenue_event_trigger: string;
  /** user_types.slug of the payer. */
  paid_by: string;
  amount: number;
  facility_percentage?: number;
  transit_park_percentage?: number;
  npa_percentage?: number;
  etss_percentage?: number;
  tow_company_percentage?: number;
}

const FACILITY_FORMS = [
  { form: 'BOOK_BONDED_TERMINAL', label: 'Bonded Terminal' },
  { form: 'BOOK_TRUCK_PARK', label: 'Truck Park' },
  { form: 'BOOK_FISH', label: 'Fish-Van Park' },
];

const MATCHING_FEE = {
  service_name: 'Matching Fee',
  paid_by: 'transporter',
  amount: 10_000,
  npa_percentage: 40,
  etss_percentage: 60,
};

export const FEE_SCHEDULE_SEEDS: FeeScheduleSeedRow[] = [
  ...FACILITY_FORMS.map(({ form, label }) => ({
    name: `Payment for Facility Bay - ${label}`,
    service_name: 'Facility Bay',
    linked_form: form,
    revenue_event_trigger: 'BOOKING_PAYMENT',
    paid_by: 'transporter',
    amount: 5_000,
    facility_percentage: 100,
  })),
  {
    name: 'Payment for Transit Park Bay - EPT',
    service_name: 'Transit Park Bay',
    linked_form: 'BOOK_EPT',
    revenue_event_trigger: 'BOOKING_PAYMENT',
    paid_by: 'transporter',
    amount: 5_000,
    transit_park_percentage: 100,
  },
  ...[...FACILITY_FORMS, { form: 'BOOK_EPT', label: 'EPT' }].map(
    ({ form, label }) => ({
      ...MATCHING_FEE,
      name: `Matching Fee - ${label}`,
      linked_form: form,
      revenue_event_trigger: 'BOOKING_PAYMENT',
    }),
  ),
  {
    name: 'Tow Truck Request',
    service_name: 'Tow Truck Request',
    linked_form: 'TOW_TRUCK_REQUEST',
    revenue_event_trigger: 'TOW_TRUCK_REQUEST_PAYMENT',
    paid_by: 'transporter',
    amount: 100_000,
    npa_percentage: 8,
    etss_percentage: 12,
    tow_company_percentage: 80,
  },
  {
    name: 'Utility Ticket',
    service_name: 'Utility Ticket',
    linked_form: 'UTILITY_TICKET',
    revenue_event_trigger: 'UTILITY_TICKET_PAYMENT',
    paid_by: 'terminal-operator',
    amount: 5_000,
    npa_percentage: 40,
    etss_percentage: 60,
  },
];
