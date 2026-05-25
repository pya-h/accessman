import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import { TokensService } from './tokens.service';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { UpdateMetadataDto } from './dto/update-metadata.dto';
import { ListTokensQueryDto } from './dto/list-tokens-query.dto';
import { AppSecurityGuard } from '../common/guards/app-security.guard';
import { OperatorGuard } from '../common/guards/operator.guard';
import { RequestApp } from '../common/decorators/app-name.decorator';
import { AppEntity } from '../apps/app.entity';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @UseGuards(AppSecurityGuard)
  @Post('verify')
  @HttpCode(200)
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

  @UseGuards(AppSecurityGuard, OperatorGuard)
  @Get()
  async findAll(@Query() query: ListTokensQueryDto) {
    return this.tokensService.findAll(query);
  }

  @UseGuards(AppSecurityGuard, OperatorGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tokensService.findOne(id);
  }

  @UseGuards(AppSecurityGuard, OperatorGuard)
  @Post(':id/revoke')
  async revoke(@Param('id', ParseIntPipe) id: number) {
    return this.tokensService.revoke(id);
  }
}
