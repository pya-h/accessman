import {
  Controller,
  Post,
  Param,
  Req,
  Body,
  Inject,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { ConfigType } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { parse } from 'csv-parse/sync';
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
    const items = this.resolveItems(request, body, ImportItemDto);
    return this.importService.importTokens(items, this.defaultExpiryDays);
  }

  @Post(':appName')
  async importForApp(
    @Param('appName') appName: string,
    @Req() request: FastifyRequest,
    @Body() body: any,
  ) {
    const perAppItems = this.resolveItems(request, body, ImportItemPerAppDto);
    const items = perAppItems.map((item) => ({
      userId: item.userId,
      appName,
      expiresAt: item.expiresAt,
    }));
    return this.importService.importTokens(items, this.defaultExpiryDays);
  }

  private resolveItems<T extends object>(
    request: FastifyRequest,
    body: any,
    dtoClass: new () => T,
  ): T[] {
    const contentType = request.headers['content-type'] as string;
    let rawItems: any[];

    if (contentType?.includes('text/csv')) {
      rawItems = this.parseCsv(body as string);
    } else {
      if (!Array.isArray(body)) {
        throw new BadRequestException('Request body must be an array');
      }
      rawItems = body;
    }

    const instances = plainToInstance(dtoClass, rawItems);
    for (const instance of instances) {
      const errors = validateSync(instance);
      if (errors.length > 0) {
        throw new BadRequestException('Invalid import data');
      }
    }

    return instances;
  }

  private parseCsv(raw: string): Record<string, any>[] {
    try {
      const records = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      return (records as Record<string, string>[]).map((record) => {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(record)) {
          cleaned[key] = value === '' ? undefined : value;
        }
        return cleaned;
      });
    } catch {
      throw new BadRequestException('Invalid CSV data');
    }
  }
}
