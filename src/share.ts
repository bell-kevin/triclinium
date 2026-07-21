// SPDX-License-Identifier: AGPL-3.0-only
import type { Plan } from './types';

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const u = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

/**
 * Encode a plan into a URL-safe token. Uses the browser's native
 * CompressionStream (deflate) when available; falls back to plain base64.
 * Prefix marks the codec: "d." deflate, "p." plain.
 */
export async function encodePlan(plan: Plan): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(plan));
  const CS = (globalThis as Record<string, unknown>).CompressionStream as
    | (new (format: string) => { readable: ReadableStream; writable: WritableStream })
    | undefined;
  if (CS) {
    const stream = new Blob([raw]).stream().pipeThrough(new CS('deflate-raw') as unknown as ReadableWritablePair);
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    return 'd.' + b64url(buf);
  }
  return 'p.' + b64url(raw);
}

export async function decodePlan(token: string): Promise<unknown | null> {
  try {
    const tag = token.slice(0, 2);
    const data = token.slice(2);
    if (tag === 'p.') {
      return JSON.parse(new TextDecoder().decode(unb64url(data)));
    }
    if (tag === 'd.') {
      const DS = (globalThis as Record<string, unknown>).DecompressionStream as
        | (new (format: string) => { readable: ReadableStream; writable: WritableStream })
        | undefined;
      if (!DS) return null;
      const bytes = unb64url(data);
      const stream = new Blob([bytes]).stream().pipeThrough(new DS('deflate-raw') as unknown as ReadableWritablePair);
      const text = await new Response(stream).text();
      return JSON.parse(text);
    }
    return null;
  } catch {
    return null;
  }
}
