import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ThesisService } from '../../application/services/thesis.service.js';
import { CreateThesisDto } from '../../application/dtos/create-thesis.dto.js';
import { UpdateThesisDto } from '../../application/dtos/update-thesis.dto.js';
import { TutorDashboardQueryDto } from '../../application/dtos/tutor-dashboard-query.dto.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

@Controller('theses')
export class ThesisController {
  constructor(private readonly thesisService: ThesisService) {}

  @Post()
  async create(@Body() dto: CreateThesisDto, @CurrentUser() user: JwtPayload) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can create a thesis');
    }
    return this.thesisService.create(user.sub, dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: TutorDashboardQueryDto,
  ) {
    if (user.role === 'STUDENT') {
      return this.thesisService.findMine(user.sub);
    }
    if (user.role === 'REVIEWER') {
      return this.thesisService.findForReviewer(user.sub);
    }
    return this.thesisService.findForTutorWithFilters(user.sub, query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.thesisService.findById(id, user.sub, user.role);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateThesisDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can update their thesis');
    }
    return this.thesisService.update(id, user.sub, dto);
  }
}
