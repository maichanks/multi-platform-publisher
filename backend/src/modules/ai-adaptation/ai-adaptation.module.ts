import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AIAdaptationService } from './services/ai-adaptation.service';
import { AIAdaptationController } from './ai-adaptation.controller';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
  ],
  providers: [AIAdaptationService],
  controllers: [AIAdaptationController],
  exports: [AIAdaptationService],
})
export class AiAdaptationModule {}
