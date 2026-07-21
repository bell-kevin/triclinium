// SPDX-License-Identifier: AGPL-3.0-only
import type { Dispatch } from 'react';
import type { Selection } from './Canvas';
import type { Action } from './model';
import type { Plan, TableKind } from './types';
import { parseSeatKey } from './types';

const KIND_LABELS: Array<{ v: TableKind; label: string }> = [
  { v: 'round', label: 'Round table' },
  { v: 'rect', label: 'Banquet table' },
  { v: 'head', label: 'Head table' },
  { v: 'row', label: 'Desk row' },
];

export function Inspector(props: {
  plan: Plan;
  selection: Selection;
  dispatch: Dispatch<Action>;
  onClose: () => void;
}) {
  const { plan, selection, dispatch, onClose } = props;
  if (!selection) return null;

  if (selection.kind === 'fixture') {
    const f = plan.fixtures.find((x) => x.id === selection.id);
    if (!f) return null;
    return (
      <div className="inspector">
        <div className="inspector-head">
          <span className="eyebrow">Fixture</span>
          <button className="iconbtn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <label className="field">
          <span>Label</span>
          <input value={f.label} onChange={(e) => dispatch({ type: 'updFixture', id: f.id, patch: { label: e.target.value } })} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Width</span>
            <input
              type="number"
              min={30}
              max={800}
              value={f.w}
              onChange={(e) => dispatch({ type: 'updFixture', id: f.id, patch: { w: Number(e.target.value) || 30 } })}
            />
          </label>
          <label className="field">
            <span>Depth</span>
            <input
              type="number"
              min={30}
              max={800}
              value={f.h}
              onChange={(e) => dispatch({ type: 'updFixture', id: f.id, patch: { h: Number(e.target.value) || 30 } })}
            />
          </label>
        </div>
        <div className="row-actions">
          <button
            className="btn ghost danger"
            onClick={() => {
              dispatch({ type: 'delFixture', id: f.id });
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  const t = plan.tables.find((x) => x.id === selection.id);
  if (!t) return null;
  const occupied = Object.keys(plan.seating).filter((k) => parseSeatKey(k).tableId === t.id).length;

  return (
    <div className="inspector">
      <div className="inspector-head">
        <span className="eyebrow">Table</span>
        <button className="iconbtn" onClick={onClose} title="Close">
          ✕
        </button>
      </div>
      <label className="field">
        <span>Name</span>
        <input value={t.name} onChange={(e) => dispatch({ type: 'updTable', id: t.id, patch: { name: e.target.value } })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Shape</span>
          <select
            value={t.kind}
            onChange={(e) => dispatch({ type: 'updTable', id: t.id, patch: { kind: e.target.value as TableKind } })}
          >
            {KIND_LABELS.map((k) => (
              <option key={k.v} value={k.v}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Seats</span>
          <input
            type="number"
            min={1}
            max={24}
            value={t.seats}
            onChange={(e) => {
              const n = Math.max(1, Math.min(24, Number(e.target.value) || 1));
              dispatch({ type: 'updTable', id: t.id, patch: { seats: n } });
            }}
          />
        </label>
      </div>
      <div className="field">
        <span>Rotation</span>
        <div className="rotate-row">
          <button className="btn ghost" onClick={() => dispatch({ type: 'updTable', id: t.id, patch: { rot: t.rot - 15 } })}>
            ⟲ 15°
          </button>
          <span className="rot-val">{((t.rot % 360) + 360) % 360}°</span>
          <button className="btn ghost" onClick={() => dispatch({ type: 'updTable', id: t.id, patch: { rot: t.rot + 15 } })}>
            ⟳ 15°
          </button>
        </div>
      </div>
      <div className="row-actions">
        <button className="btn ghost" onClick={() => dispatch({ type: 'dupTable', id: t.id })}>
          Duplicate
        </button>
        <button
          className="btn ghost danger"
          onClick={() => {
            if (occupied === 0 || confirm(`Delete ${t.name}? ${occupied} guest${occupied === 1 ? '' : 's'} will be unseated.`)) {
              dispatch({ type: 'delTable', id: t.id });
              onClose();
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
