export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface Principal {
  userId: string;
  employeeId: string;
  companyId: string;
  accessMode: 'BRANCH' | 'MULTI_BRANCH' | 'COMPANY_WIDE';
  permissions: string[];
  permissionBranchScopes: Record<string, Array<string | null>>;
  branchIds: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type CachedRequest = { expiresAt: number; promise: Promise<unknown> };
const requestCache = new Map<string, CachedRequest>();

const statusMessages: Record<number, string> = {
  400: 'Please review the information and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to complete this action.',
  404: 'The requested record could not be found.',
  409: 'This change conflicts with an existing record.',
  422: 'Some information needs your attention before it can be saved.',
  429: 'Too many requests were sent. Please wait a moment and try again.',
  500: 'The service is temporarily unavailable. Please try again.',
  502: 'The service is temporarily unavailable. Please try again.',
  503: 'The service is temporarily unavailable. Please try again.',
};

export function userFacingError(
  cause: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (cause instanceof ApiError) return statusMessages[cause.status] ?? cause.message ?? fallback;
  if (cause instanceof TypeError)
    return 'We could not reach the service. Check your connection and try again.';
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...init.headers,
      },
    });
  } catch (cause) {
    throw new TypeError(userFacingError(cause));
  }

  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new ApiError(
      body.message ?? statusMessages[response.status] ?? 'Request failed.',
      response.status,
    );
  }
  return body as T;
}

export function apiCached<T>(path: string, ttlMs = 300_000): Promise<T> {
  const key = path;
  const cached = requestCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;

  const promise = api<T>(path).catch((error) => {
    requestCache.delete(key);
    throw error;
  });
  requestCache.set(key, { expiresAt: Date.now() + ttlMs, promise });
  return promise;
}

export function clearApiCache(): void {
  requestCache.clear();
}

export function hasPermission(principal: Principal, permission: string): boolean {
  return principal.permissions.includes(permission);
}

export function hasCompanyPermission(principal: Principal, permission: string): boolean {
  return (
    principal.accessMode === 'COMPANY_WIDE' &&
    (principal.permissionBranchScopes[permission] ?? []).includes(null)
  );
}

export function canPerformInBranch(
  principal: Principal,
  permission: string,
  branchId: string,
): boolean {
  const hasBranchAccess =
    principal.accessMode === 'COMPANY_WIDE' || principal.branchIds.includes(branchId);
  if (!hasBranchAccess) return false;
  const scopes = principal.permissionBranchScopes[permission] ?? [];
  return scopes.includes(null) || scopes.includes(branchId);
}

export function canPerformAcrossBranches(
  principal: Principal,
  permission: string,
  branchIds: string[],
): boolean {
  const unique = [...new Set(branchIds)];
  return (
    unique.length > 0 &&
    unique.every((branchId) => canPerformInBranch(principal, permission, branchId))
  );
}
