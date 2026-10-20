import type { LiveTruckStage } from '../traffic-command/traffic-command.constants';

/** Congestion index at/above which a site or the corridor is in the red zone (override: CONGESTION_RED_ZONE_THRESHOLD). */
export const DEFAULT_RED_ZONE_THRESHOLD = 70;

/** Trends compare the last TREND_WINDOW_DAYS with the window before it. */
export const TREND_WINDOW_DAYS = 7;

/** Booking → Manifest lifecycle cards, grouped as on the overview. */
export type LifecycleStageKey =
  | 'AVAILABLE'
  | 'ON_TRIP'
  | 'IN_FACILITY'
  | 'MATCHED'
  | 'GTG_FACILITY'
  | 'LEFT_FACILITY'
  | 'IN_PREGATE'
  | 'GTG_PREGATE'
  | 'LEFT_PREGATE'
  | 'IN_TERMINAL'
  | 'LEFT_TERMINAL';

export const LIFECYCLE_GROUPS: {
  key: string;
  label: string;
  items: {
    key: LifecycleStageKey;
    label: string;
    description: string;
    /** Live-truck stage the card counts (AVAILABLE / LEFT_TERMINAL are counted separately). */
    stage?: LiveTruckStage;
  }[];
}[] = [
  {
    key: 'BOOKING_TRANSIT',
    label: 'Booking & Transit',
    items: [
      {
        key: 'AVAILABLE',
        label: 'Available',
        description: 'Verified truck ready for booking',
      },
      {
        key: 'ON_TRIP',
        label: 'On Trip',
        description: 'Booked and en route to facility',
        stage: 'ENROUTE_FACILITY',
      },
    ],
  },
  {
    key: 'FACILITY',
    label: 'Facility',
    items: [
      {
        key: 'IN_FACILITY',
        label: 'In Facility',
        description: 'Gated into bonded facility or truck park',
        stage: 'IN_FACILITY',
      },
      {
        key: 'MATCHED',
        label: 'Matched',
        description: 'TEP matched to truck at facility',
        stage: 'MATCHED',
      },
      {
        key: 'GTG_FACILITY',
        label: 'GTG Facility',
        description: 'Scheduled and ready to exit facility',
        stage: 'GTG_FACILITY',
      },
      {
        key: 'LEFT_FACILITY',
        label: 'Left Facility',
        description: 'Gated out of facility',
        stage: 'ENROUTE_PREGATE',
      },
    ],
  },
  {
    key: 'PREGATE',
    label: 'Pregate',
    items: [
      {
        key: 'IN_PREGATE',
        label: 'In Pregate',
        description: 'Gated into transit pregate park',
        stage: 'IN_PREGATE',
      },
      {
        key: 'GTG_PREGATE',
        label: 'GTG Pregate',
        description: 'Ready to exit pregate',
        stage: 'GTG_PREGATE',
      },
      {
        key: 'LEFT_PREGATE',
        label: 'Left Pregate',
        description: 'Gated out of pregate',
        stage: 'ENROUTE_TERMINAL',
      },
    ],
  },
  {
    key: 'TERMINAL',
    label: 'Terminal',
    items: [
      {
        key: 'IN_TERMINAL',
        label: 'In Terminal',
        description: 'Gated into destination terminal',
        stage: 'IN_TERMINAL',
      },
      {
        key: 'LEFT_TERMINAL',
        label: 'Left Terminal',
        description: 'Gated out of terminal today — journey complete',
      },
    ],
  },
];

/** Feed status label for a LIVE booking's stage (Recent Bookings). */
export const STAGE_FEED_LABELS: Record<LiveTruckStage, string> = {
  ENROUTE_FACILITY: 'On-Trip',
  IN_FACILITY: 'In-Facility',
  MATCHED: 'Matched',
  GTG_FACILITY: 'GTG-Facility',
  ENROUTE_PREGATE: 'Left-Facility',
  IN_PREGATE: 'In-Pregate',
  GTG_PREGATE: 'GTG-Pregate',
  ENROUTE_TERMINAL: 'Left-Pregate',
  IN_TERMINAL: 'In-Terminal',
};

// ─────────────────────────────────────────────────────────────────────────
// Operations Command & Control
// ─────────────────────────────────────────────────────────────────────────

export const OPS_COMMAND_ACTIONS = [
  'SUSPEND_RED_ZONE_DISPATCH',
  'REROUTE_CORRIDOR_TRAFFIC',
  'ACTIVATE_OVERFLOW_HOLDING',
  'BROADCAST_DIVERSION_ADVISORY',
  'PRIORITY_MOVEMENT',
] as const;
export type OpsCommandAction = (typeof OPS_COMMAND_ACTIONS)[number];

export const OPS_COMMAND_ACTION_META: Record<
  OpsCommandAction,
  { title: string; description: string }
> = {
  SUSPEND_RED_ZONE_DISPATCH: {
    title: 'Suspend dispatch into Red Zone',
    description: 'Halt new releases toward the congested corridor',
  },
  REROUTE_CORRIDOR_TRAFFIC: {
    title: 'Reroute corridor traffic',
    description: 'Divert onto the alternate managed corridor',
  },
  ACTIVATE_OVERFLOW_HOLDING: {
    title: 'Activate overflow holding',
    description: 'Open overflow bays to stage waiting trucks',
  },
  BROADCAST_DIVERSION_ADVISORY: {
    title: 'Broadcast diversion advisory',
    description: 'Push advisory to drivers & transporters',
  },
  PRIORITY_MOVEMENT: {
    title: 'Priority movement',
    description: 'Grant priority passage to a flagged convoy',
  },
};

export const OPS_COMMAND_STATUSES = ['ACTIVE', 'LIFTED'] as const;

/** Priority (rank 1) trucks waiting at a GTG stage longer than this are a "flagged convoy". */
export const PRIORITY_WAIT_MINUTES = 60;

/** Open incidents of these types/severities on the corridor justify a diversion advisory. */
export const ADVISORY_INCIDENT_TYPES = [
  'GATE_CONGESTION',
  'TRUCK_BREAKDOWN',
  'ACCIDENT_INJURY',
];
export const ADVISORY_INCIDENT_SEVERITIES = ['HIGH', 'CRITICAL'];
