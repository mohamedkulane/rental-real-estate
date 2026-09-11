/**
 * Shared design-system primitives for the Real Estate Operations UI.
 * All pages should import from here rather than styling controls independently.
 */
export { AppShell, type ShellSection, type ShellSubItem } from './app-shell';
export { AppHeader } from './app-header';
export { SearchableSelect, searchableOptionText, matchesSearchableOption } from './searchable-select';
export {
  AccessScopeBadge,
  BrandMark,
  EmptyState,
  ErrorState,
  Feedback,
  FormSection,
  LoadingState,
  PageHeader,
  StatusBadge,
  WorkspaceLoading,
  AppLoadingScreen,
  DashboardSkeleton,
  FormSkeleton,
  ImageSkeleton,
  InlineLoading,
  LoadingButtonContent,
  PageSkeleton,
  SectionLoading,
  TableSkeleton,
} from './ui';
export { CursorPaginationControls, PaginationControls } from './pagination';
export { DetailTabs } from './detail-tabs';
