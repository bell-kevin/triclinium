// SPDX-License-Identifier: AGPL-3.0-only
import type { Plan, TableT } from './types';

export interface Pt {
  x: number;
  y: number;
}

const SEAT_GAP = 17; // distance from table edge to seat center

export function tableRadius(seats: number): number {
  return Math.max(26, (seats * 30) / (2 * Math.PI));
}

export function rectSize(t: TableT): { w: number; h: number } {
  if (t.kind === 'head') {
    return { w: Math.max(90, t.seats * 32 + 8), h: 40 };
  }
  const side = Math.ceil(t.seats / 2);
  return { w: Math.max(80, side * 32 + 8), h: 48 };
}

function spread(i: number, count: number, w: number): number {
  if (count === 1) return 0;
  const inner = w - 28;
  return -inner / 2 + i * (inner / (count - 1));
}

/** Seat centers in table-local coordinates (before rotation). */
export function seatPoints(t: TableT): Pt[] {
  const n = Math.max(1, t.seats);
  const pts: Pt[] = [];
  if (t.kind === 'round') {
    const r = tableRadius(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: Math.cos(a) * (r + SEAT_GAP), y: Math.sin(a) * (r + SEAT_GAP) });
    }
  } else if (t.kind === 'rect') {
    const top = Math.ceil(n / 2);
    const bot = Math.floor(n / 2);
    const { w, h } = rectSize(t);
    for (let i = 0; i < top; i++) pts.push({ x: spread(i, top, w), y: -h / 2 - SEAT_GAP });
    for (let i = 0; i < bot; i++) pts.push({ x: spread(i, bot, w), y: h / 2 + SEAT_GAP });
  } else if (t.kind === 'head') {
    const { w, h } = rectSize(t);
    for (let i = 0; i < n; i++) pts.push({ x: spread(i, n, w), y: h / 2 + SEAT_GAP });
  } else {
    // row of desks
    for (let i = 0; i < n; i++) pts.push({ x: i * 40 - ((n - 1) * 40) / 2, y: 0 });
  }
  return pts;
}

/** Pairs of seat indices considered "adjacent" for the solver's couple bonus. */
export function neighborPairs(t: TableT): Array<[number, number]> {
  const n = t.seats;
  const out: Array<[number, number]> = [];
  if (t.kind === 'round') {
    for (let i = 0; i < n; i++) out.push([i, (i + 1) % n]);
    if (n === 2) out.pop();
    if (n === 1) out.length = 0;
  } else if (t.kind === 'rect') {
    const top = Math.ceil(n / 2);
    for (let i = 0; i + 1 < top; i++) out.push([i, i + 1]);
    for (let i = top; i + 1 < n; i++) out.push([i, i + 1]);
  } else {
    for (let i = 0; i + 1 < n; i++) out.push([i, i + 1]);
  }
  return out;
}

/** Rough half-extents around the table origin, seats included. */
export function tableExtent(t: TableT): { hw: number; hh: number } {
  if (t.kind === 'round') {
    const r = tableRadius(t.seats) + SEAT_GAP + 14;
    return { hw: r, hh: r };
  }
  if (t.kind === 'row') {
    return { hw: (t.seats * 40) / 2 + 8, hh: 30 };
  }
  const { w, h } = rectSize(t);
  return { hw: w / 2 + 14, hh: h / 2 + SEAT_GAP + 14 };
}

export function planBounds(plan: Plan): { cx: number; cy: number; w: number; h: number } | null {
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  let any = false;
  for (const t of plan.tables) {
    const e = tableExtent(t);
    const m = Math.max(e.hw, e.hh); // loose bound; safe under rotation
    any = true;
    minx = Math.min(minx, t.x - m);
    maxx = Math.max(maxx, t.x + m);
    miny = Math.min(miny, t.y - m);
    maxy = Math.max(maxy, t.y + m);
  }
  for (const f of plan.fixtures) {
    any = true;
    minx = Math.min(minx, f.x - f.w / 2);
    maxx = Math.max(maxx, f.x + f.w / 2);
    miny = Math.min(miny, f.y - f.h / 2);
    maxy = Math.max(maxy, f.y + f.h / 2);
  }
  if (!any) return null;
  return { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, w: maxx - minx, h: maxy - miny };
}
