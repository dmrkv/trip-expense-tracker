/**
 * Thin CRUD layer on top of Dexie. UI never talks to Dexie directly:
 * it goes through these functions or the `useLiveQuery` hook for
 * reactive subscriptions. Keeps the data layer swappable later when
 * we add remote sync.
 */
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import type { Expense, Group, Member, SplitPayload, Transfer } from '../types';

const now = () => Date.now();

// ---------------------------------------------------------------- groups
export async function createGroup(input: {
  name: string;
  description?: string;
  defaultCurrency?: string;
  avatarDataUrl?: string;
}): Promise<Group> {
  const group: Group = {
    id: uuid(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    defaultCurrency: input.defaultCurrency || 'EUR',
    avatarDataUrl: input.avatarDataUrl,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.groups.add(group);
  return group;
}

export async function updateGroup(id: string, patch: Partial<Omit<Group, 'id' | 'createdAt'>>) {
  await db.groups.update(id, { ...patch, updatedAt: now() });
}

export async function deleteGroup(id: string) {
  await db.transaction(
    'rw',
    [db.groups, db.members, db.expenses, db.transfers],
    async () => {
      await db.expenses.where('groupId').equals(id).delete();
      await db.transfers.where('groupId').equals(id).delete();
      await db.members.where('groupId').equals(id).delete();
      await db.groups.delete(id);
    },
  );
}

// --------------------------------------------------------------- members
export async function addMember(groupId: string, displayName: string): Promise<Member> {
  const existing = await db.members.where('groupId').equals(groupId).count();
  const member: Member = {
    id: uuid(),
    groupId,
    displayName: displayName.trim(),
    sortOrder: existing,
  };
  await db.members.add(member);
  return member;
}

export async function renameMember(id: string, displayName: string) {
  await db.members.update(id, { displayName: displayName.trim() });
}

export async function deleteMember(id: string) {
  await db.members.delete(id);
}

// -------------------------------------------------------------- expenses
export interface NewExpenseInput {
  groupId: string;
  title: string;
  description?: string;
  date: string;
  amountMinor: number;
  currency: string;
  paidByMemberId: string;
  split: SplitPayload;
  categoryKey?: string;
}

export async function createExpense(input: NewExpenseInput): Promise<Expense> {
  const expense: Expense = {
    id: uuid(),
    groupId: input.groupId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    date: input.date,
    amountMinor: input.amountMinor,
    currency: input.currency.toUpperCase(),
    paidByMemberId: input.paidByMemberId,
    splitMode: input.split.mode,
    splitJson: input.split,
    categoryKey: input.categoryKey,
    createdAt: now(),
  };
  await db.expenses.add(expense);
  return expense;
}

export async function deleteExpense(id: string) {
  await db.expenses.delete(id);
}

// ------------------------------------------------------------- transfers
export async function createTransfer(input: Omit<Transfer, 'id' | 'createdAt'>): Promise<Transfer> {
  const transfer: Transfer = {
    ...input,
    id: uuid(),
    createdAt: now(),
  };
  await db.transfers.add(transfer);
  return transfer;
}

export async function deleteTransfer(id: string) {
  await db.transfers.delete(id);
}

// ----------------------------------------------------------- export/import
export interface ExportPayload {
  schemaVersion: 1;
  exportedAt: number;
  groups: Group[];
  members: Member[];
  expenses: Expense[];
  transfers: Transfer[];
}

export async function exportAll(): Promise<ExportPayload> {
  const [groups, members, expenses, transfers] = await Promise.all([
    db.groups.toArray(),
    db.members.toArray(),
    db.expenses.toArray(),
    db.transfers.toArray(),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: now(),
    groups,
    members,
    expenses,
    transfers,
  };
}

/**
 * Replace-all import. Future: support merge semantics. Returns the
 * row counts written so the caller can show a confirmation toast.
 */
export async function importAllReplace(payload: ExportPayload) {
  await db.transaction(
    'rw',
    [db.groups, db.members, db.expenses, db.transfers],
    async () => {
      await Promise.all([
        db.groups.clear(),
        db.members.clear(),
        db.expenses.clear(),
        db.transfers.clear(),
      ]);
      await db.groups.bulkAdd(payload.groups ?? []);
      await db.members.bulkAdd(payload.members ?? []);
      await db.expenses.bulkAdd(payload.expenses ?? []);
      await db.transfers.bulkAdd(payload.transfers ?? []);
    },
  );
  return {
    groups: payload.groups?.length ?? 0,
    members: payload.members?.length ?? 0,
    expenses: payload.expenses?.length ?? 0,
    transfers: payload.transfers?.length ?? 0,
  };
}
