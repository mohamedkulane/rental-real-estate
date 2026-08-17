'use client';

export type DetailTabOption<Key extends string> = {
  key: Key;
  label: string;
};

export function DetailTabs<Key extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: readonly DetailTabOption<Key>[];
  active: Key;
  onChange: (key: Key) => void;
  label: string;
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-slate-200 scroll-smooth"
      role="tablist"
      aria-label={label}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          tabIndex={active === tab.key ? 0 : -1}
          onClick={() => onChange(tab.key)}
          className={
            'min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold transition-colors duration-200 ease-out ' +
            (active === tab.key
              ? 'border-[#0D47A1] text-[#0D47A1]'
              : 'border-transparent text-slate-500 hover:text-slate-800')
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
