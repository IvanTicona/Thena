import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { UserService } from '../../application/services/user.service.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import { Roles } from '../../../../modules/auth/infrastructure/decorators/roles.decorator.js';
import { RolesGuard } from '../../../../modules/auth/infrastructure/guards/roles.guard.js';
import { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  UserListQueryDto,
} from '../../application/dtos/user.dto.js';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ─── Current User ──────────────────────────────────────────────────────

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.userService.findById(user.sub);
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ─── Admin-only User Management ──────────────────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.userService.create(dto, actor.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async findAll(@Query() query: UserListQueryDto) {
    return this.userService.findPaginated(query);
  }

  @Get('tutors')
  async getTutors() {
    return this.userService.findTutors();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.getById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.userService.update(id, dto, actor.sub);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.userService.delete(id, actor.sub);
  }

  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.userService.restore(id, actor.sub);
  }
}
