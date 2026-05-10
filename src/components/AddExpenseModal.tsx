import { useMemo, useState } from 'react';
import Modal from './Modal';
import CurrencyCombobox from './CurrencyCombobox';
import Avatar from './Avatar';
import { CATEGORIES } from '../lib/categories';
import { parseToMinor } from '../lib/money';
import { todayIso } from '../lib/format';
import { createExpense } from '../lib/repo';
import { useUI } from '../store/ui';
import type { Group, Member, SplitMode, SplitPayload } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  group: Group;
  members: Member[];
}

const SPLIT_MODES: { key: SplitMode; label: string; ready: boolean }[] = [
  { key: 'equal', label: 'Equally', ready: true },
  { key: 'exact', label: 'By amount', ready: false },
  { key: 'percent', label: 'By percent', ready: false },
  { key: 'shares', label: 'By shares', ready: false },
];

export default function AddExpenseModal(props: Props) {
  // Re-mount the form on every open so initial state is derived from
  // props instead of needing a setState-inside-effect reset block.
  if (!props.open) return null;
  return <AddExpenseModalInner {...props} />;
}

function AddExpenseModalInner({ open, onClose, group, members }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(group.defaultCurrency);
  const [paidById, setPaidById] = useState<string>(members[0]?.id ?? '');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [participants, setParticipants] = useState<string[]>(members.map((m) => m.id));
  const [categoryKey, setCategoryKey] = useState<string>('food');
  const [busy, setBusy] = useState(false);
  const pushToast = useUI((s) => s.pushToast);

  const amountMinor = useMemo(
    () => parseToMinor(amount, currency),
    [amount, currency],
  );
  const canSubmit =
    title.trim().length > 0 &&
    amountMinor > 0 &&
    paidById &&
    splitMode === 'equal' &&
    participants.length > 0;

  function toggleParticipant(id: string) {
    setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      let split: SplitPayload;
      if (splitMode === 'equal') {
        split = { mode: 'equal', participantMemberIds: participants };
      } else {
        // Other modes are not implemented yet — guard already prevents this.
        pushToast({ kind: 'error', message: 'That split mode is not yet supported.' });
        return;
      }
      await createExpense({
        groupId: group.id,
        title,
        description,
        date,
        amountMinor,
        currency,
        paidByMemberId: paidById,
        split,
        categoryKey,
      });
      pushToast({ kind: 'success', message: 'Expense added' });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add expense"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="add-expense-form"
            className="btn-primary"
            disabled={!canSubmit || busy}
          >
            Add expense
          </button>
        </div>
      }
    >
      <form id="add-expense-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div>
          <label className="label" htmlFor="exp-title">
            Title
          </label>
          <input
            id="exp-title"
            className="input"
            placeholder="Dinner at the taverna"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label className="label" htmlFor="exp-amount">
              Amount
            </label>
            <input
              id="exp-amount"
              className="input text-right tabular-nums text-lg font-semibold"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="w-32">
            <label className="label">Currency</label>
            <CurrencyCombobox value={currency} onChange={setCurrency} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="exp-date">
              Date
            </label>
            <input
              id="exp-date"
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="exp-cat">
              Category
            </label>
            <select
              id="exp-cat"
              className="input"
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.emoji}  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="exp-desc">
            Note
          </label>
          <textarea
            id="exp-desc"
            className="input"
            rows={2}
            placeholder="Optional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Paid by</label>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const active = m.id === paidById;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaidById(m.id)}
                  className={`flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-sm border transition ${
                    active
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <Avatar name={m.displayName} size={22} />
                  {m.displayName}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="label !mb-0">Split</span>
            <span className="text-[11px] text-slate-400">
              Equal split available now — others coming soon
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SPLIT_MODES.map((m) => {
              const active = m.key === splitMode;
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={!m.ready}
                  onClick={() => m.ready && setSplitMode(m.key)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition ${
                    active
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-slate-700 border-slate-200'
                  } ${!m.ready ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={m.ready ? '' : 'Not yet implemented'}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {splitMode === 'equal' ? (
          <div>
            <label className="label">Split between</label>
            <ul className="card divide-y divide-slate-100">
              {members.map((m) => {
                const checked = participants.includes(m.id);
                return (
                  <li key={m.id}>
                    <label className="flex items-center gap-3 p-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleParticipant(m.id)}
                        className="h-4 w-4 accent-accent"
                      />
                      <Avatar name={m.displayName} size={28} />
                      <span className="text-sm font-medium text-slate-800">
                        {m.displayName}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {participants.length === 0 ? (
              <p className="text-xs text-red-600 mt-1">Pick at least one participant.</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            This split mode is a UI placeholder — only equal splits affect balances in
            the MVP.
          </p>
        )}
      </form>
    </Modal>
  );
}
