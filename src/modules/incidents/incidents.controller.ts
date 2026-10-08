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
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PermissionsGuard } from '../../common/guards';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IncidentActor, IncidentsService } from './incidents.service';
import {
  AddIncidentCommentDto,
  AddIncidentEvidenceDto,
  ApproveIncidentResolutionDto,
  AssignIncidentDto,
  CreateIncidentDto,
  EmergencyResponseDto,
  EscalateIncidentDto,
  QueryAssigneeCompaniesDto,
  QueryAssigneeUsersDto,
  QueryIncidentsDto,
  QueryMyIncidentsDto,
  RejectIncidentResolutionDto,
  ReopenIncidentDto,
  RequestIncidentEvidenceDto,
  ResolveIncidentDto,
  SetIncidentDeadlineDto,
  SubmitIncidentResolutionDto,
  UpdateIncidentSeverityDto,
} from './dto/incidents.dto';

const ok = (message: string, data: unknown) => ({
  success: true,
  message,
  data,
});

/** SuperAdmin incident management (MVP 090). */
@ApiTags('incidents')
@ApiBearerAuth('access-token')
@Controller('api/incidents')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get('summary')
  @Permissions('view_incident_reports')
  @ApiOperation({ summary: 'Live/Open, pending approval and resolved counts' })
  async summary(@Query() query: QueryIncidentsDto) {
    return ok(
      'Incident summary fetched successfully',
      await this.incidentsService.summary(query),
    );
  }

  @Get('export')
  @Permissions('view_incident_reports')
  @ApiProduces('text/csv')
  async exportCsv(@Query() query: QueryIncidentsDto, @Res() res: Response) {
    const csv = await this.incidentsService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=incidents-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get('assignees/companies')
  @Permissions('manage_incident_reports')
  @ApiOperation({ summary: 'Teams (companies) an incident can be assigned to' })
  async assigneeCompanies(@Query() query: QueryAssigneeCompaniesDto) {
    return ok(
      'Assignee companies fetched successfully',
      await this.incidentsService.assigneeCompanies(query.search),
    );
  }

  @Get('assignees/users')
  @Permissions('manage_incident_reports')
  @ApiOperation({
    summary: 'Users of a company an incident can be assigned to',
  })
  async assigneeUsers(@Query() query: QueryAssigneeUsersDto) {
    return ok(
      'Assignee users fetched successfully',
      await this.incidentsService.assigneeUsers(query.company_id),
    );
  }

  @Get()
  @Permissions('view_incident_reports')
  async findAll(@Query() query: QueryIncidentsDto) {
    return ok(
      'Incidents fetched successfully',
      await this.incidentsService.findAll(query),
    );
  }

  @Get(':id')
  @Permissions('view_incident_reports')
  @ApiOperation({
    summary:
      'Incident details: reporter, related truck/booking/driver, evidence, timeline, notes, actions taken, resolution',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return ok(
      'Incident fetched successfully',
      await this.incidentsService.findDetail(id),
    );
  }

  @Patch(':id/assign')
  @Permissions('manage_incident_reports')
  @ApiOperation({
    summary: 'Assign / reassign to a team (company) and/or user',
  })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignIncidentDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incident assigned successfully',
      await this.incidentsService.assign(id, dto, user),
    );
  }

  @Patch(':id/severity')
  @Permissions('manage_incident_reports')
  async updateSeverity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentSeverityDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incident severity updated successfully',
      await this.incidentsService.updateSeverity(id, dto, user),
    );
  }

  @Patch(':id/deadline')
  @Permissions('manage_incident_reports')
  async setDeadline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetIncidentDeadlineDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incident priority deadline set successfully',
      await this.incidentsService.setDeadline(id, dto, user),
    );
  }

  @Post(':id/comments')
  @Permissions('manage_incident_reports')
  @ApiOperation({ summary: 'Add a comment or instruction' })
  async comment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIncidentCommentDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Comment added successfully',
      await this.incidentsService.commentAsAdmin(id, dto, user),
    );
  }

  @Post(':id/escalate')
  @Permissions('manage_incident_reports')
  @ApiOperation({
    summary: 'Escalate to management, NPA or executive management',
  })
  async escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateIncidentDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incident escalated successfully',
      await this.incidentsService.escalate(id, dto, user),
    );
  }

  @Post(':id/request-evidence')
  @Permissions('manage_incident_reports')
  async requestEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestIncidentEvidenceDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Evidence requested successfully',
      await this.incidentsService.requestEvidence(id, dto, user),
    );
  }

  @Post(':id/emergency-response')
  @Permissions('manage_incident_reports')
  async emergencyResponse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EmergencyResponseDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Emergency response triggered successfully',
      await this.incidentsService.triggerEmergency(id, dto, user),
    );
  }

  @Patch(':id/approve-resolution')
  @Permissions('manage_incident_reports')
  async approveResolution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveIncidentResolutionDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Resolution approved — incident closed',
      await this.incidentsService.approveResolution(id, dto, user),
    );
  }

  @Patch(':id/reject-resolution')
  @Permissions('manage_incident_reports')
  async rejectResolution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectIncidentResolutionDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Resolution rejected — incident reopened',
      await this.incidentsService.rejectResolution(id, dto, user),
    );
  }

  @Patch(':id/resolve')
  @Permissions('manage_incident_reports')
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incident resolved successfully',
      await this.incidentsService.resolve(id, dto, user),
    );
  }

  @Patch(':id/reopen')
  @Permissions('manage_incident_reports')
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenIncidentDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incident reopened successfully',
      await this.incidentsService.reopen(id, dto, user),
    );
  }
}

/**
 * Account-side incident reporting: PRIMARY account holders report and
 * follow their company's incidents; assigned teams work and resolve them.
 */
@ApiTags('incident-reports')
@ApiBearerAuth('access-token')
@Controller('api/incident-reports')
@UseGuards(AuthGuard('jwt'))
export class IncidentReportsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Report an incident (PRIMARY account holders only)',
  })
  async create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incident reported successfully',
      await this.incidentsService.create(dto, user),
    );
  }

  @Get()
  @ApiOperation({
    summary:
      'Incidents my company reported (scope=REPORTED) or assigned to me / my company (scope=ASSIGNED)',
  })
  async findMine(
    @Query() query: QueryMyIncidentsDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incidents fetched successfully',
      await this.incidentsService.findMine(query, user),
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incident fetched successfully',
      await this.incidentsService.findMineOne(id, user),
    );
  }

  @Post(':id/evidence')
  @ApiOperation({
    summary: 'Attach evidence (answers a SuperAdmin evidence request)',
  })
  async addEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIncidentEvidenceDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Evidence added successfully',
      await this.incidentsService.addEvidenceAsAccount(id, dto, user),
    );
  }

  @Post(':id/comments')
  async comment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIncidentCommentDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Comment added successfully',
      await this.incidentsService.commentAsAccount(id, dto, user),
    );
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Assigned team starts work (→ IN_PROGRESS)' })
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Incident marked in progress',
      await this.incidentsService.startWork(id, user),
    );
  }

  @Patch(':id/submit-resolution')
  @ApiOperation({
    summary: 'Assigned team submits the resolution for SuperAdmin approval',
  })
  async submitResolution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitIncidentResolutionDto,
    @CurrentUser() user: IncidentActor,
  ) {
    return ok(
      'Resolution submitted for SuperAdmin approval',
      await this.incidentsService.submitResolution(id, dto, user),
    );
  }
}
