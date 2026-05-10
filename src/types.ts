/**
 * Core domain types. Money is always stored as integer minor units
 * (e.g. cents) keyed against an ISO-4217 currency code.
 */

export type ID = string;

export type SplitMode = 'equal' | 'exact' | 'percent' | 'shares';

/** A trip or shared-spending event between people. */
export interface Group {
  id: ID;
  name: string;
  description?: string;
  /** Base64 data URL, resized to ≤ 400×400 client-side before persisting. */
  avatarDataUrl?: string;
  /** Default currency suggested when creating a new expense in this group. */
  defaultCurrency: string;
  createdAt: number;
  updatedAt: number;
}

export interface Member {
  id: ID;
  groupId: ID;
  displayName: string;
  sortOrder: number;
  /** Epoch ms; used for cloud sync last-write-wins. */
  updatedAt: number;
}

/**
 * Split payload formats. We keep the union loose because future
 * versions of the schema may add more rich split metadata.
 */
export type SplitPayload =
  | { mode: 'equal'; participantMemberIds: ID[] }
  | { mode: 'exact'; shares: Record<ID, number> } // amounts in minor units
  | { mode: 'percent'; shares: Record<ID, number> } // 0..100 numeric percent
  | { mode: 'shares'; shares: Record<ID, number> }; // arbitrary share weights

export interface Expense {
  id: ID;
  groupId: ID;
  title: string;
  description?: string;
  /** ISO-8601 date string `YYYY-MM-DD` for stable, timezone-free reporting. */
  date: string;
  /** Total expense amount, integer minor units. */
  amountMinor: number;
  /** ISO-4217 currency code (e.g. "EUR"). */
  currency: string;
  paidByMemberId: ID;
  splitMode: SplitMode;
  splitJson: SplitPayload;
  categoryKey?: string;
  iconKey?: string;
  createdAt: number;
  /** Epoch ms; used for cloud sync last-write-wins. */
  updatedAt: number;
}

export interface Transfer {
  id: ID;
  groupId: ID;
  fromMemberId: ID;
  toMemberId: ID;
  amountMinor: number;
  currency: string;
  date: string;
  note?: string;
  createdAt: number;
  /** Epoch ms; used for cloud sync last-write-wins. */
  updatedAt: number;
}
