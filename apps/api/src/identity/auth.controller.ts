import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public, RequirePermissions } from '../security/security.decorators';
import { PermissionGuard } from '../security/permission.guard';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import {
  ChangePasswordDto,
  LoginDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  RevokeSessionDto,
} from './auth.dto';
import { AuthService } from './auth.service';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() input: LoginDto, @Req() request: Request) {
    return this.auth.login(input.email, input.password, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
      correlationId: request.header('x-correlation-id'),
    });
  }

  @UseGuards(SessionAuthGuard)
  @Post('logout')
  async logout(@Req() request: AuthenticatedRequest): Promise<{ success: true }> {
    await this.auth.logout(request.principal, 'User logout', request.correlationId);
    return { success: true };
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    const principal = request.principal;
    return {
      userId: principal.userId,
      employeeId: principal.employeeId,
      companyId: principal.companyId,
      accessMode: principal.accessMode,
      permissions: [...principal.permissions],
      permissionBranchScopes: Object.fromEntries(
        [...principal.permissionBranchScopes].map(([permission, scopes]) => [
          permission,
          [...scopes],
        ]),
      ),
      branchIds: [...principal.branchIds],
      sessionId: principal.sessionId,
    };
  }

  @UseGuards(SessionAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() input: ChangePasswordDto,
  ): Promise<{ success: true }> {
    await this.auth.changePassword(
      request.principal,
      input.currentPassword,
      input.newPassword,
      request.correlationId,
    );
    return { success: true };
  }

  @Public()
  @Post('password-reset/request')
  requestReset(@Body() input: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(input.email);
  }

  @Public()
  @Post('password-reset/confirm')
  async reset(@Body() input: ResetPasswordDto): Promise<{ success: true }> {
    await this.auth.resetPassword(input.token, input.newPassword);
    return { success: true };
  }

  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermissions('identity.session.revoke')
  @Post('sessions/:sessionId/revoke')
  async revoke(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() input: RevokeSessionDto,
  ): Promise<{ success: true }> {
    await this.auth.revokeSessionAsAdministrator(
      request.principal,
      sessionId,
      input.reason,
      request.correlationId,
    );
    return { success: true };
  }
}
