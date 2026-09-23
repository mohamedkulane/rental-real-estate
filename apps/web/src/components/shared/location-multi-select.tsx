'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

const DEFAULT_LOCATION_SUGGESTIONS = [
  'Hodan',
  'Wadajir',
  'Waaberi',
  'Howlwadag',
  'Yaqshid',
  'Karaan',
  'Daynile',
  'Hamar Weyne',
  'Shangani',
  'Boondheere',
  'Abdiaziz',
  'Shibis',
  'Huriwaa',
  'Kaxda',
  'Garasbaaley',
];

type LocationMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  label?: string;
  placeholder?: string;
  required?: boolean;
};

export function LocationMultiSelect({
  value,
  onChange,
  suggestions = DEFAULT_LOCATION_SUGGESTIONS,
  label = 'Preferred locations',
  placeholder = 'Search or type a location…',
  required = false,
}: LocationMultiSelectProps) {
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const available = useMemo(() => {
    const selected = new Set(value.map((item) => item.toLocaleLowerCase()));
    const trimmed = query.trim().toLocaleLowerCase();
    return suggestions.filter((item) => {
      if (selected.has(item.toLocaleLowerCase())) return false;
      if (!trimmed) return true;
      return item.toLocaleLowerCase().includes(trimmed);
    });
  }, [query, suggestions, value]);

  const canAddCustom =
    Boolean(query.trim()) &&
    !value.some((item) => item.toLocaleLowerCase() === query.trim().toLocaleLowerCase());

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function addLocation(location: string) {
    const next = location.trim();
    if (!next) return;
    if (value.some((item) => item.toLocaleLowerCase() === next.toLocaleLowerCase())) {
      setQuery('');
      return;
    }
    onChange([...value, next]);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  }

  function removeLocation(location: string) {
    onChange(value.filter((item) => item !== location));
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <div
        className={
          'rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm focus-within:border-[#215E61] focus-within:ring-2 focus-within:ring-[#215E61]/15'
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {value.map((location) => (
            <span
              key={location}
              className="inline-flex items-center gap-1 rounded-md bg-[#E8F3F3] px-2 py-1 text-[12px] font-semibold text-[#215E61]"
            >
              {location}
              <button
                type="button"
                className="rounded p-0.5 text-[#215E61]/70 hover:bg-white/60 hover:text-[#215E61]"
                aria-label={`Remove ${location}`}
                onClick={() => removeLocation(location)}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          <div className="relative min-w-[12rem] flex-1">
            <Search
              className="pointer-events-none absolute left-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={query}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              placeholder={value.length ? placeholder : 'e.g. Hodan'}
              className="w-full border-0 bg-transparent py-1 pl-6 pr-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  if (available[0]) addLocation(available[0]);
                  else if (canAddCustom) addLocation(query);
                }
                if (event.key === 'Backspace' && !query && value.length) {
                  removeLocation(value[value.length - 1]!);
                }
                if (event.key === 'Escape') setOpen(false);
              }}
            />
          </div>
        </div>
      </div>
      {open && (available.length || canAddCustom) ? (
        <ul
          id={listboxId}
          role="listbox"
          className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {available.map((location) => (
            <li key={location}>
              <button
                type="button"
                role="option"
                className="flex w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-[#E8F3F3] hover:text-[#215E61]"
                onClick={() => addLocation(location)}
              >
                {location}
              </button>
            </li>
          ))}
          {canAddCustom ? (
            <li>
              <button
                type="button"
                role="option"
                className="flex w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => addLocation(query)}
              >
                Add “{query.trim()}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      {required && !value.length ? (
        <p className="text-xs text-slate-500">Add at least one preferred location.</p>
      ) : null}
    </div>
  );
}
