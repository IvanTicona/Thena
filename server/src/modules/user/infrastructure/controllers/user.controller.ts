import { Controller, Get, Req } from '@nestjs/common';
import { UserService } from '../../application/services/user.service.js';
import { AuthenticatedRequest } from '../../../../shared/mock-auth/mock-auth.middleware.js';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.userService.findById(req.user.id);
  }

  @Get()
  async findAll() {
    return this.userService.findAll();
  }
}
