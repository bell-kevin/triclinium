// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useRef } from 'react';
import type { Dispatch, PointerEvent as RPointerEvent } from 'react';
import { planBounds, rectSize, seatPoints, tableExtent, tableRadius } from './geometry';
import type { Action } from './model';
import { groupColor, initials } from './model';
import type { Conflicts } from './solver';
import type { Fixture, Guest, Plan, TableT } from './types';
import { seatKey } from './types';

export interface View {
  x: number;
  y: number;
  scale: number;
}

export type Selection = { kind: 'table' | 'fixture'; id: string } | null;

interface InteractiveHandlers {
  onTableDown: (id: string, e: RPointerEvent<SVGGElement>) => void;
  onFixtureDown: (id: string, e: RPointerEvent<SVGGElement>) => void;
  onSeat: (tableId: string, idx: number) => void;
  onSeatDouble: (tableId: string, idx: number) => void;
}

function SeatG(props: {
  t: TableT;
  idx: number;
  x: number;
  y: number;
  guest: Guest | undefined;
  conflict: boolean;
  armed: boolean;
  handlers?: InteractiveHandlers;
}) {
  const { t, idx, x, y, guest, conflict, armed, handlers } = props;
  const fill = guest ? groupColor(guest.group) ?? 'var(--sv-seatfull)' : 'var(--sv-seat)';
  const stroke = conflict ? 'var(--claret)' : armed ? 'var(--accent2)' : 'var(--sv-seatline)';
  const width = conflict || armed ? 2.4 : 1.2;
  return (
    <g
      className={handlers ? 'seat seat-live' : 'seat'}
      transform={`translate(${x} ${y})`}
      onPointerDown={handlers ? (e) => e.stopPropagation() : undefined}
      onClick={handlers ? (e) => { e.stopPropagation(); handlers.onSeat(t.id, idx); } : undefined}
      onDoubleClick={handlers ? (e) => { e.stopPropagation(); handlers.onSeatDouble(t.id, idx); } : undefined}
    >
      <title>
        {`${t.name} · seat ${idx + 1}${guest ? ` · ${guest.name}` : ' · empty'}`}
      </title>
      <circle r={11} fill={fill} stroke={stroke} strokeWidth={width} />
      {guest && (
        <text className="seat-initials" textAnchor="middle" dy={3.4}>
          {initials(guest.name)}
        </text>
      )}
    </g>
  );
}

function TableG(props: {
  t: TableT;
  plan: Plan;
  gById: Map<string, Guest>;
  conflicts: Conflicts;
  armed: string | null;
  selected: boolean;
  handlers?: InteractiveHandlers;
}) {
  const { t, plan, gById, conflicts, armed, selected, handlers } = props;
  const pts = seatPoints(t);
  const ext = tableExtent(t);
  const occupied = pts.filter((_, i) => plan.seating[seatKey(t.id, i)]).length;

  let body: JSX.Element;
  let label: JSX.Element;
  if (t.kind === 'round') {
    const r = tableRadius(t.seats);
    body = <circle r={r} className="tbl-body" />;
    label = (
      <text className="tbl-label" textAnchor="middle" dy={-1}>
        {t.name}
        <tspan className="tbl-count" x={0} dy={12}>{`${occupied}/${t.seats}`}</tspan>
      </text>
    );
  } else if (t.kind === 'row') {
    body = (
      <g>
        {pts.map((p, i) => (
          <rect key={i} className="desk-body" x={p.x - 16} y={-13} width={32} height={26} rx={5} />
        ))}
      </g>
    );
    label = (
      <text className="tbl-label" textAnchor="middle" y={-24}>
        {t.name} <tspan className="tbl-count">{`${occupied}/${t.seats}`}</tspan>
      </text>
    );
  } else {
    const { w, h } = rectSize(t);
    body = <rect className="tbl-body" x={-w / 2} y={-h / 2} width={w} height={h} rx={9} />;
    label = (
      <text className="tbl-label" textAnchor="middle" dy={t.kind === 'head' ? -1 : 4}>
        {t.name} <tspan className="tbl-count">{`${occupied}/${t.seats}`}</tspan>
      </text>
    );
  }

  return (
    <g transform={`translate(${t.x} ${t.y}) rotate(${t.rot})`}>
      {selected && (
        <rect
          className="sel-outline"
          x={-ext.hw}
          y={-ext.hh}
          width={ext.hw * 2}
          height={ext.hh * 2}
          rx={12}
        />
      )}
      <g
        className={handlers ? 'tbl tbl-live' : 'tbl'}
        onPointerDown={handlers ? (e) => handlers.onTableDown(t.id, e) : undefined}
      >
        {body}
        {label}
      </g>
      {pts.map((p, i) => {
        const gid = plan.seating[seatKey(t.id, i)];
        const guest = gid ? gById.get(gid) : undefined;
        return (
          <SeatG
            key={i}
            t={t}
            idx={i}
            x={p.x}
            y={p.y}
            guest={guest}
            conflict={!!gid && conflicts.apartSet.has(gid)}
            armed={!!gid && gid === armed}
            handlers={handlers}
          />
        );
      })}
    </g>
  );
}

