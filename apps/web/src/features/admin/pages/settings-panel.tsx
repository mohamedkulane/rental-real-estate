'use client';

import type { FormEvent, ReactNode } from 'react';
import {
  Building2,
  ChevronRight,
  Globe2,
  LockKeyhole,
  Mail,
  Palette,
  Phone,
  Save,
  Settings,
} from 'lucide-react';

export type CompanySettings = {
  id: string;
  legalName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  defaultCurrency?: string | null;
  timezone?: string | null;
  active?: boolean;
};
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';
const value = (form: FormData, key: string) => {
  const item = form.get(key);
  return typeof item === 'string' ? item.trim() : '';
};
function Field({
  label,
  icon,
  children,
  hint,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function SettingsPanel({
  company,
  busy,
  canUpdate,
  onSave,
}: {
  company: CompanySettings;
  busy: boolean;
  canUpdate: boolean;
  onSave: (input: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          <span>Preferences</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-700">Settings</span>
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Control the company information and regional preferences used across Rental Operations.
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const phone = value(form, 'phone');
            const email = value(form, 'email');
            void onSave({
              legalName: value(form, 'legalName'),
              displayName: value(form, 'displayName'),
              ...(phone ? { phone } : {}),
              ...(email ? { email } : {}),
              defaultCurrency: value(form, 'defaultCurrency').toUpperCase(),
              timezone: value(form, 'timezone'),
            }).catch(() => undefined);
          }}
        >
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold">Company preferences</h2>
                <p className="text-sm text-slate-500">Business identity and reporting defaults.</p>
              </div>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Legal name">
                <input
                  name="legalName"
                  defaultValue={company.legalName ?? ''}
                  required
                  disabled={!canUpdate}
                  className={inputClass}
                />
              </Field>
              <Field label="Display name">
                <input
                  name="displayName"
                  defaultValue={company.displayName ?? ''}
                  required
                  disabled={!canUpdate}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" icon={<Phone className="h-4 w-4 text-slate-400" />}>
                <input
                  name="phone"
                  defaultValue={company.phone ?? ''}
                  disabled={!canUpdate}
                  className={inputClass}
                />
              </Field>
              <Field label="Email" icon={<Mail className="h-4 w-4 text-slate-400" />}>
                <input
                  name="email"
                  type="email"
                  defaultValue={company.email ?? ''}
                  disabled={!canUpdate}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Default currency"
                icon={<Globe2 className="h-4 w-4 text-slate-400" />}
                hint="Three-letter ISO code used by future financial workflows."
              >
                <input
                  name="defaultCurrency"
                  minLength={3}
                  maxLength={3}
                  defaultValue={company.defaultCurrency ?? 'USD'}
                  required
                  disabled={!canUpdate}
                  className={inputClass}
                />
              </Field>
              <Field
                label="Reporting timezone"
                icon={<Globe2 className="h-4 w-4 text-slate-400" />}
                hint="Example: Africa/Nairobi"
              >
                <input
                  name="timezone"
                  defaultValue={company.timezone ?? 'Africa/Nairobi'}
                  required
                  disabled={!canUpdate}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
          {canUpdate ? (
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {busy ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          ) : null}
        </form>
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                <LockKeyhole className="h-5 w-5" />
              </span>
              <h2 className="font-bold">Security & sessions</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              User access, account suspension, and session revocation are managed under{' '}
              <strong>Team & access → User accounts</strong>.
            </p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <Palette className="h-5 w-5" />
              </span>
              <h2 className="font-bold">Appearance</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The workspace uses the approved navy, white, and emerald product theme with Montserrat
              typography and accessible contrast.
            </p>
          </section>
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-3 text-emerald-800">
              <Settings className="h-5 w-5" />
              <strong className="text-sm">Settings are company-wide</strong>
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-800">
              Only authorized company administrators can save changes. Every update is recorded in
              the Audit log.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
