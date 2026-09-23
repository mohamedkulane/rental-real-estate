export function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item) || 'Other';
    const bucket = groups[key];
    if (bucket) bucket.push(item);
    else groups[key] = [item];
  }
  return groups;
}
