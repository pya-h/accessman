import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppEntity } from '../apps/app.entity';
import { TokenEntity } from '../tokens/token.entity';
import { generateToken } from '../tokens/token.utils';

@Injectable()
export class ImportService {
  constructor(private readonly dataSource: DataSource) {}

  async importTokens(
    items: { userId: string; appName: string; expiresAt?: string }[],
    defaultExpiryDays: number,
  ): Promise<{
    imported: {
      userId: string;
      appName: string;
      token: string;
      expiresAt: Date;
    }[];
    errors: { userId: string; appName: string; reason: string }[];
  }> {
    return this.dataSource.transaction(async (manager) => {
      const imported: {
        userId: string;
        appName: string;
        token: string;
        expiresAt: Date;
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
        const appId = appMap.get(item.appName)!;

        const existing = await manager.findOne(TokenEntity, {
          where: { userId: item.userId, appId },
        });

        if (existing) {
          errors.push({
            userId: item.userId,
            appName: item.appName,
            reason: 'Token already exists for this user and app',
          });
          continue;
        }

        const { raw, hash, prefix } = generateToken(item.appName);

        let expiresAt: Date;
        if (item.expiresAt) {
          expiresAt = new Date(item.expiresAt);
        } else {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + defaultExpiryDays);
        }

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
}
