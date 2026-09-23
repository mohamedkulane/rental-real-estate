'use client';

import type { FormEvent, ReactNode } from 'react';
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
    key: 'general',
    label: 'General',
    description: 'Workspace defaults that apply across the company.',
  },
  {
    key: 'company',
    label: 'Company',
    description: 'Legal identity, contact details, and reporting defaults.',
  },
  {
    key: 'branding',
    label: 'Branding',
    description: 'Product theme and presentation used in the workspace.',
  },
  {
    key: 'security',
    label: 'Security',
    description: 'Account protection and session controls.',
  },
  {
    key: 'users',
    label: 'Users & Access',
    description: 'Login accounts, suspension, and session revocation.',
  },
  {
    key: 'branches',
    label: 'Branches',
    description: 'Operating locations and branch directory.',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Alert delivery preferences.',
  },
  {
    key: 'finance',
    label: 'Finance Preferences',
    description: 'Finance defaults used by billing and reporting.',
  },
  {
    key: 'system',
    label: 'System Preferences',
    description: 'Platform-level operating preferences.',
  },
  {
    key: 'audit',
    label: 'Audit',
    description: 'Sensitive and administrative activity history.',
  },
];

export function isSettingsSectionKey(value: string | null | undefined): value is SettingsSectionKey {
  return Boolean(value && SETTINGS_SECTIONS.some((section) => section.key === value));
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD] disabled:bg-slate-100';

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
    SETTINGS_SECTIONS.find((section) => section.key === activeSection) ?? SETTINGS_SECTIONS[1]!;

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

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          className="h-fit rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
          aria-label="Settings sections"
        >
          <ul className="space-y-0.5">
            {SETTINGS_SECTIONS.map((section) => {
              const isActive = section.key === selected.key;
              return (
                <li key={section.key}>
                  <button
                    type="button"
                    className={
                      'w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ' +
                      (isActive
                        ? 'bg-[#E3F2FD] text-[#0D47A1]'
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-[#E3F2FD] p-2 text-[#0D47A1]">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-bold">Company profile</h3>
                      <p className="text-sm text-slate-500">
                        Business identity and reporting defaults used across the system.
                      </p>
                    </div>
                  </div>
                  <StatusBadge value={company.active} />
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
                    hint="Three-letter ISO code used by financial workflows."
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
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0D47A1] disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {busy ? 'Saving…' : 'Save company'}
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
  );
}
