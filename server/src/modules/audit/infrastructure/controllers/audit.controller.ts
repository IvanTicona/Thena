import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from '../../application/audit.service.js';
import { QueryAuditLogsDto } from '../../application/dtos/query-audit-logs.dto.js';
import { Roles } from '../../../../modules/auth/infrastructure/decorators/roles.decorator.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

@Controller('audit-logs')
@Roles('SUPER_ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Query() query: QueryAuditLogsDto,
    @CurrentUser() _user: JwtPayload,
  ) {
    return this.auditService.findAll({
      action: query.action,
      actorId: query.actorId,
      entityType: query.entityType,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page: query.page,
      limit: query.limit,
    });
  }
}
