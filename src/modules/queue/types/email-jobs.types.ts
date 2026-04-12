export type InviteEmailJobData = {
  to: string;
  firstName: string;
  lastName: string;
  invitedByLabel?: string;
  /** When set (create + resend-invite), included in the email body. */
  tempPassword?: string;
};

export type WelcomeEmailJobData = {
  to: string;
  displayName: string;
};
