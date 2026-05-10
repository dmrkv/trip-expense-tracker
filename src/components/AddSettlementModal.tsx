import { useMemo, useState } from 'react';
import Modal from './Modal';
import CurrencyCombobox from './CurrencyCombobox';
import Avatar from './Avatar';
import { todayIso } from '../lib/format';
import { parseToMinor } from '../lib/money';
import { createTransfer } from '../lib/repo';
import { useUI } from '../store/ui';
import type { Group, Member } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  group: Group;
  members: Member[];
}

export default function AddSettlementModal(props: Props) {
  if (!props.open) return null;
  return <AddSettlementModalInner {...props} />;
}

function AddSettlementModalInner({ onClose, group, members }: Props) {
  const [fromId, setFromId] = useState<string>(members[0]?.id ?? '');
  const [toId, setToId] = useState<string>(members[1]?.id ?? members[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(group.defaultCurrency);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const pushToast = useUI((s) => s.pushToast);

  const amountMinor = useMemo(() => parseToMinor(amount, currency), [amount, currency]);

  const toChoices = useMemo(
    () => members.filter((m) => m.id !== fromId),
    [members, fromId],
  );

  const canSubmit =
    members.length >= 2 &&
    Boolean(fromId) &&
    Boolean(toId) &&
    fromId !== toId &&
    members.some((m) => m.id === fromId) &&
    members.some((m) => m.id === toId) &&
    amountMinor > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await createTransfer({
        groupId: group.id,
        fromMemberId: fromId,
        toMemberId: toId,
        amountMinor,
        currency,
        date,
        note: note.trim() || undefined,
      });
      pushToast({ kind: 'success', message: 'Payment recorded' });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record payment"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <button type="button" className="btn-secondary min-h-11" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="add-settlement-form"
            className="btn-primary min-h-11"
            disabled={!canSubmit || busy}
          >
            Save
          </button>
        </div>
      }
    >
      <form id="add-settlement-form" onSubmit={(e) => void handleSubmit(e)} className="pt-2 space-y-4">
        <p className="text-sm text-slate-500">
          Log money one member paid directly to another. Balances update right away.
        </p>

        <div>
          <label className="label">From</label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const active = m.id === fromId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setFromId(m.id);
                    setToId((prev) => {
                      if (prev !== m.id) return prev;
                      const other = members.find((x) => x.id !== m.id);
                      return other?.id ?? prev;
                    });
                  }}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm transition ${
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
          <label className="label">To</label>
          <div className="flex flex-wrap gap-2">
            {toChoices.map((m) => {
              const active = m.id === toId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setToId(m.id)}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm transition ${
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
          {toChoices.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">Add another member to record a payment.</p>
          ) : null}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label className="label" htmlFor="settle-amount">
              Amount
            </label>
            <input
              id="settle-amount"
              className="input min-h-11 text-right tabular-nums text-lg font-semibold"
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

        <div>
          <label className="label" htmlFor="settle-date">
            Date
          </label>
          <input
            id="settle-date"
            type="date"
            className="input min-h-11"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="settle-note">
            Note
          </label>
          <textarea
            id="settle-note"
            className="input"
            rows={2}
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {amountMinor <= 0 && amount.trim().length > 0 ? (
          <p className="text-xs text-amber-700">Enter a positive amount.</p>
        ) : null}
        {fromId === toId && members.length >= 2 ? (
          <p className="text-xs text-amber-700">Choose two different members.</p>
        ) : null}
      </form>
    </Modal>
  );
}
