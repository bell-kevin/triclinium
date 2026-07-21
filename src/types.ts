// SPDX-License-Identifier: AGPL-3.0-only

export type TableKind = 'round' | 'rect' | 'head' | 'row';

export interface TableT {
  id: string;
  name: string;
  kind: TableKind;
  seats: number;
  x: number;
  y: number;
  rot: number;
}

export interface Fixture {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Guest {
  id: string;
  name: string;
  group: string;
  lockedTable: string | null;
}

export type PairKind = 'together' | 'apart';

export interface Pair {
  id: string;
  a: string;
  b: string;
  kind: PairKind;
}

export interface Plan {
  v: 1;
  eventName: string;
  tables: TableT[];
  fixtures: Fixture[];
  guests: Guest[];
  pairs: Pair[];
  /** seat key -> guest id */
  seating: Record<string, string>;
}

export const seatKey = (tableId: string, idx: number): string => `${tableId}#${idx}`;

export const parseSeatKey = (k: string): { tableId: string; idx: number } => {
  const j = k.lastIndexOf('#');
  return { tableId: k.slice(0, j), idx: Number(k.slice(j + 1)) };
};

export function emptyPlan(): Plan {
  return { v: 1, eventName: 'Untitled event', tables: [], fixtures: [], guests: [], pairs: [], seating: {} };
}

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 9);
}
