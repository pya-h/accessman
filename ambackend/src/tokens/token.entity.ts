import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { AppEntity } from '../apps/app.entity';

@Entity('tokens')
@Unique(['userId', 'app'])
@Index(['tokenHash'])
export class TokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'varchar', length: 128 })
  userId: string;

  @ManyToOne(() => AppEntity, (app) => app.tokens)
  @JoinColumn({ name: 'app_id' })
  app: AppEntity;

  @Column({ name: 'app_id' })
  appId: number;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @Column({ name: 'token_prefix', type: 'varchar', length: 120 })
  tokenPrefix: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
