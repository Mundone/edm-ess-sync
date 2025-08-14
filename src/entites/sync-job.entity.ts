// src/entities/sync-job.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SyncJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum SyncJobType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  AUTO = 'auto'
}

@Entity('sync_job')
export class SyncJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'job_name' })
  jobName: string;

  @Column({ 
    type: 'enum', 
    enum: SyncJobType,
    default: SyncJobType.MANUAL 
  })
  type: SyncJobType;

  @Column({ 
    type: 'enum', 
    enum: SyncJobStatus,
    default: SyncJobStatus.PENDING 
  })
  status: SyncJobStatus;

  @Column({ name: 'started_by', nullable: true })
  startedBy: string;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ name: 'records_processed', default: 0 })
  recordsProcessed: number;

  @Column({ name: 'records_success', default: 0 })
  recordsSuccess: number;

  @Column({ name: 'records_failed', default: 0 })
  recordsFailed: number;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage: string;

  @Column({ name: 'sync_config', type: 'jsonb', nullable: true })
  syncConfig: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}