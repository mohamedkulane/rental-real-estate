import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
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
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthService } from './auth.service';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly rateLimits: AuthRateLimitService,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.rateLimits.consume('login', request.ip ?? 'unknown', input.email);
    const session = await this.auth.login(input.email, input.password, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
      correlationId: request.header('x-correlation-id'),
    });
    response.cookie('rerms_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
      expires: session.expiresAt,
    });
    return { expiresAt: session.expiresAt };
  }

  @UseGuards(SessionAuthGuard)
  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.auth.logout(request.principal, 'User logout', request.correlationId);
    response.clearCookie('rerms_session', { path: '/api' });
    return { success: true };
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    const principal = request.principal;
    return {
      kind: principal.kind,
      userId: principal.userId,
      employeeId: principal.employeeId || undefined,
      companyId: principal.companyId,
      businessDate: principal.businessDate,
      accessMode: principal.accessMode,
      roles: principal.roles,
      permissions: [...principal.permissions],
      permissionBranchScopes: Object.fromEntries(
        [...principal.permissionBranchScopes].map(([permission, scopes]) => [
          permission,
          [...scopes],
        ]),
      ),
      branchIds: [...principal.branchIds],
      branches: principal.branches ?? [],
      partyId: principal.partyId,
      displayName: principal.displayName,
      portalType: principal.portalType,
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
  async requestReset(@Body() input: RequestPasswordResetDto, @Req() request: Request) {
    await this.rateLimits.consume('reset', request.ip ?? 'unknown', input.email);
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
