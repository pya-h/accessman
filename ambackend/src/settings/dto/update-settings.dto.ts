import { IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MIN_CODE_LENGTH, MAX_CODE_LENGTH } from '../../tokens/token.utils';

export class UpdateSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_CODE_LENGTH)
  @Max(MAX_CODE_LENGTH)
  codeLength?: number;

  @IsOptional()
  @IsBoolean()
  prefixAppName?: boolean;
}
