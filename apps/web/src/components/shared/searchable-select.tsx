'use client';

import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

type OptionElement = ReactElement<{
  children?: ReactNode;
  value?: string | number;
  disabled?: boolean;
}>;
type SearchableSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  searchable?: boolean;
  searchThreshold?: number;
  searchPlaceholder?: string;
  loading?: boolean;
  onSearchChange?: (query: string) => void;
};

const nodeText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
};

export const searchableOptionText = (option: OptionElement): string => {
  const label = nodeText(option.props.children).trim();
  return label || String(option.props.value ?? '');
};

export const matchesSearchableOption = (option: OptionElement, query: string): boolean =>
  searchableOptionText(option).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

export const isStatusSelection = (name?: string, ariaLabel?: string, className?: string): boolean =>
  [name, ariaLabel, className]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes('status'));

export function SearchableSelect({
  children,
  className,
  searchable,
  searchThreshold = 8,
  searchPlaceholder = 'Search or select...',
  loading = false,
  onSearchChange,
  'aria-label': ariaLabel,
  onChange,
  disabled,
  value,
  defaultValue,
  autoFocus,
  ...props
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const listboxId = useId();
  const inputId = useId();
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? ''));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const controlled = value !== undefined;
  const selectedValue = String(controlled ? value : internalValue);
  const childOptions = useMemo(
    () =>
      Children.toArray(children).filter((child): child is OptionElement => isValidElement(child)),
    [children],
  );
  const selectableOptionCount = childOptions.filter(
    (option) => String(option.props.value ?? '') !== '',
  ).length;
  const showCombobox =
    searchable === true &&
    (onSearchChange !== undefined || loading || selectableOptionCount >= searchThreshold) &&
    !isStatusSelection(props.name, ariaLabel, className);
  const selectedOption = childOptions.find(
    (option) => String(option.props.value ?? '') === selectedValue,
  );
  const selectedOptionCache = useRef<OptionElement | undefined>(undefined);
  if (selectedOption) selectedOptionCache.current = selectedOption;
  const preservedSelectedOption =
    selectedOption ??
    (String(selectedOptionCache.current?.props.value ?? '') === selectedValue
      ? selectedOptionCache.current
      : undefined);
  const placeholder =
    childOptions.find((option) => String(option.props.value ?? '') === '')?.props.children ??
    searchPlaceholder;
  const filteredOptions = useMemo(
    () =>
      childOptions.filter(
        (option) =>
          String(option.props.value ?? '') !== '' &&
          !option.props.disabled &&
          (!query.trim() || matchesSearchableOption(option, query)),
      ),
    [childOptions, query],
  );

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filteredOptions.length - 1, 0)));
  }, [filteredOptions.length]);

  const select = (nextValue: string) => {
    if (!controlled) setInternalValue(nextValue);
    setQuery('');
    setOpen(false);
    if (selectRef.current) {
      selectRef.current.value = nextValue;
      onChange?.({
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      } as ChangeEvent<HTMLSelectElement>);
    }
  };

  if (!showCombobox) {
    return (
      <div className="searchable-select">
        <select
          ref={selectRef}
          {...props}
          disabled={disabled}
          value={controlled ? value : undefined}
          defaultValue={controlled ? undefined : defaultValue}
          autoFocus={autoFocus}
          onChange={onChange}
          aria-label={ariaLabel}
          className={className}
        >
          {children}
        </select>
      </div>
    );
  }

  const activeOption = filteredOptions[activeIndex];
  const activeId = activeOption ? listboxId + '-option-' + activeIndex : undefined;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && activeOption) {
      event.preventDefault();
      select(String(activeOption.props.value ?? ''));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={rootRef} className="searchable-select relative">
      <select
        ref={selectRef}
        {...props}
        disabled={disabled}
        value={selectedValue}
        onChange={onChange}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      >
        {children}
        {selectedValue && !selectedOption && preservedSelectedOption
          ? preservedSelectedOption
          : null}
      </select>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          id={inputId}
          role="combobox"
          aria-label={ariaLabel ?? props.name ?? 'Select option'}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open ? activeId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          value={
            open
              ? query
              : searchableOptionText(
                  preservedSelectedOption ??
                    ({ props: { children: placeholder } } as OptionElement),
                )
          }
          placeholder={searchPlaceholder}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            onSearchChange?.(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          className={(className ?? '') + ` w-full !pl-10 ${selectedValue ? '!pr-16' : '!pr-10'}`}
        />
        {selectedValue && !disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => select('')}
            className="absolute right-9 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Close options' : 'Open options'}
          onClick={() => setOpen((current) => !current)}
          className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-slate-500"
        >
          <ChevronDown className={'h-4 w-4 transition-transform ' + (open ? 'rotate-180' : '')} />
        </button>
      </div>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={inputId}
          className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          {loading ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500" role="status">
              Loading options...
            </p>
          ) : filteredOptions.length ? (
            filteredOptions.map((option, index) => {
              const optionValue = String(option.props.value ?? '');
              const selected = optionValue === selectedValue;
              return (
                <button
                  id={listboxId + '-option-' + index}
                  role="option"
                  aria-selected={selected}
                  key={optionValue}
                  type="button"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => select(optionValue)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ' +
                    (index === activeIndex
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-slate-800 hover:bg-slate-50')
                  }
                >
                  <span>{option.props.children}</span>
                  {selected ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-4 text-center text-sm text-slate-500">No matching options.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
