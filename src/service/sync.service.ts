// src/sync/sync.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectConnection } from '@nestjs/typeorm';
import { Repository, Connection, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Employee } from 'src/entites/employee.entity';
import { EmployeeEmployment } from 'src/entites/employee-employment.entity';
import { SyncJob, SyncJobType } from 'src/entites/sync-job.entity';
import { SyncLog } from 'src/entites/sync-log.entity';


interface SyncConfig {
  pageSize?: number;
  backupBeforeSync?: boolean;
  validateData?: boolean;
  syncEmployees?: boolean;
  syncEmployments?: boolean;
  excludeDeleted?: boolean;
  customFilters?: any;
}

interface SyncResult {
  jobId: number;
  success: boolean;
  recordsProcessed: number;
  recordsSuccess: number;
  recordsFailed: number;
  errors: string[];
  duration: number;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(Employee, 'edm')
    private edmEmployeeRepo: Repository<Employee>,
    
    @InjectRepository(EmployeeEmployment, 'edm')
    private edmEmploymentRepo: Repository<EmployeeEmployment>,
    
    @InjectRepository(SyncJob, 'edm')
    private syncJobRepo: Repository<SyncJob>,
    
    @InjectRepository(SyncLog, 'edm')
    private syncLogRepo: Repository<SyncLog>,
    
    @InjectConnection('edm')
    private edmConnection: Connection,
    
    @InjectConnection('ess')
    private essConnection: Connection,
    
