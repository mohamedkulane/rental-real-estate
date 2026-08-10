import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { AccessService } from './access.service';
import { CreateRoleDto, PermissionGrantDto, ReasonDto, UpdateRoleDto } from './access.dto';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'permissions', version: '1' })
export class PermissionController {
  constructor(private readonly access: AccessService) {}
  @Get() @RequirePermissions('identity.permission.read') list() {
    return this.access.listPermissions();
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'roles', version: '1' })
export class RoleController {
  constructor(private readonly access: AccessService) {}
  @Get() @RequirePermissions('identity.role.read') list(@Req() request: AuthenticatedRequest) {
    return this.access.listRoles(request.principal);
  }
  @Post() @RequirePermissions('identity.role.manage') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateRoleDto,
  ) {
    return this.access.createRole(request.principal, input, request.correlationId);
  }
  @Patch(':roleId') @RequirePermissions('identity.role.manage') update(
    @Req() request: AuthenticatedRequest,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() input: UpdateRoleDto,
  ) {
    return this.access.updateRole(request.principal, roleId, input, request.correlationId);
  }
  @Post(':roleId/permissions') @RequirePermissions('identity.role.manage') grant(
    @Req() request: AuthenticatedRequest,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() input: PermissionGrantDto,
  ) {
    return this.access.grantPermission(
      request.principal,
      roleId,
      input.permissionId,
      request.correlationId,
    );
  }
  @Delete(':roleId/permissions/:permissionId') @RequirePermissions('identity.role.manage') revoke(
    @Req() request: AuthenticatedRequest,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Body() input: ReasonDto,
  ) {
    return this.access.revokePermission(
      request.principal,
      roleId,
      permissionId,
      input.reason,
      request.correlationId,
    );
  }
  @Post('employee-assignments/:assignmentId/end')
  @RequirePermissions('identity.role.manage')
  endAssignment(
    @Req() request: AuthenticatedRequest,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: ReasonDto,
  ) {
    return this.access.endEmployeeRole(
      request.principal,
      assignmentId,
      input.reason,
      request.correlationId,
    );
  }
}
