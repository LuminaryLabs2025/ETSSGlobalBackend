export type InviteEmailJobData = {
  to: string;
  firstName: string;
  lastName: string;
  invitedByLabel?: string;
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

export type TwoFactorEmailJobData = {
  to: string;
  code: string;
};