    private configService: ConfigService,
    private auditService: AuditService,
    private notificationService: NotificationService,
    private backupService: BackupService,
  ) {}

  /**
   * Manual sync triggered by user
   */
  async triggerManualSync(
    config: SyncConfig = {},
    userId?: string,
  ): Promise<SyncResult> {
    this.logger.log('Manual sync triggered', { userId, config });
    
    const syncJob = await this.createSyncJob(
      'Manual Sync',
      SyncJobType.MANUAL,
      userId,
      config,
    );

    return this.performSync(syncJob);
  }

  /**
   * Scheduled sync (configurable via cron)
   */
  @Cron('0 1 * * *', {
    name: 'daily_sync',
    timeZone: 'Asia/Ulaanbaatar',
  })
  async scheduledDailySync() {
    const isEnabled = this.configService.get('SCHEDULED_SYNC_ENABLED', 'true') === 'true';
    if (!isEnabled) {
      this.logger.log('Scheduled sync is disabled');
      return;
    }

    this.logger.log('Daily scheduled sync triggered');
    
    const config: SyncConfig = {
      pageSize: parseInt(this.configService.get('SYNC_PAGE_SIZE', '500')),
      backupBeforeSync: this.configService.get('AUTO_BACKUP_BEFORE_SYNC', 'true') === 'true',
      validateData: true,
      syncEmployees: true,
      syncEmployments: true,
      excludeDeleted: true,
    };

    const syncJob = await this.createSyncJob(
      'Daily Scheduled Sync',
      SyncJobType.SCHEDULED,
      'system',
      config,
    );

    try {
      const result = await this.performSync(syncJob);
      await this.notificationService.sendSyncCompletionNotification(result);
    } catch (error) {
      this.logger.error('Scheduled sync failed', error);
      await this.notificationService.sendSyncErrorNotification(syncJob.id, error.message);
    }
  }

  /**
   * Core sync logic
   */
  private async performSync(syncJob: SyncJob): Promise<SyncResult> {
    const startTime = Date.now();
    let queryRunner: QueryRunner;

    try {
      // Update job status
      await this.updateSyncJobStatus(syncJob.id, SyncJobStatus.RUNNING);

      // Create backup if requested
      if (syncJob.syncConfig?.backupBeforeSync) {
        this.logger.log('Creating backup before sync', { jobId: syncJob.id });
        await this.backupService.createBackup('auto_pre_sync', 'system');
      }

      // Initialize counters
      let recordsProcessed = 0;
      let recordsSuccess = 0;
      let recordsFailed = 0;
      const errors: string[] = [];

      // Get ESS connection query runner for transaction
      queryRunner = this.essConnection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Sync employees
        if (syncJob.syncConfig?.syncEmployees !== false) {
          const employeeResult = await this.syncEmployees(
            syncJob.id,
            queryRunner,
            syncJob.syncConfig,
          );
          recordsProcessed += employeeResult.processed;
          recordsSuccess += employeeResult.success;
          recordsFailed += employeeResult.failed;
          errors.push(...employeeResult.errors);
        }

        // Sync employments
        if (syncJob.syncConfig?.syncEmployments !== false) {
          const employmentResult = await this.syncEmployments(
            syncJob.id,
            queryRunner,
            syncJob.syncConfig,
          );
          recordsProcessed += employmentResult.processed;
          recordsSuccess += employmentResult.success;
          recordsFailed += employmentResult.failed;
          errors.push(...employmentResult.errors);
        }

        // Commit transaction if no critical errors
        await queryRunner.commitTransaction();

        // Update job completion
        const duration = Date.now() - startTime;
        await this.completeSyncJob(syncJob.id, recordsProcessed, recordsSuccess, recordsFailed);

        this.logger.log('Sync completed successfully', {
          jobId: syncJob.id,
          recordsProcessed,
          recordsSuccess,
          recordsFailed,
          duration,
        });

        return {
          jobId: syncJob.id,
          success: true,
          recordsProcessed,
          recordsSuccess,
          recordsFailed,
          errors,
          duration,
        };

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }

    } catch (error) {
      this.logger.error('Sync failed', error);
      await this.failSyncJob(syncJob.id, error.message);
      
      const duration = Date.now() - startTime;
      return {
        jobId: syncJob.id,
        success: false,
        recordsProcessed: 0,
        recordsSuccess: 0,
        recordsFailed: 0,
        errors: [error.message],
        duration,
      };
    }
  }

  /**
   * Sync employees from EDM to ESS
   */
  private async syncEmployees(
    jobId: number,
    queryRunner: QueryRunner,
    config: SyncConfig,
  ) {
    const pageSize = config.pageSize || 500;
    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    this.logger.log('Starting employee sync', { jobId, pageSize });

    // Build query with filters
    let query = this.edmEmployeeRepo.createQueryBuilder('e');
    
    if (config.excludeDeleted) {
      query = query.where('e.deletedAt IS NULL');
    }
    
    if (config.customFilters) {
      // Apply custom filters
      Object.entries(config.customFilters).forEach(([key, value]) => {
        query = query.andWhere(`e.${key} = :${key}`, { [key]: value });
      });
    }

    const totalCount = await query.getCount();
    this.logger.log(`Found ${totalCount} employees to sync`);

    // Process in batches
    for (let offset = 0; offset < totalCount; offset += pageSize) {
      const employees = await query
        .skip(offset)
        .take(pageSize)
        .getMany();

      for (const employee of employees) {
        try {
          // Data validation
          if (config.validateData) {
            await this.validateEmployeeData(employee);
          }

          // Perform upsert
          await this.upsertEmployeeToESS(employee, queryRunner);
          
          success++;
          await this.logSyncOperation(jobId, SyncLogLevel.INFO, 
            `Employee ${employee.erpCode} synced successfully`, employee.erpCode);

        } catch (error) {
          failed++;
          const errorMsg = `Failed to sync employee ${employee.erpCode}: ${error.message}`;
          errors.push(errorMsg);
          
          await this.logSyncOperation(jobId, SyncLogLevel.ERROR, errorMsg, employee.erpCode, {
            error: error.message,
            stack: error.stack,
          });
        }
        processed++;
      }

      // Update progress
      await this.updateSyncJobProgress(jobId, processed, success, failed);
      
      this.logger.log(`Processed batch: ${offset + pageSize}/${totalCount} employees`);
    }

    return { processed, success, failed, errors };
  }

  /**
   * Sync employee employments from EDM to ESS
   */
  private async syncEmployments(
    jobId: number,
    queryRunner: QueryRunner,
    config: SyncConfig,
  ) {
    const pageSize = config.pageSize || 500;
    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    this.logger.log('Starting employment sync', { jobId, pageSize });

    // Build query with joins
    let query = this.edmEmploymentRepo.createQueryBuilder('emp')
      .leftJoinAndSelect('emp.employee', 'e');
    
    if (config.excludeDeleted) {
      query = query.where('emp.deletedAt IS NULL')
        .andWhere('e.deletedAt IS NULL');
    }

    const totalCount = await query.getCount();
    this.logger.log(`Found ${totalCount} employments to sync`);

    // Process in batches
    for (let offset = 0; offset < totalCount; offset += pageSize) {
      const employments = await query
        .skip(offset)
        .take(pageSize)
        .getMany();

      for (const employment of employments) {
        try {
          // Data validation
          if (config.validateData) {
            await this.validateEmploymentData(employment);
          }

          // Perform upsert
          await this.upsertEmploymentToESS(employment, queryRunner);
          
          success++;
          await this.logSyncOperation(jobId, SyncLogLevel.INFO, 
            `Employment ${employment.erpCode} synced successfully`, employment.erpCode);

        } catch (error) {
          failed++;
          const errorMsg = `Failed to sync employment ${employment.erpCode}: ${error.message}`;
          errors.push(errorMsg);
          
          await this.logSyncOperation(jobId, SyncLogLevel.ERROR, errorMsg, employment.erpCode, {
            error: error.message,
            stack: error.stack,
          });
        }
        processed++;
      }

      // Update progress
      await this.updateSyncJobProgress(jobId, processed, success, failed);
      
      this.logger.log(`Processed batch: ${offset + pageSize}/${totalCount} employments`);
    }

    return { processed, success, failed, errors };
  }

  /**
   * Upsert employee to ESS database
   */
  private async upsertEmployeeToESS(employee: Employee, queryRunner: QueryRunner) {
    const upsertQuery = `
      INSERT INTO public.employee (
        "erpCode", "registrationNumber", "firstName", "lastName",
        "phoneNumber", "phoneNumber2", "workEmail", "gender",
        "startWorkingDate", "firstStartWorkingDate", 
        "emergencyContactName", "emergencyContactPhone",
        "portraitImage", "portraitImageFallback",
        "createdAt", "updatedAt", "deletedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      ON CONFLICT ("erpCode") DO UPDATE SET
        "registrationNumber" = EXCLUDED."registrationNumber",
        "firstName" = EXCLUDED."firstName",
        "lastName" = EXCLUDED."lastName",
        "phoneNumber" = EXCLUDED."phoneNumber",
        "phoneNumber2" = EXCLUDED."phoneNumber2",
        "workEmail" = EXCLUDED."workEmail",
        "gender" = EXCLUDED."gender",
        "startWorkingDate" = EXCLUDED."startWorkingDate",
        "firstStartWorkingDate" = EXCLUDED."firstStartWorkingDate",
        "emergencyContactName" = EXCLUDED."emergencyContactName",
        "emergencyContactPhone" = EXCLUDED."emergencyContactPhone",
        "portraitImage" = EXCLUDED."portraitImage",
        "portraitImageFallback" = EXCLUDED."portraitImageFallback",
        "updatedAt" = EXCLUDED."updatedAt",
        "deletedAt" = EXCLUDED."deletedAt"
    `;

    await queryRunner.query(upsertQuery, [
      employee.erpCode,
      employee.registrationNumber,
      employee.firstname,
      employee.lastname,
      employee.employeePhone1,
      employee.employeePhone2,
      employee.email,
      employee.gender,
      employee.companyEnrolledDate,
      employee.mmcFirstEnrolledDate,
      employee.emergencyContactName,
      employee.emergencyContactPhone,
      employee.portraitImage,
      employee.portraitImageFallback,
      employee.createdAt,
      employee.updatedAt,
      employee.deletedAt,
    ]);
  }

  /**
   * Upsert employment to ESS database
   */
  private async upsertEmploymentToESS(employment: EmployeeEmployment, queryRunner: QueryRunner) {
    const upsertQuery = `
      INSERT INTO public.employee (
        "erpCode", "grade", "commuteFrom", "vehicleType",
        "workLocation", "rosterSchedule", "rosterType", "company",
        "unit", "unitAbbr", "unitAbbr2", "code", "section", "sectionAbbr",
        "office", "officeAbbr", "officeMn", "department", "departmentAbbr",
        "division", "position", "positionType", "isRoster",
        "workingCondition", "status", "employmentCondition",
        "isUHGCampResident", "isTKHCampResident",
        "createdAt", "updatedAt", "deletedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
      )
      ON CONFLICT ("erpCode") DO UPDATE SET
        "grade" = EXCLUDED."grade",
        "commuteFrom" = EXCLUDED."commuteFrom",
        "vehicleType" = EXCLUDED."vehicleType",
        "workLocation" = EXCLUDED."workLocation",
        "rosterSchedule" = EXCLUDED."rosterSchedule",
        "rosterType" = EXCLUDED."rosterType",
        "company" = EXCLUDED."company",
        "unit" = EXCLUDED."unit",
        "unitAbbr" = EXCLUDED."unitAbbr",
        "unitAbbr2" = EXCLUDED."unitAbbr2",
        "code" = EXCLUDED."code",
        "section" = EXCLUDED."section",
        "sectionAbbr" = EXCLUDED."sectionAbbr",
        "office" = EXCLUDED."office",
        "officeAbbr" = EXCLUDED."officeAbbr",
        "officeMn" = EXCLUDED."officeMn",
        "department" = EXCLUDED."department",
        "departmentAbbr" = EXCLUDED."departmentAbbr",
        "division" = EXCLUDED."division",
        "position" = EXCLUDED."position",
        "positionType" = EXCLUDED."positionType",
        "isRoster" = EXCLUDED."isRoster",
        "workingCondition" = EXCLUDED."workingCondition",
        "status" = EXCLUDED."status",
        "employmentCondition" = EXCLUDED."employmentCondition",
        "isUHGCampResident" = EXCLUDED."isUHGCampResident",
        "isTKHCampResident" = EXCLUDED."isTKHCampResident",
        "updatedAt" = EXCLUDED."updatedAt",
        "deletedAt" = EXCLUDED."deletedAt"
    `;

    await queryRunner.query(upsertQuery, [
      employment.erpCode,
      employment.grade,
      employment.commuteFrom,
      employment.vehicleType,
      employment.workLocation,
      employment.rosterSchedule,
      employment.rosterType,
      employment.company,
      employment.unit,
      employment.unitAbbr,
      employment.unitAbbr2,
      employment.code,
      employment.subsection,
      employment.subsectionAbbr,
      employment.section,
      employment.sectionAbbr,
      employment.sectionMn,
      employment.department,
      employment.departmentAbbr,
      employment.division,
      employment.position,
      employment.positionType,
      employment.isRoster,
      employment.workingCondition,
      employment.employeeStatus,
      employment.employmentCondition,
      employment.isUhgCampResident,
      employment.isTkhCampResident,
      employment.createdAt,
      employment.updatedAt,
      employment.deletedAt,
    ]);
  }

  /**
   * Data validation methods
   */
  private async validateEmployeeData(employee: Employee) {
    if (!employee.erpCode) {
      throw new BadRequestException('ERP Code is required');
    }
    if (!employee.firstname) {
      throw new BadRequestException('First name is required');
    }
    if (!employee.lastname) {
      throw new BadRequestException('Last name is required');
    }
    // Add more validation rules as needed
  }

  private async validateEmploymentData(employment: EmployeeEmployment) {
    if (!employment.erpCode) {
      throw new BadRequestException('ERP Code is required');
    }
    // Add more validation rules as needed
  }

  /**
   * Sync job management methods
   */
  private async createSyncJob(
    jobName: string,
    type: SyncJobType,
    startedBy: string,
    config: SyncConfig,
  ): Promise<SyncJob> {
    const syncJob = this.syncJobRepo.create({
      jobName,
      type,
      startedBy,
      syncConfig: config,
      status: SyncJobStatus.PENDING,
    });

    return this.syncJobRepo.save(syncJob);
  }

  private async updateSyncJobStatus(jobId: number, status: SyncJobStatus) {
    await this.syncJobRepo.update(jobId, {
      status,
      startedAt: status === SyncJobStatus.RUNNING ? new Date() : undefined,
    });
  }

  private async updateSyncJobProgress(
    jobId: number,
    processed: number,
    success: number,
    failed: number,
  ) {
    await this.syncJobRepo.update(jobId, {
      recordsProcessed: processed,
      recordsSuccess: success,
      recordsFailed: failed,
    });
  }

  private async completeSyncJob(
    jobId: number,
    processed: number,
    success: number,
    failed: number,
  ) {
    await this.syncJobRepo.update(jobId, {
      status: SyncJobStatus.COMPLETED,
      completedAt: new Date(),
      recordsProcessed: processed,
      recordsSuccess: success,
      recordsFailed: failed,
    });
  }

  private async failSyncJob(jobId: number, errorMessage: string) {
    await this.syncJobRepo.update(jobId, {
      status: SyncJobStatus.FAILED,
      completedAt: new Date(),
      errorMessage,
    });
  }

  private async logSyncOperation(
    jobId: number,
    level: SyncLogLevel,
    message: string,
    erpCode?: string,
    metadata?: any,
  ) {
    const syncLog = this.syncLogRepo.create({
      syncJobId: jobId,
      level,
      message,
      employeeErpCode: erpCode,
      metadata,
    });

    await this.syncLogRepo.save(syncLog);
  }

  /**
   * Get sync status and history
   */
  async getSyncJobs(limit = 50, offset = 0) {
    return this.syncJobRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getSyncJobById(id: number) {
    return this.syncJobRepo.findOne({ where: { id } });
  }

  async getSyncLogs(jobId: number, limit = 100, offset = 0) {
    return this.syncLogRepo.find({
      where: { syncJobId: jobId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Cancel running sync job
   */
  async cancelSyncJob(jobId: number, userId: string) {
    const job = await this.syncJobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new BadRequestException('Sync job not found');
    }

    if (job.status !== SyncJobStatus.RUNNING) {
      throw new BadRequestException('Can only cancel running jobs');
    }

    await this.syncJobRepo.update(jobId, {
      status: SyncJobStatus.CANCELLED,
      completedAt: new Date(),
      errorMessage: `Cancelled by user: ${userId}`,
    });

    await this.auditService.log({
      userId,
      action: 'CANCEL_SYNC',
      resourceType: 'sync_job',
      resourceId: jobId.toString(),
      metadata: { jobId },
    });
  }
}