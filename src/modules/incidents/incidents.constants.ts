export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  TRUCK_BREAKDOWN: 'Truck Breakdown',
  CARGO_DAMAGE: 'Cargo Damage',
  ACCIDENT_INJURY: 'Accident / Injury',
  GATE_CONGESTION: 'Gate Congestion',
  SECURITY_BREACH: 'Security Breach',
  PAYMENT_DISPUTE: 'Payment Dispute',
  SYSTEM_DOWNTIME: 'System / Access Control Downtime',
};

export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  PENDING_SUPERADMIN_APPROVAL: 'Pending SuperAdmin Approval',
  CLOSED: 'Closed',
  REJECTED_BY_SUPERADMIN: 'Rejected by SuperAdmin',
  REOPENED: 'Reopened',
};

export const INCIDENT_LOCATION_KIND_LABELS: Record<string, string> = {
  FACILITY: 'Facility',
  TRANSIT_PARK: 'Transit Park',
  PORT_TERMINAL: 'Port / Terminal',
};

/** "Live / Open" card and the OPEN status group. */
export const OPEN_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'REOPENED',
  'REJECTED_BY_SUPERADMIN',
];
/** "Resolved" card and the RESOLVED status group. */
export const RESOLVED_STATUSES = ['RESOLVED', 'CLOSED'];

export const STATUS_GROUPS = ['OPEN', 'PENDING_APPROVAL', 'RESOLVED'] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];
export const STATUS_GROUP_STATUSES: Record<StatusGroup, string[]> = {
  OPEN: OPEN_STATUSES,
  PENDING_APPROVAL: ['PENDING_SUPERADMIN_APPROVAL'],
  RESOLVED: RESOLVED_STATUSES,
};

export const EMERGENCY_ACTIONS = [
  'DISPATCH_TOW_TRUCK',
  'NOTIFY_EMERGENCY_SERVICES',
  'DISPATCH_SECURITY',
  'ALERT_TRAFFIC_CONTROL',
  'LOCKDOWN_GATE',
  'OTHER',
] as const;

export const EMERGENCY_ACTION_LABELS: Record<string, string> = {
  DISPATCH_TOW_TRUCK: 'Dispatch tow truck',
  NOTIFY_EMERGENCY_SERVICES: 'Notify emergency services',
  DISPATCH_SECURITY: 'Dispatch security',
  ALERT_TRAFFIC_CONTROL: 'Alert traffic control',
  LOCKDOWN_GATE: 'Lock down gate',
  OTHER: 'Emergency response',
};

export const ESCALATION_LABELS: Record<string, string> = {
  MANAGEMENT: 'Management',
  NPA: 'Regulatory Agency (NPA)',
  EXECUTIVE: 'Executive Management',
};

export const SUPER_ADMIN_TEAM = 'MARITIME-ETSS';
