'use client';

import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode, SelectHTMLAttributes } from 'react';
import { Search } from 'lucide-react';

type OptionElement = ReactElement<{ children?: ReactNode; value?: string | number }>;
type SearchableSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  searchable?: boolean;
  searchThreshold?: number;
  searchPlaceholder?: string;
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

export const firstSearchableOptionValue = (
  options: OptionElement[],
  query: string,
): string | undefined => {
  const match = options.find(
    (option) => String(option.props.value ?? '') && matchesSearchableOption(option, query),
  );
  return match ? String(match.props.value) : undefined;
};

export const isStatusSelection = (name?: string, ariaLabel?: string, className?: string): boolean =>
  [name, ariaLabel, className]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes('status'));

export function SearchableSelect({
  children,
  className,
  searchable,
  searchThreshold = 8,
  searchPlaceholder = 'Search options...',
  'aria-label': ariaLabel,
  ...props
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const lastAutoSelection = useRef('');
  const selectedValue = String(props.value ?? props.defaultValue ?? '');
  const childOptions = useMemo(
    () =>
      Children.toArray(children).filter((child): child is OptionElement => isValidElement(child)),
    [children],
  );
  const selectableOptionCount = childOptions.filter(
    (option) => String(option.props.value ?? '') !== '',
  ).length;
  // Compact selects are the default. Search is opt-in and only appears for
  // genuinely long, data-backed lists (people, properties, buildings, etc.).
  const showSearch =
    searchable === true &&
    selectableOptionCount >= searchThreshold &&
    !isStatusSelection(props.name, ariaLabel, className);
  const normalizedQuery = query.trim().toLowerCase();
  const options = useMemo(
    () =>
      childOptions.filter(
        (option) =>
          !normalizedQuery ||
          String(option.props.value ?? '') === selectedValue ||
          matchesSearchableOption(option, normalizedQuery),
      ),
    [childOptions, normalizedQuery, selectedValue],
  );

  useEffect(() => {
    if (!showSearch || !normalizedQuery || !selectRef.current) return;
    const firstValue = firstSearchableOptionValue(childOptions, normalizedQuery);
    const signature = normalizedQuery + ':' + firstValue;
    if (!firstValue || lastAutoSelection.current === signature) return;
    lastAutoSelection.current = signature;
    selectRef.current.value = firstValue;
    selectRef.current.dispatchEvent(new Event('change', { bubbles: true }));
  }, [childOptions, normalizedQuery, showSearch]);

  return (
    <div className="searchable-select">
      {showSearch ? (
        <div className="searchable-select-search">
          <Search aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => {
              lastAutoSelection.current = '';
              setQuery(event.target.value);
            }}
            placeholder={searchPlaceholder}
            autoComplete="off"
            aria-label={'Search ' + (ariaLabel ?? props.name ?? 'options')}
          />
        </div>
      ) : null}
      <select ref={selectRef} {...props} aria-label={ariaLabel} className={className}>
        {showSearch ? options : children}
      </select>
    </div>
  );
}
