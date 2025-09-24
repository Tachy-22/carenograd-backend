import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { UploadController } from './upload.controller';
import { DocumentUploadService } from './document-upload.service';
import { DatabaseTokenTrackerService } from './database-token-tracker.service';
import { AgentCacheService } from './agent-cache.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AllocationModule } from '../allocation/allocation.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { GeminiWithKeyPoolService } from '../services/gemini-with-key-pool.service';

@Module({
  imports: [DatabaseModule, AuthModule, AllocationModule, SubscriptionModule],
  controllers: [AgentController, UploadController],
  providers: [
    AgentService, 
    DocumentUploadService, 
    DatabaseTokenTrackerService,
    AgentCacheService,
    GeminiWithKeyPoolService
  ],
  exports: [AgentService, DocumentUploadService, DatabaseTokenTrackerService],
})
export class AgentModule {}