function FixtureG(props: { f: Fixture; selected: boolean; handlers?: InteractiveHandlers }) {
  const { f, selected, handlers } = props;
  return (
    <g transform={`translate(${f.x} ${f.y})`}>
      {selected && (
        <rect className="sel-outline" x={-f.w / 2 - 8} y={-f.h / 2 - 8} width={f.w + 16} height={f.h + 16} rx={10} />
      )}
      <g
        className={handlers ? 'fixture tbl-live' : 'fixture'}
        onPointerDown={handlers ? (e) => handlers.onFixtureDown(f.id, e) : undefined}
      >
        <rect className="fixture-body" x={-f.w / 2} y={-f.h / 2} width={f.w} height={f.h} rx={7} />
        <text className="fixture-label" textAnchor="middle" dy={4}>
          {f.label.toUpperCase()}
        </text>
      </g>
    </g>
  );
}

export function PlanContent(props: {
  plan: Plan;
  conflicts: Conflicts;
  armed?: string | null;
  selection?: Selection;
  handlers?: InteractiveHandlers;
}) {
  const { plan, conflicts, armed = null, selection = null, handlers } = props;
  const gById = new Map(plan.guests.map((g) => [g.id, g] as const));
  return (
    <g>
      {plan.fixtures.map((f) => (
        <FixtureG key={f.id} f={f} selected={selection?.kind === 'fixture' && selection.id === f.id} handlers={handlers} />
      ))}
      {plan.tables.map((t) => (
        <TableG
          key={t.id}
          t={t}
          plan={plan}
          gById={gById}
          conflicts={conflicts}
          armed={armed}
          selected={selection?.kind === 'table' && selection.id === t.id}
          handlers={handlers}
        />
      ))}
    </g>
  );
}

