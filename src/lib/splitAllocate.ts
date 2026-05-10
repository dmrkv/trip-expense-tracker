/**
 * Integer allocation of an expense total across participants with positive weights.
 *
 * **Largest remainder (Hamilton) method, deterministic:** Each id receives
 * floor(amountMinor × weight / totalWeight) minor units. The leftover delta from
 * rounding is distributed one minor unit at a time to ids with the largest
 * `(amountMinor × weight) % totalWeight` tie-breakers; ties break by ascending id.
 * Sum of outputs always equals amountMinor when totalWeight > 0.
 *
 * Used for percent splits (weights = percentage points) and share splits
 * (weights = integer share counts).
 */
export function allocateWeightedMinor(
  amountMinor: number,
  orderedParticipantIds: string[],
  weights: Record<string, number>,
): Record<string, number> {
  const ids = orderedParticipantIds.filter((id) => {
    const w = weights[id];
    return typeof w === 'number' && Number.isFinite(w) && w > 0;
  });

  const empty = Object.fromEntries(orderedParticipantIds.map((id) => [id, 0]));

  if (amountMinor <= 0 || ids.length === 0) {
    return empty;
  }

  const totalW = ids.reduce((s, id) => s + weights[id], 0);
  if (!(totalW > 0)) {
    return empty;
  }

  const floorById = new Map<string, number>();
  const remainderNumeratorById = new Map<string, number>();

  for (const id of ids) {
    const w = weights[id];
    const prod = amountMinor * w;
    floorById.set(id, Math.floor(prod / totalW));
    remainderNumeratorById.set(id, prod % totalW);
  }

  let assigned = 0;
  for (const id of ids) {
    assigned += floorById.get(id) ?? 0;
  }
  const leftover = amountMinor - assigned;

  const rankOrder = [...ids].sort((a, b) => {
    const ra = remainderNumeratorById.get(a) ?? 0;
    const rb = remainderNumeratorById.get(b) ?? 0;
    if (rb !== ra) return rb - ra;
    return a.localeCompare(b);
  });

  const out = { ...empty };
  for (const id of ids) {
    out[id] = floorById.get(id) ?? 0;
  }
  for (let i = 0; i < leftover; i += 1) {
    const id = rankOrder[i];
    if (id) out[id] += 1;
  }

  return out;
}

/**
 * Split amountMinor evenly across n slots (equal weights). First `remainder`
 * indices receive one extra minor unit so the row sums to amountMinor.
 */
export function splitEqualMinor(amountMinor: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.trunc(amountMinor / n);
  const remainder = amountMinor - base * n;
  const out = new Array(n).fill(base);
  for (let i = 0; i < remainder; i += 1) out[i] += 1;
  return out;
}
