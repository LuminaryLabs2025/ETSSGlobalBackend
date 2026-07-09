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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SuperAdminGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DisputesService } from './disputes.service';
import { QueryDisputesDto, ResolveDisputeDto } from './dto/operations.dto';

@ApiTags('disputes')
@ApiBearerAuth('access-token')
@Controller('api/disputes')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get('summary')
  @ApiOkResponse({ description: 'Disputes dashboard summary counts' })
  async summary() {
    return this.ok(
      'Disputes summary fetched successfully',
      await this.disputesService.disputesSummary(),
    );
  }

  @Get('export')
  async exportCsv(@Query() query: QueryDisputesDto, @Res() res: Response) {
    const csv = await this.disputesService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=disputes-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  async findAll(@Query() query: QueryDisputesDto) {
    return this.ok(
      'Disputes fetched successfully',
      await this.disputesService.findDisputes(query),
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Dispute fetched successfully',
      await this.disputesService.findDispute(id),
    );
  }

  @Patch(':id/resolve')
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
