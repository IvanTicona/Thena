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
import { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/v1/notifications
   * Returns paginated notifications for the authenticated user + unreadCount.
   */
  @Get()
  async findAll(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationService.findByUser(user.sub, query.page, query.limit);
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Mark all notifications as read for the authenticated user.
   * Must be defined BEFORE :id route to avoid route conflict.
   */
  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationService.markAllAsRead(user.sub);
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark a single notification as read (verifies ownership).
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationService.markAsRead(id, user.sub);
  }
}
