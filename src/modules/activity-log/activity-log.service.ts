import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from '../../database/entities/activity-log.entity';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<{
    data: ActivityLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [data, total] = await this.activityLogRepository.findAndCount({
      relations: ['user'],
      order: { timestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        user: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      },
    });

    return { data, total, page, limit };
  }

  async findByUser(userId: string): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { user_id: userId },
      order: { timestamp: 'DESC' },
      take: 50,
    });
  }
}
