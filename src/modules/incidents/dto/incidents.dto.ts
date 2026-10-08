import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  INCIDENT_ESCALATION_LEVELS,
  INCIDENT_LOCATION_KINDS,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
} from '../../../database/entities/incidents.entities';
import { DATE_PRESETS, DatePreset } from '../../../common/utils/date-range';
import {
  EMERGENCY_ACTIONS,
  STATUS_GROUPS,
  StatusGroup,
} from '../incidents.constants';

export class IncidentEvidenceItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @ApiPropertyOptional({ enum: ['PHOTO', 'FILE'], default: 'FILE' })
  @IsOptional()
  @IsIn(['PHOTO', 'FILE'])
  type?: 'PHOTO' | 'FILE';

  @ApiPropertyOptional({ description: 'Uploaded file URL' })
  @IsUrl({ require_tld: false })
  url: string;
}

export class CreateIncidentDto {
  @ApiPropertyOptional({ enum: INCIDENT_TYPES })
  @IsIn(INCIDENT_TYPES)
  type: (typeof INCIDENT_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES, default: 'MEDIUM' })
  @IsOptional()
  @IsIn(INCIDENT_SEVERITIES)
  severity?: (typeof INCIDENT_SEVERITIES)[number];

  @ApiPropertyOptional({ enum: INCIDENT_LOCATION_KINDS })
  @IsIn(INCIDENT_LOCATION_KINDS)
  location_kind: (typeof INCIDENT_LOCATION_KINDS)[number];

  @ApiPropertyOptional({
    description: 'Facility / transit park / terminal id matching location_kind',
  })
  @IsOptional()
  @IsUUID()
  location_id?: string;

  @ApiPropertyOptional({ description: 'Required when location_id is not sent' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location_name?: string;

  @ApiPropertyOptional({ description: 'TRUCK_BREAKDOWN only' })
  @IsOptional()
  @IsUUID()
  truck_id?: string;

  @ApiPropertyOptional({ description: 'TRUCK_BREAKDOWN only' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  truck_plate_number?: string;

  @ApiPropertyOptional({
    description: 'TRUCK_BREAKDOWN only — driver record id',
  })
  @IsOptional()
  @IsUUID()
  driver_id?: string;

  @ApiPropertyOptional({
    description: 'TRUCK_BREAKDOWN only — booking record id',
  })
  @IsOptional()
  @IsUUID()
  booking_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  payment_reference?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => IncidentEvidenceItemDto)
  evidence?: IncidentEvidenceItemDto[];
}

export class QueryIncidentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Incident reference ID (also plate / location / reporter)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: INCIDENT_TYPES })
  @IsOptional()
  @IsIn(INCIDENT_TYPES)
  type?: string;

  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES })
  @IsOptional()
  @IsIn(INCIDENT_SEVERITIES)
  severity?: string;

  @ApiPropertyOptional({ enum: INCIDENT_STATUSES })
  @IsOptional()
  @IsIn(INCIDENT_STATUSES)
  status?: string;

  @ApiPropertyOptional({
    enum: STATUS_GROUPS,
    description: 'OPEN = live/open statuses, RESOLVED = resolved + closed',
  })
  @IsOptional()
  @IsIn(STATUS_GROUPS)
  status_group?: StatusGroup;

  @ApiPropertyOptional({ enum: INCIDENT_LOCATION_KINDS })
  @IsOptional()
  @IsIn(INCIDENT_LOCATION_KINDS)
  location_kind?: string;

  @IsOptional()
  @IsUUID()
  assigned_company_id?: string;

  @ApiPropertyOptional({ enum: DATE_PRESETS })
  @IsOptional()
  @IsIn(DATE_PRESETS)
  date_preset?: DatePreset;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

export class QueryMyIncidentsDto extends QueryIncidentsDto {
  @ApiPropertyOptional({
    enum: ['REPORTED', 'ASSIGNED'],
    default: 'REPORTED',
    description:
      'REPORTED = incidents my company reported, ASSIGNED = incidents assigned to me / my company',
  })
  @IsOptional()
  @IsIn(['REPORTED', 'ASSIGNED'])
  scope?: 'REPORTED' | 'ASSIGNED';
}

export class QueryAssigneeCompaniesDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryAssigneeUsersDto {
  @IsUUID()
  company_id: string;
}

export class AssignIncidentDto {
  @ApiPropertyOptional({ description: 'Team = company' })
  @IsOptional()
  @IsUUID()
  assigned_company_id?: string;

  @ApiPropertyOptional({
    description: 'Defaults the team to the user’s company',
  })
  @IsOptional()
  @IsUUID()
  assigned_user_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpdateIncidentSeverityDto {
  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES })
  @IsIn(INCIDENT_SEVERITIES)
  severity: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class SetIncidentDeadlineDto {
  @ApiPropertyOptional({ example: '2026-10-10T17:00:00.000Z' })
  @IsDateString()
  priority_deadline: string;
}

export class AddIncidentCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({
    enum: ['COMMENT', 'INSTRUCTION'],
    default: 'COMMENT',
    description: 'INSTRUCTION is SuperAdmin-only',
  })
  @IsOptional()
  @IsIn(['COMMENT', 'INSTRUCTION'])
  kind?: 'COMMENT' | 'INSTRUCTION';
}

export class EscalateIncidentDto {
  @ApiPropertyOptional({ enum: INCIDENT_ESCALATION_LEVELS })
  @IsIn(INCIDENT_ESCALATION_LEVELS)
  level: (typeof INCIDENT_ESCALATION_LEVELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RequestIncidentEvidenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}

export class EmergencyResponseDto {
  @ApiPropertyOptional({ enum: EMERGENCY_ACTIONS })
  @IsIn(EMERGENCY_ACTIONS)
  action: (typeof EMERGENCY_ACTIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ResolveIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  root_cause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  corrective_action?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  resolution_notes: string;
}

export class SubmitIncidentResolutionDto extends ResolveIncidentDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => IncidentEvidenceItemDto)
  evidence?: IncidentEvidenceItemDto[];
}

export class ApproveIncidentResolutionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RejectIncidentResolutionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class ReopenIncidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class AddIncidentEvidenceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => IncidentEvidenceItemDto)
  evidence: IncidentEvidenceItemDto[];
}
