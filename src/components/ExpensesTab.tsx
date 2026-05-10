import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import EmptyState from './EmptyState';
import Avatar from './Avatar';
import { formatMoney } from '../lib/money';
import { findCategory } from '../lib/categories';
import { formatDateShort } from '../lib/format';
import { deleteExpense } from '../lib/repo';
import { useUI } from '../store/ui';
import type { Expense, Member } from '../types';

export default function ExpensesTab({
  groupId,
  members,
}: {
  groupId: string;
  members: Member[];
}) {
  const expenses = useLiveQuery(
    () =>
      db.expenses.where('groupId').equals(groupId).reverse().sortBy('date'),
    [groupId],
    [] as Expense[],
  );
  const pushToast = useUI((s) => s.pushToast);

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  if (expenses.length === 0) {
    return (
      <EmptyState
        title="No expenses yet"
        description="Tap the + button to record the first expense for this trip."
      />
    );
  }

  // Group by date for a clean Splitwise-like list.
  const byDate = new Map<string, Expense[]>();
  for (const e of expenses) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }

  return (
    <div className="space-y-4">
      {Array.from(byDate.entries()).map(([date, items]) => (
        <section key={date}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
            {formatDateShort(date)}
          </div>
          <ul className="card divide-y divide-slate-100 overflow-hidden">
            {items.map((e) => {
              const cat = findCategory(e.categoryKey);
              const paidBy = memberById.get(e.paidByMemberId);
              return (
                <li key={e.id} className="flex items-center gap-3 p-3">
                  <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent-700 grid place-items-center text-lg shrink-0">
                    {cat?.emoji ?? '🧾'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-medium text-slate-900 truncate">
                        {e.title}
                      </div>
                      <div className="font-semibold text-slate-900 shrink-0">
                        {formatMoney(e.amountMinor, e.currency)}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      {paidBy ? (
                        <>
                          <Avatar name={paidBy.displayName} size={16} />
                          <span className="truncate">
                            {paidBy.displayName} paid
                          </span>
                        </>
                      ) : (
                        <span className="italic">Unknown payer</span>
                      )}
                      <span aria-hidden>·</span>
                      <span className="capitalize">{e.splitMode}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost h-9 w-9 p-0 grid place-items-center text-slate-400 hover:text-red-600"
                    aria-label="Delete expense"
                    onClick={async () => {
                      if (window.confirm(`Delete "${e.title}"?`)) {
                        await deleteExpense(e.id);
                        pushToast({ kind: 'success', message: 'Expense deleted' });
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m-7 0v12a2 2 0 002 2h4a2 2 0 002-2V7"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
