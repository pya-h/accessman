import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

// Single-row table: the global token-generation settings. Always id = 1.
@Entity('settings')
export class SettingsEntity {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ name: 'code_length', type: 'int', default: 4 })
  codeLength: number;

  @Column({ name: 'prefix_app_name', type: 'boolean', default: false })
  prefixAppName: boolean;

  @Column({ name: 'include_numbers', type: 'boolean', default: true })
  includeNumbers: boolean;

  @Column({
    name: 'letter_case',
    type: 'varchar',
    length: 10,
    default: 'lower',
  })
  letterCase: 'upper' | 'lower' | 'both';

  @Column({ name: 'include_special', type: 'boolean', default: false })
  includeSpecial: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
