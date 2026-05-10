import { useMemo, useState } from 'react';
import Modal from './Modal';
import CurrencyCombobox from './CurrencyCombobox';
import Avatar from './Avatar';
import { CATEGORIES } from '../lib/categories';
import { formatMinorNumeric, formatMoney, parseToMinor } from '../lib/money';
import { todayIso } from '../lib/format';
import { allocateWeightedMinor } from '../lib/splitAllocate';
import { createExpense } from '../lib/repo';
import { useUI } from '../store/ui';
import type { Group, Member, SplitMode, SplitPayload } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  group: Group;
  members: Member[];
}

const SPLIT_MODES: { key: SplitMode; label: string }[] = [
  { key: 'equal', label: 'Equally' },
  { key: 'exact', label: 'By amount' },
  { key: 'percent', label: 'By percent' },
  { key: 'shares', label: 'By shares' },
];

/** Equal percentages over ids as strings summing to 100.00 (basis-point split). */
function equalPercentRecord(ids: string[]): Record<string, string> {
  const n = ids.length;
  if (n === 0) return {};
  const basis = 10000;
  const base = Math.floor(basis / n);
  const extra = basis - base * n;
  return Object.fromEntries(
    ids.map((id, i) => [id, ((base + (i < extra ? 1 : 0)) / 100).toFixed(2)]),
  );
}

function exactDefaultsEqualMinor(
  amountMinor: number,
  participantIds: string[],
  currency: string,
): Record<string, string> {
  if (participantIds.length === 0) return {};
  const weights = Object.fromEntries(participantIds.map((id) => [id, 1]));
  const alloc = allocateWeightedMinor(amountMinor, participantIds, weights);
  return Object.fromEntries(
    participantIds.map((id) => [id, formatMinorNumeric(alloc[id] ?? 0, currency)]),
  );
}

function parsePercentField(raw: string): number | null {
  const trimmed = raw.replace(/[\s,]/g, (m) => (m === ',' ? '.' : '')).trim();
  if (!trimmed) return null;
  const v = Number(trimmed);
  return Number.isFinite(v) ? v : null;
}

