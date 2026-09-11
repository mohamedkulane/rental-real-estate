'use client';

import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, pageItems, type CursorPage, userFacingError } from '@/lib/phase3-api';

export type PickRecord = { id: string; label: string; [key: string]: unknown };
export function RecordPicker({
  label,
  path,
  value,
  selectedLabel,
  map,
  onChange,
}: {
  label: string;
  path: string;
  value: string;
  selectedLabel?: string;
  map: (row: Record<string, unknown>) => PickRecord;
  onChange: (record: PickRecord | null) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [page, setPage] = useState(0);
  const [remembered, setRemembered] = useState<PickRecord | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search);
      setPage(0);
      setCursors([undefined]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const url =
    path +
    (path.includes('?') ? '&' : '?') +
    new URLSearchParams({
      limit: '20',
      search: term,
      ...(cursors[page] ? { cursor: cursors[page] } : {}),
    }).toString();
  const query = useQuery({
    queryKey: ['workflow-options', url],
    queryFn: () => api<CursorPage<Record<string, unknown>>>(url),
  });
  const options = query.data ? pageItems(query.data).map(map) : [];
  const missingSelection = value && !options.some((option) => option.id === value);
  return (
    <div className="grid min-w-0 gap-2">
      <label className="grid gap-1 text-sm">
        Search {label.toLowerCase()}
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${label.toLowerCase()}`}
        />
      </label>
      <div className="grid gap-1 text-sm">
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          value={value}
          onChange={(event) => {
            const record = options.find((option) => option.id === event.target.value) ?? null;
            setRemembered(record);
            onChange(record);
          }}
        >
          <option value="">Choose {label.toLowerCase()}</option>
          {missingSelection ? (
            <option value={value}>
              {remembered?.id === value ? remembered.label : (selectedLabel ?? 'Saved selection')}
            </option>
          ) : null}
          {options.map((option) => (
            <option value={option.id} key={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {query.isFetching ? (
        <p role="status" className="text-xs text-slate-500">
          Loading choices…
        </p>
      ) : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-red-700">
          {userFacingError(query.error)}{' '}
          <button type="button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      ) : null}
      {!query.isFetching && !query.isError && !options.length ? (
        <p className="text-sm text-slate-500">
          No matching records. Try another name or create one below.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          className="button secondary"
          disabled={page === 0 || query.isFetching}
          onClick={() => setPage((current) => current - 1)}
        >
          Previous choices
        </button>
        <span>Page {page + 1}</span>
        <button
          type="button"
          className="button secondary"
          disabled={!query.data?.pageInfo.hasNextPage || query.isFetching}
          onClick={() => {
            const next = query.data?.pageInfo.nextCursor;
            if (!next) return;
            setCursors((current) => [...current.slice(0, page + 1), next]);
            setPage((current) => current + 1);
          }}
        >
          Next choices
        </button>
      </div>
    </div>
  );
}
