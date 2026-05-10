import type { Expense, Member, Transfer } from '../types';

/**
 * Honest multi-currency MVP: we compute balances *per currency* and
 * never silently convert. Callers render one settlement section per
 * currency that has any activity.
 */

export interface MemberNet {
  memberId: string;
  /** Positive ⇒ the group owes them. Negative ⇒ they owe the group. */
  net: number;
}

export interface Settlement {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

export interface CurrencyLedger {
  currency: string;
  totalSpentMinor: number;
  perMemberPaidMinor: Record<string, number>;
  perMemberShareMinor: Record<string, number>;
  nets: MemberNet[];
  settlements: Settlement[];
}

/**
 * Distribute `amount` evenly across `n` participants in integer minor
 * units. We round each share down and assign the leftover remainder
 * one-by-one starting from the first index, so the sum is always
 * exactly the total.
 */
function splitEqualMinor(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.trunc(amount / n);
  const remainder = amount - base * n;
  const out = new Array(n).fill(base);
  for (let i = 0; i < remainder; i += 1) out[i] += 1;
  return out;
}

/** Greedy two-pointer settlement minimizer. */
function settle(nets: MemberNet[]): Settlement[] {
  // Filter to non-zero balances and clone so we can mutate locally.
  const debtors = nets.filter((n) => n.net < 0).map((n) => ({ ...n }));
  const creditors = nets.filter((n) => n.net > 0).map((n) => ({ ...n }));

  // Sort largest-magnitude first so transfers feel "natural" to read.
  debtors.sort((a, b) => a.net - b.net); // most negative first
  creditors.sort((a, b) => b.net - a.net); // most positive first

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(-d.net, c.net);
    if (pay > 0) {
      settlements.push({
        fromMemberId: d.memberId,
        toMemberId: c.memberId,
        amountMinor: pay,
      });
      d.net += pay;
      c.net -= pay;
    }
    if (d.net === 0) i += 1;
    if (c.net === 0) j += 1;
  }
  return settlements;
}

export function computeLedgers(
  members: Member[],
  expenses: Expense[],
  transfers: Transfer[],
): CurrencyLedger[] {
  const memberIds = members.map((m) => m.id);
  /** currency -> { paid, share } per member */
  const byCurrency = new Map<
    string,
    { paid: Record<string, number>; share: Record<string, number>; total: number }
  >();

  const ensure = (currency: string) => {
    let bucket = byCurrency.get(currency);
    if (!bucket) {
      bucket = {
        paid: Object.fromEntries(memberIds.map((id) => [id, 0])),
        share: Object.fromEntries(memberIds.map((id) => [id, 0])),
        total: 0,
      };
      byCurrency.set(currency, bucket);
    }
    return bucket;
  };

  for (const e of expenses) {
    const bucket = ensure(e.currency);
    bucket.total += e.amountMinor;

    if (memberIds.includes(e.paidByMemberId)) {
      bucket.paid[e.paidByMemberId] += e.amountMinor;
    }

    if (e.splitMode === 'equal' && e.splitJson.mode === 'equal') {
      const participants = e.splitJson.participantMemberIds.filter((id) =>
        memberIds.includes(id),
      );
      const shares = splitEqualMinor(e.amountMinor, participants.length);
      participants.forEach((id, idx) => {
        bucket.share[id] += shares[idx] ?? 0;
      });
    } else if (e.splitJson.mode === 'exact') {
      for (const [id, amt] of Object.entries(e.splitJson.shares)) {
        if (memberIds.includes(id)) bucket.share[id] += amt;
      }
    } else if (e.splitJson.mode === 'percent') {
      const totalPct = Object.values(e.splitJson.shares).reduce((a, b) => a + b, 0);
      if (totalPct > 0) {
        const ids = Object.keys(e.splitJson.shares).filter((id) => memberIds.includes(id));
        const raw = ids.map(
          (id) => Math.round(((e.splitJson as { shares: Record<string, number> }).shares[id] / totalPct) * e.amountMinor),
        );
        // Adjust rounding drift onto the first participant.
        const drift = e.amountMinor - raw.reduce((a, b) => a + b, 0);
        if (raw.length > 0) raw[0] += drift;
        ids.forEach((id, idx) => {
          bucket.share[id] += raw[idx];
        });
      }
    } else if (e.splitJson.mode === 'shares') {
      const totalShares = Object.values(e.splitJson.shares).reduce((a, b) => a + b, 0);
      if (totalShares > 0) {
        const ids = Object.keys(e.splitJson.shares).filter((id) => memberIds.includes(id));
        const raw = ids.map(
          (id) =>
            Math.round(
              ((e.splitJson as { shares: Record<string, number> }).shares[id] / totalShares) *
                e.amountMinor,
            ),
        );
        const drift = e.amountMinor - raw.reduce((a, b) => a + b, 0);
        if (raw.length > 0) raw[0] += drift;
        ids.forEach((id, idx) => {
          bucket.share[id] += raw[idx];
        });
      }
    }
  }

  for (const t of transfers) {
    const bucket = ensure(t.currency);
    if (memberIds.includes(t.fromMemberId)) bucket.paid[t.fromMemberId] += t.amountMinor;
    if (memberIds.includes(t.toMemberId)) bucket.share[t.toMemberId] += t.amountMinor;
  }

  const ledgers: CurrencyLedger[] = [];
  for (const [currency, bucket] of byCurrency.entries()) {
    const nets: MemberNet[] = memberIds.map((id) => ({
      memberId: id,
      net: bucket.paid[id] - bucket.share[id],
    }));
    ledgers.push({
      currency,
      totalSpentMinor: bucket.total,
      perMemberPaidMinor: bucket.paid,
      perMemberShareMinor: bucket.share,
      nets,
      settlements: settle(nets),
    });
  }

  // Stable order: alphabetical by currency code.
  ledgers.sort((a, b) => a.currency.localeCompare(b.currency));
  return ledgers;
}