type DragState =
  | { mode: 'pan'; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { mode: 'table' | 'fixture'; id: string; dx: number; dy: number; moved: boolean };

export function Canvas(props: {
  plan: Plan;
  conflicts: Conflicts;
  dispatch: Dispatch<Action>;
  view: View;
  setView: (v: View) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  armed: string | null;
  setArmed: (g: string | null) => void;
  fitSignal: number;
}) {
  const { plan, conflicts, dispatch, view, setView, selection, setSelection, armed, setArmed, fitSignal } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<DragState | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const toWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = (svgRef.current as SVGSVGElement).getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left) / v.scale + v.x, y: (clientY - rect.top) / v.scale + v.y };
  };

  const onBgDown = (e: RPointerEvent<SVGSVGElement>): void => {
    if (e.button !== 0) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y, moved: false };
  };

  const startPiece = (mode: 'table' | 'fixture', id: string, x: number, y: number, e: RPointerEvent<SVGGElement>): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    const w = toWorld(e.clientX, e.clientY);
    drag.current = { mode, id, dx: w.x - x, dy: w.y - y, moved: false };
    setSelection({ kind: mode, id });
  };

  const handlers: InteractiveHandlers = {
    onTableDown: (id, e) => {
      const t = plan.tables.find((x) => x.id === id);
      if (t) startPiece('table', id, t.x, t.y, e);
    },
    onFixtureDown: (id, e) => {
      const f = plan.fixtures.find((x) => x.id === id);
      if (f) startPiece('fixture', id, f.x, f.y, e);
    },
    onSeat: (tableId, idx) => {
      const k = seatKey(tableId, idx);
      const occ = plan.seating[k];
      if (armed) {
        dispatch({ type: 'assign', guestId: armed, seat: k });
        setArmed(null);
      } else if (occ) {
        setArmed(occ);
      }
    },
    onSeatDouble: (tableId, idx) => {
      const occ = plan.seating[seatKey(tableId, idx)];
      if (occ) dispatch({ type: 'unassignGuest', guestId: occ });
      setArmed(null);
    },
  };

  const onMove = (e: RPointerEvent<SVGSVGElement>): void => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'pan') {
      const dx = (e.clientX - d.sx) / viewRef.current.scale;
      const dy = (e.clientY - d.sy) / viewRef.current.scale;
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true;
      setView({ ...viewRef.current, x: d.ox - dx, y: d.oy - dy });
    } else {
      const w = toWorld(e.clientX, e.clientY);
      const nx = Math.round((w.x - d.dx) / 4) * 4;
      const ny = Math.round((w.y - d.dy) / 4) * 4;
      d.moved = true;
      if (d.mode === 'table') dispatch({ type: 'updTable', id: d.id, patch: { x: nx, y: ny } });
      else dispatch({ type: 'updFixture', id: d.id, patch: { x: nx, y: ny } });
    }
  };

  const onUp = (): void => {
    const d = drag.current;
    drag.current = null;
    if (d && d.mode === 'pan' && !d.moved) {
      setArmed(null);
      setSelection(null);
    }
  };

  // Wheel zoom centered on the cursor. Native listener so preventDefault works.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const v = viewRef.current;
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const ns = Math.min(3, Math.max(0.2, v.scale * f));
      const wx = (e.clientX - rect.left) / v.scale + v.x;
      const wy = (e.clientY - rect.top) / v.scale + v.y;
      setView({ x: wx - (e.clientX - rect.left) / ns, y: wy - (e.clientY - rect.top) / ns, scale: ns });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zoom-to-fit on demand.
  useEffect(() => {
    if (fitSignal === 0) return;
    const el = svgRef.current;
    if (!el) return;
    const b = planBounds(plan);
    if (!b) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const pad = 70;
    const scale = Math.min(1.6, Math.max(0.2, Math.min(rect.width / (b.w + pad * 2), rect.height / (b.h + pad * 2))));
    setView({ x: b.cx - rect.width / (2 * scale), y: b.cy - rect.height / (2 * scale), scale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  return (
    <svg
      ref={svgRef}
      className="canvas"
      onPointerDown={onBgDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <defs>
        <pattern id="parquet" width={28} height={28} patternUnits="userSpaceOnUse">
          <circle cx={1.3} cy={1.3} r={1.3} fill="var(--sv-grid)" />
        </pattern>
      </defs>
      <g transform={`scale(${view.scale}) translate(${-view.x} ${-view.y})`}>
        <rect x={-6000} y={-6000} width={12000} height={12000} fill="url(#parquet)" pointerEvents="none" />
        <PlanContent plan={plan} conflicts={conflicts} armed={armed} selection={selection} handlers={handlers} />
      </g>
    </svg>
  );
}

export function StaticPlan(props: { plan: Plan; conflicts: Conflicts }) {
  const b = planBounds(props.plan);
  const pad = 55;
  const vb = b
    ? `${b.cx - b.w / 2 - pad} ${b.cy - b.h / 2 - pad} ${b.w + pad * 2} ${b.h + pad * 2}`
    : '0 0 800 500';
  return (
    <svg className="static-plan" viewBox={vb}>
      <PlanContent plan={props.plan} conflicts={props.conflicts} />
    </svg>
  );
}
