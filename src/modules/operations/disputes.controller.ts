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
import { DisputesService } from './disputes.service';
import { QueryDisputesDto, ResolveDisputeDto } from './dto/operations.dto';
import {
  DisputeListResponseDto,
  DisputeResponseDto,
  DisputesSummaryResponseDto,
} from './dto/operations-response.dto';

@ApiTags('disputes')
@ApiBearerAuth('access-token')
@Controller('api/disputes')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get('summary')
  @ApiOkResponse({ type: DisputesSummaryResponseDto })
  async summary() {
    return this.ok(
      'Disputes summary fetched successfully',
      await this.disputesService.disputesSummary(),
    );
  }

  @Get('export')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV export of disputes (respects list query filters)',
    schema: { type: 'string', example: 'Dispute ID,Truck Plate,...' },
  })
  async exportCsv(@Query() query: QueryDisputesDto, @Res() res: Response) {
    const csv = await this.disputesService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=disputes-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  @ApiOkResponse({ type: DisputeListResponseDto })
  async findAll(@Query() query: QueryDisputesDto) {
    return this.ok(
      'Disputes fetched successfully',
      await this.disputesService.findDisputes(query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: DisputeResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Dispute fetched successfully',
      await this.disputesService.findDispute(id),
    );
  }

  @Patch(':id/resolve')
  @ApiOkResponse({ type: DisputeResponseDto })
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'Dispute resolved successfully',
      await this.disputesService.resolveDispute(id, dto, actor),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
