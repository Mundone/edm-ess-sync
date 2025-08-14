// src/sync/sync.controller.ts
import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Body, 
  Query, 
  Param, 
  UseGuards,
  Request,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { SyncConfigDto, SyncJobResponseDto, SyncLogResponseDto } from './dto/sync.dto';

@ApiTags('Sync')
@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('manual')
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ 
    summary: 'Trigger manual synchronization',
    description: 'Manually trigger EDM to ESS synchronization with custom configuration'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Sync job created successfully',
    type: SyncJobResponseDto,
  })
  async triggerManualSync(
    @Body() config: SyncConfigDto,
    @Request() req,
  ) {
    const result = await this.syncService.triggerManualSync(config, req.user.id);
    return {
      success: true,
      message: 'Manual sync triggered successfully',
      data: result,
    };
  }

  @Get('jobs')
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.HR_USER, UserRole.VIEWER)
  @ApiOperation({ 
    summary: 'Get sync job history',
    description: 'Retrieve paginated list of sync jobs with their status and details'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records to return' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of records to skip' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync jobs retrieved successfully',
  })
  async getSyncJobs(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    const jobs = await this.syncService.getSyncJobs(+limit, +offset);
    return {
      success: true,
      data: jobs,
      pagination: {
        limit: +limit,
        offset: +offset,
        total: jobs.length,
      },
    };
  }

  @Get('jobs/:id')
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.HR_USER, UserRole.VIEWER)
  @ApiOperation({ 
    summary: 'Get sync job details',
    description: 'Retrieve detailed information about a specific sync job'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync job details retrieved successfully',
  })
  async getSyncJobById(@Param('id') id: number) {
    const job = await this.syncService.getSyncJobById(+id);
    if (!job) {
      throw new BadRequestException('Sync job not found');
    }

    return {
      success: true,
      data: job,
    };
  }

  @Get('jobs/:id/logs')
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.HR_USER, UserRole.VIEWER)
  @ApiOperation({ 
    summary: 'Get sync job logs',
    description: 'Retrieve logs for a specific sync job'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync job logs retrieved successfully',
  })
  async getSyncJobLogs(
    @Param('id') id: number,
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
  ) {
    const logs = await this.syncService.getSyncLogs(+id, +limit, +offset);
    return {
      success: true,
      data: logs,
      pagination: {
        limit: +limit,
        offset: +offset,
        total: logs.length,
      },
    };
  }

  @Put('jobs/:id/cancel')
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER)
  @ApiOperation({ 
    summary: 'Cancel running sync job',
    description: 'Cancel a currently running synchronization job'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync job cancelled successfully',
  })
  async cancelSyncJob(
    @Param('id') id: number,
    @Request() req,
  ) {
    await this.syncService.cancelSyncJob(+id, req.user.id);
    return {
      success: true,
      message: 'Sync job cancelled successfully',
    };
  }

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.HR_MANAGER, UserRole.HR_USER, UserRole.VIEWER)
  @ApiOperation({ 
    summary: 'Get sync service status',
    description: 'Check the current status of the sync service and recent activity'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sync service status retrieved successfully',
  })
  async getSyncStatus() {
    const recentJobs = await this.syncService.getSyncJobs(5, 0);
    const runningJobs = recentJobs.filter(job => job.status === 'running');
    const lastSuccessfulSync = recentJobs.find(job => job.status === 'completed');

    return {
      success: true,
      data: {
        isHealthy: true,
        runningJobs: runningJobs.length,
        lastSuccessfulSync: lastSuccessfulSync?.completedAt,
        recentJobs: recentJobs.slice(0, 3),
      },
    };
  }
}

