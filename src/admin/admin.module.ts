import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AllocationModule } from '../allocation/allocation.module';
import { MultiApiAllocationService } from '../services/multi-api-allocation.service';
import { GeminiKeyPoolService } from '../services/gemini-key-pool.service';

@Module({
  imports: [DatabaseModule, AuthModule, AllocationModule],
  controllers: [AdminController],
  providers: [AdminService, MultiApiAllocationService, GeminiKeyPoolService],
  exports: [AdminService],
})
export class AdminModule {}