import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AppsService } from './apps.service';
import { CreateAppDto } from './dto/create-app.dto';
import { AppSecurityGuard } from '../common/guards/app-security.guard';
import { OperatorGuard } from '../common/guards/operator.guard';

@Controller('apps')
@UseGuards(AppSecurityGuard, OperatorGuard)
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Get()
  async findAll() {
    return this.appsService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateAppDto) {
    return this.appsService.create(dto.name);
  }
}
