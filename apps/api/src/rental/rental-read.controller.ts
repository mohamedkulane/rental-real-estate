import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { CrmReadService } from '../crm/crm-read.service';
import { LeasingService } from '../leasing/leasing.service';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { RentalPresentationService } from './rental-presentation.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'rental', version: '1' })
export class RentalReadController {
  constructor(
    private readonly presentation: RentalPresentationService,
    private readonly crm: CrmReadService,
    private readonly leasing: LeasingService,
  ) {}

  @Get('properties')
  @RequirePermissions('portfolio.property.read')
  listProperties(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.presentation.listRentalProperties(request.principal, {
      ...(search ? { search } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(cursor ? { cursor } : {}),
    });
  }

  @Get('sale-properties')
  @RequirePermissions('portfolio.property.read')
  listSaleProperties(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.presentation.listSaleProperties(request.principal, {
      ...(search ? { search } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(cursor ? { cursor } : {}),
    });
  }

  @Get('properties/:propertyId')
  @RequirePermissions('portfolio.property.read')
  getProperty(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.presentation.getRentalProperty(request.principal, propertyId);
  }

  @Get('customers')
  @RequirePermissions('crm.lead.read')
  listCustomers(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.presentation.listRentalCustomers(request.principal, {
      ...(search ? { search } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(cursor ? { cursor } : {}),
    });
  }

  @Get('customers/:leadId')
  @RequirePermissions('crm.lead.read')
  getCustomer(
    @Req() request: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ) {
    return this.crm.get(request.principal, leadId, request.correlationId);
  }

  @Get('buyers')
  @RequirePermissions('crm.lead.read')
  listBuyers(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.presentation.listBuyers(request.principal, {
      ...(search ? { search } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(cursor ? { cursor } : {}),
    });
  }

  @Get('buyers/:leadId')
  @RequirePermissions('crm.lead.read')
  getBuyer(
    @Req() request: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) leadId: string,
  ) {
    return this.crm.get(request.principal, leadId, request.correlationId);
  }

  @Get('leases/:leaseId')
  @RequirePermissions('lease.read')
  getLease(
    @Req() request: AuthenticatedRequest,
    @Param('leaseId', ParseUUIDPipe) leaseId: string,
  ) {
    return this.leasing.getLease(request.principal, leaseId);
  }
}
