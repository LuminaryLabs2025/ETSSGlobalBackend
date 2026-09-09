import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  /**
   * Optional — if provided, PaymentsService asserts it belongs to this
   * booking's invoice (400 on mismatch) rather than trusting an arbitrary
   * reference. Omit to verify the invoice's current transaction.
   */
  @IsOptional()
  @IsString()
  reference?: string;
}

/**
 * Used by the reference-only `POST /api/payments/verify` — the payment
 * callback page only ever has the Paystack `reference` from the redirect
 * query string, not the booking's id, so this route doesn't need a
 * `:bookingId` in the path the way the booking-scoped verify route does.
 */
export class VerifyByReferenceDto {
  @IsString()
  @IsNotEmpty()
  reference: string;
}
