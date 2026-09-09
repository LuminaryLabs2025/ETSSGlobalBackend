import { Equals } from 'class-validator';

export class InitializePaymentDto {
  /**
   * The "I AGREE TO MARITIME-ETSS TERMS & CONDITIONS" checkbox — appears
   * alongside the payment section per spec, so it's enforced here rather
   * than on the booking-create DTOs.
   */
  @Equals(true, {
    message: 'terms_accepted must be true to proceed to payment',
  })
  terms_accepted: true;
}
