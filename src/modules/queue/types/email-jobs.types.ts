export type InviteEmailJobData = {
  to: string;
  firstName: string;
  lastName: string;
  invitedByLabel?: string;
};

export type WelcomeEmailJobData = {
  to: string;
  displayName: string;
};
