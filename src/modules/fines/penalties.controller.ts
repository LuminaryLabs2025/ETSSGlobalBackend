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
import { PenaltiesService } from './penalties.service';
import {
  CreatePenaltyDto,
  QueryPenaltiesDto,
  UpdatePenaltyDto,
} from './dto/fines.dto';
import {
  PenaltiesSummaryResponseDto,
  PenaltyListResponseDto,
  PenaltyResponseDto,
} from './dto/fines-response.dto';

@ApiTags('penalties')
@ApiBearerAuth('access-token')
@Controller('api/penalties')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class PenaltiesController {
  constructor(private readonly penaltiesService: PenaltiesService) {}

  @Get('summary')
  @ApiOkResponse({ type: PenaltiesSummaryResponseDto })
  async summary() {
    return this.ok(
      'Penalties summary fetched successfully',
      await this.penaltiesService.penaltiesSummary(),
    );
  }

  @Get('export')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV export of penalties (respects list query filters)',
    schema: { type: 'string', example: 'Penalty Code,Name,...' },
  })
  async exportCsv(@Query() query: QueryPenaltiesDto, @Res() res: Response) {
    const csv = await this.penaltiesService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=penalties-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  @ApiOkResponse({ type: PenaltyListResponseDto })
  async findAll(@Query() query: QueryPenaltiesDto) {
    return this.ok(
      'Penalties fetched successfully',
      await this.penaltiesService.findPenalties(query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: PenaltyResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Penalty fetched successfully',
      await this.penaltiesService.findPenalty(id),
    );
  }

  @Post()
  @ApiOkResponse({ type: PenaltyResponseDto })
  async create(
    @Body() dto: CreatePenaltyDto,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'Penalty created successfully',
      await this.penaltiesService.createPenalty(dto, actor),
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: PenaltyResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePenaltyDto,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'Penalty updated successfully',
      await this.penaltiesService.updatePenalty(id, dto, actor),
    );
  }

  @Patch(':id/archive')
  @ApiOkResponse({ type: PenaltyResponseDto })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'Penalty archived successfully',
      await this.penaltiesService.archivePenalty(id, actor),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
