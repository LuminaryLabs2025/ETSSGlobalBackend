import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ActivityLogService } from '../../modules/activity-log/activity-log.service';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly activityLogService: ActivityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method } = request;

    if (method === 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseData) => {
        await this.activityLogService.recordHttpSuccess(request, responseData);
      }),
    );
  }
}
