import { Module } from '@nestjs/common';
import { AssignmentController } from './infrastructure/controllers/assignment.controller.js';
import { AssignmentService } from './application/services/assignment.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [AssignmentController],
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
