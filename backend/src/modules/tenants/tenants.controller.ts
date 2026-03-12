import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('api/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @UseGuards(TenantGuard)
  getCurrentTenant(@Req() req: any) {
    return this.tenantsService.getCurrentTenant(req);
  }
}
