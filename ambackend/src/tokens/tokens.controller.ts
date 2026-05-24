import { Controller, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { UpdateMetadataDto } from './dto/update-metadata.dto';
import { AppSecurityGuard } from '../common/guards/app-security.guard';
import { RequestApp } from '../common/decorators/app-name.decorator';
import { AppEntity } from '../apps/app.entity';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @UseGuards(AppSecurityGuard)
  @Post('verify')
  async verify(@Body() dto: VerifyTokenDto, @RequestApp() app: AppEntity) {
    return this.tokensService.verify(dto.token, app.name);
  }

  @UseGuards(AppSecurityGuard)
  @Patch('metadata')
  async updateMetadata(
    @Body() dto: UpdateMetadataDto,
    @RequestApp() app: AppEntity,
  ) {
    return this.tokensService.updateMetadata(dto.token, app.name, dto.metadata);
  }
}
