import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE = 'public-route';
export const REQUIRED_PERMISSIONS = 'required-permissions';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
