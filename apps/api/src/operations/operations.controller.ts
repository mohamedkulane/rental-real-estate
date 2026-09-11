import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import {
  CreateDefectDto,
  CreateDefectMaintenanceDto,
  CreateInspectionDto,
  CreateMaintenanceRequestDto,
  CreateVendorDto,
  CreateWorkOrderDto,
  DefectTransitionDto,
  InspectionQueryDto,
  InspectionTransitionDto,
  MaintenanceQueryDto,
  MaintenanceTransitionDto,
  OperationsQueryDto,
  UpdateVendorDto,
  VendorQueryDto,
  WorkOrderQueryDto,
  WorkOrderTransitionDto,
} from './operations.dto';
import { OperationsService } from './operations.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'operations', version: '1' })
export class OperationsOverviewController {
  constructor(private readonly operations: OperationsService) {}

  @Get('overview')
  @RequirePermissions('operations.overview.read')
  overview(@Req() req: AuthenticatedRequest) {
    return this.operations.overview(req.principal);
  }

  @Get('properties/:propertyId/condition-history')
  @RequirePermissions('maintenance.read')
  history(
    @Req() req: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: OperationsQueryDto,
  ) {
    return this.operations.propertyConditionHistory(req.principal, propertyId, query);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'vendors', version: '1' })
export class VendorController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  @RequirePermissions('vendor.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: VendorQueryDto) {
    return this.operations.listVendors(req.principal, query);
  }

  @Post()
  @RequirePermissions('vendor.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateVendorDto) {
    return this.operations.createVendor(req.principal, input, req.correlationId);
  }

  @Get(':id')
  @RequirePermissions('vendor.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.operations.getVendor(req.principal, id);
  }

  @Patch(':id')
  @RequirePermissions('vendor.manage')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVendorDto,
  ) {
    return this.operations.updateVendor(req.principal, id, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'maintenance-requests', version: '1' })
export class MaintenanceRequestController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  @RequirePermissions('maintenance.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: MaintenanceQueryDto) {
    return this.operations.listMaintenance(req.principal, query);
  }

  @Post()
  @RequirePermissions('maintenance.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateMaintenanceRequestDto) {
    return this.operations.createMaintenance(req.principal, input, req.correlationId);
  }

  @Get(':id')
  @RequirePermissions('maintenance.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.operations.getMaintenance(req.principal, id);
  }

  @Post(':id/transition')
  @RequirePermissions('maintenance.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MaintenanceTransitionDto,
  ) {
    return this.operations.transitionMaintenance(req.principal, id, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'work-orders', version: '1' })
export class WorkOrderController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  @RequirePermissions('work-order.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: WorkOrderQueryDto) {
    return this.operations.listWorkOrders(req.principal, query);
  }

  @Post()
  @RequirePermissions('work-order.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateWorkOrderDto) {
    return this.operations.createWorkOrder(req.principal, input, req.correlationId);
  }

  @Get(':id')
  @RequirePermissions('work-order.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.operations.getWorkOrder(req.principal, id);
  }

  @Post(':id/transition')
  @RequirePermissions('work-order.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: WorkOrderTransitionDto,
  ) {
    return this.operations.transitionWorkOrder(req.principal, id, input, req.correlationId);
  }

  @Post(':id/expense')
  @RequirePermissions('expense.manage')
  expense(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.operations.createWorkOrderExpense(req.principal, id, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'inspections', version: '1' })
export class InspectionController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  @RequirePermissions('inspection.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: InspectionQueryDto) {
    return this.operations.listInspections(req.principal, query);
  }

  @Post()
  @RequirePermissions('inspection.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateInspectionDto) {
    return this.operations.createInspection(req.principal, input, req.correlationId);
  }

  @Get(':id')
  @RequirePermissions('inspection.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.operations.getInspection(req.principal, id);
  }

  @Post(':id/transition')
  @RequirePermissions('inspection.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: InspectionTransitionDto,
  ) {
    return this.operations.transitionInspection(req.principal, id, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'defects', version: '1' })
export class DefectController {
  constructor(private readonly operations: OperationsService) {}

  @Post()
  @RequirePermissions('defect.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateDefectDto) {
    return this.operations.createDefect(req.principal, input, req.correlationId);
  }

  @Post(':id/transition')
  @RequirePermissions('defect.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DefectTransitionDto,
  ) {
    return this.operations.transitionDefect(req.principal, id, input, req.correlationId);
  }

  @Post(':id/maintenance-request')
  @RequirePermissions('maintenance.manage')
  followUp(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateDefectMaintenanceDto,
  ) {
    return this.operations.createMaintenanceFromDefect(req.principal, id, input, req.correlationId);
  }
}
