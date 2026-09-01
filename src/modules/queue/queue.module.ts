import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { EmailProcessor } from './processors/email.processor';
import { EMAIL_QUEUE } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        // Prefer a full connection string (e.g. Render's external
        // rediss://... URL) — ioredis parses host/port/password/TLS from
        // it natively (rediss: auto-enables TLS). REDIS_HOST/PORT below
        // are for local/docker-compose Redis with no URL.
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          return { connection: { url: redisUrl } };
        }
        return {
          connection: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: parseInt(String(config.get('REDIS_PORT', 6379)), 10),
            password: config.get<string>('REDIS_PASSWORD') || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    MailModule,
  ],
  providers: [EmailProcessor],
  exports: [BullModule],
})
export class QueueModule {}
