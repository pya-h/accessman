import {
  Controller,
  Post,
  Param,
  Req,
  Body,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ConfigType } from '@nestjs/config';
import { ImportService } from './import.service';
import { ImportItemDto } from './dto/import-item.dto';
import { ImportItemPerAppDto } from './dto/import-item-per-app.dto';
import { AppSecurityGuard } from '../common/guards/app-security.guard';
import { OperatorGuard } from '../common/guards/operator.guard';
import tokenConfig from '../config/token.config';

@Controller('import')
@UseGuards(AppSecurityGuard, OperatorGuard)
export class ImportController {
  private readonly defaultExpiryDays: number;

  constructor(
    private readonly importService: ImportService,
    @Inject(tokenConfig.KEY)
    private readonly tokenConf: ConfigType<typeof tokenConfig>,
  ) {
    this.defaultExpiryDays = this.tokenConf.defaultExpiryDays;
  }

  @Post()
  async importTokens(@Req() request: FastifyRequest, @Body() body: any) {
    const contentType = request.headers['content-type'] as string;
    const items = this.importService.resolveItems(
      contentType,
      body,
      ImportItemDto,
    );
    return this.importService.importTokens(items, this.defaultExpiryDays);
  }

  @Post('reissue')
  async reIssueTokens(@Req() request: FastifyRequest, @Body() body: any) {
    const contentType = request.headers['content-type'] as string;
    const items = this.importService.resolveItems(
      contentType,
      body,
      ImportItemDto,
    );
    return this.importService.reIssueTokens(items, this.defaultExpiryDays);
  }

  @Post(':appName')
  async importForApp(
    @Param('appName') appName: string,
    @Req() request: FastifyRequest,
    @Body() body: any,
  ) {
    const contentType = request.headers['content-type'] as string;
    const perAppItems = this.importService.resolveItems(
      contentType,
      body,
      ImportItemPerAppDto,
    );
    const items = perAppItems.map((item) => ({
      userId: item.userId,
      appName,
      expiresAt: item.expiresAt,
    }));
    return this.importService.importTokens(items, this.defaultExpiryDays);
  }
}
