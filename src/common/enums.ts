export enum UserTypeCategory {
  SYSTEM = 'SYSTEM',
  EXTERNAL = 'EXTERNAL',
}

export enum AccountType {
  PRIMARY = 'PRIMARY',
  SUB_ACCOUNT = 'SUB_ACCOUNT',
  SYSTEM = 'SYSTEM',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  AWAITING_ACTIVATION = 'AWAITING_ACTIVATION',
  ARCHIVED = 'ARCHIVED',
}

/** Outcome of an audited HTTP or domain action (activity log row). */
export enum ActivityLogEntryStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}
