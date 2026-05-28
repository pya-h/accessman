import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { parse } from 'csv-parse/sync';
import { AppEntity } from '../apps/app.entity';
import { TokenEntity } from '../tokens/token.entity';
import {
  generateToken,
  validateCustomToken,
  processCustomToken,
  MAX_GENERATION_ATTEMPTS,
  type CharsetOptions,
} from '../tokens/token.utils';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ImportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
  ) {}

  // Generates a unique token, retrying on hash collisions (likely with short
  // codes). Returns null if no unique code was found within the attempt budget.
  private async generateUniqueToken(
    manager: EntityManager,
    appName: string,
    codeLength: number,
    prefixAppName: boolean,
    charset: CharsetOptions,
  ): Promise<{ raw: string; hash: string; prefix: string } | null> {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const candidate = generateToken(
        appName,
        codeLength,
        prefixAppName,
        charset,
      );
      const clash = await manager.findOne(TokenEntity, {
        where: { tokenHash: candidate.hash },
      });
      if (!clash) return candidate;
    }
    return null;
  }

  async importTokens(
    items: {
      userId?: string;
      appName: string;
      expiresAt?: string;
      token?: string;
    }[],
  ): Promise<{
    imported: {
      userId: string;
      appName: string;
      token: string;
      expiresAt: Date | null;
    }[];
    errors: { userId: string; appName: string; reason: string }[];
  }> {
    const settings = await this.settingsService.get();
    const { codeLength, prefixAppName } = settings;
    const charset: CharsetOptions = {
      includeNumbers: settings.includeNumbers,
      letterCase: settings.letterCase,
      includeSpecial: settings.includeSpecial,
    };

    return this.dataSource.transaction(async (manager) => {
      const imported: {
        userId: string;
        appName: string;
        token: string;
        expiresAt: Date | null;
      }[] = [];
      const errors: {
        userId: string;
        appName: string;
        reason: string;
      }[] = [];

      // Collect unique app names and findOrCreate each
      const uniqueAppNames = [...new Set(items.map((i) => i.appName))];
      const appMap = new Map<string, number>();

      for (const name of uniqueAppNames) {
        let app = await manager.findOne(AppEntity, { where: { name } });
        if (!app) {
          app = manager.create(AppEntity, { name });
          app = await manager.save(app);
        }
        appMap.set(name, app.id);
      }

      // Process each item
      for (const item of items) {
        const userId = item.userId || randomUUID();
        const appId = appMap.get(item.appName)!;

        const existing = await manager.findOne(TokenEntity, {
          where: { userId, appId, revokedAt: IsNull() },
        });

        if (existing) {
          errors.push({
            userId,
            appName: item.appName,
            reason: 'Token already exists for this user and app',
          });
          continue;
        }

        let raw: string, hash: string, prefix: string;

        if (item.token) {
          const validationError = validateCustomToken(item.token);
          if (validationError) {
            errors.push({
              userId,
              appName: item.appName,
              reason: validationError,
            });
            continue;
          }

          const processed = processCustomToken(item.token);
          raw = processed.raw;
          hash = processed.hash;
          prefix = processed.prefix;

          // Check for hash collision
          const hashExists = await manager.findOne(TokenEntity, {
            where: { tokenHash: hash },
          });
          if (hashExists) {
            errors.push({
              userId,
              appName: item.appName,
              reason: 'Token already exists (duplicate token value)',
            });
            continue;
          }
        } else {
          const generated = await this.generateUniqueToken(
            manager,
            item.appName,
            codeLength,
            prefixAppName,
            charset,
          );
          if (!generated) {
            errors.push({
              userId,
              appName: item.appName,
              reason: `Could not generate a unique code after ${MAX_GENERATION_ATTEMPTS} attempts. Increase the code length, provide a custom token, or retry.`,
            });
            continue;
          }
          ({ raw, hash, prefix } = generated);
        }

        const expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;

        const token = manager.create(TokenEntity, {
          userId,
          appId,
          tokenHash: hash,
          tokenPrefix: prefix,
          metadata: {},
          expiresAt,
        });
        await manager.save(token);

        imported.push({
          userId,
          appName: item.appName,
          token: raw,
          expiresAt,
        });
      }

      return { imported, errors };
    });
  }

  async reIssueTokens(
    items: {
      userId: string;
      appName: string;
      expiresAt?: string;
      token?: string;
    }[],
  ): Promise<{
    imported: {
      userId: string;
      appName: string;
      token: string;
      expiresAt: Date | null;
    }[];
    errors: { userId: string; appName: string; reason: string }[];
  }> {
    const settings = await this.settingsService.get();
    const { codeLength, prefixAppName } = settings;
    const charset: CharsetOptions = {
      includeNumbers: settings.includeNumbers,
      letterCase: settings.letterCase,
      includeSpecial: settings.includeSpecial,
    };

    return this.dataSource.transaction(async (manager) => {
      const imported: {
        userId: string;
        appName: string;
        token: string;
        expiresAt: Date | null;
      }[] = [];
      const errors: {
        userId: string;
        appName: string;
        reason: string;
      }[] = [];

      const uniqueAppNames = [...new Set(items.map((i) => i.appName))];
      const appMap = new Map<string, number>();

      for (const name of uniqueAppNames) {
        let app = await manager.findOne(AppEntity, { where: { name } });
        if (!app) {
          app = manager.create(AppEntity, { name });
          app = await manager.save(app);
        }
        appMap.set(name, app.id);
      }

      for (const item of items) {
        const appId = appMap.get(item.appName)!;

        const existing = await manager.findOne(TokenEntity, {
          where: { userId: item.userId, appId, revokedAt: IsNull() },
        });

        let raw: string, hash: string, prefix: string;

        if (item.token) {
          const validationError = validateCustomToken(item.token);
          if (validationError) {
            errors.push({
              userId: item.userId,
              appName: item.appName,
              reason: validationError,
            });
            continue;
          }

          const processed = processCustomToken(item.token);
          raw = processed.raw;
          hash = processed.hash;
          prefix = processed.prefix;

          // Check for hash collision
          const hashExists = await manager.findOne(TokenEntity, {
            where: { tokenHash: hash },
          });
          if (hashExists) {
            errors.push({
              userId: item.userId,
              appName: item.appName,
              reason: 'Token already exists (duplicate token value)',
            });
            continue;
          }
        } else {
          const generated = await this.generateUniqueToken(
            manager,
            item.appName,
            codeLength,
            prefixAppName,
            charset,
          );
          if (!generated) {
            errors.push({
              userId: item.userId,
              appName: item.appName,
              reason: `Could not generate a unique code after ${MAX_GENERATION_ATTEMPTS} attempts. Increase the code length, provide a custom token, or retry.`,
            });
            continue;
          }
          ({ raw, hash, prefix } = generated);
        }

        if (existing) {
          existing.revokedAt = new Date();
          await manager.save(existing);
        }

        const expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;

        const token = manager.create(TokenEntity, {
          userId: item.userId,
          appId,
          tokenHash: hash,
          tokenPrefix: prefix,
          metadata: {},
          expiresAt,
        });
        await manager.save(token);

        imported.push({
          userId: item.userId,
          appName: item.appName,
          token: raw,
          expiresAt,
        });
      }

      return { imported, errors };
    });
  }

  resolveItems<T extends object>(
    contentType: string | undefined,
    body: any,
    dtoClass: new () => T,
  ): T[] {
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
