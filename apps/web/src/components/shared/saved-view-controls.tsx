'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api, userFacingError } from '@/lib/phase3-api';
import toast from '@/lib/toast';

type SavedView = {
  id: string;
  workspace: string;
  name: string;
  filters: Record<string, unknown>;
};

function filterValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .filter(
        (item) =>
          item === null ||
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean',
      )
      .map((item) => String(item ?? ''))
      .join(',');
  }
  return '';
}

export function SavedViewControls({
  workspace,
  filters,
  onApply,
}: {
  workspace: string;
  filters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}) {
  const client = useQueryClient();
  const [selected, setSelected] = useState('');
  const views = useQuery({
    queryKey: ['saved-views', workspace],
    queryFn: () => api<SavedView[]>(`/saved-views?workspace=${encodeURIComponent(workspace)}`),
  });
  const save = useMutation({
    mutationFn: (name: string) =>
      api('/saved-views', {
        method: 'POST',
        body: JSON.stringify({ workspace, name, filters }),
      }),
    onSuccess: () => {
      toast.success('Saved View created.');
      void client.invalidateQueries({ queryKey: ['saved-views', workspace] });
    },
    onError: (error) => toast.error(userFacingError(error, 'Saved View could not be created.')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/saved-views/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSelected('');
      toast.success('Saved View removed.');
      void client.invalidateQueries({ queryKey: ['saved-views', workspace] });
    },
    onError: (error) => toast.error(userFacingError(error, 'Saved View could not be removed.')),
  });
  const apply = (id: string) => {
    setSelected(id);
    const view = views.data?.find((item) => item.id === id);
    if (view)
      onApply(
        Object.fromEntries(
          Object.entries(view.filters).map(([key, value]) => [key, filterValue(value)]),
        ),
      );
  };

  return (
    <div className="flex items-center gap-2">
      <Bookmark className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
      <label className="sr-only" htmlFor={`saved-view-${workspace}`}>
        Saved View
      </label>
      <select
        id={`saved-view-${workspace}`}
        className="input-control min-w-36 py-2 text-sm"
        value={selected}
        onChange={(event) => apply(event.target.value)}
      >
        <option value="">Saved Views</option>
        {views.data?.map((view) => (
          <option key={view.id} value={view.id}>
            {view.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="button secondary px-2.5"
        aria-label="Save current filters"
        title="Save current filters"
        onClick={() => {
          const name = window.prompt('Name this Saved View');
          if (name?.trim()) save.mutate(name.trim());
        }}
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" />
      </button>
      {selected ? (
        <button
          type="button"
          className="button ghost px-2.5 text-red-700"
          aria-label="Delete selected Saved View"
          title="Delete selected Saved View"
          onClick={() => remove.mutate(selected)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
