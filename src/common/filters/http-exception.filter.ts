import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const er = exceptionResponse as Record<string, unknown>;
        const msg = er.message;
        message =
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

        const body: Record<string, unknown> = {
          statusCode: status,
          message,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
        if (Array.isArray(er.errors)) {
          body.errors = er.errors;
        }
        response.status(status).json(body);
        return;
      }

      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exceptionResponse;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
