import {
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { PaymentsService } from './payments.service';
import {
  PaystackSignedRequest,
  PaystackWebhookSignatureGuard,
} from './paystack-webhook-signature.guard';

/**
 * Public route — Paystack calls this directly, no JWT. Signature is verified
 * by PaystackWebhookSignatureGuard (always active — see its doc comment for
 * why it doesn't throw directly). Every event is durably logged via
 * PaymentsService.handleWebhookEvent before any decision is made about it.
 */
@Controller('api/payments/webhook')
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('paystack')
  @UseGuards(PaystackWebhookSignatureGuard)
  @ApiExcludeEndpoint()
  async handlePaystackWebhook(
    @Req() request: PaystackSignedRequest,
    @Res() res: Response,
  ) {
    const payload = request.body as {
      event?: string;
      data?: { reference?: string };
    };
    await this.paymentsService.handleWebhookEvent({
      signatureValid: request.paystackSignatureValid,
      payload,
    });
    if (!request.paystackSignatureValid) {
      // Logged above; 401 is safe here (unlike an unknown-reference
      // anomaly) since a bad signature is never something Paystack retrying
      // would fix — the retry only matters for the audit trail, not for us
      // asking for a resend.
      res.status(HttpStatus.UNAUTHORIZED).json({ received: false });
      return;
    }
    // 200 for everything else once durably logged — including an unknown
    // reference — since Paystack retries non-2xx responses, which can't fix
    // an anomaly on our side; the audit log carries it instead.
    res.status(HttpStatus.OK).json({ received: true });
  }
}
