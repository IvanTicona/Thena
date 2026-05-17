import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationService } from '../../application/notification.service.js';
import { QueryNotificationsDto } from '../../application/dtos/query-notifications.dto.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async findAll(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationService.findByUser(
      user.sub,
      query.page,
      query.limit,
    );
  }

  // Must be defined BEFORE :id route to avoid route conflict
  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationService.markAllAsRead(user.sub);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationService.markAsRead(id, user.sub);
  }
}
