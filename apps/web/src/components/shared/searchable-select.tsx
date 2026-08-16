'use client';

import { Children, isValidElement, useId, useMemo, useState } from 'react';
import type { ReactElement, ReactNode, SelectHTMLAttributes } from 'react';
import { Search } from 'lucide-react';

type OptionElement = ReactElement<{ children?: ReactNode; value?: string | number }>;

const optionText = (option: OptionElement): string => {
  const children = option.props.children;
  return typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : String(option.props.value ?? '');
};

export function SearchableSelect({
  children,
  className,
  'aria-label': ariaLabel,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const selectedValue = String(props.value ?? props.defaultValue ?? '');
  const options = useMemo(
    () =>
      Children.toArray(children).filter((child) => {
        if (!query || !isValidElement(child)) return true;
        const option = child as OptionElement;
        return (
          String(option.props.value ?? '') === selectedValue ||
          optionText(option).toLowerCase().includes(query.trim().toLowerCase())
        );
      }),
    [children, query, selectedValue],
  );

  return (
    <div className="searchable-select">
      <div className="searchable-select-search">
        <Search aria-hidden="true" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search options..."
          autoComplete="off"
          aria-label={'Search ' + (ariaLabel ?? props.name ?? 'options')}
        />
      </div>
      <select {...props} aria-label={ariaLabel} className={className}>
        {options}
      </select>
    </div>
  );
}
