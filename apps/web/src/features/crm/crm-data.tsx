'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { CursorPaginationControls } from '@/components/shared/pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/ui';
import { ApiError, api, canPerformInBranch, hasPermission, type Principal } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import type { Page, SelectorOption } from './crm-types';
import { appendCursor } from './crm-model';

export function crmError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409)
      return 'This record changed elsewhere. Close the form, refresh this view, and review the latest details before trying again.';
    if (error.status === 403)
      return 'Your current Branch permissions do not allow this action. Ask your administrator to review your access.';
    if (error.status === 404) return 'This record is no longer available in your authorized scope.';
    if (error.status === 400 || error.status === 422)
      return 'Review the required fields, dates, ranges, and workflow prerequisites, then try again. The server could not accept this change.';
    if (error.status === 401) return 'Your session expired. Sign in again to continue.';
    if (error.status === 429) return 'Please wait a moment before trying again.';
  }
  return 'The service could not complete this request. Check your connection and try again.';
}

export function can(principal: Principal, permission: string, branchId?: string): boolean {
  return (
    hasPermission(principal, permission) &&
    (!branchId || canPerformInBranch(principal, permission, branchId))
  );
}
export function canReadChild(principal: Principal, permission: string, branchId: string): boolean {
  return can(principal, 'crm.lead.read', branchId) && can(principal, permission, branchId);
}

export function requestPath(
  path: string,
  filters: Record<string, string | readonly string[] | undefined> = {},
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    for (const part of typeof value === 'string' ? [value] : (value ?? []))
      if (part.trim()) query.append(key, part.trim());
  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
}

export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  return { params, set, clear: () => router.replace(pathname, { scroll: false }) };
}

export function useCrmPage<T>(path: string, enabled = true) {
  const [position, setPosition] = useState<{
    path: string;
    cursors: Array<string | undefined>;
    page: number;
  }>({ path, cursors: [undefined], page: 0 });
  const current = position.path === path ? position : { path, cursors: [undefined], page: 0 };
  const query = useQuery({
    queryKey: ['crm', path, current.cursors[current.page]],
    enabled,
    retry: false,
    queryFn: () =>
      api<Page<T>>(requestPath(path, { limit: '25', cursor: current.cursors[current.page] })),
  });
  const controls = {
    page: current.page + 1,
    itemCount: query.data?.items.length ?? 0,
    hasPrevious: current.page > 0,
    hasNext: query.data?.pageInfo.hasNextPage ?? false,
    busy: query.isFetching,
    onPrevious: () => setPosition({ ...current, page: current.page - 1 }),
    onNext: () => {
      const next = query.data?.pageInfo.nextCursor;
      if (next)
        setPosition({
          path,
          cursors: appendCursor(current.cursors, current.page, next),
          page: current.page + 1,
        });
    },
  };
  return {
    ...query,
    controls,
    restart: () => setPosition({ path, cursors: [undefined], page: 0 }),
  };
}

export function PagedResults<T>({
  query,
  empty,
  filtered = false,
  children,
}: {
  query: ReturnType<typeof useCrmPage<T>>;
  empty: string;
  filtered?: boolean;
  children: (items: T[]) => ReactNode;
}) {
  if (query.isPending) return <LoadingState label="Loading authorized records" />;
  if (query.isError)
    return (
      <>
        <ErrorState message={crmError(query.error)} onRetry={() => void query.refetch()} />
        {query.controls.hasPrevious ? (
          <button type="button" className="button secondary" onClick={query.restart}>
            Start from first page
          </button>
        ) : null}
      </>
    );
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-600">
          {query.data.totalCount.toLocaleString()} records
        </p>
        <button
          type="button"
          className="button secondary"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          Refresh
        </button>
      </div>
      {query.data.items.length ? (
        children(query.data.items)
      ) : (
        <EmptyState
          title={filtered ? 'No matching records' : 'Nothing here yet'}
          description={filtered ? 'Try another search or clear the filters.' : empty}
        />
      )}
      <CursorPaginationControls {...query.controls} />
    </>
  );
}

