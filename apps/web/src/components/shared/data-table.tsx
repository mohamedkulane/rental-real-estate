'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  CircleOff,
  Eye,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type TableActionTone =
  | 'open'
  | 'view'
  | 'edit'
  | 'manage'
  | 'create'
  | 'schedule'
  | 'property'
  | 'agreement'
  | 'danger'
  | 'neutral';

const TABLE_ACTION_STYLES: Record<TableActionTone, string> = {
  open: 'border-[#215E61]/20 bg-[#E8F3F3] text-[#215E61] hover:bg-[#d7eaea]',
  view: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
  edit: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
  manage: 'border-[#FF9E20]/35 bg-[#FFF4E5] text-[#9A5B00] hover:bg-[#ffe8c7]',
  create: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  schedule: 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
  property: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
  agreement: 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100',
  danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  neutral: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
};

const TABLE_ACTION_ICONS: Record<TableActionTone, LucideIcon> = {
  open: FolderOpen,
  view: Eye,
  edit: Pencil,
  manage: Settings2,
  create: Plus,
  schedule: CalendarDays,
  property: Building2,
  agreement: FileText,
  danger: CircleOff,
  neutral: Eye,
};

type TableActionButtonProps = {
  tone?: TableActionTone;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  icon?: LucideIcon | false;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  title?: string;
  'aria-label'?: string;
};

export function TableActionButton({
  tone = 'open',
  href,
  onClick,
  children,
  icon,
  disabled = false,
  className = '',
  type = 'button',
  title,
  'aria-label': ariaLabel,
}: TableActionButtonProps) {
  const Icon = icon === false ? null : (icon ?? TABLE_ACTION_ICONS[tone]);
  const classes =
    'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#215E61]/25 disabled:pointer-events-none disabled:opacity-50 ' +
    TABLE_ACTION_STYLES[tone] +
    (className ? ` ${className}` : '');

  const content = (
    <>
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      <span>{children}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={classes}
        title={title}
        aria-label={ariaLabel}
        {...(onClick ? { onClick } : {})}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );
}

export function TableActionGroup({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={'flex flex-wrap items-center justify-end gap-1.5 ' + className}>{children}</div>
  );
}

export function DataTableSurface({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={
        'overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm ' + className
      }
    >
      {children}
    </section>
  );
}

export function DataTableToolbar({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">{children}</div>
      {footer ? <div className="border-t border-slate-100 px-4 py-2">{footer}</div> : null}
    </div>
  );
}

export function DataTableSearch({
  value,
  onChange,
  placeholder = 'Search records...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="sr-only">Search</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-800 shadow-sm transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
      />
    </label>
  );
}

export function DataTableFilter({
  label,
  value,
  onChange,
  options,
  className = 'w-full sm:w-44',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <label className={'block ' + className}>
      <span className="mb-1 block text-[12px] font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
      >
        {options.map((option) => (
          <option key={option.value || '__all'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DataTableActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 md:justify-end">{children}</div>;
}

export function DataTableResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="button ghost text-[13px]" onClick={onClick}>
      Reset Filters
    </button>
  );
}

export function DataTableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function DataTable({ children, minWidth = 760 }: { children: ReactNode; minWidth?: number }) {
  return (
    <table className="data-table w-full border-collapse" style={{ minWidth }}>
      {children}
    </table>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function DataTableRow({
  children,
  clickable = false,
  onClick,
}: {
  children: ReactNode;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      className={'border-b border-slate-100 last:border-0 ' + (clickable ? 'cursor-pointer' : '')}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function DataTableHeaderCell({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={'px-4 py-3 text-[12px] font-semibold text-slate-500 ' + alignClass + ' ' + className}>
      {children}
    </th>
  );
}

export function DataTableCell({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td className={'px-4 py-3.5 text-[14px] text-slate-700 ' + alignClass + ' ' + className}>
      {children}
    </td>
  );
}

export function DataTablePrimaryCell({
  title,
  subtitle,
  leading,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {leading}
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-slate-900">{title}</p>
        {subtitle ? <p className="truncate text-[12px] text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function PropertyThumbnail({
  src,
  alt,
  size = 40,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="shrink-0 rounded-lg border border-slate-200 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
        <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    </span>
  );
}

export function DataTableSkeleton({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div className="p-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="mb-2 grid gap-3 border-b border-slate-100 py-3 last:mb-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, colIndex) => (
            <span
              key={colIndex}
              className="h-4 animate-pulse rounded bg-slate-100"
              style={{ opacity: 1 - colIndex * 0.08 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DataTableEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] text-slate-500">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function DataTableError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-[14px] font-semibold text-slate-900">We could not load this table</p>
      <p className="mt-2 text-[13px] text-slate-500">{message}</p>
      {onRetry ? (
        <button type="button" className="button secondary mt-4" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export type RowAction = {
  key: string;
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
};

export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="relative inline-flex justify-end" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              className={
                'flex w-full rounded-md px-3 py-2 text-left text-[13px] font-medium transition hover:bg-slate-50 ' +
                (action.tone === 'danger' ? 'text-red-700 hover:bg-red-50' : 'text-slate-700')
              }
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DataTableMobileCards({ children }: { children: ReactNode }) {
  return <div className="space-y-3 p-3 sm:p-4 md:hidden">{children}</div>;
}

export function DataTableMobileCard({
  title,
  subtitle,
  rows,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-[15px] font-semibold text-slate-900">{title}</p>
        {subtitle ? <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p> : null}
      </div>
      <dl className="grid gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 text-[13px] sm:grid sm:grid-cols-[110px_1fr] sm:gap-2">
            <dt className="font-medium text-slate-500">{row.label}</dt>
            <dd className="text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="mt-4 flex items-center gap-2">{actions}</div> : null}
    </article>
  );
}

export function DataTableDesktopOnly({ children }: { children: ReactNode }) {
  return <div className="hidden md:block">{children}</div>;
}
