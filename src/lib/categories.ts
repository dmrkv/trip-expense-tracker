/** Default expense categories surfaced in the add-expense form. */
export interface CategoryDef {
  key: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'food', label: 'Food & drink', emoji: '🍽️' },
  { key: 'groceries', label: 'Groceries', emoji: '🛒' },
  { key: 'transport', label: 'Transport', emoji: '🚕' },
  { key: 'fuel', label: 'Fuel', emoji: '⛽' },
  { key: 'lodging', label: 'Lodging', emoji: '🏨' },
  { key: 'flights', label: 'Flights', emoji: '✈️' },
  { key: 'activities', label: 'Activities', emoji: '🎟️' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { key: 'health', label: 'Health', emoji: '🩹' },
  { key: 'fees', label: 'Fees & tips', emoji: '💸' },
  { key: 'other', label: 'Other', emoji: '🧾' },
];

export function findCategory(key: string | undefined): CategoryDef | undefined {
  if (!key) return undefined;
  return CATEGORIES.find((c) => c.key === key);
}
