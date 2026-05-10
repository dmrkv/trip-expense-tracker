import { useEffect, useMemo, useRef, useState } from 'react';
import { CURRENCIES, type CurrencyOption, searchCurrencies } from '../lib/currencies';

interface Props {
  value: string;
  onChange: (code: string) => void;
  id?: string;
}

/** Searchable currency selector backed by a static ISO subset. */
export default function CurrencyCombobox({ value, onChange, id }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  const selected = useMemo<CurrencyOption | undefined>(
    () => CURRENCIES.find((c) => c.code === value),
    [value],
  );

  const results = useMemo(() => searchCurrencies(query).slice(0, 60), [query]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function pick(c: CurrencyOption) {
    onChange(c.code);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative" ref={ref}>
      <button
        id={id}
        type="button"
        className="input flex items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-medium text-slate-900">
          {selected?.code ?? value}
          <span className="ml-2 text-slate-500 font-normal">
            {selected?.name ?? ''}
          </span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              className="input"
              placeholder="Search currency…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter' && results[activeIndex]) {
                  e.preventDefault();
                  pick(results[activeIndex]);
                }
              }}
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {results.map((c, i) => (
              <li key={c.code}>
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm ${
                    i === activeIndex ? 'bg-accent/10' : ''
                  } ${value === c.code ? 'text-accent-700 font-semibold' : 'text-slate-700'}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pick(c)}
                >
                  <span>
                    <span className="font-mono mr-2">{c.code}</span>
                    {c.name}
                  </span>
                  {c.symbol ? <span className="text-slate-400">{c.symbol}</span> : null}
                </button>
              </li>
            ))}
            {results.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">No matches</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
