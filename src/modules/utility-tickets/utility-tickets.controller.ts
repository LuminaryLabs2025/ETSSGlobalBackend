import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { UtilityTicketsService } from './utility-tickets.service';
import {
  CreateUtilityTicketDto,
  QueryUtilityTicketsDto,
  UpdateUtilityTicketDto,
} from './dto/utility-tickets.dto';
import {
  UtilityTicketListResponseDto,
  UtilityTicketResponseDto,
  UtilityTicketsSummaryResponseDto,
} from './dto/utility-tickets-response.dto';

@ApiTags('utility-tickets')
@ApiBearerAuth('access-token')
@Controller('api/utility-tickets')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class UtilityTicketsController {
  constructor(private readonly utilityTicketsService: UtilityTicketsService) {}

  @Get('summary')
  @ApiOkResponse({ type: UtilityTicketsSummaryResponseDto })
  async summary() {
    return this.ok(
      'Utility tickets summary fetched successfully',
      await this.utilityTicketsService.summary(),
    );
  }

  @Get('export')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV export of utility tickets (respects list query filters)',
    schema: { type: 'string', example: 'Ticket ID,Terminal Name,...' },
  })
  async exportCsv(@Query() query: QueryUtilityTicketsDto, @Res() res: Response) {
    const csv = await this.utilityTicketsService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=utility-tickets-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Post('generate')
  @ApiOkResponse({ type: UtilityTicketResponseDto })
  async generate(
    @Body() dto: CreateUtilityTicketDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ok(
      'Utility ticket generated successfully',
      await this.utilityTicketsService.generateTicket(dto, userId),
    );
  }

  @Get()
  @ApiOkResponse({ type: UtilityTicketListResponseDto })
  async findAll(@Query() query: QueryUtilityTicketsDto) {
    return this.ok(
      'Utility tickets fetched successfully',
      await this.utilityTicketsService.findTickets(query),
    );
  }

  @Get(':id/e-ticket')
  @ApiOkResponse({ type: UtilityTicketResponseDto })
  async eTicket(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'E-ticket fetched successfully',
      await this.utilityTicketsService.getETicket(id),
    );
  }

  @Patch(':id/approve')
  @ApiOkResponse({ type: UtilityTicketResponseDto })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ok(
      'Utility ticket approved successfully',
      await this.utilityTicketsService.approveTicket(id, userId),
    );
  }

  @Patch(':id/cancel')
  @ApiOkResponse({ type: UtilityTicketResponseDto })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ok(
      'Utility ticket cancelled successfully',
      await this.utilityTicketsService.cancelTicket(id, userId),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: UtilityTicketResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Utility ticket fetched successfully',
      await this.utilityTicketsService.findTicket(id),
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: UtilityTicketResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUtilityTicketDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ok(
      'Utility ticket updated successfully',
      await this.utilityTicketsService.updateTicket(id, dto, userId),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
