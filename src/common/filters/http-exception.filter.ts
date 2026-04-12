import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ActivityLogService } from '../../modules/activity-log/activity-log.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly activityLogService: ActivityLogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let messageStr = 'Internal server error';
    let body: Record<string, unknown> = {
      statusCode: status,
      message: messageStr,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const er = exceptionResponse as Record<string, unknown>;
        const msg = er.message;
        messageStr =
          typeof msg === 'string'
            ? msg
            : Array.isArray(msg)
              ? (msg as string[]).join('; ')
              : String(msg ?? 'Error');

        if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
          this.logger.error(
            `${request.method} ${request.url}`,
            exception instanceof Error ? exception.stack : String(exception),
          );
        }

        body = {
          statusCode: status,
          message: messageStr,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
        if (Array.isArray(er.errors)) {
          body.errors = er.errors;
        }
      } else {
        messageStr =
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : String(
                (exceptionResponse as { message?: string }).message ??
                  exceptionResponse,
              );
        body = {
          statusCode: status,
          message: messageStr,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }
    } else {
      messageStr =
        exception instanceof Error ? exception.message : String(exception);
      body = {
        statusCode: status,
        message: messageStr,
        timestamp: new Date().toISOString(),
        path: request.url,
      };
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    void this.activityLogService.recordHttpFailure(request, status, messageStr);
    response.status(status).json(body);
  }
}
