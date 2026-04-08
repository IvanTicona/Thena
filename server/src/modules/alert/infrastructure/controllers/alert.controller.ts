import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AlertService } from '../../application/alert.service.js';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard.js';
import { Roles } from '../../../auth/infrastructure/decorators/roles.decorator.js';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  /**
   * GET /api/v1/alerts
   * Returns all active (unresolved) alerts. Admin/Super-admin only.
   * Optional query param: ?thesisId=<uuid>
   */
  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  async getActiveAlerts(@Query('thesisId') thesisId?: string) {
    return this.alertService.getActiveAlerts(thesisId);
  }

  /**
   * PATCH /api/v1/alerts/:id/resolve
   * Manually resolves an alert. Admin/Super-admin only.
   */
  @Patch(':id/resolve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async resolveAlert(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertService.resolveAlert(id);
  }
}
