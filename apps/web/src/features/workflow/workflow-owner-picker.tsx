'use client';

import Link from 'next/link';
import { Check, Search, UserRound } from 'lucide-react';
import { humanize } from '@/lib/presentation';

type OwnerCard = {
  id: string;
  name: string;
  code: string;
  kind: string;
};

const asRecord = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');

function ownerCardMeta(row: Record<string, unknown>): OwnerCard {
  const party = asRecord(row.party);
  return {
    id: string(row.partyId || row.id),
    name: string(party.displayName || row.displayName),
    code: string(row.ownerNumber),
    kind: humanize(string(party.kind)),
  };
}

export function WorkflowOwnerPicker({
  rows,
  selectedId,
  loading,
  search,
  onSearchChange,
  onSelect,
  optional = false,
}: {
  rows: unknown[];
  selectedId: string;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  optional?: boolean;
}) {
  const cards = rows.map((raw) => ownerCardMeta(asRecord(raw))).filter((card) => card.id);

  return (
    <div className="guided-workflow__picker">
      <div>
        <p className="guided-workflow__field-label">Owner</p>
        <p className="guided-workflow__field-hint">
          Search by name or owner number. Only authorized owners are shown.
        </p>
      </div>
      <label className="guided-workflow__search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search owners by name or number..."
          aria-label="Search owners"
          autoComplete="off"
        />
      </label>
      {loading ? <p className="guided-workflow__muted">Loading owners…</p> : null}
      <div className="guided-workflow__record-list" role="listbox" aria-label="Owners">
        {cards.map((card) => {
          const selected = card.id === selectedId;
          return (
            <button
              key={card.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={`guided-workflow__record-row${selected ? ' is-selected' : ''}`}
              onClick={() => onSelect(selected ? '' : card.id)}
            >
              <span className="guided-workflow__record-avatar" aria-hidden="true">
                <UserRound size={18} />
              </span>
              <span className="guided-workflow__record-copy">
                <strong>{card.name || 'Unnamed owner'}</strong>
                <span>
                  {card.code || 'Owner number pending'}
                  {card.kind ? ` · ${card.kind}` : ''}
                </span>
              </span>
              {selected ? (
                <span className="guided-workflow__record-check" aria-hidden="true">
                  <Check size={14} strokeWidth={2.5} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {!loading && cards.length === 0 ? (
        <p className="guided-workflow__muted">
          No matching owners were found. Try another name or owner number.
        </p>
      ) : null}
      {optional ? (
        <button
          type="button"
          className="button secondary justify-self-start"
          onClick={() => onSelect('')}
        >
          Skip this optional step
        </button>
      ) : null}
      <div className="guided-workflow__info-banner">
        <strong>Can&apos;t find the owner?</strong>
        <p>Register the owner in the portfolio workspace first, then return to this workflow.</p>
        <Link href="/portfolio/owners">Go to Owners</Link>
      </div>
    </div>
  );
}
