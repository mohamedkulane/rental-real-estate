import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CursorPageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}

export interface CursorPage<T> {
  items: T[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}

export function cursorPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => string,
): CursorPage<T> {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor: hasNextPage && items.length ? cursorOf(items[items.length - 1]!) : null,
    },
  };
}
