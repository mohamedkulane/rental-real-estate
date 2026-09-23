import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import {
  AddBuyerDto,
  AddOwnerAndPropertyDto,
  AddRentalCustomerDto,
  AddRentalOwnerDto,
  AddRentalPropertyDto,
  CreateRentalLeaseDto,
  StartFullManagementDto,
  StartRentalBrokerageDto,
} from './rental.dto';
import { RentalOrchestrationService } from './rental-orchestration.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'rental/commands', version: '1' })
export class RentalCommandController {
  constructor(private readonly rental: RentalOrchestrationService) {}

  @Post('add-owner')
  @RequirePermissions('party.create', 'owner.create')
  addOwner(@Req() request: AuthenticatedRequest, @Body() input: AddRentalOwnerDto) {
    return this.rental.addOwner(request.principal, input, request.correlationId);
  }

  @Post('add-property')
  @RequirePermissions(
    'portfolio.property.create',
    'portfolio.ownership.manage',
    'portfolio.space.create',
    'portfolio.property.update',
  )
  addProperty(@Req() request: AuthenticatedRequest, @Body() input: AddRentalPropertyDto) {
    return this.rental.addProperty(request.principal, input, request.correlationId);
  }

  @Post('add-owner-and-property')
  @RequirePermissions(
    'party.create',
    'owner.create',
    'portfolio.property.create',
    'portfolio.ownership.manage',
    'portfolio.space.create',
    'portfolio.property.update',
  )
  addOwnerAndProperty(
    @Req() request: AuthenticatedRequest,
    @Body() input: AddOwnerAndPropertyDto,
  ) {
    return this.rental.addOwnerAndProperty(request.principal, input, request.correlationId);
  }

  @Post('add-rental-customer')
  @RequirePermissions('crm.lead.create', 'party.create')
  addRentalCustomer(
    @Req() request: AuthenticatedRequest,
    @Body() input: AddRentalCustomerDto,
  ) {
    return this.rental.addRentalCustomer(request.principal, input, request.correlationId);
  }

  @Post('add-buyer')
  @RequirePermissions('crm.lead.create', 'party.create')
  addBuyer(@Req() request: AuthenticatedRequest, @Body() input: AddBuyerDto) {
    return this.rental.addBuyer(request.principal, input, request.correlationId);
  }

  @Post('create-lease')
  @RequirePermissions(
    'lease.create',
    'application.create',
    'application.review',
    'screening.manage',
    'tenant.create',
  )
  createLease(@Req() request: AuthenticatedRequest, @Body() input: CreateRentalLeaseDto) {
    return this.rental.createRentalLease(request.principal, input, request.correlationId);
  }

  @Post('start-rental-brokerage')
  @RequirePermissions('service-engagement.create', 'service-engagement.activate')
  startRentalBrokerage(
    @Req() request: AuthenticatedRequest,
    @Body() input: StartRentalBrokerageDto,
  ) {
    return this.rental.startRentalBrokerage(request.principal, input, request.correlationId);
  }

  @Post('start-full-management')
  @RequirePermissions('service-engagement.create', 'service-engagement.activate')
  startFullManagement(
    @Req() request: AuthenticatedRequest,
    @Body() input: StartFullManagementDto,
  ) {
    return this.rental.startFullManagement(request.principal, input, request.correlationId);
  }
}
