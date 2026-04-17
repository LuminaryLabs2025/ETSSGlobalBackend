import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateTeamMemberDto {
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

  @IsUUID()
  @IsNotEmpty()
  user_type_id: string;

  /**
   * Permission row UUIDs (`permissions.id`). Stored as direct `user_permissions` for this user.
   */
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  permission_ids?: string[];

  @IsString()
  @IsOptional()
  department?: string;
}
