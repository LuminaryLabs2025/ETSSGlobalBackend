import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignTeamMemberRoleDto {
  @IsUUID()
  @IsNotEmpty()
  role_id: string;
}
