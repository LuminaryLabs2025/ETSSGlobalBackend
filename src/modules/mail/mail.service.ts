import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type InviteEmailOptions = {
  firstName: string;
  lastName: string;
  invitedByLabel?: string;
  appName?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const user = config.get<string>('SMTP_USER')?.trim();
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: parseInt(String(config.get('SMTP_PORT', 1025)), 10),
      secure: false,
      auth: user
        ? {
            user,
            pass: config.get<string>('SMTP_PASS', ''),
          }
        : undefined,
    });
    this.from =
      config.get<string>('SMTP_FROM') || `"Maritime ETSS" <noreply@etss.local>`;
  }

  async sendWelcomeEmail(to: string, displayName: string): Promise<void> {
    const subject = 'Welcome to Maritime ETSS';
    const text = `Hi ${displayName},\n\nYour account is ready. You can sign in whenever you like.\n\n— Maritime ETSS`;
    const html = `<p>Hi ${this.escapeHtml(displayName)},</p><p>Your account is ready. You can sign in whenever you like.</p><p>— Maritime ETSS</p>`;
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
    const text = `Hi ${options.firstName} ${options.lastName},

You have been invited to join ${appName}${inviter}.

Sign in with the email address this message was sent to, using the credentials your administrator provided.

— ${appName}`;
    const html = `<p>Hi ${this.escapeHtml(options.firstName)} ${this.escapeHtml(options.lastName)},</p>
<p>You have been invited to join <strong>${this.escapeHtml(appName)}</strong>${inviter ? ` by <strong>${this.escapeHtml(options.invitedByLabel!)}</strong>` : ''}.</p>
<p>Sign in with the email address this message was sent to, using the credentials your administrator provided.</p>
<p>— ${this.escapeHtml(appName)}</p>`;
    await this.send({ to, subject, text, html });
  }

  private async send(mail: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (err) {
      this.logger.error(`Failed to send mail to ${mail.to}`, err);
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
