'use client';

import Link from 'next/link';
import { Building2, Check, Search } from 'lucide-react';
import { humanize } from '@/lib/presentation';

type Option = { id: string; label: string };

const asRecord = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');

function propertyCardMeta(row: Record<string, unknown>) {
  return {
    id: string(row.id),
    code: string(row.propertyCode),
    name: string(row.name),
    location: [string(row.district), string(row.city)].filter(Boolean).join(', '),
    type: humanize(string(row.propertyType)),
  };
}

export function WorkflowPropertyPicker({
  options,
  rows,
  selectedId,
  loading,
  search,
  onSearchChange,
  onSelect,
}: {
  options: Option[];
  rows: unknown[];
  selectedId: string;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const cards = rows.map((raw) => propertyCardMeta(asRecord(raw)));

  return (
    <div className="guided-workflow__picker">
      <div>
        <p className="guided-workflow__field-label">Property</p>
        <p className="guided-workflow__field-hint">
          Select an authorized property from your portfolio. Only properties you have access to are
          shown.
        </p>
      </div>
      <label className="guided-workflow__search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search properties by name, code, or location..."
          aria-label="Search properties"
        />
      </label>
      {loading ? <p className="guided-workflow__muted">Loading properties…</p> : null}
      <div className="guided-workflow__property-grid">
        {cards.map((card) => {
          const selected = card.id === selectedId;
          return (
            <button
              key={card.id}
              type="button"
              className={`guided-workflow__property-card${selected ? ' is-selected' : ''}`}
              onClick={() => onSelect(card.id)}
              aria-pressed={selected}
            >
              <span className="guided-workflow__property-image" aria-hidden="true">
                <Building2 size={28} />
              </span>
              {selected ? (
                <span className="guided-workflow__property-check" aria-hidden="true">
                  <Check size={14} strokeWidth={2.5} />
                </span>
              ) : null}
              <strong>{card.name}</strong>
              <span>{card.code}</span>
              <span>{card.location || 'Location pending'}</span>
              <span className="guided-workflow__property-tag">{card.type || 'Property'}</span>
            </button>
          );
        })}
      </div>
      {!loading && cards.length === 0 ? (
        <p className="guided-workflow__muted">No matching properties were found for this branch.</p>
      ) : null}
      {options.length > cards.length ? (
        <p className="guided-workflow__muted">
          Showing {cards.length} results. Refine your search to narrow the list.
        </p>
      ) : null}
      <div className="guided-workflow__info-banner">
        <strong>Can&apos;t find the property you need?</strong>
        <p>
          If the property is not yet registered, add it from the portfolio workspace first, then
          return to this workflow.
        </p>
        <Link href="/portfolio/properties">Go to Properties</Link>
      </div>
    </div>
  );
}
