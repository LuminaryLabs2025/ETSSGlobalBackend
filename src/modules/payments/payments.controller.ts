import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/guards';
import { PaymentsService } from './payments.service';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { VerifyByReferenceDto } from './dto/verify-payment.dto';
import {
  PaymentDetailResponseDto,
  PaymentListResponseDto,
  PaymentsConfigResponseDto,
} from './dto/payments-response.dto';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@Controller('api/payments')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('config')
  @ApiOkResponse({ type: PaymentsConfigResponseDto })
  config() {
    return this.ok('Payments config fetched successfully', {
      public_key: this.paymentsService.publicKey,
    });
  }

  @Get()
  @ApiOkResponse({ type: PaymentListResponseDto })
  async findAll(@Query() query: QueryPaymentsDto) {
    return this.ok(
      'Payments fetched successfully',
      await this.paymentsService.listPayments(query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: PaymentDetailResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Payment fetched successfully',
      await this.paymentsService.findPayment(id),
    );
  }

  /**
   * Reference-only verify — for the Paystack checkout redirect-back page,
   * which only ever has `?reference=...` from the URL, not a booking id.
   */
  @Post('verify')
  @ApiOkResponse({ type: PaymentDetailResponseDto })
  async verifyByReference(@Body() dto: VerifyByReferenceDto) {
    return this.ok(
      'Payment verified successfully',
      await this.paymentsService.verifyByReference(dto.reference),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
