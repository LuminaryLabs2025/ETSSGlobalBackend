import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsObject,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsUUID()
  @IsNotEmpty()
  user_type_id: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsString()
  @IsOptional()
  organization_name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  /** Keys must match `UserType.metadata.fields[].name` (snake_case), e.g. `park_name`, `linked_axis`. */
  @IsObject()
  @IsOptional()
  extra_fields?: Record<string, any>;
}
