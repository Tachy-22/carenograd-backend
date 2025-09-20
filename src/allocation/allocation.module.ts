import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AllocationController } from './allocation.controller';
import { MultiApiAllocationService } from '../services/multi-api-allocation.service';
import { GeminiKeyPoolService } from '../services/gemini-key-pool.service';
import { GeminiWithKeyPoolService } from '../services/gemini-with-key-pool.service';

@Module({
  imports: [ConfigModule],
  controllers: [AllocationController],
  providers: [
    MultiApiAllocationService,
    GeminiKeyPoolService,
    GeminiWithKeyPoolService,
  ],
  exports: [
    MultiApiAllocationService,
    GeminiKeyPoolService,
    GeminiWithKeyPoolService,
  ],
})
export class AllocationModule {}