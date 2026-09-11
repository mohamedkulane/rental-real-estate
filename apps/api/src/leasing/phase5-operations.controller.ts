import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ListingStatus } from '@prisma/client';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { LeasingService } from './leasing.service';
import { ListingService } from './listing.service';
import {
  ApplicationQueryDto, ApplicationTransitionDto, CompleteViewingDto, ConvertTenantDto,
  CreateApplicationDto, CreateLeaseDto, CreateRentalListingDto, CreateRenewalDto,
  CreateReservationDto, CreateSaleListingDto, CreateViewingDto, LeaseQueryDto,
  LeaseTransitionDto, ListingQueryDto, MatchListingsDto, MoveInQueryDto,
  MoveInTransitionDto, RecordScreeningDto, RenewalQueryDto, RenewalTransitionDto,
  ReservationQueryDto, ReservationTransitionDto, RescheduleViewingDto, ScheduleMoveInDto,
  TenantQueryDto, VersionedTransitionDto, ViewingQueryDto,
} from './phase5-operations.dto';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'rental-listings', version: '1' })
export class RentalListingController {
  constructor(private readonly listings: ListingService) {}
  @Get() @RequirePermissions('listing.read') list(@Req() req: AuthenticatedRequest, @Query() query: ListingQueryDto) { return this.listings.listRental(req.principal, query); }
  @Get(':id') @RequirePermissions('listing.read') get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.listings.getRental(req.principal, id); }
  @Post() @RequirePermissions('listing.create') create(@Req() req: AuthenticatedRequest, @Body() input: CreateRentalListingDto) { return this.listings.createRental(req.principal, input, req.correlationId); }
  @Post(':id/submit') @RequirePermissions('listing.review') submit(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionRental(req.principal, id, ListingStatus.PENDING_REVIEW, input, req.correlationId); }
  @Post(':id/publish') @RequirePermissions('listing.publish') publish(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionRental(req.principal, id, ListingStatus.PUBLISHED, input, req.correlationId); }
  @Post(':id/pause') @RequirePermissions('listing.publish') pause(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionRental(req.principal, id, ListingStatus.PAUSED, input, req.correlationId); }
  @Post(':id/unpublish') @RequirePermissions('listing.publish') unpublish(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionRental(req.principal, id, ListingStatus.UNPUBLISHED, input, req.correlationId); }
  @Post(':id/close') @RequirePermissions('listing.publish') close(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionRental(req.principal, id, ListingStatus.CLOSED, input, req.correlationId); }
  @Post(':id/archive') @RequirePermissions('listing.publish') archive(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionRental(req.principal, id, ListingStatus.ARCHIVED, input, req.correlationId); }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'sale-listings', version: '1' })
export class SaleListingController {
  constructor(private readonly listings: ListingService) {}
  @Get() @RequirePermissions('listing.read') list(@Req() req: AuthenticatedRequest, @Query() query: ListingQueryDto) { return this.listings.listSale(req.principal, query); }
  @Get(':id') @RequirePermissions('listing.read') get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.listings.getSale(req.principal, id); }
  @Post() @RequirePermissions('listing.create') create(@Req() req: AuthenticatedRequest, @Body() input: CreateSaleListingDto) { return this.listings.createSale(req.principal, input, req.correlationId); }
  @Post(':id/submit') @RequirePermissions('listing.review') submit(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionSale(req.principal, id, ListingStatus.PENDING_REVIEW, input, req.correlationId); }
  @Post(':id/publish') @RequirePermissions('listing.publish') publish(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionSale(req.principal, id, ListingStatus.PUBLISHED, input, req.correlationId); }
  @Post(':id/pause') @RequirePermissions('listing.publish') pause(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionSale(req.principal, id, ListingStatus.PAUSED, input, req.correlationId); }
  @Post(':id/unpublish') @RequirePermissions('listing.publish') unpublish(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionSale(req.principal, id, ListingStatus.UNPUBLISHED, input, req.correlationId); }
  @Post(':id/close') @RequirePermissions('listing.publish') close(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionSale(req.principal, id, ListingStatus.CLOSED, input, req.correlationId); }
  @Post(':id/archive') @RequirePermissions('listing.publish') archive(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: VersionedTransitionDto) { return this.listings.transitionSale(req.principal, id, ListingStatus.ARCHIVED, input, req.correlationId); }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'listing-matches', version: '1' })
export class ListingMatchController {
  constructor(private readonly listings: ListingService) {}
  @Get() @RequirePermissions('listing.match') match(@Req() req: AuthenticatedRequest, @Query() query: MatchListingsDto) { return this.listings.match(req.principal, query); }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'viewings', version: '1' })
