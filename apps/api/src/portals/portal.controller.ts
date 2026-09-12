import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { PortalMaintenanceRequestDto } from './portal.dto';
import { PortalOwnerService } from './portal-owner.service';
import { PortalTenantService } from './portal-tenant.service';

@Controller({ path: 'portal/owner', version: '1' })
@UseGuards(SessionAuthGuard)
export class PortalOwnerController {
  constructor(private readonly ownerPortal: PortalOwnerService) {}

  @Get('overview')
  overview(@Req() request: AuthenticatedRequest) {
    return this.ownerPortal.overview(request.principal);
  }

  @Get('statements')
  statements(@Req() request: AuthenticatedRequest) {
    return this.ownerPortal.statements(request.principal);
  }

  @Get('statements/:id')
  statement(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.ownerPortal.statementDetail(request.principal, id);
  }

  @Get('payouts')
  payouts(@Req() request: AuthenticatedRequest) {
    return this.ownerPortal.payouts(request.principal);
  }

  @Get('maintenance')
  maintenance(@Req() request: AuthenticatedRequest) {
    return this.ownerPortal.maintenance(request.principal);
  }

  @Get('activity')
  activity(@Req() request: AuthenticatedRequest) {
    return this.ownerPortal.activity(request.principal);
  }

  @Get('properties/:propertyId/occupancy')
  occupancy(@Req() request: AuthenticatedRequest, @Param('propertyId') propertyId: string) {
    return this.ownerPortal.propertyOccupancy(request.principal, propertyId);
  }
}

@Controller({ path: 'portal/tenant', version: '1' })
@UseGuards(SessionAuthGuard)
export class PortalTenantController {
  constructor(private readonly tenantPortal: PortalTenantService) {}

  @Get('overview')
  overview(@Req() request: AuthenticatedRequest) {
    return this.tenantPortal.overview(request.principal);
  }

  @Get('invoices')
  invoices(@Req() request: AuthenticatedRequest) {
    return this.tenantPortal.invoices(request.principal);
  }

  @Get('payments')
  payments(@Req() request: AuthenticatedRequest) {
    return this.tenantPortal.payments(request.principal);
  }

  @Get('receipts')
  receipts(@Req() request: AuthenticatedRequest) {
    return this.tenantPortal.receipts(request.principal);
  }

  @Get('maintenance')
  maintenance(@Req() request: AuthenticatedRequest) {
    return this.tenantPortal.maintenance(request.principal);
  }

  @Post('maintenance')
  createMaintenance(@Req() request: AuthenticatedRequest, @Body() body: PortalMaintenanceRequestDto) {
    return this.tenantPortal.createMaintenance(request.principal, body);
  }

  @Get('profile')
  profile(@Req() request: AuthenticatedRequest) {
    return this.tenantPortal.profile(request.principal);
  }

  @Get('move-in')
  moveIn(@Req() request: AuthenticatedRequest) {
    return this.tenantPortal.moveIn(request.principal);
  }
}
