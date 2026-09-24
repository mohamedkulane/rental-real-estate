'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Bell,
  Building2,
  ChevronRight,
  FileSearch,
  Globe2,
  Landmark,
  LockKeyhole,
  Mail,
  Palette,
  Phone,
  Save,
  Settings,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
import { StatusBadge } from '@/components/shared/ui';

export type CompanySettings = {
  id: string;
  legalName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: Record<string, unknown> | null;
  logoMetadata?: Record<string, unknown> | null;
  defaultCurrency?: string | null;
  timezone?: string | null;
  active?: boolean;
};

export type SettingsSectionKey =
  | 'general'
  | 'company'
  | 'branding'
  | 'security'
  | 'users'
  | 'branches'
  | 'notifications'
  | 'finance'
  | 'system'
  | 'audit';

export const SETTINGS_SECTIONS: Array<{
  key: SettingsSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'company',
    label: 'Organization & branding',
    description: 'Company identity, logo, colors, and reporting defaults.',
  },
  {
    key: 'security',
    label: 'Security',
    description: 'Account protection and session controls.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Alert delivery preferences.',
  },
];

export function isSettingsSectionKey(value: string | null | undefined): value is SettingsSectionKey {
  return Boolean(value && SETTINGS_SECTIONS.some((section) => section.key === value));
}

const inputClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#E6F4F1] disabled:bg-slate-50';

const colorValue = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;

const metadataValue = (metadata: Record<string, unknown> | null | undefined, key: string) =>
  typeof metadata?.[key] === 'string' ? String(metadata[key]) : '';

