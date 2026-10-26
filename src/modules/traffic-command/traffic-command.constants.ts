/**
 * Live Truck Updates stages (the TCCM matrix columns), derived from a LIVE
 * booking's lifecycle timestamps — the latest milestone reached wins.
 */
export const LIVE_TRUCK_STAGES = [
  'ON_TRIP',
  'IN_FACILITY',
  'MATCHED',
  'GTG_FACILITY',
  'LEFT_FACILITY',
  'IN_PREGATE',
  'GTG_PREGATE',
  'LEFT_PREGATE',
  'IN_TERMINAL',
] as const;
export type LiveTruckStage = (typeof LIVE_TRUCK_STAGES)[number];

/** Same wording as the overview lifecycle cards; `destination` says where a truck is heading. */
export const LIVE_TRUCK_STAGE_LABELS: Record<LiveTruckStage, string> = {
  ON_TRIP: 'On Trip',
  IN_FACILITY: 'In Facility',
  MATCHED: 'Matched',
  GTG_FACILITY: 'GTG Facility',
  LEFT_FACILITY: 'Left Facility',
  IN_PREGATE: 'In Pregate',
  GTG_PREGATE: 'GTG Pregate',
  LEFT_PREGATE: 'Left Pregate',
  IN_TERMINAL: 'In Terminal',
};

/** Stages where the truck is on the road between stops — together they make up "On Trip" totals. */
export const ON_ROAD_STAGES: LiveTruckStage[] = [
  'ON_TRIP',
  'LEFT_FACILITY',
  'LEFT_PREGATE',
];

/** Coarser grouping used by the "By Route" view. */
export const LIVE_TRUCK_STAGE_GROUP: Record<LiveTruckStage, string> = {
  ON_TRIP: 'TO_FACILITY',
  IN_FACILITY: 'IN_FACILITY',
  MATCHED: 'IN_FACILITY',
  GTG_FACILITY: 'IN_FACILITY',
  LEFT_FACILITY: 'FACILITY_TO_TRANSIT_PARK',
  IN_PREGATE: 'IN_TRANSIT_PARK',
  GTG_PREGATE: 'IN_TRANSIT_PARK',
  LEFT_PREGATE: 'TRANSIT_PARK_TO_TERMINAL',
  IN_TERMINAL: 'IN_TERMINAL',
};

export const FACILITY_STAGES: LiveTruckStage[] = [
  'IN_FACILITY',
  'MATCHED',
  'GTG_FACILITY',
];

/** SQL CASE yielding the LiveTruckStage of booking alias `b`. */
export function stageSql(b = 'b'): string {
  return `(CASE
    WHEN ${b}.in_terminal_at IS NOT NULL THEN 'IN_TERMINAL'
    WHEN ${b}.left_pregate_at IS NOT NULL THEN 'LEFT_PREGATE'
    WHEN ${b}.gtg_pregate_at IS NOT NULL THEN 'GTG_PREGATE'
    WHEN ${b}.in_pregate_at IS NOT NULL THEN 'IN_PREGATE'
    WHEN ${b}.left_facility_at IS NOT NULL THEN 'LEFT_FACILITY'
    WHEN ${b}.gtg_facility_at IS NOT NULL THEN 'GTG_FACILITY'
    WHEN ${b}.matched_at IS NOT NULL THEN 'MATCHED'
    WHEN ${b}.in_facility_at IS NOT NULL THEN 'IN_FACILITY'
    ELSE 'ON_TRIP'
  END)`;
}

/** When booking alias `b` entered its current stage (FIFO ordering within a matrix cell). */
export function stageSinceSql(b = 'b'): string {
  return `COALESCE(${b}.in_terminal_at, ${b}.left_pregate_at, ${b}.gtg_pregate_at, ${b}.in_pregate_at, ${b}.left_facility_at, ${b}.gtg_facility_at, ${b}.matched_at, ${b}.in_facility_at, ${b}.created_at)`;
}

export const LOCATION_KINDS = [
  'FACILITY',
  'FACILITY_PREGATE',
  'PREGATE',
  'EPT',
  'TERMINAL',
] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  FACILITY: 'Facility',
  FACILITY_PREGATE: 'Facility-Pregate',
  PREGATE: 'Pregate',
  EPT: 'EPT',
  TERMINAL: 'Terminal',
};

export const PARK_TYPE_LABELS: Record<string, string> = {
  BONDED_TERMINAL: 'Bonded Terminal',
  TRUCK_PARK: 'Truck Park',
  FISH_VAN_PARK: 'Fish-Van Park',
  PREGATE: 'Pregate',
  EPT: 'EPT',
  PORT_TERMINAL: 'Port Terminal',
  NON_PORT_TERMINAL: 'Non-Port Terminal',
};

export const BOOKING_TYPES = [
  'BONDED_TERMINAL',
  'TRUCK_PARK',
  'FISH_VAN_PARK',
  'EPT',
] as const;

export const EMERGENCY_TYPES = ['TOW_TRUCK', 'BREAKDOWN', 'ACCIDENT'] as const;
export type EmergencyType = (typeof EMERGENCY_TYPES)[number];

/** "1hr 43mins" as on the live-location wireframe. */
export function formatMinutes(minutes: number | null): string | null {
  if (minutes === null || Number.isNaN(minutes)) return null;
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}mins`;
  return `${h}hr${h > 1 ? 's' : ''} ${m}mins`;
}
