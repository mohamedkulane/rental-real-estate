import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CursorPageQueryDto } from '../common/cursor-pagination';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import {
  AssignBranchDto,
  AssignRoleDto,
  ChangeEmployeeStatusDto,
  ChangeUserStatusDto,
  CreateBranchDto,
  CreateEmployeeDto,
  CreateUserDto,
  UpdateBranchDto,
  UpdateCompanyDto,
  UpdateEmployeeDto,
} from './organization.dto';
import { OrganizationService } from './organization.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'company', version: '1' })
export class CompanyController {
  constructor(private readonly organization: OrganizationService) {}
  @Get() @RequirePermissions('organization.company.read') get() {
    return this.organization.getCompany();
  }
  @Patch() @RequirePermissions('organization.company.update') update(
    @Req() request: AuthenticatedRequest,
    @Body() input: UpdateCompanyDto,
  ) {
    return this.organization.updateCompany(request.principal, input, request.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'branches', version: '1' })
export class BranchController {
  constructor(private readonly organization: OrganizationService) {}
  @Get() @RequirePermissions('organization.branch.read') list(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organization.listBranches(request.principal);
  }
  @Get(':branchId') @RequirePermissions('organization.branch.read') get(
    @Req() request: AuthenticatedRequest,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.organization.getBranch(request.principal, branchId);
  }
  @Post() @RequirePermissions('organization.branch.create') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateBranchDto,
  ) {
    return this.organization.createBranch(request.principal, input, request.correlationId);
  }
  @Patch(':branchId') @RequirePermissions('organization.branch.update') update(
    @Req() request: AuthenticatedRequest,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() input: UpdateBranchDto,
  ) {
    return this.organization.updateBranch(
      request.principal,
      branchId,
      input,
      request.correlationId,
    );
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'employees', version: '1' })
export class EmployeeController {
  constructor(private readonly organization: OrganizationService) {}
  @Get() @RequirePermissions('identity.employee.read') list(
    @Req() request: AuthenticatedRequest,
    @Query() query: CursorPageQueryDto,
  ) {
    return this.organization.listEmployees(request.principal, query);
  }
  @Get(':employeeId') @RequirePermissions('identity.employee.read') get(
    @Req() request: AuthenticatedRequest,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.organization.getEmployee(request.principal, employeeId);
  }
  @Post() @RequirePermissions('identity.employee.create') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateEmployeeDto,
  ) {
    return this.organization.createEmployee(request.principal, input, request.correlationId);
  }
  @Patch(':employeeId') @RequirePermissions('identity.employee.update') update(
    @Req() request: AuthenticatedRequest,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: UpdateEmployeeDto,
  ) {
    return this.organization.updateEmployee(
      request.principal,
      employeeId,
      input,
      request.correlationId,
    );
  }
  @Patch(':employeeId/status') @RequirePermissions('identity.employee.update') changeStatus(
    @Req() request: AuthenticatedRequest,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: ChangeEmployeeStatusDto,
  ) {
    return this.organization.changeEmployeeStatus(
      request.principal,
      employeeId,
      input,
      request.correlationId,
    );
  }
  @Post(':employeeId/branches') @RequirePermissions('identity.employee.update') assignBranch(
    @Req() request: AuthenticatedRequest,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: AssignBranchDto,
  ) {
    return this.organization.assignBranch(
      request.principal,
      employeeId,
      input,
      request.correlationId,
    );
  }
  @Post(':employeeId/roles') @RequirePermissions('identity.role.manage') assignRole(
    @Req() request: AuthenticatedRequest,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() input: AssignRoleDto,
  ) {
    return this.organization.assignRole(
      request.principal,
      employeeId,
      input,
      request.correlationId,
    );
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly organization: OrganizationService) {}
  @Get() @RequirePermissions('identity.user.read') list(
    @Req() request: AuthenticatedRequest,
    @Query() query: CursorPageQueryDto,
  ) {
    return this.organization.listUsers(request.principal, query);
  }
  @Post() @RequirePermissions('identity.user.create') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateUserDto,
  ) {
    return this.organization.createUser(request.principal, input, request.correlationId);
  }
  @Patch(':userId/status') @RequirePermissions('identity.user.suspend') changeStatus(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() input: ChangeUserStatusDto,
  ) {
    return this.organization.changeUserStatus(
      request.principal,
      userId,
      input,
      request.correlationId,
    );
  }
}
