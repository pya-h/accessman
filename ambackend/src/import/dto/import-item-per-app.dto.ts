import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class ImportItemPerAppDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  token?: string;
}
