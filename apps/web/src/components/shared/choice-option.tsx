'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Compact single-select option (replaces native radio chrome).
 */
export function ChoiceOption({
  selected,
  onSelect,
  label,
  description,
  name,
  value,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
  name?: string;
  value?: string;
}) {
  return (
    <label
      className={
        'flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors duration-150 ' +
        (selected
          ? 'border-[#5D9293] bg-[#F1F8F7]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50')
      }
    >
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          type="radio"
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
          checked={selected}
          onChange={onSelect}
          name={name}
          value={value}
        />
        <span
          aria-hidden="true"
          className={
            'pointer-events-none flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] transition-colors duration-150 ' +
            (selected
              ? 'border-[#215E61] bg-[#215E61] text-white'
              : 'border-slate-300 bg-white text-transparent peer-hover:border-slate-400')
          }
        >
          <Check className="h-2.5 w-2.5 stroke-[3]" />
        </span>
      </span>
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block text-[13px] font-semibold text-slate-800">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] font-normal text-slate-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function ChoiceGroup({
  legend,
  children,
  className = '',
}: {
  legend?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={className.trim() || undefined}>
      {legend ? (
        <legend className="mb-1.5 px-0.5 text-sm font-semibold text-slate-700">{legend}</legend>
      ) : null}
      <div className="grid gap-1.5">{children}</div>
    </fieldset>
  );
}
