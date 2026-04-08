import { Module } from '@nestjs/common';
import { AuditController } from './infrastructure/controllers/audit.controller.js';
import { AuditService } from './application/audit.service.js';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
