export const CORRELATION_ID_HEADER = 'x-correlation-id' as const;

export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details: unknown[];
  correlationId: string;
}
