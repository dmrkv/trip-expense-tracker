import { useMemo } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import EmptyState from './EmptyState';
import Avatar from './Avatar';
import { computeLedgers } from '../lib/balances';
import { formatMoney } from '../lib/money';
import type { Expense, Member, Transfer } from '../types';

export default function BalancesPanel({
  groupId,
  members,
  onRequestRecordSettlement,
  variant = 'standalone',
}: {
  groupId: string;
  members: Member[];
  onRequestRecordSettlement?: () => void;
  variant?: 'standalone' | 'sidebar';
}) {
  const expenses = useLiveQuery(
    () => db.expenses.where('groupId').equals(groupId).toArray(),
    [groupId],
    [] as Expense[],
  );
  const transfers = useLiveQuery(
    () => db.transfers.where('groupId').equals(groupId).toArray(),
    [groupId],
    [] as Transfer[],
  );

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  const ledgers = useMemo(
    () => computeLedgers(members, expenses, transfers),
    [members, expenses, transfers],
  );

  const recordSettlementBtn =
    members.length >= 2 && onRequestRecordSettlement ? (
      <button
        type="button"
        className={`btn-secondary shrink-0 min-h-10 px-3 py-2 text-sm gap-2 inline-flex items-center justify-center ${
          variant === 'standalone' ? 'w-full sm:w-auto' : ''
        }`}
        onClick={onRequestRecordSettlement}
      >
        <ArrowRightLeft className="h-[18px] w-[18px] shrink-0" aria-hidden />
        Record payment
      </button>
    ) : null;

  const header =
    variant === 'sidebar' ? (
      <header className="flex items-center justify-between gap-2 shrink-0 pb-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Balances</h2>
        {recordSettlementBtn}
      </header>
    ) : recordSettlementBtn ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {recordSettlementBtn}
      </div>
    ) : null;

  if (members.length === 0) {
    return (
      <div
        className={
          variant === 'sidebar'
            ? 'flex flex-col min-h-0 gap-3 flex-1'
            : 'space-y-4'
        }
      >
        {header}
        <EmptyState
          title="No members yet"
          description="Add at least two members to start tracking who owes whom."
        />
      </div>
    );
  }

  if (ledgers.length === 0 || expenses.length + transfers.length === 0) {
    return (
      <div
        className={
          variant === 'sidebar'
            ? 'flex flex-col min-h-0 gap-3 flex-1 overflow-hidden'
            : 'space-y-4'
        }
      >
        {header}
        <EmptyState
          title="No balances yet"
          description="Once you log an expense or transfer, balances will appear here per currency."
        />
      </div>
    );
  }

  const body = (
    <>
      {ledgers.map((ledger) => (
        <section key={ledger.currency} className="space-y-3">
          <header className="flex items-baseline justify-between px-1">
            <h3 className="text-sm font-semibold text-slate-700">
              {ledger.currency}
            </h3>
            <div className="text-xs text-slate-500">
              Total spent {formatMoney(ledger.totalSpentMinor, ledger.currency)}
            </div>
          </header>

          <ul className="card divide-y divide-slate-100">
            {ledger.nets
              .slice()
              .sort((a, b) => b.net - a.net)
              .map((n) => {
                const m = memberById.get(n.memberId);
                if (!m) return null;
                const positive = n.net > 0;
                const zero = n.net === 0;
                return (
                  <li key={n.memberId} className="flex items-center gap-3 p-3">
                    <Avatar name={m.displayName} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {m.displayName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {zero
                          ? 'settled up'
                          : positive
                            ? 'is owed'
                            : 'owes'}
                      </div>
                    </div>
                    <div
                      className={`font-semibold ${
                        zero
                          ? 'text-slate-400'
                          : positive
                            ? 'text-accent-700'
                            : 'text-red-600'
                      }`}
                    >
                      {formatMoney(Math.abs(n.net), ledger.currency)}
                    </div>
                  </li>
                );
              })}
          </ul>

          {ledger.settlements.length > 0 ? (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                Suggested settlements
              </div>
              <ul className="card divide-y divide-slate-100">
                {ledger.settlements.map((s, idx) => {
                  const from = memberById.get(s.fromMemberId);
                  const to = memberById.get(s.toMemberId);
                  if (!from || !to) return null;
                  return (
                    <li key={idx} className="flex items-center gap-3 p-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar name={from.displayName} size={28} />
                        <span className="text-sm text-slate-700 truncate">
                          {from.displayName}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="text-slate-400">
                          <path
                            d="M5 12h14M13 6l6 6-6 6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                        <Avatar name={to.displayName} size={28} />
                        <span className="text-sm text-slate-700 truncate">
                          {to.displayName}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-900 shrink-0">
                        {formatMoney(s.amountMinor, ledger.currency)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ))}

      <p className="text-[11px] text-slate-400 px-1 leading-relaxed shrink-0">
        Multi-currency MVP: balances are computed per currency. Cross-currency
        conversion is on the roadmap.
      </p>
    </>
  );

  if (variant === 'sidebar') {
    return (
      <div className="flex flex-col min-h-0 flex-1 gap-3 overflow-hidden">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-5 pr-0.5 -mr-0.5">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      {body}
    </div>
  );
}
