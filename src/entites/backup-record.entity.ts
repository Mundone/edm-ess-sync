// src/entities/backup-record.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  MANUAL = 'manual'
}

export enum BackupStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Entity('backup_record')
export class BackupRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'backup_name' })
  backupName: string;

  @Column({ 
    type: 'enum', 
    enum: BackupType,
    default: BackupType.MANUAL 
  })
  type: BackupType;

  @Column({ 
    type: 'enum', 
    enum: BackupStatus,
    default: BackupStatus.IN_PROGRESS 
  })
  status: BackupStatus;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'file_size', nullable: true })
  fileSize: number;

  @Column({ name: 'record_count' })
  recordCount: number;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}