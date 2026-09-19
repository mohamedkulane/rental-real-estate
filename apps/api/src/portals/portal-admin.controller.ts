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
import { RequirePermissions } from '../security/security.decorators';
import { PermissionGuard } from '../security/permission.guard';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import {
  ChangePortalAccountStatusDto,
  CreatePortalAccountDto,
  ListPortalAccountsQueryDto,
} from './portal.dto';
import { PortalAdminService } from './portal-admin.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'portal-accounts', version: '1' })
export class PortalAdminController {
  constructor(private readonly portalAdmin: PortalAdminService) {}

  @Get()
  @RequirePermissions('portal.account.read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListPortalAccountsQueryDto) {
    return this.portalAdmin.list(request.principal, query);
  }

  @Post()
  @RequirePermissions('portal.account.create')
  create(@Req() request: AuthenticatedRequest, @Body() input: CreatePortalAccountDto) {
    return this.portalAdmin.create(request.principal, input, request.correlationId);
  }

  @Patch(':portalAccountId/status')
  @RequirePermissions('portal.account.update')
  changeStatus(
    @Req() request: AuthenticatedRequest,
    @Param('portalAccountId', ParseUUIDPipe) portalAccountId: string,
    @Body() input: ChangePortalAccountStatusDto,
  ) {
    return this.portalAdmin.changeStatus(
      request.principal,
      portalAccountId,
      input,
      request.correlationId,
    );
  }
}
