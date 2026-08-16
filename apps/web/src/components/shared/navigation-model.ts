export type NavigationItem = {
  key: string;
  label: string;
  onSelect?: () => void;
  children?: NavigationItem[];
};

export function expandedParentForActive(
  items: NavigationItem[],
  activeItem: string | undefined,
): string | undefined {
  if (!activeItem) return undefined;
  return items.find((item) => item.children?.some((child) => child.key === activeItem))?.key;
}

export function nextExpandedParent(
  current: string | undefined,
  requested: string,
): string | undefined {
  return current === requested ? undefined : requested;
}

export function navigationItemIsActive(
  item: NavigationItem,
  activeItem: string | undefined,
): boolean {
  return (
    item.key === activeItem || Boolean(item.children?.some((child) => child.key === activeItem))
  );
}
