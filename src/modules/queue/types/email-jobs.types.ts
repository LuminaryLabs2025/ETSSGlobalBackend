export type InviteEmailJobData = {
  to: string;
  firstName: string;
  lastName: string;
  invitedByLabel?: string;
  /** When set (create + resend-invite), included in the email body. */
  tempPassword?: string;
  joinInviteLink?: string;
};

export type WelcomeEmailJobData = {
  to: string;
  displayName: string;
};

export type PasswordResetEmailJobData = {
  to: string;
  resetLink: string;
};
