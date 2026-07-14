import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { SuperAdminGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FineDisputesService } from './fine-disputes.service';
import { QueryFineDisputesDto, ResolveFineDisputeDto } from './dto/fines.dto';
import {
  DisputesSummaryResponseDto,
  FineDisputeListResponseDto,
  FineDisputeResponseDto,
} from './dto/fines-response.dto';

@ApiTags('disputes')
@ApiBearerAuth('access-token')
@Controller('api/disputes')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class FineDisputesController {
  constructor(private readonly fineDisputesService: FineDisputesService) {}

  @Get('summary')
  @ApiOkResponse({ type: DisputesSummaryResponseDto })
  async summary() {
    return this.ok(
      'Disputes summary fetched successfully',
      await this.fineDisputesService.disputesSummary(),
    );
  }

  @Get('export')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV export of disputes (respects list query filters)',
    schema: { type: 'string', example: 'Dispute ID,Truck Plate,...' },
  })
  async exportCsv(@Query() query: QueryFineDisputesDto, @Res() res: Response) {
    const csv = await this.fineDisputesService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=disputes-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  @ApiOkResponse({ type: FineDisputeListResponseDto })
  async findAll(@Query() query: QueryFineDisputesDto) {
    return this.ok(
      'Disputes fetched successfully',
      await this.fineDisputesService.findDisputes(query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: FineDisputeResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Dispute fetched successfully',
      await this.fineDisputesService.findDispute(id),
    );
  }

  @Patch(':id/resolve')
  @ApiOkResponse({ type: FineDisputeResponseDto })
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveFineDisputeDto,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'Dispute resolved successfully',
      await this.fineDisputesService.resolveDispute(id, dto, actor),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
