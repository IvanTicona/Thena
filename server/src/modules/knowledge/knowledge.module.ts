import { Module } from '@nestjs/common';
import { KnowledgeController } from './infrastructure/controllers/knowledge.controller.js';
import { KnowledgeService } from './application/services/knowledge.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}
