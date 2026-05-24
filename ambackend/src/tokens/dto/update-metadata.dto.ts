import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class UpdateMetadataDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsObject()
  metadata: Record<string, any>;
}
