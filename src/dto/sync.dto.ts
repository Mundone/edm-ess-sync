// src/sync/dto/sync.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsNumber, IsObject, Min, Max } from 'class-validator';

export class SyncConfigDto {
  @ApiPropertyOptional({ 
    description: 'Number of records to process per batch',
    minimum: 100,
    maximum: 2000,
    default: 500,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(2000)
  pageSize?: number;

  @ApiPropertyOptional({ 
    description: 'Create backup before synchronization',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  backupBeforeSync?: boolean;

  @ApiPropertyOptional({ 
    description: 'Validate data before insertion',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  validateData?: boolean;

  @ApiPropertyOptional({ 
    description: 'Synchronize employee records',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  syncEmployees?: boolean;

  @ApiPropertyOptional({ 
    description: 'Synchronize employment records',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  syncEmployments?: boolean;

  @ApiPropertyOptional({ 
    description: 'Exclude deleted records from sync',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  excludeDeleted?: boolean;

  @ApiPropertyOptional({ 
    description: 'Custom filters to apply during sync',
    example: { department: 'IT', status: 'active' },
  })
  @IsOptional()
  @IsObject()
  customFilters?: any;
}

export class SyncJobResponseDto {
  @ApiProperty()
  jobId: number;

  @ApiProperty()
  success: boolean;

  @ApiProperty()
  recordsProcessed: number;

  @ApiProperty()
  recordsSuccess: number;

  @ApiProperty()
  recordsFailed: number;

  @ApiProperty()
  errors: string[];

  @ApiProperty()
  duration: number;
}

export class SyncLogResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  level: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  employeeErpCode: string;

  @ApiProperty()
  metadata: any;

  @ApiProperty()
  createdAt: Date;
}