export class ViewingController {
  constructor(private readonly leasing: LeasingService) {}
  @Get() @RequirePermissions('viewing.read') list(@Req() req: AuthenticatedRequest, @Query() query: ViewingQueryDto) { return this.leasing.listViewings(req.principal, query); }
  @Post() @RequirePermissions('viewing.create') create(@Req() req: AuthenticatedRequest, @Body() input: CreateViewingDto) { return this.leasing.createViewing(req.principal, input, req.correlationId); }
  @Post(':id/reschedule') @RequirePermissions('viewing.update') reschedule(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: RescheduleViewingDto) { return this.leasing.rescheduleViewing(req.principal, id, input, req.correlationId); }
  @Post(':id/transition') @RequirePermissions('viewing.complete') transition(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: CompleteViewingDto) { return this.leasing.completeViewing(req.principal, id, input, req.correlationId); }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'applications', version: '1' })
export class ApplicationController {
  constructor(private readonly leasing: LeasingService) {}
  @Get() @RequirePermissions('application.read') list(@Req() req: AuthenticatedRequest, @Query() query: ApplicationQueryDto) { return this.leasing.listApplications(req.principal, query); }
  @Post() @RequirePermissions('application.create') create(@Req() req: AuthenticatedRequest, @Body() input: CreateApplicationDto) { return this.leasing.createApplication(req.principal, input, req.correlationId); }
  @Post(':id/transition') @RequirePermissions('application.read') transition(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: ApplicationTransitionDto) { return this.leasing.transitionApplication(req.principal, id, input, req.correlationId); }
  @Post(':id/screening') @RequirePermissions('screening.manage') screening(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: RecordScreeningDto) { return this.leasing.recordScreening(req.principal, id, input, req.correlationId); }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'reservations', version: '1' })
export class ReservationController {
  constructor(private readonly leasing: LeasingService) {}
  @Get() @RequirePermissions('reservation.read') list(@Req() req: AuthenticatedRequest, @Query() query: ReservationQueryDto) { return this.leasing.listReservations(req.principal, query); }
  @Post() @RequirePermissions('reservation.create') create(@Req() req: AuthenticatedRequest, @Body() input: CreateReservationDto) { return this.leasing.createReservation(req.principal, input, req.correlationId); }
  @Post(':id/transition') @RequirePermissions('reservation.manage') transition(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: ReservationTransitionDto) { return this.leasing.transitionReservation(req.principal, id, input, req.correlationId); }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'tenants', version: '1' })
export class TenantController {
  constructor(private readonly leasing: LeasingService) {}
  @Get() @RequirePermissions('tenant.read') list(@Req() req: AuthenticatedRequest, @Query() query: TenantQueryDto) { return this.leasing.listTenants(req.principal, query); }
  @Post('convert') @RequirePermissions('tenant.create') convert(@Req() req: AuthenticatedRequest, @Body() input: ConvertTenantDto) { return this.leasing.convertTenant(req.principal, input, req.correlationId); }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'leases', version: '1' })
export class LeaseController {
  constructor(private readonly leasing: LeasingService) {}
  @Get() @RequirePermissions('lease.read') list(@Req() req: AuthenticatedRequest, @Query() query: LeaseQueryDto) { return this.leasing.listLeases(req.principal, query); }
  @Post() @RequirePermissions('lease.create') create(@Req() req: AuthenticatedRequest, @Body() input: CreateLeaseDto) { return this.leasing.createLease(req.principal, input, req.correlationId); }
  @Post(':id/transition') @RequirePermissions('lease.read') transition(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: LeaseTransitionDto) { return this.leasing.transitionLease(req.principal, id, input, req.correlationId); }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'renewals', version: '1' })
export class RenewalController {
  constructor(private readonly leasing: LeasingService) {}
  @Get() @RequirePermissions('renewal.read') list(@Req() req: AuthenticatedRequest, @Query() query: RenewalQueryDto) { return this.leasing.listRenewals(req.principal, query); }
  @Post() @RequirePermissions('renewal.manage') create(@Req() req: AuthenticatedRequest, @Body() input: CreateRenewalDto) { return this.leasing.createRenewal(req.principal, input, req.correlationId); }
  @Post(':id/transition') @RequirePermissions('renewal.manage') transition(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: RenewalTransitionDto) { return this.leasing.transitionRenewal(req.principal, id, input, req.correlationId); }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'move-ins', version: '1' })
export class MoveInController {
  constructor(private readonly leasing: LeasingService) {}
  @Get() @RequirePermissions('move-in.read') list(@Req() req: AuthenticatedRequest, @Query() query: MoveInQueryDto) { return this.leasing.listMoveIns(req.principal, query); }
  @Post() @RequirePermissions('move-in.manage') create(@Req() req: AuthenticatedRequest, @Body() input: ScheduleMoveInDto) { return this.leasing.scheduleMoveIn(req.principal, input, req.correlationId); }
  @Post(':id/transition') @RequirePermissions('move-in.manage') transition(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: MoveInTransitionDto) { return this.leasing.transitionMoveIn(req.principal, id, input, req.correlationId); }
}
