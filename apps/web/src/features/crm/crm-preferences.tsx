'use client';

import type { LeadIntent, PreferenceResponse } from './crm-types';
import { humanize } from '@/lib/presentation';

type Field = {
  name: string;
  label: string;
  type?: 'text' | 'date' | 'decimal' | 'integer' | 'list' | 'boolean' | 'notes';
  options?: readonly string[];
};
const common: Field[] = [
  { name: 'preferredAreaText', label: 'Preferred areas (one per line)', type: 'list' },
  { name: 'desiredByDate', label: 'Desired by', type: 'date' },
  { name: 'notes', label: 'Preference notes', type: 'notes' },
];
const dimensions: Field[] = [
  { name: 'minBedrooms', label: 'Minimum bedrooms', type: 'integer' },
  { name: 'maxBedrooms', label: 'Maximum bedrooms', type: 'integer' },
  { name: 'minBathrooms', label: 'Minimum bathrooms', type: 'decimal' },
  { name: 'maxBathrooms', label: 'Maximum bathrooms', type: 'decimal' },
  { name: 'minArea', label: 'Minimum area', type: 'decimal' },
  { name: 'maxArea', label: 'Maximum area', type: 'decimal' },
  { name: 'areaUnit', label: 'Area unit', options: ['SQM', 'SQFT', 'HECTARE', 'ACRE'] },
];
export const preferenceFields: Record<LeadIntent, Field[]> = {
  RENT: [
    { name: 'minRent', label: 'Minimum rent', type: 'decimal' },
    { name: 'maxRent', label: 'Maximum rent', type: 'decimal' },
    { name: 'currency', label: 'Currency (three-letter code)' },
    {
      name: 'rentPeriod',
      label: 'Rent period',
      options: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
    },
    { name: 'moveInDate', label: 'Move-in date', type: 'date' },
    {
      name: 'furnishedPreference',
      label: 'Furnishing',
      options: ['REQUIRED', 'PREFERRED', 'NOT_REQUIRED', 'NO_PREFERENCE'],
    },
    { name: 'parkingRequired', label: 'Parking required', type: 'boolean' },
    { name: 'propertyTypeCodes', label: 'Preferred Property types (one per line)', type: 'list' },
    { name: 'rentableSpaceTypeCodes', label: 'Preferred Space types (one per line)', type: 'list' },
    ...dimensions,
  ],
  BUY: [
    { name: 'minBudget', label: 'Minimum budget', type: 'decimal' },
    { name: 'maxBudget', label: 'Maximum budget', type: 'decimal' },
    { name: 'currency', label: 'Currency (three-letter code)' },
    { name: 'targetPurchaseDate', label: 'Target purchase date', type: 'date' },
    {
      name: 'financingReadiness',
      label: 'Financing readiness',
      options: ['CASH_READY', 'FINANCE_PREAPPROVED', 'FINANCE_NEEDED', 'UNDECIDED'],
    },
    { name: 'propertyTypeCodes', label: 'Preferred Property types (one per line)', type: 'list' },
    ...dimensions,
  ],
  SELL: [
    { name: 'subjectDescription', label: 'Property description', type: 'notes' },
    { name: 'subjectLocation', label: 'Property location' },
    { name: 'expectedMinPrice', label: 'Expected minimum price', type: 'decimal' },
    { name: 'askingPrice', label: 'Asking price', type: 'decimal' },
    { name: 'currency', label: 'Currency (three-letter code)' },
    { name: 'desiredSaleDate', label: 'Desired sale date', type: 'date' },
    {
      name: 'sellerRelationship',
      label: 'Seller relationship',
      options: ['OWNER', 'AUTHORIZED_REPRESENTATIVE', 'OTHER_UNVERIFIED'],
    },
  ],
  CONSTRUCTION_SERVICE: [
    { name: 'projectBrief', label: 'Requested construction service', type: 'notes' },
    { name: 'siteLocation', label: 'Site location' },
    {
      name: 'category',
      label: 'Service category',
      options: ['NEW_BUILD', 'EXTENSION', 'RENOVATION', 'OTHER'],
    },
    { name: 'estimatedMinBudget', label: 'Estimated minimum budget', type: 'decimal' },
    { name: 'estimatedMaxBudget', label: 'Estimated maximum budget', type: 'decimal' },
    { name: 'currency', label: 'Currency (three-letter code)' },
    { name: 'targetStartDate', label: 'Target start date', type: 'date' },
    { name: 'targetCompletionDate', label: 'Target completion date', type: 'date' },
    { name: 'plotArea', label: 'Plot area', type: 'decimal' },
    { name: 'floorArea', label: 'Floor area', type: 'decimal' },
    { name: 'areaUnit', label: 'Area unit', options: ['SQM', 'SQFT', 'HECTARE', 'ACRE'] },
    { name: 'bedrooms', label: 'Bedrooms', type: 'integer' },
    { name: 'floors', label: 'Floors', type: 'integer' },
    {
      name: 'siteControl',
      label: 'Site control',
      options: ['OWNS_SITE', 'AUTHORIZED_TO_BUILD', 'SEEKING_SITE', 'UNKNOWN'],
    },
  ],
};

