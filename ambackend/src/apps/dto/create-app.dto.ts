import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateAppDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
