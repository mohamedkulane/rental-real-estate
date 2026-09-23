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
      className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            'min-h-11 shrink-0 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ease-out ' +
            (active === tab.key
              ? 'bg-[#215E61] text-white shadow-sm'
              : 'text-slate-600 hover:bg-[#F4F2F2] hover:text-[#1D2128]')
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
