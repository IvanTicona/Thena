import {
  Controller,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ObservationService } from '../../application/services/observation.service.js';
import {
  CreateObservationDto,
  UpdateObservationDto,
} from '../../application/dtos/observation.dto.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

@Controller('observations')
export class ObservationController {
  constructor(private readonly observationService: ObservationService) {}

  @Post()
  async create(
    @Body() dto: CreateObservationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'TUTOR') {
      throw new ForbiddenException('Only tutors can create observations');
    }
    return this.observationService.create(user.sub, dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateObservationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'TUTOR') {
      throw new ForbiddenException('Only tutors can edit observations');
    }
    return this.observationService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'TUTOR') {
      throw new ForbiddenException('Only tutors can delete observations');
    }
    await this.observationService.remove(id, user.sub);
  }
}