export function AsyncSelect({
  label,
  path,
  value,
  onChange,
  required = false,
  initial,
  disabled = false,
}: {
  label: string;
  path: string;
  value: string;
  onChange: (value: string, option?: SelectorOption) => void;
  required?: boolean;
  initial?: SelectorOption | undefined;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<SelectorOption | undefined>(initial);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useCrmPage<SelectorOption>(requestPath(path, { search: debounced }), !disabled);
  const items = query.data?.items ?? [];
  const options =
    selected && selected.id === value && !items.some((item) => item.id === value)
      ? [selected, ...items]
      : items;
  return (
    <div>
      <label>
        {label}
        <SearchableSelect
          searchable
          searchThreshold={0}
          aria-label={label}
          searchPlaceholder={`Search ${label.toLowerCase()}`}
          value={value}
          loading={query.isFetching}
          disabled={disabled}
          required={required}
          onSearchChange={setSearch}
          onChange={(event) => {
            const option = options.find((item) => item.id === event.target.value);
            setSelected(option);
            onChange(event.target.value, option);
          }}
        >
          <option value="">Choose {label.toLowerCase()}</option>
          {options.map((item) => (
            <option key={item.id} value={item.id} disabled={item.capabilityAllowed === false}>
              {[
                item.employeeNumber ??
                  item.partyNumber ??
                  item.propertyCode ??
                  item.spaceCode ??
                  item.code,
                item.displayName ?? item.name ?? item.label,
              ]
                .filter(Boolean)
                .join(' — ')}
              {item.active === false ? ' (Inactive)' : ''}
              {item.capabilityAllowed === false ? ' — Not currently eligible' : ''}
            </option>
          ))}
        </SearchableSelect>
      </label>
      {value && !required ? (
        <button
          type="button"
          className="mt-1 min-h-9 text-xs font-semibold text-blue-700"
          onClick={() => {
            setSelected(undefined);
            onChange('');
          }}
        >
          Clear selection
        </button>
      ) : null}
      {query.isError ? (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {crmError(query.error)}{' '}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      ) : null}
      {!disabled && (query.controls.hasPrevious || query.controls.hasNext) ? (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <button
            type="button"
            className="button secondary"
            disabled={!query.controls.hasPrevious || query.isFetching}
            onClick={query.controls.onPrevious}
          >
            Previous options
          </button>
          <span>{query.data?.totalCount} options</span>
          <button
            type="button"
            className="button secondary"
            disabled={!query.controls.hasNext || query.isFetching}
            onClick={query.controls.onNext}
          >
            More options
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CommandDialog({
  title,
  description,
  path,
  method = 'POST',
  build,
  onClose,
  onSuccess,
  children,
  danger = false,
}: {
  title: string;
  description: string;
  path: string;
  method?: 'POST' | 'PATCH';
  build: (form: FormData) => Record<string, unknown>;
  onClose: () => void;
  onSuccess?: ((ack: { id: string; version?: number }) => void) | undefined;
  children: ReactNode;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const client = useQueryClient();
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ id: string; version?: number }>(path, { method, body: JSON.stringify(body) }),
    onSuccess: (ack) => {
      void client.invalidateQueries({ queryKey: ['crm'] });
      toast.success(`${title} saved.`);
      onSuccess?.(ack);
      onClose();
    },
    onError: (cause) => setError(crmError(cause)),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mutation.isPending) return;
    setError('');
    try {
      mutation.mutate(build(new FormData(event.currentTarget)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review the form.');
    }
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!mutation.isPending) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
    >
      <h2 id={id}>{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        {error ? (
          <div className="feedback feedback-error" role="alert">
            {error}
          </div>
        ) : null}
        <fieldset disabled={mutation.isPending} className="space-y-4">
          {children}
        </fieldset>
        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            className={danger ? 'button danger' : 'button primary'}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : title}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export const formText = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};
export function ReasonField() {
  return (
    <label>
      Reason
      <textarea name="reason" required minLength={3} maxLength={500} rows={3} />
    </label>
  );
}
export function EnumField({
  label,
  name,
  values,
  value = '',
  required = false,
}: {
  label: string;
  name: string;
  values: readonly string[];
  value?: string | undefined;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value} required={required}>
        <option value="">Choose {label.toLowerCase()}</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {humanize(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
