import Dexie, { type Table } from 'dexie';
import type { Expense, Group, Member, Transfer } from './types';

/**
 * Versioned schema. Every breaking change must bump `version()` and
 * provide an `.upgrade()` callback that migrates existing rows in
 * place. Never repurpose an existing version number.
 */
class TripExpenseDB extends Dexie {
  groups!: Table<Group, string>;
  members!: Table<Member, string>;
  expenses!: Table<Expense, string>;
  transfers!: Table<Transfer, string>;

  constructor() {
    super('trip-expense-tracker');

    // v1 — initial schema.
    this.version(1).stores({
      groups: 'id, name, createdAt, updatedAt',
      members: 'id, groupId, sortOrder',
      expenses: 'id, groupId, date, paidByMemberId, createdAt',
      transfers: 'id, groupId, date, fromMemberId, toMemberId, createdAt',
    });

    // Example future migration scaffold (commented for clarity):
    // this.version(2).stores({ ... }).upgrade(async (tx) => {
    //   await tx.table('groups').toCollection().modify((g) => {
    //     g.defaultCurrency = g.defaultCurrency ?? 'EUR';
    //   });
    // });
  }
}

export const db = new TripExpenseDB();
