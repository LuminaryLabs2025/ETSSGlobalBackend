import {
  IsInt,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueryAppOptionsDto {
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

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class CreateTruckTypeDto {
  @ApiProperty({ example: '40-Footer' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Booking category UUIDs to link to this truck type',
    example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  linked_booking_categories: string[];
}

export class UpdateTruckTypeDto {
  @ApiPropertyOptional({ example: '40-Footer' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Replace linked booking categories. Omit to leave links unchanged.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  linked_booking_categories?: string[];
}

export class CreateTruckCapacityDto {
  @IsUUID()
  truck_type_id: string;

  @IsString()
  @IsNotEmpty()
  capacity_value: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateTruckCapacityDto {
  @IsOptional()
  @IsUUID()
  truck_type_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  capacity_value?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateTruckLengthDto {
  @IsUUID()
  truck_type_id: string;

  @IsString()
  @IsNotEmpty()
  length_value: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateTruckLengthDto {
  @IsOptional()
  @IsUUID()
  truck_type_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  length_value?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateBookingCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateBookingCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateTepTypeDto {
  @ApiProperty({ example: 'Export TEP' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Booking category UUIDs linked to this TEP type',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  booking_category_ids: string[];

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Truck type UUIDs linked to this TEP type',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  truck_type_ids: string[];
}

export class UpdateTepTypeDto {
  @ApiPropertyOptional({ example: 'Export TEP' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Replace linked booking categories. Can be sent alone (without name).',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  booking_category_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Replace linked truck types. Can be sent alone (without name).',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  truck_type_ids?: string[];
}

export class CreateParkTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateParkTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateFacilityTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  park_type_ids: string[];
}

export class UpdateFacilityTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  park_type_ids?: string[];
}

export class CreateFacilityTimeslotDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  start_time: string;

  @IsString()
  @IsNotEmpty()
  end_time: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateFacilityTimeslotDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  start_time?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  end_time?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['TERMINAL_GATE', 'FACILITY', 'PARK', 'TRANSIT_LOCATION'])
  type: string;

  @IsOptional()
  @IsUUID()
  reference_id?: string;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TERMINAL_GATE', 'FACILITY', 'PARK', 'TRANSIT_LOCATION'])
  type?: string;

  @IsOptional()
  @IsUUID()
  reference_id?: string;
}

export class UpdateFacilityTimeslotAssignmentDto {
  @IsBoolean()
  is_active: boolean;
}

export class CreatePaymentTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  service_name: string;

  @IsString()
  @IsNotEmpty()
  linked_form: string;

  @IsString()
  @IsNotEmpty()
  revenue_event_trigger: string;

  @IsUUID()
  charged_to_user_type_id: string;

  @IsString()
  @IsIn(['FIXED', 'DYNAMIC'])
  amount_type: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdatePaymentTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  service_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  linked_form?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  revenue_event_trigger?: string;

  @IsOptional()
  @IsUUID()
  charged_to_user_type_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['FIXED', 'DYNAMIC'])
  amount_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateInfractionCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fine_amount: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateInfractionCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fine_amount?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateTerminalGateDto {
  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  entry_barrier_name: string;

  @IsString()
  @IsNotEmpty()
  entry_barrier_id: string;

  @IsString()
  @IsNotEmpty()
  exit_barrier_name: string;

  @IsString()
  @IsNotEmpty()
  exit_barrier_id: string;
}

export class UpdateTerminalGateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  location?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  entry_barrier_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  entry_barrier_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  exit_barrier_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  exit_barrier_id?: string;
}

export class CreateHandheldDeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  /** @deprecated Prefer barrier_id for Barriers module. */
  @IsOptional()
  @IsUUID()
  location_id?: string;

  @IsOptional()
  @IsUUID()
  barrier_id?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateHandheldDeviceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsUUID()
  location_id?: string;

  @IsOptional()
  @IsUUID()
  barrier_id?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateRfidTagDto {
  @IsString()
  @IsNotEmpty()
  rfid_tag_number: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  truck_id?: string;

  @IsOptional()
  @IsString()
  transporter_name?: string;
}

export class UpdateRfidTagDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status?: string;

  @IsOptional()
  @IsUUID()
  truck_id?: string;

  @IsOptional()
  @IsString()
  transporter_name?: string;
}
