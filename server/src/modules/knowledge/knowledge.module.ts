import { Module } from '@nestjs/common';
import { KnowledgeController } from './infrastructure/controllers/knowledge.controller.js';
import { KnowledgeService } from './application/services/knowledge.service.js';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