export default function AddExpenseModal(props: Props) {
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
  const [exactByMember, setExactByMember] = useState<Record<string, string>>({});
  const [percentByMember, setPercentByMember] = useState<Record<string, string>>({});
  const [sharesByMember, setSharesByMember] = useState<Record<string, string>>({});
  const [categoryKey, setCategoryKey] = useState<string>('food');
  const [busy, setBusy] = useState(false);
  const pushToast = useUI((s) => s.pushToast);

  const amountMinor = useMemo(
    () => parseToMinor(amount, currency),
    [amount, currency],
  );

  const participantMembers = useMemo(() => {
    const set = new Set(participants);
    return [...members].filter((m) => set.has(m.id));
  }, [members, participants]);

  function chooseSplitMode(mode: SplitMode) {
    setSplitMode(mode);
    if (mode === 'exact') {
      setExactByMember(
        amountMinor > 0 && participants.length > 0
          ? exactDefaultsEqualMinor(amountMinor, participants, currency)
          : Object.fromEntries(participants.map((id) => [id, formatMinorNumeric(0, currency)])),
      );
    }
    if (mode === 'percent') {
      setPercentByMember(equalPercentRecord(participants));
    }
    if (mode === 'shares') {
      setSharesByMember(Object.fromEntries(participants.map((id) => [id, '1'])));
    }
  }

  function syncSplitMapsForParticipants(nextParticipants: string[]) {
    if (splitMode === 'exact') {
      setExactByMember((prev) => {
        const next = { ...prev };
        for (const pid of nextParticipants) {
          if (!(pid in next)) next[pid] = formatMinorNumeric(0, currency);
        }
        for (const k of Object.keys(next)) {
          if (!nextParticipants.includes(k)) delete next[k];
        }
        return next;
      });
    } else if (splitMode === 'percent') {
      setPercentByMember(equalPercentRecord(nextParticipants));
    } else if (splitMode === 'shares') {
      setSharesByMember((prev) => {
        const next = { ...prev };
        for (const pid of nextParticipants) {
          if (!(pid in next)) next[pid] = '1';
        }
        for (const k of Object.keys(next)) {
          if (!nextParticipants.includes(k)) delete next[k];
        }
        return next;
      });
    }
  }

  const exactPartsMinor = useMemo(() => {
    const parts: Record<string, number> = {};
    for (const id of participants) {
      parts[id] = parseToMinor(exactByMember[id] ?? '', currency);
    }
    return parts;
  }, [exactByMember, participants, currency]);

  const exactSumMinor = useMemo(
    () => Object.values(exactPartsMinor).reduce((a, b) => a + b, 0),
    [exactPartsMinor],
  );

  const percentSum = useMemo(() => {
    let s = 0;
    for (const id of participants) {
      const v = parsePercentField(percentByMember[id] ?? '');
      if (v === null) return null;
      s += v;
    }
    return participants.length === 0 ? null : s;
  }, [percentByMember, participants]);

  const percentWeights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const id of participants) {
      const v = parsePercentField(percentByMember[id] ?? '');
      if (v === null || v <= 0) return null;
      w[id] = v;
    }
    return participants.length === 0 ? null : w;
  }, [percentByMember, participants]);

  const shareWeights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const id of participants) {
      const raw = (sharesByMember[id] ?? '').trim();
      const v = parseInt(raw, 10);
      if (!Number.isFinite(v) || v < 1) return null;
      w[id] = v;
    }
    return participants.length === 0 ? null : w;
  }, [sharesByMember, participants]);

  const percentPreview = useMemo(() => {
    if (
      splitMode !== 'percent' ||
      amountMinor <= 0 ||
      !percentWeights ||
      percentSum === null ||
      Math.abs(percentSum - 100) > 0.01
    ) {
      return null;
    }
    return allocateWeightedMinor(amountMinor, participants, percentWeights);
  }, [splitMode, amountMinor, percentWeights, percentSum, participants]);

  const sharesPreview = useMemo(() => {
    if (splitMode !== 'shares' || amountMinor <= 0 || !shareWeights) return null;
    return allocateWeightedMinor(amountMinor, participants, shareWeights);
  }, [splitMode, amountMinor, shareWeights, participants]);

  const splitPayload = useMemo((): SplitPayload | null => {
    if (participants.length === 0) return null;
    switch (splitMode) {
      case 'equal':
        return { mode: 'equal', participantMemberIds: participants };
      case 'exact': {
        if (exactSumMinor !== amountMinor) return null;
        const shares: Record<string, number> = {};
        for (const id of participants) {
          const m = exactPartsMinor[id];
          if (m === undefined || m < 0) return null;
          shares[id] = m;
        }
        return { mode: 'exact', shares };
      }
      case 'percent': {
        if (percentSum === null || Math.abs(percentSum - 100) > 0.01) return null;
        const shares: Record<string, number> = {};
        for (const id of participants) {
          const v = parsePercentField(percentByMember[id] ?? '');
          if (v === null || v <= 0) return null;
          shares[id] = v;
        }
        return { mode: 'percent', shares };
      }
      case 'shares': {
        const shares: Record<string, number> = {};
        for (const id of participants) {
          const raw = (sharesByMember[id] ?? '').trim();
          const v = parseInt(raw, 10);
          if (!Number.isFinite(v) || v < 1) return null;
          shares[id] = v;
        }
        return { mode: 'shares', shares };
      }
      default:
        return null;
    }
  }, [
    participants,
    splitMode,
    exactSumMinor,
    amountMinor,
    exactPartsMinor,
    percentSum,
    percentByMember,
    sharesByMember,
  ]);

  const canSubmit =
    title.trim().length > 0 &&
    amountMinor > 0 &&
    Boolean(paidById) &&
    participants.length > 0 &&
    splitPayload !== null;

  function toggleParticipant(id: string) {
    const nextSet = new Set(participants);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    const nextParticipants = members.filter((m) => nextSet.has(m.id)).map((m) => m.id);
    setParticipants(nextParticipants);
    syncSplitMapsForParticipants(nextParticipants);
  }

  function handleAmountChange(raw: string) {
    setAmount(raw);
    const nextMinor = parseToMinor(raw, currency);
    if (splitMode !== 'exact' || nextMinor <= 0 || participants.length === 0) return;
    setExactByMember((prev) => {
      const sum = participants.reduce((s, pid) => s + parseToMinor(prev[pid] ?? '', currency), 0);
      const allZero = participants.every((pid) => parseToMinor(prev[pid] ?? '', currency) === 0);
      if (sum === 0 && allZero) {
        return exactDefaultsEqualMinor(nextMinor, participants, currency);
      }
      return prev;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !splitPayload) return;
    setBusy(true);
    try {
      await createExpense({
        groupId: group.id,
        title,
        description,
        date,
        amountMinor,
        currency,
        paidByMemberId: paidById,
        split: splitPayload,
        categoryKey,
      });
      pushToast({ kind: 'success', message: 'Expense added' });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const exactDeltaMinor = exactSumMinor - amountMinor;

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
              onChange={(e) => handleAmountChange(e.target.value)}
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
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SPLIT_MODES.map((m) => {
              const active = m.key === splitMode;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => chooseSplitMode(m.key)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition ${
                    active
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

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
                      className="h-4 w-4 accent-accent shrink-0"
                    />
                    <Avatar name={m.displayName} size={28} />
                    <span className="text-sm font-medium text-slate-800 grow min-w-0">
                      {m.displayName}
                    </span>
                    {splitMode === 'exact' && checked ? (
                      <input
                        className="input text-right tabular-nums w-[7.5rem] shrink-0 py-1.5 text-sm"
                        inputMode="decimal"
                        placeholder={formatMinorNumeric(0, currency)}
                        value={exactByMember[m.id] ?? ''}
                        onChange={(e) =>
                          setExactByMember((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                      />
                    ) : null}
                    {splitMode === 'percent' && checked ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          className="input text-right tabular-nums w-[4.5rem] py-1.5 text-sm"
                          inputMode="decimal"
                          placeholder="0"
                          value={percentByMember[m.id] ?? ''}
                          onChange={(e) =>
                            setPercentByMember((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                        />
                        <span className="text-slate-500 text-sm">%</span>
                      </div>
                    ) : null}
                    {splitMode === 'shares' && checked ? (
                      <input
                        className="input text-right tabular-nums w-[4.5rem] shrink-0 py-1.5 text-sm"
                        inputMode="numeric"
                        placeholder="1"
                        value={sharesByMember[m.id] ?? ''}
                        onChange={(e) =>
                          setSharesByMember((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                      />
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
          {participants.length === 0 ? (
            <p className="text-xs text-red-600 mt-1">Pick at least one participant.</p>
          ) : null}
          {splitMode === 'exact' && participants.length > 0 ? (
            <p
              className={`text-xs mt-1.5 tabular-nums ${
                exactDeltaMinor === 0 ? 'text-slate-500' : 'text-amber-700'
              }`}
            >
              Parts total {formatMoney(exactSumMinor, currency)}
              {amountMinor > 0 ? (
                <>
                  {' '}
                  · expense {formatMoney(amountMinor, currency)}
                  {exactDeltaMinor !== 0 ? (
                    <>
                      {' '}
                      ·{' '}
                      {exactDeltaMinor > 0 ? '+' : ''}
                      {formatMoney(exactDeltaMinor, currency)}
                    </>
                  ) : null}
                </>
              ) : null}
            </p>
          ) : null}
          {splitMode === 'percent' && participants.length > 0 ? (
            <p
              className={`text-xs mt-1.5 tabular-nums ${
                percentSum !== null && Math.abs(percentSum - 100) <= 0.01
                  ? 'text-slate-500'
                  : 'text-amber-700'
              }`}
            >
              Percent total:{' '}
              {percentSum === null ? '—' : `${percentSum.toFixed(2)}%`} (need 100.00% ± 0.01)
            </p>
          ) : null}
          {splitMode === 'percent' && percentPreview && participants.length > 0 ? (
            <ul className="mt-2 text-xs text-slate-500 space-y-0.5 tabular-nums">
              {participantMembers.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate">{m.displayName}</span>
                  <span>{formatMoney(percentPreview[m.id] ?? 0, currency)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {splitMode === 'shares' && sharesPreview && participants.length > 0 ? (
            <ul className="mt-2 text-xs text-slate-500 space-y-0.5 tabular-nums">
              {participantMembers.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate">{m.displayName}</span>
                  <span>{formatMoney(sharesPreview[m.id] ?? 0, currency)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
