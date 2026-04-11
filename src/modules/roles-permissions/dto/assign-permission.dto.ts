import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignPermissionDto {
  @IsUUID()
  @IsNotEmpty()
  role_id: string;

  @IsUUID()
  @IsNotEmpty()
  permission_id: string;
}
