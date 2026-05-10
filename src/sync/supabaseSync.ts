import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db';
import type { Expense, Group, Member, Transfer } from '../types';

/** Embedded in each JSONB row for forward-compatible decoding. */
export const SYNC_PAYLOAD_SCHEMA_VERSION = 1 as const;

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function msFromIso(isoStr: string): number {
  return new Date(isoStr).getTime();
}

function memberFromPayload(raw: unknown): Member | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== SYNC_PAYLOAD_SCHEMA_VERSION) return null;
  if (typeof o.id !== 'string' || typeof o.groupId !== 'string') return null;
  if (typeof o.displayName !== 'string' || typeof o.sortOrder !== 'number') return null;
  const updatedAt = typeof o.updatedAt === 'number' ? o.updatedAt : 0;
  return {
    id: o.id,
    groupId: o.groupId,
    displayName: o.displayName,
    sortOrder: o.sortOrder,
    updatedAt,
  };
}

function expenseFromPayload(raw: unknown): Expense | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== SYNC_PAYLOAD_SCHEMA_VERSION) return null;
  if (typeof o.id !== 'string' || typeof o.groupId !== 'string') return null;
  if (typeof o.title !== 'string' || typeof o.date !== 'string') return null;
  if (typeof o.amountMinor !== 'number' || typeof o.currency !== 'string') return null;
  if (typeof o.paidByMemberId !== 'string' || typeof o.splitMode !== 'string') return null;
  if (!o.splitJson || typeof o.splitJson !== 'object') return null;
  if (typeof o.createdAt !== 'number') return null;
  const updatedAt = typeof o.updatedAt === 'number' ? o.updatedAt : o.createdAt;
  return {
    id: o.id,
    groupId: o.groupId,
    title: o.title,
    description: typeof o.description === 'string' ? o.description : undefined,
    date: o.date,
    amountMinor: o.amountMinor,
    currency: o.currency,
    paidByMemberId: o.paidByMemberId,
    splitMode: o.splitMode as Expense['splitMode'],
    splitJson: o.splitJson as Expense['splitJson'],
    categoryKey: typeof o.categoryKey === 'string' ? o.categoryKey : undefined,
    iconKey: typeof o.iconKey === 'string' ? o.iconKey : undefined,
    createdAt: o.createdAt,
    updatedAt,
  };
}

function transferFromPayload(raw: unknown): Transfer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== SYNC_PAYLOAD_SCHEMA_VERSION) return null;
  if (typeof o.id !== 'string' || typeof o.groupId !== 'string') return null;
  if (typeof o.fromMemberId !== 'string' || typeof o.toMemberId !== 'string') return null;
  if (typeof o.amountMinor !== 'number' || typeof o.currency !== 'string') return null;
  if (typeof o.date !== 'string' || typeof o.createdAt !== 'number') return null;
  const updatedAt = typeof o.updatedAt === 'number' ? o.updatedAt : o.createdAt;
  return {
    id: o.id,
    groupId: o.groupId,
    fromMemberId: o.fromMemberId,
    toMemberId: o.toMemberId,
    amountMinor: o.amountMinor,
    currency: o.currency,
    date: o.date,
    note: typeof o.note === 'string' ? o.note : undefined,
    createdAt: o.createdAt,
    updatedAt,
  };
}

function memberPayload(m: Member): Record<string, unknown> {
  return { schemaVersion: SYNC_PAYLOAD_SCHEMA_VERSION, ...m };
}

function expensePayload(e: Expense): Record<string, unknown> {
  return { schemaVersion: SYNC_PAYLOAD_SCHEMA_VERSION, ...e };
}

function transferPayload(t: Transfer): Record<string, unknown> {
  return { schemaVersion: SYNC_PAYLOAD_SCHEMA_VERSION, ...t };
}

const SYNC_META_KEY = 'tripsplit_supabase_sync_meta_v1';

interface SyncMeta {
  /** True once this browser profile has seen ≥1 trip while sync could run (avoids wiping cloud on first load). */
  hadLocalTripsSynced?: boolean;
}

function readSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    return raw ? (JSON.parse(raw) as SyncMeta) : {};
  } catch {
    return {};
  }
}

