// src/entities/sync-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SyncJob } from './sync-job.entity';

export enum SyncLogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug'
}

@Entity('sync_log')
export class SyncLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sync_job_id' })
  syncJobId: number;

  @Column({ 
    type: 'enum', 
    enum: SyncLogLevel,
    default: SyncLogLevel.INFO 
  })
  level: SyncLogLevel;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'employee_erp_code', nullable: true })
  employeeErpCode: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => SyncJob)
  @JoinColumn({ name: 'sync_job_id' })
  syncJob: SyncJob;
}