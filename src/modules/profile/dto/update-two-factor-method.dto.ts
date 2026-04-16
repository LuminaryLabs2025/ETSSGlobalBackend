import { IsEnum } from 'class-validator';
import { TwoFactorMethod } from '../../../common/enums';

export class UpdateTwoFactorMethodDto {
  @IsEnum(TwoFactorMethod)
  method: TwoFactorMethod;
}
