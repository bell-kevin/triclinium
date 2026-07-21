// SPDX-License-Identifier: AGPL-3.0-only
import { neighborPairs } from './geometry';
import type { Pair, Plan } from './types';
import { parseSeatKey, seatKey } from './types';

export interface Conflicts {
  apart: Array<{ text: string; guests: [string, string] }>;
  togetherSplit: Array<{ text: string }>;
  lockViol: string[];
  apartSet: Set<string>;
  unseated: string[];
}

/** Cheap conflict scan used for live badges and the rules panel. */
export function liveConflicts(plan: Plan): Conflicts {
  const tableOf = new Map<string, string>();
  for (const [k, g] of Object.entries(plan.seating)) tableOf.set(g, parseSeatKey(k).tableId);
  const name = new Map(plan.guests.map((g) => [g.id, g.name] as const));
  const tname = new Map(plan.tables.map((t) => [t.id, t.name] as const));
  const res: Conflicts = { apart: [], togetherSplit: [], lockViol: [], apartSet: new Set(), unseated: [] };
  for (const p of plan.pairs) {
    if (!name.has(p.a) || !name.has(p.b)) continue;
    const ta = tableOf.get(p.a);
    const tb = tableOf.get(p.b);
    if (p.kind === 'apart') {
      if (ta && ta === tb) {
        res.apart.push({ text: `${name.get(p.a)} & ${name.get(p.b)} are both at ${tname.get(ta) ?? '?'}`, guests: [p.a, p.b] });
        res.apartSet.add(p.a);
        res.apartSet.add(p.b);
      }
    } else if (!ta || !tb || ta !== tb) {
      res.togetherSplit.push({ text: `${name.get(p.a)} & ${name.get(p.b)} are not seated together` });
    }
  }
  for (const g of plan.guests) {
    const t = tableOf.get(g.id);
    if (!t) res.unseated.push(g.id);
    if (g.lockedTable && t && t !== g.lockedTable) {
      res.lockViol.push(`${g.name} is pinned to ${tname.get(g.lockedTable) ?? 'a removed table'} but seated at ${tname.get(t) ?? '?'}`);
    }
  }
  return res;
}

// Energy weights. Lower energy is better.
const APART = 150; // hard: keep-apart pair at the same table
const SPLIT = 46; // keep-together pair at different tables (or one unseated)
const ADJ = -7; // bonus: keep-together pair in adjacent seats
const GRP = -2.5; // bonus per same-group pair sharing a table
const LOCK = 700; // hard: pinned guest away from their table

export interface SolveResult {
  seating: Record<string, string>;
  summary: string;
}

/**
 * Simulated annealing over guest→seat assignments.
 * Pinned guests are placed at their table first and never moved.
 */
