import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Keeps the managed Postgres instance (Aiven's free tier powers off after a
 * period of inactivity) warm with a trivial query on a schedule. Uses
 * @nestjs/schedule rather than the existing BullMQ/Redis queue so this has
 * no dependency on Redis also being up.
 */
@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Cron(process.env.DB_KEEPALIVE_CRON ?? '0 */6 * * *')
  async ping(): Promise<void> {
    try {
      await this.dataSource.query('SELECT 1');
      this.logger.log('Database keep-alive ping succeeded');
    } catch (error) {
      this.logger.error('Database keep-alive ping failed', error as Error);
    }
  }
}
