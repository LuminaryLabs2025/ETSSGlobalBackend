import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DttrService } from './dttr.service';
import {
  ConfigureModeDto,
  DttrBreakdownDto,
  QueryDttrDto,
  SuperAdminEditDttrDto,
} from './dto/dttr.dto';
import {
  DttrEditAuditListResponseDto,
  DttrSubmissionListResponseDto,
  DttrSummaryResponseDto,
  DttrTerminalListResponseDto,
  DttrTerminalResponseDto,
} from './dto/dttr-response.dto';

@ApiTags('dttr')
@ApiBearerAuth('access-token')
@Controller('api/dttr')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class DttrController {
  constructor(private readonly dttrService: DttrService) {}

  @Get('summary')
  @ApiOkResponse({ type: DttrSummaryResponseDto })
  async summary() {
    return this.ok(
      'DTTR summary fetched successfully',
      await this.dttrService.summary(),
    );
  }

  @Get('edit-audit')
  @ApiOkResponse({ type: DttrEditAuditListResponseDto })
  async editAudits() {
    return this.ok(
      'DTTR edit audits fetched successfully',
      await this.dttrService.findEditAudits(),
    );
  }

  @Get()
  @ApiOkResponse({ type: DttrTerminalListResponseDto })
  async findAll(@Query() query: QueryDttrDto) {
    return this.ok(
      'DTTR terminal requests fetched successfully',
      await this.dttrService.findAll(query),
    );
  }

  @Get(':id/submissions')
  @ApiOkResponse({ type: DttrSubmissionListResponseDto })
  async submissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'DTTR submissions fetched successfully',
      await this.dttrService.findSubmissions(id),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: DttrTerminalResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'DTTR terminal request fetched successfully',
      await this.dttrService.findOne(id),
    );
  }

  @Post(':id/submit')
  @ApiOkResponse({ type: DttrTerminalResponseDto })
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DttrBreakdownDto,
    @CurrentUser() user: { id: string; first_name: string; last_name: string },
  ) {
    return this.ok(
      'DTTR request submitted successfully',
      await this.dttrService.submit(id, dto, user),
    );
  }

  @Patch(':id/configure-mode')
  @ApiOkResponse({ type: DttrTerminalResponseDto })
  async configureMode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfigureModeDto,
  ) {
    return this.ok(
      'DTTR request mode configured successfully',
      await this.dttrService.configureMode(id, dto),
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: DttrTerminalResponseDto })
  async superAdminEdit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuperAdminEditDttrDto,
    @CurrentUser() user: { id: string; first_name: string; last_name: string },
  ) {
    return this.ok(
      'DTTR request updated successfully',
      await this.dttrService.superAdminEdit(id, dto, user),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
