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

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  async getActiveAlerts(@Query('thesisId') thesisId?: string) {
    return this.alertService.getActiveAlerts(thesisId);
  }

  @Patch(':id/resolve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async resolveAlert(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertService.resolveAlert(id);
  }
}
