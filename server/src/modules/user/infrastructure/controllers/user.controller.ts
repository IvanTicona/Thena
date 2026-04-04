import { Controller, Get } from '@nestjs/common';
import { UserService } from '../../application/services/user.service.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.userService.findById(user.sub);
  }
}
