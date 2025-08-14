import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';

// Modules
import { SyncModule } from './sync/sync.module';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';
import { NotificationModule } from './notification/notification.module';

// Entities
import { Employee } from './entites/employee.entity';
import { EmployeeEmployment } from './entites/employee-employment.entity';
import { SyncJob } from './entites/sync-job.entity';
import { SyncLog } from './entites/sync-log.entity';
import { BackupRecord } from './entites/backup-record.entity';
import { AuditLog } from './entites/audit-log.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database connections
    TypeOrmModule.forRootAsync({
      name: 'edm',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('EDM_DB_HOST'),
        port: configService.get('EDM_DB_PORT', 5432),
        username: configService.get('EDM_DB_USER'),
        password: configService.get('EDM_DB_PASSWORD'),
        database: configService.get('EDM_DB_NAME'),
        entities: [Employee, EmployeeEmployment, SyncJob, SyncLog, BackupRecord, AuditLog],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        ssl: configService.get('EDM_DB_SSL') === 'true' ? {
          rejectUnauthorized: false,
        } : false,
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forRootAsync({
      name: 'ess',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('ESS_DB_HOST'),
        port: configService.get('ESS_DB_PORT', 5432),
        username: configService.get('ESS_DB_USER'),
        password: configService.get('ESS_DB_PASSWORD'),
        database: configService.get('ESS_DB_NAME'),
        entities: [],
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
        ssl: configService.get('ESS_DB_SSL') === 'true' ? {
          rejectUnauthorized: false,
        } : false,
      }),
      inject: [ConfigService],
    }),

    // JWT Module
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),

    // Schedule Module for cron jobs
    ScheduleModule.forRoot(),

  ],
})
export class AppModule {}