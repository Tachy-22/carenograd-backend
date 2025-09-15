import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { UploadController } from './upload.controller';
import { DocumentUploadService } from './document-upload.service';
import { DatabaseTokenTrackerService } from './database-token-tracker.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AgentController, UploadController],
  providers: [
    AgentService, 
    DocumentUploadService, 
    DatabaseTokenTrackerService
  ],
  exports: [AgentService, DocumentUploadService, DatabaseTokenTrackerService],
})
export class AgentModule {}