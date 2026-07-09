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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
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

@ApiTags('teps')
@ApiBearerAuth('access-token')
@Controller('api/teps')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class TepsController {
  constructor(private readonly tepsService: TepsService) {}

  @Get('summary')
  @ApiOkResponse({ description: 'TEP dashboard summary counts' })
  async summary() {
    return this.ok(
      'TEPs summary fetched successfully',
      await this.tepsService.tepsSummary(),
    );
  }

  @Get('export')
  async exportCsv(@Query() query: QueryTepsDto, @Res() res: Response) {
    const csv = await this.tepsService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=teps-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  async findAll(@Query() query: QueryTepsDto) {
    return this.ok(
      'TEPs fetched successfully',
      await this.tepsService.findTeps(query),
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'TEP fetched successfully',
      await this.tepsService.findTep(id),
    );
  }

  @Post()
  async create(@Body() dto: CreateTepDto, @CurrentUser('id') userId: string) {
    return this.ok(
      'TEP created successfully',
      await this.tepsService.createTep(dto, userId),
    );
  }

  @Post('bulk')
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
