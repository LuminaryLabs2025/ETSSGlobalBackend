import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

export interface PaystackSignedRequest extends RawBodyRequest<Request> {
  paystackSignatureValid: boolean;
}

/**
 * Verifies `x-paystack-signature` as HMAC-SHA512 of the TRUE raw request
 * body (via Nest's `rawBody: true` bootstrap option in main.ts), not a
 * re-stringified parsed object — the latter is fragile since JSON
 * serialization isn't guaranteed to round-trip byte-identically to what
 * Paystack actually signed. Uses a timing-safe comparison.
 *
 * Deliberately does NOT throw on an invalid signature — it attaches the
 * result to `request.paystackSignatureValid` and always allows the request
 * through, so PaymentsWebhookController can durably log the attempt to
 * PaymentWebhookEvent (signature_valid: false included) before rejecting it
 * with 401. A reference implementation we reviewed for this integration
 * disabled its signature guard entirely on the live route — this guard is
 * always active; it just defers the reject decision to keep the audit log
 * complete.
 */
@Injectable()
export class PaystackWebhookSignatureGuard implements CanActivate {
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      throw new Error(
        'PAYSTACK_SECRET_KEY is not configured — see .env.example',
      );
    }
    this.secretKey = secretKey;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PaystackSignedRequest>();
    request.paystackSignatureValid = this.verify(request);
    return true;
  }

  private verify(request: PaystackSignedRequest): boolean {
    const signature = request.headers['x-paystack-signature'];
    if (!signature || typeof signature !== 'string' || !request.rawBody) {
      return false;
    }
    const expected = crypto
      .createHmac('sha512', this.secretKey)
      .update(request.rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const signatureBuf = Buffer.from(signature, 'utf8');
    return (
      expectedBuf.length === signatureBuf.length &&
      crypto.timingSafeEqual(expectedBuf, signatureBuf)
    );
  }
}
