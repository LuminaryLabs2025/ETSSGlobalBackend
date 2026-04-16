import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import {
  EMAIL_QUEUE,
  JOB_INVITE_EMAIL,
  JOB_PASSWORD_RESET_EMAIL,
  JOB_TWO_FACTOR_EMAIL,
  JOB_WELCOME_EMAIL,
} from '../queue.constants';
import type {
  InviteEmailJobData,
  PasswordResetEmailJobData,
  TwoFactorEmailJobData,
  WelcomeEmailJobData,
} from '../types/email-jobs.types';

@Processor(EMAIL_QUEUE)
@Injectable()
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing ${job.name} (${job.id})`);

    if (job.name === JOB_INVITE_EMAIL) {
      const data = job.data as InviteEmailJobData;
      await this.mailService.sendInviteEmail(data.to, {
        firstName: data.firstName,
        lastName: data.lastName,
        invitedByLabel: data.invitedByLabel,
        joinInviteLink: data.joinInviteLink,
      });
      return;
    }

    if (job.name === JOB_WELCOME_EMAIL) {
      const data = job.data as WelcomeEmailJobData;
      await this.mailService.sendWelcomeEmail(data.to, data.displayName);
      return;
    }

    if (job.name === JOB_PASSWORD_RESET_EMAIL) {
      const data = job.data as PasswordResetEmailJobData;
      await this.mailService.sendPasswordResetEmail(data.to, data.resetLink);
      return;
    }

    if (job.name === JOB_TWO_FACTOR_EMAIL) {
      const data = job.data as TwoFactorEmailJobData;
      await this.mailService.sendTwoFactorCodeEmail(data.to, data.code);
      return;
    }

    this.logger.warn(`Unknown job name: ${job.name}`);
  }
}
