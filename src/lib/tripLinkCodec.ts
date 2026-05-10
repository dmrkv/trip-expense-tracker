import { gzipSync, gunzipSync, strToU8 } from 'fflate';
import type { ExportPayload } from './repo';

/** Hash fragment prefix after `#` (versioned). Payload is base64url gzip JSON after this. */
export const TRIP_LINK_HASH_PREFIX = 'tripsplit=t1.';

/** Total URL length cap (origin + path + `#…`) before link sharing is disabled. */
export const MAX_TRIP_LINK_URL_LENGTH = 60_000;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function u8ToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToU8(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function buildTripShareUrl(fragmentBody: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/#${fragmentBody}`;
}

/**
 * Compress export payload into a client-only trip URL (hash never reaches the server).
 */
export function encodeTripExport(payload: ExportPayload): {
  url: string;
  tooLarge: boolean;
  bytes: number;
} {
  const json = stableStringify(payload);
  const gz = gzipSync(strToU8(json), { level: 9 });
  const b64 = u8ToBase64Url(gz);
  const fragmentBody = `${TRIP_LINK_HASH_PREFIX}${b64}`;
  const url = buildTripShareUrl(fragmentBody);
  const tooLarge = url.length > MAX_TRIP_LINK_URL_LENGTH;
  return { url, tooLarge, bytes: gz.byteLength };
}

/**
 * Parse `#tripsplit=t1.…` or `tripsplit=t1.…` into an export payload.
 */
export function decodeTripHash(hash: string): ExportPayload {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!trimmed.startsWith(TRIP_LINK_HASH_PREFIX)) {
    throw new Error('Not a Tripsplit trip link');
  }
  const b64 = trimmed.slice(TRIP_LINK_HASH_PREFIX.length);
  if (!b64) {
    throw new Error('Trip link payload is empty');
  }
  let rawJson: string;
  try {
    const u8 = base64UrlToU8(b64);
    rawJson = new TextDecoder().decode(gunzipSync(u8));
  } catch {
    throw new Error('Trip link could not be decoded');
  }
  let data: unknown;
  try {
    data = JSON.parse(rawJson);
  } catch {
    throw new Error('Trip link contained invalid JSON');
  }
  const payload = data as ExportPayload;
  if (payload.schemaVersion !== 1) {
    throw new Error(`Unsupported trip link format (v${String(payload.schemaVersion)})`);
  }
  if (!Array.isArray(payload.groups)) {
    throw new Error('Invalid trip link payload');
  }
  return payload;
}

export function isTripLinkHash(hash: string): boolean {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  return trimmed.startsWith(TRIP_LINK_HASH_PREFIX);
}
