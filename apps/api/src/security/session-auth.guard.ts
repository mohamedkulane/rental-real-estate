import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../identity/auth.service';
import { PUBLIC_ROUTE } from './security.decorators';
import type { AuthenticatedRequest } from './security.types';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Authentication required.');
    const token = authorization.slice(7).trim();
    if (!token) throw new UnauthorizedException('Authentication required.');
    const principal = await this.auth.resolveSession(token);
    Object.assign(request, { principal, sessionToken: token } satisfies Pick<
      AuthenticatedRequest,
      'principal' | 'sessionToken'
    >);
    return true;
  }
}
