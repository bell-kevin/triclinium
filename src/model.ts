// SPDX-License-Identifier: AGPL-3.0-only
import type { Fixture, Guest, PairKind, Plan, TableKind, TableT } from './types';
import { emptyPlan, parseSeatKey, uid } from './types';

export type Action =
  | { type: 'reset'; plan: Plan }
  | { type: 'eventName'; name: string }
  | { type: 'addTable'; kind: TableKind; x: number; y: number }
  | { type: 'updTable'; id: string; patch: Partial<TableT> }
  | { type: 'dupTable'; id: string }
  | { type: 'delTable'; id: string }
  | { type: 'addFixture'; x: number; y: number }
  | { type: 'updFixture'; id: string; patch: Partial<Fixture> }
  | { type: 'delFixture'; id: string }
  | { type: 'addGuest'; name: string; group: string }
  | { type: 'importGuests'; text: string }
  | { type: 'updGuest'; id: string; patch: Partial<Guest> }
  | { type: 'delGuest'; id: string }
  | { type: 'addPair'; a: string; b: string; kind: PairKind }
  | { type: 'delPair'; id: string }
  | { type: 'assign'; guestId: string; seat: string }
  | { type: 'unassignGuest'; guestId: string }
  | { type: 'clearSeating' }
  | { type: 'setSeating'; seating: Record<string, string> };

function defaultName(plan: Plan, kind: TableKind): string {
  if (kind === 'head') return 'Head table';
  const base = kind === 'row' ? 'Row' : 'Table';
  const n = plan.tables.filter((t) => (kind === 'row' ? t.kind === 'row' : t.kind !== 'row')).length + 1;
  return `${base} ${n}`;
}

export function reducer(plan: Plan, a: Action): Plan {
  switch (a.type) {
    case 'reset':
      return a.plan;
    case 'eventName':
      return { ...plan, eventName: a.name };
    case 'addTable': {
      const t: TableT = {
        id: uid('t'),
        name: defaultName(plan, a.kind),
        kind: a.kind,
        seats: a.kind === 'head' ? 6 : a.kind === 'row' ? 6 : 8,
        x: a.x,
        y: a.y,
        rot: 0,
      };
      return { ...plan, tables: [...plan.tables, t] };
    }
    case 'updTable': {
      const tables = plan.tables.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t));
      let seating = plan.seating;
      if (a.patch.seats !== undefined) {
        const n = a.patch.seats;
        seating = Object.fromEntries(
          Object.entries(seating).filter(([k]) => {
            const p = parseSeatKey(k);
            return p.tableId !== a.id || p.idx < n;
          }),
        );
      }
      return { ...plan, tables, seating };
    }
    case 'dupTable': {
      const src = plan.tables.find((t) => t.id === a.id);
      if (!src) return plan;
      const copy: TableT = { ...src, id: uid('t'), name: `${src.name} (copy)`, x: src.x + 48, y: src.y + 48 };
      return { ...plan, tables: [...plan.tables, copy] };
    }
    case 'delTable': {
      const seating = Object.fromEntries(
        Object.entries(plan.seating).filter(([k]) => parseSeatKey(k).tableId !== a.id),
      );
      const guests = plan.guests.map((g) => (g.lockedTable === a.id ? { ...g, lockedTable: null } : g));
      return { ...plan, tables: plan.tables.filter((t) => t.id !== a.id), seating, guests };
    }
    case 'addFixture':
      return {
        ...plan,
        fixtures: [...plan.fixtures, { id: uid('f'), label: 'Dance floor', x: a.x, y: a.y, w: 200, h: 120 }],
      };
    case 'updFixture':
      return { ...plan, fixtures: plan.fixtures.map((f) => (f.id === a.id ? { ...f, ...a.patch } : f)) };
    case 'delFixture':
      return { ...plan, fixtures: plan.fixtures.filter((f) => f.id !== a.id) };
    case 'addGuest': {
      const name = a.name.trim();
      if (!name) return plan;
      return { ...plan, guests: [...plan.guests, { id: uid('g'), name, group: a.group.trim(), lockedTable: null }] };
    }
    case 'importGuests': {
      const added: Guest[] = [];
      for (const line of a.text.split(/\r?\n/)) {
        const s = line.trim();
        if (!s) continue;
        const c = s.indexOf(',');
        const name = (c === -1 ? s : s.slice(0, c)).trim();
        const group = (c === -1 ? '' : s.slice(c + 1)).trim();
        if (name) added.push({ id: uid('g'), name, group, lockedTable: null });
      }
      return added.length ? { ...plan, guests: [...plan.guests, ...added] } : plan;
    }
    case 'updGuest':
      return { ...plan, guests: plan.guests.map((g) => (g.id === a.id ? { ...g, ...a.patch } : g)) };
    case 'delGuest': {
      const seating = Object.fromEntries(Object.entries(plan.seating).filter(([, g]) => g !== a.id));
      return {
        ...plan,
        guests: plan.guests.filter((g) => g.id !== a.id),
        pairs: plan.pairs.filter((p) => p.a !== a.id && p.b !== a.id),
        seating,
      };
    }
    case 'addPair': {
      if (a.a === a.b) return plan;
      const dup = plan.pairs.some(
        (p) => ((p.a === a.a && p.b === a.b) || (p.a === a.b && p.b === a.a)) && p.kind === a.kind,
      );
      if (dup) return plan;
      return { ...plan, pairs: [...plan.pairs, { id: uid('p'), a: a.a, b: a.b, kind: a.kind }] };
    }
    case 'delPair':
      return { ...plan, pairs: plan.pairs.filter((p) => p.id !== a.id) };
    case 'assign': {
      const s: Record<string, string> = { ...plan.seating };
      let old: string | undefined;
      for (const [k, g] of Object.entries(s)) {
        if (g === a.guestId) {
          old = k;
          break;
        }
      }
      if (old === a.seat) return plan;
      const occupant = s[a.seat];
      if (old) delete s[old];
      delete s[a.seat];
      if (occupant && occupant !== a.guestId && old) s[old] = occupant; // swap
      s[a.seat] = a.guestId;
      return { ...plan, seating: s };
    }
    case 'unassignGuest': {
      const s = Object.fromEntries(Object.entries(plan.seating).filter(([, g]) => g !== a.guestId));
      return { ...plan, seating: s };
    }
    case 'clearSeating':
      return { ...plan, seating: {} };
    case 'setSeating':
      return { ...plan, seating: a.seating };
  }
}

export function guestSeatMap(plan: Plan): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, g] of Object.entries(plan.seating)) m.set(g, k);
  return m;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function groupHue(group: string): number | null {
  const g = group.trim().toLowerCase();
  if (!g) return null;
  let h = 0;
  for (let i = 0; i < g.length; i++) h = (h * 31 + g.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function groupColor(group: string): string | null {
  const hue = groupHue(group);
  if (hue === null) return null;
  return `hsl(${hue} 42% 58%)`;
}

export function download(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function validatePlan(x: unknown): Plan | null {
  if (!x || typeof x !== 'object') return null;
  const p = x as Plan;
  if (p.v !== 1 || !Array.isArray(p.tables) || !Array.isArray(p.guests)) return null;
  return {
    ...emptyPlan(),
    ...p,
    fixtures: Array.isArray(p.fixtures) ? p.fixtures : [],
    pairs: Array.isArray(p.pairs) ? p.pairs : [],
    seating: p.seating && typeof p.seating === 'object' ? p.seating : {},
  };
}
