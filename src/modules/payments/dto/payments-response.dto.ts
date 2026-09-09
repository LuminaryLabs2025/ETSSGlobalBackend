import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ResponseEnvelopeDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  message: string;
}

class PaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total_pages: number;
}

export class PaymentTransactionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'MTMS-1762000000000-a1b2c3d4' })
  reference: string;

  @ApiProperty({ format: 'uuid' })
  invoice_id: string;

  @ApiPropertyOptional({ example: 'INV-2026-000001' })
  invoice_number?: string;

  @ApiPropertyOptional({ enum: ['BOOKING'] })
  payable_type?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The booking id, when payable_type is BOOKING.',
  })
  payable_id?: string;

  @ApiProperty({ enum: ['PAYSTACK'] })
  gateway: string;

  @ApiProperty({ enum: ['PENDING', 'SUCCESSFUL', 'FAILED', 'ABANDONED'] })
  status: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ example: 'NGN' })
  currency: string;

  @ApiPropertyOptional()
  customer_email?: string;

  @ApiPropertyOptional()
  paystack_authorization_url?: string;

  @ApiPropertyOptional()
  channel?: string;

  @ApiPropertyOptional()
  gateway_response?: string;

  @ApiPropertyOptional()
  paid_at?: Date;

  @ApiProperty()
  created_at: Date;
}

export class InitializePaymentResponseDto extends ResponseEnvelopeDto {
  @ApiProperty()
  data: {
    reference: string;
    authorization_url: string;
    access_code: string;
    amount: number;
    currency: string;
  };
}

class PaymentListDataDto {
  @ApiProperty({ type: () => [PaymentTransactionDto] })
  data: PaymentTransactionDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class PaymentListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => PaymentListDataDto })
  data: PaymentListDataDto;
}

export class PaymentDetailResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => PaymentTransactionDto })
  data: PaymentTransactionDto;
}

export class PaymentsConfigResponseDto extends ResponseEnvelopeDto {
  @ApiProperty()
  data: { public_key: string };
}
