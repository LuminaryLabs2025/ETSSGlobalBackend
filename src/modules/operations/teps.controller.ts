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
import { TepsService } from './teps.service';
import {
  BulkCreateTepsDto,
  CreateTepDto,
  QueryTepsDto,
  ReasonDto,
} from './dto/operations.dto';
import {
  BulkTepsResponseDto,
  TepListResponseDto,
  TepResponseDto,
  TepsSummaryResponseDto,
} from './dto/operations-response.dto';

@ApiTags('teps')
@ApiBearerAuth('access-token')
@Controller('api/teps')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class TepsController {
  constructor(private readonly tepsService: TepsService) {}

  @Get('summary')
  @ApiOkResponse({ type: TepsSummaryResponseDto })
  async summary() {
    return this.ok(
      'TEPs summary fetched successfully',
      await this.tepsService.tepsSummary(),
    );
  }

  @Get('export')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV export of TEPs (respects list query filters)',
    schema: { type: 'string', example: 'Reference Number,Classification,...' },
  })
  async exportCsv(@Query() query: QueryTepsDto, @Res() res: Response) {
    const csv = await this.tepsService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=teps-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  @ApiOkResponse({ type: TepListResponseDto })
  async findAll(@Query() query: QueryTepsDto) {
    return this.ok(
      'TEPs fetched successfully',
      await this.tepsService.findTeps(query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: TepResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'TEP fetched successfully',
      await this.tepsService.findTep(id),
    );
  }

  @Post()
  @ApiOkResponse({ type: TepResponseDto })
  async create(@Body() dto: CreateTepDto, @CurrentUser('id') userId: string) {
    return this.ok(
      'TEP created successfully',
      await this.tepsService.createTep(dto, userId),
    );
  }

  @Post('bulk')
  @ApiOkResponse({ type: BulkTepsResponseDto })
  async bulkCreate(
    @Body() dto: BulkCreateTepsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ok(
      'TEPs created successfully',
      await this.tepsService.bulkCreateTeps(dto, userId),
    );
  }

  @Patch(':id/revoke')
  @ApiOkResponse({ type: TepResponseDto })
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'TEP revoked successfully',
      await this.tepsService.revokeTep(id, dto, actor),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
