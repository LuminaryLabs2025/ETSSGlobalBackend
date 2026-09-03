import {
  Equals,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export const EXPORT_TYPES = [
  'AGRO_EXPORT',
  'MANUFACTURED_EXPORT',
  'OTHERS',
] as const;

export const EPT_OPERATION_TYPES = [
  'LOADED_EXPORT_DELIVERY',
  'EMPTY_CONTAINER_DELIVERY',
  'VERIFIED_EXPORT_COLLECTION',
  'LOADED_DELIVERY_WITH_COLLECTION',
] as const;

export const PAYMENT_METHODS = ['WALLET', 'PAYSTACK'] as const;

/** Bonded Terminal & Truck Park share an identical field shape. */
export class CreateFacilityBookingDto {
  /** Bonded Terminal / Truck Park facility id. */
  @IsUUID()
  facility_id: string;

  @IsUUID()
  transporter_company_id: string;

  @IsUUID()
  truck_id: string;

  @IsUUID()
  driver_id: string;

  /** Port/Non-Port Terminal Destination — its `location`/`terminal_type` already carry the "Terminal Location" the frontend filters by. */
  @IsUUID()
  terminal_id: string;

  @IsUUID()
  booking_category_id: string;

  @IsDateString()
  expected_arrival_date: string;

  @IsUUID()
  expected_arrival_time_slot_id: string;
}

export class CreateFishBookingDto {
  /** Fish-Van Park facility id. */
  @IsUUID()
  facility_id: string;

  @IsUUID()
  transporter_company_id: string;

  @IsUUID()
  truck_id: string;

  @IsUUID()
  driver_id: string;

  @IsUUID()
  terminal_id: string;

  @IsDateString()
  expected_arrival_date: string;

  /** Spec lists a timeslot dropdown for Fish; optional since the current FE mock doesn't collect it yet. */
  @IsOptional()
  @IsUUID()
  expected_arrival_time_slot_id?: string;

  /** Not in the written spec's Fish section but present on the current FE mock as "Truck Entry Permit". Accepted if sent, never required. */
  @IsOptional()
  @IsString()
  gate_pass_number?: string;
}

export class CreateEptBookingDto {
  @IsUUID()
  transporter_company_id: string;

  @IsIn(EXPORT_TYPES)
  export_type: (typeof EXPORT_TYPES)[number];

  @IsUUID()
  truck_id: string;

  @IsUUID()
  driver_id: string;

  /** The selected EPT — a TransitPark with transit_park_type = 'EPT'. */
  @IsUUID()
  transit_park_id: string;

  @IsIn(EPT_OPERATION_TYPES)
  ept_operation_type: (typeof EPT_OPERATION_TYPES)[number];

  /** Port Terminal Destination. */
  @IsUUID()
  terminal_id: string;

  @IsDateString()
  expected_arrival_date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'expected_arrival_time must be in HH:mm 24-hour format',
  })
  expected_arrival_time: string;

  @IsString()
  @IsNotEmpty()
  gate_pass_number: string;
}

export class ConfirmPaymentDto {
  @IsIn(PAYMENT_METHODS)
  payment_method: (typeof PAYMENT_METHODS)[number];

  /**
   * The "I AGREE TO MARITIME-ETSS TERMS & CONDITIONS" checkbox — per spec
   * this appears alongside the payment section, not at create time, so it's
   * enforced here rather than on the create DTOs.
   */
  @Equals(true, {
    message: 'terms_accepted must be true to proceed to payment',
  })
  terms_accepted: true;
}

export class MarkInPregateDto {
  @IsUUID()
  pregate_transit_park_id: string;
}
