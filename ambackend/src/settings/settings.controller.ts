import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AppSecurityGuard } from '../common/guards/app-security.guard';
import { OperatorGuard } from '../common/guards/operator.guard';
import { SettingsEntity } from './settings.entity';

@Controller('settings')
@UseGuards(AppSecurityGuard, OperatorGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async get() {
    return this.toResponse(await this.settingsService.get());
  }

  @Patch()
  async update(@Body() dto: UpdateSettingsDto) {
    return this.toResponse(await this.settingsService.update(dto));
  }

  private toResponse(settings: SettingsEntity) {
    return {
      codeLength: settings.codeLength,
      prefixAppName: settings.prefixAppName,
    };
  }
}
