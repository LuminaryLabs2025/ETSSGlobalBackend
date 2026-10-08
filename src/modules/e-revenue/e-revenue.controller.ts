import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PermissionsGuard } from '../../common/guards';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ERevenueService } from './e-revenue.service';
import { RevenueLedgerService } from './revenue-ledger.service';
import {
  QueryFeeScheduleDto,
  QueryRevenueDto,
  RevenueModuleParamDto,
} from './dto/e-revenue.dto';
import { REVENUE_MODULES } from './e-revenue.constants';

const MODULE_PARAM = {
  name: 'module',
  enum: REVENUE_MODULES,
  description:
    'etss = Maritime-ETSS (all revenue), npa = NPA share, facilities / transit / tow = beneficiary shares',
};

@ApiTags('e-revenue')
@ApiBearerAuth('access-token')
@Controller('api/e-revenue')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ERevenueController {
  constructor(
    private readonly eRevenueService: ERevenueService,
    private readonly ledgerService: RevenueLedgerService,
  ) {}

  @Get('total')
  @Permissions('view_e_revenue')
  @ApiOperation({ summary: 'All-time successful revenue (header badge)' })
  async total() {
    return this.ok(
      'e-Revenue total fetched successfully',
      await this.eRevenueService.totalRevenue(),
    );
  }

  @Get('fee-schedule')
  @Permissions('view_e_revenue')
  @ApiOperation({
    summary:
      'Fee schedule: amount, payer and revenue-recipient split per payment type (edit via App Options → Payment Types)',
  })
  async feeSchedule(@Query() query: QueryFeeScheduleDto) {
    return this.ok(
      'Fee schedule fetched successfully',
      await this.eRevenueService.feeSchedule(query),
    );
  }

  @Post('ledger/sync')
  @Permissions('manage_e_revenue')
  @ApiOperation({
    summary:
      'Backfill/refresh the e-Revenue ledger from all payment transactions',
  })
  async syncLedger() {
    return this.ok(
      'e-Revenue ledger synced successfully',
      await this.ledgerService.syncAll(),
    );
  }

  @Get('transactions/:id')
  @Permissions('view_e_revenue')
  @ApiOperation({ summary: 'View payment details' })
  async findTransaction(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Revenue transaction fetched successfully',
      await this.eRevenueService.findTransaction(id),
    );
  }

  @Get(':module/summary')
  @Permissions('view_e_revenue')
  @ApiParam(MODULE_PARAM)
  @ApiOperation({ summary: 'Revenue cards (per payment source) for a tab' })
  async summary(
    @Param() params: RevenueModuleParamDto,
    @Query() query: QueryRevenueDto,
  ) {
    return this.ok(
      'e-Revenue summary fetched successfully',
      await this.eRevenueService.summary(params.module, query),
    );
  }

  @Get(':module/breakdown')
  @Permissions('view_e_revenue')
  @ApiParam(MODULE_PARAM)
  @ApiOperation({ summary: 'Pie chart slices for a tab' })
  async breakdown(
    @Param() params: RevenueModuleParamDto,
    @Query() query: QueryRevenueDto,
  ) {
    return this.ok(
      'e-Revenue breakdown fetched successfully',
      await this.eRevenueService.breakdown(params.module, query),
    );
  }

  @Get(':module/transactions')
  @Permissions('view_e_revenue')
  @ApiParam(MODULE_PARAM)
  @ApiOperation({ summary: 'Paginated transactions database for a tab' })
  async transactions(
    @Param() params: RevenueModuleParamDto,
    @Query() query: QueryRevenueDto,
  ) {
    return this.ok(
      'e-Revenue transactions fetched successfully',
      await this.eRevenueService.transactions(params.module, query),
    );
  }

  @Get(':module/export')
  @Permissions('export_e_revenue')
  @ApiParam(MODULE_PARAM)
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'CSV export (respects the list filters)' })
  async exportCsv(
    @Param() params: RevenueModuleParamDto,
    @Query() query: QueryRevenueDto,
    @Res() res: Response,
  ) {
    const csv = await this.eRevenueService.exportCsv(params.module, query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=e-revenue-${params.module}-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
