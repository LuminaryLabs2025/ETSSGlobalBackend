import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// ─── Shared query ───
export class QueryOperationsDto {
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

  @IsOptional()
  @IsString()
  search?: string;

  /** Tab filter: all | verified | unverified | flagged | disabled */
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  visibility?: string;
}

export const TRUCK_TYPES = [
  '20-FOOTER',
  '40-FOOTER',
  'FLATBED',
  'LOW_LOADER',
  'TANKER',
  'CURTAINSIDER',
] as const;

export const TRUCK_REGISTRATION_STATUSES = [
  'MSS_VERIFIED',
  'UNVERIFIED',
  'VERIFICATION_REQUESTED',
  'FLAGGED',
  'DISABLED',
  'ARCHIVED',
] as const;

export const TRUCK_STATUSES = [
  'AVAILABLE',
  'ON_TRIP',
  'IN_FACILITY',
  'MATCHED',
  'GTG_FACILITY',
  'LEFT_FACILITY',
  'IN_PREGATE',
  'GTG_PREGATE',
  'LEFT_PREGATE',
  'IN_TERMINAL',
  'LEFT_TERMINAL',
] as const;

export const VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const;

export const PENALTY_TYPES = [
  'OVERSTAY',
  'ROUTE_VIOLATION',
  'UNAUTHORIZED_PARKING',
  'OVERWEIGHT',
  'CONTRABAND',
] as const;

export const PAYMENT_STATUSES = [
  'UNPAID',
  'PAID',
  'OVERRIDDEN',
  'DISPUTED',
] as const;

export const DRIVER_VERIFICATION_STATUSES = [
  'VERIFIED',
  'UNVERIFIED',
  'VERIFICATION_IN_PROGRESS',
  'FLAGGED',
  'DISABLED',
  'ARCHIVED',
] as const;

export const DRIVER_OPERATIONAL_STATUSES = [
  'AVAILABLE',
  'ON_TRIP',
  'IN_FACILITY',
  'IN_PREGATE',
  'IN_TERMINAL',
  'OFF_DUTY',
  'SUSPENDED',
] as const;

export const DRIVER_SEXES = ['MALE', 'FEMALE'] as const;

export const FLAG_TYPES = [
  'TRAFFIC_VIOLATION',
  'MISCONDUCT',
  'ACCIDENT',
  'UNAUTHORIZED_ROUTE',
  'EXPIRED_LICENSE',
  'CUSTOMER_COMPLAINT',
] as const;

export const FLAG_STATUSES = ['ACTIVE', 'CLEARED', 'UNDER_REVIEW'] as const;

export const TEP_CLASSIFICATIONS = [
  'EMPTY_TDO',
  'IMPORT_TDO',
  'EXPORT_TDO',
  'GATEPASS_PORT',
  'GATEPASS_NON_PORT',
] as const;

export const TEP_SOURCES = [
  'SHIPPING_LINE',
  'PORT_TERMINAL',
  'NON_PORT_TERMINAL',
  'EPT',
] as const;

export const TEP_MATCH_STATUSES = ['MATCHED', 'UNMATCHED'] as const;

export const TEP_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'] as const;

export const DISPUTE_STATUSES = [
  'PENDING_REVIEW',
  'UNDER_NPA_REVIEW',
  'RESOLVED',
  'REJECTED',
] as const;

export const RESOLUTION_OUTCOMES = [
  'FINE_UPHELD',
  'FINE_WAIVED',
  'FINE_ADJUSTED',
] as const;

export class QueryTrucksDto extends QueryOperationsDto {
  @IsOptional()
  @IsString()
  registration_status?: string;

  @IsOptional()
  @IsString()
  truck_status?: string;

  @IsOptional()
  @IsString()
  truck_type?: string;

  @IsOptional()
  @IsString()
  penalty_type?: string;

  @IsOptional()
  @IsString()
  payment_status?: string;
}

export class QueryDriversDto extends QueryOperationsDto {
  @IsOptional()
  @IsString()
  verification_status?: string;

  @IsOptional()
  @IsString()
  operational_status?: string;

  @IsOptional()
  @IsString()
  flag_type?: string;

  @IsOptional()
  @IsString()
  flag_status?: string;
}

export class QueryTepsDto extends QueryOperationsDto {
  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  match_status?: string;
}

export class QueryDisputesDto extends QueryOperationsDto {
  @IsOptional()
  @IsString()
  dispute_status?: string;

  @IsOptional()
  @IsString()
  resolution_outcome?: string;
}

export class ReasonDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

// ─── Trucks ───
export class CreateTruckDto {
  @IsString()
  @IsNotEmpty()
  plate_number: string;

  @IsString()
  @IsIn(TRUCK_TYPES)
  truck_type: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  chassis_number?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  truck_length?: string;

  @IsOptional()
  @IsString()
  truck_capacity?: string;

  @IsUUID()
  transporter_company_id: string;

  @IsOptional()
  @IsString()
  @IsIn(VISIBILITIES)
  visibility?: string;
}

export class BulkCreateTrucksDto {
  @IsUUID()
  transporter_company_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTruckItemDto)
  trucks: CreateTruckItemDto[];
}

export class CreateTruckItemDto {
  @IsString()
  @IsNotEmpty()
  plate_number: string;

  @IsString()
  @IsIn(TRUCK_TYPES)
  truck_type: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  chassis_number?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  truck_length?: string;

  @IsOptional()
  @IsString()
  truck_capacity?: string;

  @IsOptional()
  @IsString()
  @IsIn(VISIBILITIES)
  visibility?: string;
}

// ─── Drivers ───
export class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsOptional()
  @IsString()
  mobile_number?: string;

  @IsString()
  @IsNotEmpty()
  license_number: string;

  @IsDateString()
  license_expiry_date: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  @IsIn(DRIVER_SEXES)
  sex?: string;

  @IsUUID()
  transporter_company_id: string;

  @IsOptional()
  @IsString()
  @IsIn(VISIBILITIES)
  visibility?: string;
}

// ─── TEPs ───
export class CreateTepDto {
  @IsString()
  @IsNotEmpty()
  reference_number: string;

  @IsString()
  @IsIn(TEP_CLASSIFICATIONS)
  classification: string;

  @IsString()
  @IsNotEmpty()
  facility_name: string;

  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  truck_plate_number?: string;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;
}

export class BulkCreateTepsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTepDto)
  teps: CreateTepDto[];
}

export class ResolveDisputeDto {
  @IsString()
  @IsIn(DISPUTE_STATUSES)
  dispute_status: string;

  @IsOptional()
  @IsString()
  @IsIn(RESOLUTION_OUTCOMES)
  resolution_outcome?: string;

  @IsOptional()
  @Type(() => Number)
  adjusted_amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

/** Maps TEP classification to upload source per design rules. */
export const TEP_SOURCE_BY_CLASSIFICATION: Record<string, string> = {
  EMPTY_TDO: 'SHIPPING_LINE',
  IMPORT_TDO: 'PORT_TERMINAL',
  EXPORT_TDO: 'EPT',
  GATEPASS_PORT: 'PORT_TERMINAL',
  GATEPASS_NON_PORT: 'NON_PORT_TERMINAL',
};