export function autoSeat(plan: Plan): SolveResult {
  const seats: string[] = [];
  const seatTable = new Map<string, string>();
  const seatIdx = new Map<string, number>();
  for (const t of plan.tables) {
    for (let i = 0; i < t.seats; i++) {
      const k = seatKey(t.id, i);
      seats.push(k);
      seatTable.set(k, t.id);
      seatIdx.set(k, i);
    }
  }

  const guestIds = new Set(plan.guests.map((g) => g.id));
  const guestSeat = new Map<string, string>();
  const seatGuest = new Map<string, string>();
  for (const [k, g] of Object.entries(plan.seating)) {
    if (seatTable.has(k) && guestIds.has(g) && !seatGuest.has(k) && !guestSeat.has(g)) {
      seatGuest.set(k, g);
      guestSeat.set(g, k);
    }
  }

  const locked = new Map<string, string>();
  for (const g of plan.guests) {
    if (g.lockedTable && plan.tables.some((t) => t.id === g.lockedTable)) locked.set(g.id, g.lockedTable);
  }
  // Seat pinned guests at their table when a seat is free.
  for (const [gid, tid] of locked) {
    const cur = guestSeat.get(gid);
    if (cur && seatTable.get(cur) === tid) continue;
    const free = seats.find((k) => seatTable.get(k) === tid && !seatGuest.has(k));
    if (free) {
      if (cur) seatGuest.delete(cur);
      guestSeat.set(gid, free);
      seatGuest.set(free, gid);
    }
  }

  // Random-place everyone still standing.
  const rng = Math.random;
  const free = seats.filter((k) => !seatGuest.has(k));
  for (let i = free.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [free[i], free[j]] = [free[j], free[i]];
  }
  for (const g of plan.guests) {
    if (guestSeat.has(g.id)) continue;
    const k = free.pop();
    if (!k) break;
    guestSeat.set(g.id, k);
    seatGuest.set(k, g.id);
  }

  // Adjacency lookup per table.
  const nb = new Map<string, Set<string>>();
  for (const t of plan.tables) {
    const s = new Set<string>();
    for (const [a, b] of neighborPairs(t)) s.add(a < b ? `${a}:${b}` : `${b}:${a}`);
    nb.set(t.id, s);
  }
  const adjacent = (k1: string, k2: string): boolean => {
    const t = seatTable.get(k1);
    if (!t || t !== seatTable.get(k2)) return false;
    const a = seatIdx.get(k1) as number;
    const b = seatIdx.get(k2) as number;
    return (nb.get(t) as Set<string>).has(a < b ? `${a}:${b}` : `${b}:${a}`);
  };

  const push = <K, V>(m: Map<K, V[]>, k: K, v: V): void => {
    const arr = m.get(k);
    if (arr) arr.push(v);
    else m.set(k, [v]);
  };
  const pairsBy = new Map<string, Pair[]>();
  const activePairs: Pair[] = [];
  for (const p of plan.pairs) {
    if (!guestIds.has(p.a) || !guestIds.has(p.b)) continue;
    activePairs.push(p);
    push(pairsBy, p.a, p);
    push(pairsBy, p.b, p);
  }

  const groupOf = new Map(plan.guests.map((g) => [g.id, g.group.trim()] as const));
  const gCount = new Map<string, Map<string, number>>();
  const bump = (tid: string, grp: string, d: number): void => {
    if (!grp) return;
    let m = gCount.get(tid);
    if (!m) {
      m = new Map();
      gCount.set(tid, m);
    }
    m.set(grp, (m.get(grp) ?? 0) + d);
  };
  for (const [gid, k] of guestSeat) bump(seatTable.get(k) as string, groupOf.get(gid) ?? '', 1);

  const pairCost = (p: Pair): number => {
    const ka = guestSeat.get(p.a);
    const kb = guestSeat.get(p.b);
    if (p.kind === 'apart') {
      return ka && kb && seatTable.get(ka) === seatTable.get(kb) ? APART : 0;
    }
    if (!ka || !kb || seatTable.get(ka) !== seatTable.get(kb)) return SPLIT;
    return adjacent(ka, kb) ? ADJ : 0;
  };
  const lockCost = (gid: string): number => {
    const t = locked.get(gid);
    if (!t) return 0;
    const k = guestSeat.get(gid);
    return k && seatTable.get(k) === t ? 0 : LOCK;
  };
  /** Energy restricted to the moved guests' pairs, locks, and the affected (table, group) cells. */
  const localE = (gids: string[], tids: Array<string | undefined>): number => {
    let e = 0;
    const seenPair = new Set<string>();
    for (const g of gids) {
      e += lockCost(g);
      const arr = pairsBy.get(g);
      if (arr) {
        for (const p of arr) {
          if (seenPair.has(p.id)) continue;
          seenPair.add(p.id);
          e += pairCost(p);
        }
      }
    }
    const seenCell = new Set<string>();
    for (const g of gids) {
      const grp = groupOf.get(g) ?? '';
      if (!grp) continue;
      for (const tid of tids) {
        if (!tid) continue;
        const key = `${tid}|${grp}`;
        if (seenCell.has(key)) continue;
        seenCell.add(key);
        const n = gCount.get(tid)?.get(grp) ?? 0;
        e += GRP * ((n * (n - 1)) / 2);
      }
    }
    return e;
  };

  const detach = (g: string): void => {
    const k = guestSeat.get(g);
    if (!k) return;
    seatGuest.delete(k);
    guestSeat.delete(g);
    bump(seatTable.get(k) as string, groupOf.get(g) ?? '', -1);
  };
  const attach = (g: string, k: string): void => {
    seatGuest.set(k, g);
    guestSeat.set(g, k);
    bump(seatTable.get(k) as string, groupOf.get(g) ?? '', 1);
  };

  const totalE = (): number => {
    let e = 0;
    for (const p of activePairs) e += pairCost(p);
    for (const g of plan.guests) e += lockCost(g.id);
    for (const m of gCount.values()) for (const n of m.values()) e += GRP * ((n * (n - 1)) / 2);
    return e;
  };

  let E = totalE();
  let bestE = E;
  let best = new Map(guestSeat);

  const movable = plan.guests.filter((g) => !locked.has(g.id)).map((g) => g.id);
  const iters = seats.length === 0 || movable.length === 0 ? 0 : Math.min(140000, 24000 + plan.guests.length * 650);
  const T0 = 32;
  const Te = 0.12;

  for (let it = 0; it < iters; it++) {
    const T = T0 * Math.pow(Te / T0, it / iters);
    const gid = movable[(rng() * movable.length) | 0];
    const to = seats[(rng() * seats.length) | 0];
    const from = guestSeat.get(gid);
    if (to === from) continue;
    const other = seatGuest.get(to);
    if (other === gid) continue;
    if (other && locked.has(other)) continue;

    const gids = other ? [gid, other] : [gid];
    const tids: Array<string | undefined> = [from ? seatTable.get(from) : undefined, seatTable.get(to)];
    const before = localE(gids, tids);

    detach(gid);
    if (other) {
      detach(other);
      if (from) attach(other, from);
    }
    attach(gid, to);

    const dE = localE(gids, tids) - before;
    if (dE <= 0 || rng() < Math.exp(-dE / T)) {
      E += dE;
      if (E < bestE - 1e-9) {
        bestE = E;
        best = new Map(guestSeat);
      }
    } else {
      // undo
      detach(gid);
      if (other) {
        if (from) detach(other);
        attach(other, to);
      }
      if (from) attach(gid, from);
    }
  }

  const seating: Record<string, string> = {};
  for (const [g, k] of best) seating[k] = g;

  const check = liveConflicts({ ...plan, seating });
  const seated = plan.guests.length - check.unseated.length;
  const parts: string[] = [`Seated ${seated} of ${plan.guests.length}`];
  parts.push(check.apart.length === 0 ? 'no hard conflicts' : `${check.apart.length} hard conflict${check.apart.length === 1 ? '' : 's'}`);
  if (check.togetherSplit.length > 0) parts.push(`${check.togetherSplit.length} pair${check.togetherSplit.length === 1 ? '' : 's'} still split`);
  if (check.unseated.length > 0) parts.push(`${check.unseated.length} need more seats`);
  return { seating, summary: parts.join(' · ') };
}
