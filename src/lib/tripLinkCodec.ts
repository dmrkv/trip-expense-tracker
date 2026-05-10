import { gzipSync, gunzipSync, strToU8 } from 'fflate';
import type { ExportPayload } from './repo';

/** Hash fragment prefix after `#` (versioned). Payload is base64url gzip JSON after this. */
export const TRIP_LINK_HASH_PREFIX = 'tripsplit=t1.';

/** Total URL length cap (origin + path + `#…`) before link sharing is disabled. */
export const MAX_TRIP_LINK_URL_LENGTH = 60_000;

export type TripLinkDecodeStep = 'prefix' | 'base64' | 'gzip' | 'json' | 'validate';

/** Thrown from {@link decodeTripHash} with a coarse pipeline step for UX / dev logs. */
export class TripLinkDecodeError extends Error {
  readonly step: TripLinkDecodeStep;
  readonly cause?: unknown;

  constructor(message: string, step: TripLinkDecodeStep, cause?: unknown) {
    super(message);
    this.name = 'TripLinkDecodeError';
    this.step = step;
    this.cause = cause;
  }
}

export function tripLinkDecodeUserMessage(err: unknown): string {
  if (err instanceof TripLinkDecodeError) {
    switch (err.step) {
      case 'prefix':
        return 'Not a valid Tripsplit trip link.';
      case 'base64':
        return 'Trip link text looks corrupted. Copy the full link again (Share → Copy link).';
      case 'gzip':
        return 'Could not read trip link — it may be truncated. Copy the link again; avoid “Share” in apps that shorten URLs.';
      case 'json':
        return 'Trip link data looks damaged. Ask for a fresh share or use Copy link.';
      case 'validate':
        return err.message;
      default:
        return 'Invalid or corrupted trip link.';
    }
  }
  return 'Invalid or corrupted trip link.';
}

/** Trim BOM/whitespace; if multiple `#`, use the segment after the last `#`. */
export function normalizeTripHashInput(raw: string): string {
  let s = raw.trim().replace(/^\uFEFF/, '');
  if (s.includes('#')) {
    s = s.slice(s.lastIndexOf('#') + 1);
  }
  return s.trim();
}

/** Locate `tripsplit=t1.` anywhere in the fragment (tolerates stray prefix characters). */
function extractTripLinkFragment(fragment: string): string | null {
  const idx = fragment.indexOf(TRIP_LINK_HASH_PREFIX);
  if (idx === -1) return null;
  return fragment.slice(idx).trim();
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
 * Uses `JSON.stringify` (same semantics as downloaded backups) so optional fields stay valid JSON.
 */
export function encodeTripExport(payload: ExportPayload): {
  url: string;
  tooLarge: boolean;
  bytes: number;
} {
  const json = JSON.stringify(payload);
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
  const normalized = normalizeTripHashInput(hash);
  const body = extractTripLinkFragment(normalized);
  if (!body || !body.startsWith(TRIP_LINK_HASH_PREFIX)) {
    throw new TripLinkDecodeError('Not a Tripsplit trip link', 'prefix');
  }
  const b64 = body.slice(TRIP_LINK_HASH_PREFIX.length).replace(/[\s\u200b\uFEFF]+/g, '');
  if (!b64) {
    throw new TripLinkDecodeError('Trip link payload is empty', 'prefix');
  }

  let u8: Uint8Array;
  try {
    u8 = base64UrlToU8(b64);
  } catch (e) {
    throw new TripLinkDecodeError('Trip link payload is not valid base64', 'base64', e);
  }

  let rawJson: string;
  try {
    rawJson = new TextDecoder().decode(gunzipSync(u8));
  } catch (e) {
    throw new TripLinkDecodeError('Trip link could not be decompressed', 'gzip', e);
  }

  let data: unknown;
  try {
    data = JSON.parse(rawJson);
  } catch (e) {
    throw new TripLinkDecodeError('Trip link contained invalid JSON', 'json', e);
  }

  const payload = data as ExportPayload;
  if (payload.schemaVersion !== 1) {
    throw new TripLinkDecodeError(
      `Unsupported trip link format (v${String(payload.schemaVersion)})`,
      'validate',
    );
  }
  if (!Array.isArray(payload.groups)) {
    throw new TripLinkDecodeError('Invalid trip link payload', 'validate');
  }
  return payload;
}

export function isTripLinkHash(hash: string): boolean {
  const normalized = normalizeTripHashInput(hash);
  const body = extractTripLinkFragment(normalized);
  return body !== null && body.startsWith(TRIP_LINK_HASH_PREFIX);
}
