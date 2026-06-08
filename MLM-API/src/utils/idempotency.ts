export function newIdempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

import crypto from 'crypto';

export function makeIdempotencyKey(parts: Record<string, unknown>): string {
  const json = JSON.stringify(parts, Object.keys(parts).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