function writeSyncMeta(patch: Partial<SyncMeta>) {
  const next = { ...readSyncMeta(), ...patch };
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(next));
}

function groupFromTripRow(row: {
  id: string;
  name: string;
  description: string | null;
  avatar_data_url: string | null;
  default_currency: string;
  created_at: string;
  updated_at: string;
}): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    avatarDataUrl: row.avatar_data_url ?? undefined,
    defaultCurrency: row.default_currency,
    createdAt: msFromIso(row.created_at),
    updatedAt: msFromIso(row.updated_at),
  };
}

/** Serialize sync runs so concurrent triggers queue instead of skipping work. */
let syncTail = Promise.resolve();

/**
 * Full bidirectional sync: delete trips removed locally from the server, pull remote
 * changes (last-write-wins per row by `updated_at`), push local rows and prune orphans.
 */
export function syncWithSupabase(supabase: SupabaseClient, userId: string): Promise<void> {
  syncTail = syncTail
    .then(() => runSync(supabase, userId))
    .catch((e: unknown) => console.warn('[sync] failed', e));
  return syncTail;
}

async function runSync(supabase: SupabaseClient, userId: string): Promise<void> {
  const meta = readSyncMeta();
  const localGroups = await db.groups.toArray();
  const localTripIds = new Set(localGroups.map((g) => g.id));

  const { data: remoteIdsRows, error: idErr } = await supabase
    .from('trips')
    .select('id')
    .eq('owner_id', userId);
  if (idErr) {
    console.warn('[sync] list trips failed', idErr.message);
    return;
  }

  const remoteTripIds = new Set((remoteIdsRows ?? []).map((r) => r.id as string));

  if (meta.hadLocalTripsSynced && localTripIds.size === 0 && remoteTripIds.size > 0) {
    for (const rid of remoteTripIds) {
      const { error } = await supabase.from('trips').delete().eq('id', rid);
      if (error) console.warn('[sync] delete remote trip (cleared local)', rid, error.message);
    }
  } else if (localTripIds.size > 0) {
    for (const rid of remoteTripIds) {
      if (!localTripIds.has(rid)) {
        const { error } = await supabase.from('trips').delete().eq('id', rid);
        if (error) console.warn('[sync] delete remote trip', rid, error.message);
      }
    }
  }

  const { data: remoteTrips, error: tripErr } = await supabase
    .from('trips')
    .select('*')
    .eq('owner_id', userId);
  if (tripErr) {
    console.warn('[sync] pull trips failed', tripErr.message);
    return;
  }

  await db.transaction('rw', db.groups, async () => {
    for (const row of remoteTrips ?? []) {
      const r = row as {
        id: string;
        name: string;
        description: string | null;
        avatar_data_url: string | null;
        default_currency: string;
        created_at: string;
        updated_at: string;
      };
      const remoteTime = msFromIso(r.updated_at);
      const local = await db.groups.get(r.id);
      const remoteGroup = groupFromTripRow(r);
      if (!local || remoteTime > local.updatedAt) {
        await db.groups.put(remoteGroup);
      }
    }
  });

  const mergedGroups = await db.groups.toArray();
  const tripIds = mergedGroups.map((g) => g.id);
  if (tripIds.length === 0) {
    return;
  }

  const { data: remoteMembers } = await supabase.from('trip_members').select('*').in('trip_id', tripIds);
  const { data: remoteExpenses } = await supabase.from('trip_expenses').select('*').in('trip_id', tripIds);
  const { data: remoteTransfers } = await supabase.from('trip_transfers').select('*').in('trip_id', tripIds);

  await db.transaction('rw', db.members, async () => {
    for (const row of remoteMembers ?? []) {
      const r = row as { payload: unknown; updated_at: string };
      const remoteTime = msFromIso(r.updated_at);
      const parsed = memberFromPayload(r.payload);
      if (!parsed) continue;
      const local = await db.members.get(parsed.id);
      if (!local || remoteTime > local.updatedAt) {
        await db.members.put(parsed);
      }
    }
  });

  await db.transaction('rw', db.expenses, async () => {
    for (const row of remoteExpenses ?? []) {
      const r = row as { payload: unknown; updated_at: string };
      const remoteTime = msFromIso(r.updated_at);
      const parsed = expenseFromPayload(r.payload);
      if (!parsed) continue;
      const local = await db.expenses.get(parsed.id);
      if (!local || remoteTime > local.updatedAt) {
        await db.expenses.put(parsed);
      }
    }
  });

  await db.transaction('rw', db.transfers, async () => {
    for (const row of remoteTransfers ?? []) {
      const r = row as { payload: unknown; updated_at: string };
      const remoteTime = msFromIso(r.updated_at);
      const parsed = transferFromPayload(r.payload);
      if (!parsed) continue;
      const local = await db.transfers.get(parsed.id);
      if (!local || remoteTime > local.updatedAt) {
        await db.transfers.put(parsed);
      }
    }
  });

  const groupsFinal = await db.groups.toArray();
  for (const g of groupsFinal) {
    const { error: uErr } = await supabase.from('trips').upsert(
      {
        id: g.id,
        owner_id: userId,
        name: g.name,
        description: g.description ?? null,
        avatar_data_url: g.avatarDataUrl ?? null,
        default_currency: g.defaultCurrency,
        created_at: isoFromMs(g.createdAt),
        updated_at: isoFromMs(g.updatedAt),
      },
      { onConflict: 'id' },
    );
    if (uErr) {
      console.warn('[sync] upsert trip', g.id, uErr.message);
      continue;
    }

    const members = await db.members.where('groupId').equals(g.id).toArray();
    const expenses = await db.expenses.where('groupId').equals(g.id).toArray();
    const transfers = await db.transfers.where('groupId').equals(g.id).toArray();

    const { data: rm } = await supabase.from('trip_members').select('id').eq('trip_id', g.id);
    const remoteM = new Set((rm ?? []).map((x) => x.id as string));
    const localM = new Set(members.map((m) => m.id));
    for (const id of remoteM) {
      if (!localM.has(id)) {
        await supabase.from('trip_members').delete().eq('id', id);
      }
    }

    const { data: re } = await supabase.from('trip_expenses').select('id').eq('trip_id', g.id);
    const remoteE = new Set((re ?? []).map((x) => x.id as string));
    const localE = new Set(expenses.map((e) => e.id));
    for (const id of remoteE) {
      if (!localE.has(id)) {
        await supabase.from('trip_expenses').delete().eq('id', id);
      }
    }

    const { data: rt } = await supabase.from('trip_transfers').select('id').eq('trip_id', g.id);
    const remoteT = new Set((rt ?? []).map((x) => x.id as string));
    const localT = new Set(transfers.map((t) => t.id));
    for (const id of remoteT) {
      if (!localT.has(id)) {
        await supabase.from('trip_transfers').delete().eq('id', id);
      }
    }

    if (members.length > 0) {
      const { error: mErr } = await supabase.from('trip_members').upsert(
        members.map((m) => ({
          id: m.id,
          trip_id: g.id,
          payload: memberPayload(m),
          updated_at: isoFromMs(m.updatedAt),
        })),
        { onConflict: 'id' },
      );
      if (mErr) console.warn('[sync] upsert members', g.id, mErr.message);
    }

    if (expenses.length > 0) {
      const { error: eErr } = await supabase.from('trip_expenses').upsert(
        expenses.map((e) => ({
          id: e.id,
          trip_id: g.id,
          payload: expensePayload(e),
          updated_at: isoFromMs(e.updatedAt),
        })),
        { onConflict: 'id' },
      );
      if (eErr) console.warn('[sync] upsert expenses', g.id, eErr.message);
    }

    if (transfers.length > 0) {
      const { error: tErr } = await supabase.from('trip_transfers').upsert(
        transfers.map((t) => ({
          id: t.id,
          trip_id: g.id,
          payload: transferPayload(t),
          updated_at: isoFromMs(t.updatedAt),
        })),
        { onConflict: 'id' },
      );
      if (tErr) console.warn('[sync] upsert transfers', g.id, tErr.message);
    }
  }

  const groupsFinalMeta = await db.groups.toArray();
  if (groupsFinalMeta.length > 0) {
    writeSyncMeta({ hadLocalTripsSynced: true });
  }
}
