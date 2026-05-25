import { Controller, Post, Param, Req, Body, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ImportService } from './import.service';
import { ImportItemDto } from './dto/import-item.dto';
import { ImportItemPerAppDto } from './dto/import-item-per-app.dto';
import { ReissueItemDto } from './dto/reissue-item.dto';
import { AppSecurityGuard } from '../common/guards/app-security.guard';
import { OperatorGuard } from '../common/guards/operator.guard';

@Controller('import')
@UseGuards(AppSecurityGuard, OperatorGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  async importTokens(@Req() request: FastifyRequest, @Body() body: any) {
    const contentType = request.headers['content-type'] as string;
    const items = this.importService.resolveItems(
      contentType,
      body,
      ImportItemDto,
    );
    return this.importService.importTokens(items);
  }

  @Post('reissue')
  async reIssueTokens(@Req() request: FastifyRequest, @Body() body: any) {
    const contentType = request.headers['content-type'] as string;
    const items = this.importService.resolveItems(
      contentType,
      body,
      ReissueItemDto,
    );
    return this.importService.reIssueTokens(items);
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
      token: item.token,
    }));
    return this.importService.importTokens(items);
  }
}
