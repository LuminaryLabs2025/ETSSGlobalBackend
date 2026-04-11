import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from '../../database/entities/activity-log.entity';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip } = request;

    if (method === 'GET') {
      return next.handle();
    }

    const action = this.getAction(method);
    const entity = this.getEntityFromUrl(url);

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const log = this.activityLogRepository.create({
            user_id: user?.id || null,
            action,
            entity,
            entity_id: responseData?.id || null,
            metadata: {
              method,
              url,
              body: this.sanitizeBody(request.body),
            },
            ip_address: ip,
          });
          await this.activityLogRepository.save(log);
        } catch {
          // Silently fail — activity logging should never break the request
        }
      }),
    );
  }

  private getAction(method: string): string {
    const map: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    return map[method] || method;
  }

  private getEntityFromUrl(url: string): string {
    const segments = url.split('/').filter(Boolean);
    const apiIndex = segments.indexOf('api');
    return segments[apiIndex + 1] || segments[0] || 'unknown';
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };
    delete sanitized.password;
    delete sanitized.token;
    return sanitized;
  }
}