const addressValue = (address: Record<string, unknown> | null | undefined) =>
  typeof address?.line1 === 'string' ? address.line1 : '';

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

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-[#E3F2FD] p-2 text-[#0D47A1]">{icon}</span>
          <h2 className="font-bold">{title}</h2>
        </div>
      </div>
      <div className="space-y-4 p-5 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

function ComingSoonNote({ topic }: { topic: string }) {
  return (
    <p>
      {topic} are not configured in this release. No additional backend settings are available yet —
      this section is reserved so Administration has one place for future preferences.
    </p>
  );
}

function WorkspaceLink({
  label,
  description,
  onOpen,
}: {
  label: string;
  description: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <p className="font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        onClick={onOpen}
      >
        Open
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SettingsPanel({
  company,
  busy,
  canUpdate,
  activeSection = 'company',
  onSectionChange,
  onNavigateAdmin,
  onSave,
}: {
  company: CompanySettings;
  busy: boolean;
  canUpdate: boolean;
  activeSection?: SettingsSectionKey;
  onSectionChange: (section: SettingsSectionKey) => void;
  onNavigateAdmin: (section: 'users' | 'branches' | 'audit') => void;
  onSave: (input: Record<string, unknown>) => Promise<void>;
}) {
  const selected =
    SETTINGS_SECTIONS.find((section) => section.key === activeSection) ?? SETTINGS_SECTIONS[0]!;
  const metadata = company.logoMetadata ?? {};
  const [formState, setFormState] = useState(() => ({
    legalName: company.legalName ?? '',
    displayName: company.displayName ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    address: addressValue(company.address),
    defaultCurrency: company.defaultCurrency ?? 'USD',
    timezone: company.timezone ?? 'Africa/Nairobi',
    logoUrl: metadataValue(metadata, 'url'),
    primaryColor: colorValue(metadata['primaryColor'], '#0F766E'),
    accentColor: colorValue(metadata['accentColor'], '#2563EB'),
  }));
  const setFormValue = (key: keyof typeof formState, next: string) =>
    setFormState((current) => ({ ...current, [key]: next }));

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          <span>Administration</span>
          <ChevronRight className="h-3 w-3" />
          <span>Settings</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-700">{selected.label}</span>
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Company identity and operating preferences live here — one primary place for administrators.
        </p>
      </header>

      <div className="space-y-5">
        <nav
          className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
          aria-label="Settings sections"
        >
          <ul className="flex min-w-max gap-1">
            {SETTINGS_SECTIONS.map((section) => {
              const isActive = section.key === selected.key;
              return (
                <li key={section.key}>
                  <button
                    type="button"
                    className={
                      'whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold transition ' +
                      (isActive
                        ? 'bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                    }
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onSectionChange(section.key)}
                  >
                    {section.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className={
            selected.key === 'company'
              ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]'
              : 'space-y-4'
          }
        >
          <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{selected.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{selected.description}</p>
          </div>

          {selected.key === 'company' ? (
            <form
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const nextMetadata = {
                  ...metadata,
                  url: formState.logoUrl.trim() || undefined,
                  primaryColor: formState.primaryColor,
                  accentColor: formState.accentColor,
                };
                void onSave({
                  legalName: formState.legalName.trim(),
                  displayName: formState.displayName.trim(),
                  ...(formState.phone.trim() ? { phone: formState.phone.trim() } : {}),
                  ...(formState.email.trim() ? { email: formState.email.trim() } : {}),
                  ...(formState.address.trim()
                    ? { address: { ...(company.address ?? {}), line1: formState.address.trim() } }
                    : {}),
                  logoMetadata: nextMetadata,
                  defaultCurrency: formState.defaultCurrency.trim().toUpperCase(),
                  timezone: formState.timezone.trim(),
                }).catch(() => undefined);
              }}
            >
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-[#E6F4F1] p-2 text-[#0F766E]">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900">Company profile</h3>
                      <p className="text-sm text-slate-500">
                        Identity, branding, and reporting defaults.
                      </p>
                    </div>
                  </div>
                  <StatusBadge value={company.active} />
                </div>
              </div>
              <div className="space-y-6 p-5">
                <section className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Basic information</h4>
                    <p className="mt-1 text-xs text-slate-500">The identity shown across the workspace.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Legal name">
                      <input
                        value={formState.legalName}
                        onChange={(event) => setFormValue('legalName', event.target.value)}
                        required
                        disabled={!canUpdate}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Display name">
                      <input
                        value={formState.displayName}
                        onChange={(event) => setFormValue('displayName', event.target.value)}
                        required
                        disabled={!canUpdate}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </section>

                <section className="space-y-4 border-t border-slate-100 pt-5">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Brand identity</h4>
                    <p className="mt-1 text-xs text-slate-500">Used by the shell and company-facing surfaces.</p>
                  </div>
                  <Field
                    label="Logo URL"
                    icon={<Palette className="h-4 w-4 text-slate-400" />}
                    hint="Use a public PNG, JPG, SVG, WebP, or CDN image URL."
                  >
                    <input
                      type="url"
                      value={formState.logoUrl}
                      onChange={(event) => setFormValue('logoUrl', event.target.value)}
                      placeholder="https://example.com/logo.svg"
                      disabled={!canUpdate}
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(['primaryColor', 'accentColor'] as const).map((key) => (
                      <Field key={key} label={key === 'primaryColor' ? 'Primary brand color' : 'Accent brand color'}>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formState[key]}
                            onChange={(event) => setFormValue(key, event.target.value)}
                            disabled={!canUpdate}
                            className="h-11 w-14 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
                            aria-label={key === 'primaryColor' ? 'Primary brand color' : 'Accent brand color'}
                          />
                          <input
                            value={formState[key]}
                            onChange={(event) => setFormValue(key, event.target.value)}
                            disabled={!canUpdate}
                            className={inputClass}
                            aria-label={`${key} hex value`}
                          />
                        </div>
                      </Field>
                    ))}
                  </div>
                </section>

                <section className="space-y-4 border-t border-slate-100 pt-5">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Contact information</h4>
                    <p className="mt-1 text-xs text-slate-500">Shown in operational and financial records where available.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Phone" icon={<Phone className="h-4 w-4 text-slate-400" />}>
                      <input
                        value={formState.phone}
                        onChange={(event) => setFormValue('phone', event.target.value)}
                        disabled={!canUpdate}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Email" icon={<Mail className="h-4 w-4 text-slate-400" />}>
                      <input
                        type="email"
                        value={formState.email}
                        onChange={(event) => setFormValue('email', event.target.value)}
                        disabled={!canUpdate}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="Address">
                    <input
                      value={formState.address}
                      onChange={(event) => setFormValue('address', event.target.value)}
                      disabled={!canUpdate}
                      className={inputClass}
                    />
                  </Field>
                </section>

                <section className="space-y-4 border-t border-slate-100 pt-5">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Defaults</h4>
                    <p className="mt-1 text-xs text-slate-500">Applied to reporting and financial workflows.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Default currency"
                      icon={<Globe2 className="h-4 w-4 text-slate-400" />}
                      hint="Three-letter ISO code."
                    >
                      <input
                        value={formState.defaultCurrency}
                        onChange={(event) => setFormValue('defaultCurrency', event.target.value)}
                        minLength={3}
                        maxLength={3}
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
                        value={formState.timezone}
                        onChange={(event) => setFormValue('timezone', event.target.value)}
                        required
                        disabled={!canUpdate}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </section>
              </div>
              {canUpdate ? (
                <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {busy ? 'Saving...' : 'Save workspace'}
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}

          {selected.key === 'general' ? (
            <SectionCard icon={<Settings className="h-5 w-5" />} title="General">
              <p>
                Regional defaults such as reporting timezone and default currency are managed under{' '}
                <button
                  type="button"
                  className="font-semibold text-[#0D47A1] underline-offset-2 hover:underline"
                  onClick={() => onSectionChange('company')}
                >
                  Company
                </button>
                . There is no separate general preference store yet.
              </p>
            </SectionCard>
          ) : null}

          {selected.key === 'branding' ? (
            <SectionCard icon={<Palette className="h-5 w-5" />} title="Branding">
              <p>
                The workspace uses the approved navy, white, and emerald product theme with accessible
                contrast. Custom branding controls are not available in this release.
              </p>
            </SectionCard>
          ) : null}

          {selected.key === 'security' ? (
            <SectionCard icon={<LockKeyhole className="h-5 w-5" />} title="Security">
              <p>
                User access, account suspension, and session revocation are managed under Users &
                Access. Company profile changes remain restricted to authorized administrators and are
                recorded in Audit.
              </p>
              <WorkspaceLink
                label="Users & Access"
                description="Open account status and session controls."
                onOpen={() => onNavigateAdmin('users')}
              />
            </SectionCard>
          ) : null}

          {selected.key === 'users' ? (
            <SectionCard icon={<Users className="h-5 w-5" />} title="Users & Access">
              <p>
                Login accounts, access state, and revocable sessions are maintained in the user
                accounts register.
              </p>
              <WorkspaceLink
                label="User accounts"
                description="Requires identity.user.read."
                onOpen={() => onNavigateAdmin('users')}
              />
            </SectionCard>
          ) : null}

          {selected.key === 'branches' ? (
            <SectionCard icon={<Landmark className="h-5 w-5" />} title="Branches">
              <p>Operating locations are managed in the Branches directory under Administration.</p>
              <WorkspaceLink
                label="Branch directory"
                description="Requires organization.branch.read."
                onOpen={() => onNavigateAdmin('branches')}
              />
            </SectionCard>
          ) : null}

          {selected.key === 'notifications' ? (
            <SectionCard icon={<Bell className="h-5 w-5" />} title="Notifications">
              <ComingSoonNote topic="Notification preferences" />
            </SectionCard>
          ) : null}

          {selected.key === 'finance' ? (
            <SectionCard icon={<Wallet className="h-5 w-5" />} title="Finance Preferences">
              <p>
                Default currency is set on the Company section. Additional finance preference controls
                are not available in this release.
              </p>
              <button
                type="button"
                className="font-semibold text-[#0D47A1] underline-offset-2 hover:underline"
                onClick={() => onSectionChange('company')}
              >
                Open Company defaults
              </button>
            </SectionCard>
          ) : null}

          {selected.key === 'system' ? (
            <SectionCard icon={<Shield className="h-5 w-5" />} title="System Preferences">
              <ComingSoonNote topic="System preferences" />
            </SectionCard>
          ) : null}

          {selected.key === 'audit' ? (
            <SectionCard icon={<FileSearch className="h-5 w-5" />} title="Audit">
              <p>
                Sensitive and administrative activity is recorded in the audit log for authorized
                reviewers.
              </p>
              <WorkspaceLink
                label="Audit log"
                description="Requires governance.audit.read."
                onOpen={() => onNavigateAdmin('audit')}
              />
            </SectionCard>
          ) : null}

          <aside className="rounded-xl border border-[#90CAF9] bg-[#E3F2FD] p-5">
            <div className="flex items-center gap-3 text-[#0D47A1]">
              <Settings className="h-5 w-5" />
              <strong className="text-sm">Settings are company-wide</strong>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#0D47A1]">
              Only authorized company administrators can save company changes. Every update is
              recorded in the Audit log.
            </p>
          </aside>
          </div>

        </div>
      </div>
    </div>
  );
}
