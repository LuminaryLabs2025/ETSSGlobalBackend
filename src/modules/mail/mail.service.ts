import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type InviteEmailOptions = {
  firstName: string;
  lastName: string;
  invitedByLabel?: string;
  appName?: string;
  /** Shown in the email so the user can sign in (invite + resend-invite). */
  tempPassword?: string;
  /** Tokenized one-time link for invite activation. */
  joinInviteLink?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  /** When set (e.g. Resend sandbox), envelope goes here; body still shows the real invitee email. */
  private readonly smtpRedirectTo: string | undefined;
  /** Development: log full message and skip SMTP (any recipient “works”). */
  private readonly logOnly: boolean;

  constructor(private readonly config: ConfigService) {
    const user = config.get<string>('SMTP_USER')?.trim();
    const port = parseInt(String(config.get('SMTP_PORT', 1025)), 10);
    const secureFlag = config.get<string>('SMTP_SECURE')?.trim().toLowerCase();
    const secure =
      secureFlag === 'true' ||
      secureFlag === '1' ||
      port === 465 ||
      port === 2465;
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port,
      secure,
      auth: user
        ? {
            user,
            pass: config.get<string>('SMTP_PASS', ''),
          }
        : undefined,
    });
    this.from =
      config.get<string>('SMTP_FROM') || `"Maritime ETSS" <noreply@etss.local>`;
    this.smtpRedirectTo = config.get<string>('SMTP_REDIRECT_TO')?.trim() || undefined;
    if (this.smtpRedirectTo) {
      this.logger.warn(
        `SMTP_REDIRECT_TO is set (${this.smtpRedirectTo}) — all mail envelopes go there; templates still show the intended recipient.`,
      );
    }

    const nodeEnv = config.get<string>('NODE_ENV', 'development');
    const smtpMode = config.get<string>('SMTP_MODE', '').trim().toLowerCase();
    this.logOnly = smtpMode === 'log' && nodeEnv !== 'production';
    if (smtpMode === 'log' && nodeEnv === 'production') {
      this.logger.warn(
        'SMTP_MODE=log is ignored in production; configure real SMTP.',
      );
    }
    if (this.logOnly) {
      this.logger.warn(
        'SMTP_MODE=log — emails are not sent over the network; invite bodies are logged (safe for arbitrary test addresses).',
      );
    }
  }

  async sendWelcomeEmail(to: string, displayName: string): Promise<void> {
    const subject = 'Welcome to Maritime ETSS';
    const text = `Hi ${displayName},\n\nYour account is ready. You can sign in whenever you like.\n\n— Maritime ETSS`;
    const html = `<p>Hi ${this.escapeHtml(displayName)},</p><p>Your account is ready. You can sign in whenever you like.</p><p>— Maritime ETSS</p>`;
    await this.send({ to, subject, text, html });
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const subject = 'Reset your Maritime ETSS password';
    const text = `We received a request to reset your password.\n\nUse the link below to set a new password (valid for 15 minutes):\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`;
    const html = `<p>We received a request to reset your password.</p>
<p>Use the link below to set a new password (valid for 15 minutes):</p>
<p><a href="${this.escapeHtml(resetLink)}">${this.escapeHtml(resetLink)}</a></p>
<p>If you did not request this, you can safely ignore this email.</p>`;
    await this.send({ to, subject, text, html });
  }

  async sendInviteEmail(
    to: string,
    options: InviteEmailOptions,
  ): Promise<void> {
    const appName = options.appName ?? 'Maritime ETSS';
    const inviter = options.invitedByLabel
      ? ` by ${options.invitedByLabel}`
      : '';
    const subject = `You have been invited to ${appName}`;
    const credsBlock = options.tempPassword
      ? `

Sign in with:
  • Email: ${to}
  • Temporary password: ${options.tempPassword}

Join invite link:
  • ${options.joinInviteLink ?? 'Use the link in this email'}

Change your password after signing in if the app offers that option.`
      : `

Sign in with the email address this message was sent to, using the credentials your administrator provided.`;
    const text = `Hi ${options.firstName} ${options.lastName},

You have been invited to join ${appName}${inviter}.${credsBlock}

— ${appName}`;
    const credsHtml = options.tempPassword
      ? `<p><strong>Sign in with:</strong></p>
<ul>
<li>Email: ${this.escapeHtml(to)}</li>
<li>Temporary password: <code>${this.escapeHtml(options.tempPassword)}</code></li>
</ul>
${options.joinInviteLink ? `<p><strong>Join invite link:</strong> <a href="${this.escapeHtml(options.joinInviteLink)}">${this.escapeHtml(options.joinInviteLink)}</a></p>` : ''}
<p>Change your password after signing in if the app offers that option.</p>`
      : `<p>Sign in with the email address this message was sent to, using the credentials your administrator provided.</p>`;
    const html = `<p>Hi ${this.escapeHtml(options.firstName)} ${this.escapeHtml(options.lastName)},</p>
<p>You have been invited to join <strong>${this.escapeHtml(appName)}</strong>${inviter ? ` by <strong>${this.escapeHtml(options.invitedByLabel!)}</strong>` : ''}.</p>
${credsHtml}
<p>— ${this.escapeHtml(appName)}</p>`;
    await this.send({ to, subject, text, html });
  }

  private async send(mail: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    if (this.logOnly) {
      this.logger.log(
        `[SMTP_MODE=log] ────────────────────────────────────────────────\n` +
          `To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n` +
          `────────────────────────────────────────────────`,
      );
      return;
    }

    const envelopeTo = this.smtpRedirectTo ?? mail.to;
    if (this.smtpRedirectTo && this.smtpRedirectTo !== mail.to) {
      this.logger.log(
        `SMTP envelope → ${envelopeTo} (intended recipient ${mail.to})`,
      );
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: envelopeTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (err: any) {
      const code = err?.responseCode ?? err?.code;
      this.logger.error(`Failed to send mail (envelope ${envelopeTo})`, err);
      if (code === 550 || err?.message?.includes('550')) {
        this.logger.error(
          'SMTP 550 often means Resend sandbox: verify a domain at resend.com/domains, use a From address on that domain, or set SMTP_REDIRECT_TO to your Resend-account email for local testing.',
        );
      }
      throw err;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
