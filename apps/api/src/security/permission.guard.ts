import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS } from './security.decorators';
import type { AuthenticatedRequest } from './security.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!required.length) return true;
    const { principal } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!principal || !required.every((permission) => principal.permissions.has(permission)))
      throw new ForbiddenException('Required permission is missing.');
    return true;
  }
}