export function readPreference(intent: LeadIntent, form: FormData): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  for (const field of [...common, ...preferenceFields[intent]]) {
    const entry = form.get(`preference.${field.name}`);
    const raw = typeof entry === 'string' ? entry.trim() : '';
    if (!raw) continue;
    value[field.name] =
      field.type === 'list'
        ? [
            ...new Set(
              raw
                .split('\n')
                .map((part) => part.trim())
                .filter(Boolean),
            ),
          ]
        : field.type === 'integer'
          ? Number(raw)
          : field.type === 'boolean'
            ? raw === 'true'
            : raw;
  }
  return value;
}

export function preferenceValidation(value: Record<string, unknown>): string | null {
  for (const [minimum, maximum] of [
    ['minRent', 'maxRent'],
    ['minBudget', 'maxBudget'],
    ['expectedMinPrice', 'askingPrice'],
    ['estimatedMinBudget', 'estimatedMaxBudget'],
    ['minBedrooms', 'maxBedrooms'],
    ['minBathrooms', 'maxBathrooms'],
    ['minArea', 'maxArea'],
  ]) {
    if (
      value[minimum!] !== undefined &&
      value[maximum!] !== undefined &&
      Number(value[minimum!]) > Number(value[maximum!])
    )
      return 'A minimum cannot be greater than its maximum. Review the preference ranges.';
  }
  return null;
}

export function PreferenceFields({
  intent,
  defaults = {},
}: {
  intent: LeadIntent;
  defaults?: Record<string, unknown>;
}) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-3 text-base font-bold">{humanize(intent)} preferences</legend>
      {[...common, ...preferenceFields[intent]].map((field) => {
        const raw = defaults[field.name];
        const initial =
          raw === undefined || raw === null
            ? ''
            : Array.isArray(raw)
              ? raw.join('\n')
              : typeof raw === 'string'
                ? raw
                : typeof raw === 'number' || typeof raw === 'boolean'
                  ? String(raw)
                  : '';
        return (
          <label
            key={`${intent}.${field.name}`}
            className={field.type === 'notes' || field.type === 'list' ? 'sm:col-span-2' : ''}
          >
            {field.label}
            {field.options || field.type === 'boolean' ? (
              <select
                name={`preference.${field.name}`}
                defaultValue={initial}
                required={intent === 'CONSTRUCTION_SERVICE' && field.name === 'category'}
              >
                <option value="">Not recorded</option>
                {(field.options ?? ['true', 'false']).map((option) => (
                  <option key={option} value={option}>
                    {option === 'true' ? 'Yes' : option === 'false' ? 'No' : humanize(option)}
                  </option>
                ))}
              </select>
            ) : field.type === 'notes' || field.type === 'list' ? (
              <textarea
                name={`preference.${field.name}`}
                rows={3}
                defaultValue={initial}
                required={field.name === 'projectBrief'}
                minLength={field.name === 'projectBrief' ? 3 : undefined}
                maxLength={field.name === 'projectBrief' ? 2000 : 1000}
              />
            ) : (
              <input
                name={`preference.${field.name}`}
                defaultValue={field.type === 'date' ? initial.slice(0, 10) : initial}
                type={
                  field.type === 'date'
                    ? 'date'
                    : field.type === 'decimal' || field.type === 'integer'
                      ? 'number'
                      : 'text'
                }
                min={field.type === 'decimal' || field.type === 'integer' ? 0 : undefined}
                step={
                  field.type === 'decimal'
                    ? field.name.includes('Bathrooms')
                      ? '0.1'
                      : field.name.toLowerCase().includes('area')
                        ? '0.000001'
                        : '0.0001'
                    : field.type === 'integer'
                      ? '1'
                      : undefined
                }
                max={field.type === 'integer' ? 100 : undefined}
                maxLength={field.name === 'currency' ? 3 : 300}
                pattern={field.name === 'currency' ? '[A-Z]{3}' : undefined}
              />
            )}
          </label>
        );
      })}
    </fieldset>
  );
}

export function PreferenceSummary({
  intent,
  preference,
}: {
  intent: LeadIntent;
  preference: PreferenceResponse | Record<string, unknown>;
}) {
  const values = preference as unknown as Record<string, unknown>;
  const fields = [...common, ...preferenceFields[intent]].filter(
    (field) =>
      values[field.name] !== undefined && values[field.name] !== null && values[field.name] !== '',
  );
  if (!fields.length)
    return (
      <p className="text-sm text-slate-500">
        No preferences recorded yet. Add the known requirements before qualification.
      </p>
    );
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const value = values[field.name];
        const display = Array.isArray(value)
          ? value.join(', ')
          : field.type === 'boolean'
            ? value
              ? 'Yes'
              : 'No'
            : field.options
              ? humanize(String(value))
              : field.type === 'date'
                ? String(value).slice(0, 10)
                : /Rent|Budget|Price/.test(field.name) && typeof values.currency === 'string'
                  ? `${values.currency} ${String(value)}`
                  : String(value);
        return (
          <div key={field.name}>
            <dt className="text-xs font-bold text-slate-500">
              {field.label.replace(' (one per line)', '')}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}
