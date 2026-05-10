import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import GroupFormModal from '../components/GroupFormModal';
import { formatMoney } from '../lib/money';
import type { Expense, Group } from '../types';

export default function GroupsListPage() {
  const [openNew, setOpenNew] = useState(false);

  const groups = useLiveQuery(
    () => db.groups.orderBy('updatedAt').reverse().toArray(),
    [],
    [] as Group[],
  );
  const allExpenses = useLiveQuery(() => db.expenses.toArray(), [], [] as Expense[]);

  const expensesByGroup = useMemo(() => {
    const out = new Map<string, Expense[]>();
    for (const e of allExpenses) {
      const arr = out.get(e.groupId) ?? [];
      arr.push(e);
      out.set(e.groupId, arr);
    }
    return out;
  }, [allExpenses]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Trips</h1>
          <p className="text-sm text-slate-500">
            Group spending by trip or shared event.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpenNew(true)}>
          <PlusIcon /> New trip
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No trips yet"
          description="Start by creating your first trip — you'll add members and expenses next."
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 7h13l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
            </svg>
          }
          action={
            <button type="button" className="btn-primary" onClick={() => setOpenNew(true)}>
              <PlusIcon /> New trip
            </button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {groups.map((g) => {
            const exps = expensesByGroup.get(g.id) ?? [];
            const totalsByCurrency = new Map<string, number>();
            for (const e of exps) {
              totalsByCurrency.set(
                e.currency,
                (totalsByCurrency.get(e.currency) ?? 0) + e.amountMinor,
              );
            }
            const totals = Array.from(totalsByCurrency.entries()).slice(0, 2);
            return (
              <li key={g.id}>
                <Link
                  to={`/group/${g.id}`}
                  className="card flex items-center gap-3 p-3 hover:shadow-md transition active:scale-[.99]"
                >
                  <Avatar name={g.name} src={g.avatarDataUrl} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold text-slate-900 truncate">{g.name}</div>
                      <div className="text-xs text-slate-400 shrink-0">
                        {exps.length} {exps.length === 1 ? 'expense' : 'expenses'}
                      </div>
                    </div>
                    {g.description ? (
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {g.description}
                      </div>
                    ) : null}
                    {totals.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {totals.map(([cur, amt]) => (
                          <span key={cur} className="chip">
                            {formatMoney(amt, cur)}
                          </span>
                        ))}
                        {totalsByCurrency.size > totals.length ? (
                          <span className="chip">+{totalsByCurrency.size - totals.length}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <ChevronRight />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <GroupFormModal open={openNew} onClose={() => setOpenNew(false)} />
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="text-slate-400">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
