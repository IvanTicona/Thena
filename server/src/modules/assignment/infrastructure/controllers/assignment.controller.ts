import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AssignmentService } from '../../application/services/assignment.service.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import { Roles } from '../../../../modules/auth/infrastructure/decorators/roles.decorator.js';
import { RolesGuard } from '../../../../modules/auth/infrastructure/guards/roles.guard.js';
import type { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';
import {
  CreateAssignmentDto,
  AssignmentListQueryDto,
} from '../../application/dtos/assignment.dto.js';

@Controller('assignments')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post()
  async create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.assignmentService.create(dto, actor.sub);
  }

  @Get()
  async findAll(@Query() query: AssignmentListQueryDto) {
    return this.assignmentService.findPaginated(query);
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.assignmentService.delete(id, actor.sub);
  }
}
