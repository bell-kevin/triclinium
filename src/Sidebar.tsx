// SPDX-License-Identifier: AGPL-3.0-only
import { useMemo, useState } from 'react';
import type { Dispatch } from 'react';
import type { Action } from './model';
import { groupColor, guestSeatMap } from './model';
import type { Conflicts } from './solver';
import type { PairKind, Plan } from './types';
import { parseSeatKey } from './types';

export type SidebarTab = 'guests' | 'rules';

function GuestEditor(props: { plan: Plan; guestId: string; dispatch: Dispatch<Action>; onDone: () => void }) {
  const { plan, guestId, dispatch, onDone } = props;
  const guest = plan.guests.find((g) => g.id === guestId);
  if (!guest) return null;
  return (
    <div className="guest-editor">
      <label className="field">
        <span>Name</span>
        <input value={guest.name} onChange={(e) => dispatch({ type: 'updGuest', id: guest.id, patch: { name: e.target.value } })} />
      </label>
      <label className="field">
        <span>Group</span>
        <input
          value={guest.group}
          placeholder="e.g. Bell family"
          onChange={(e) => dispatch({ type: 'updGuest', id: guest.id, patch: { group: e.target.value } })}
        />
      </label>
      <label className="field">
        <span>Pin to table</span>
        <select
          value={guest.lockedTable ?? ''}
          onChange={(e) => dispatch({ type: 'updGuest', id: guest.id, patch: { lockedTable: e.target.value || null } })}
        >
          <option value="">Not pinned</option>
          {plan.tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row-actions">
        <button className="btn ghost" onClick={() => dispatch({ type: 'unassignGuest', guestId: guest.id })}>
          Unseat
        </button>
        <button
          className="btn ghost danger"
          onClick={() => {
            if (confirm(`Remove ${guest.name} from the guest list?`)) {
              dispatch({ type: 'delGuest', id: guest.id });
              onDone();
            }
          }}
        >
          Remove
        </button>
        <span className="spacer" />
        <button className="btn ghost" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

function GuestsTab(props: {
  plan: Plan;
  dispatch: Dispatch<Action>;
  armed: string | null;
  setArmed: (g: string | null) => void;
  conflicts: Conflicts;
}) {
  const { plan, dispatch, armed, setArmed, conflicts } = props;
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const seatOf = useMemo(() => guestSeatMap(plan), [plan]);
  const tableName = useMemo(() => new Map(plan.tables.map((t) => [t.id, t.name] as const)), [plan.tables]);

  const add = (): void => {
    if (!name.trim()) return;
    dispatch({ type: 'addGuest', name, group });
    setName('');
  };

  return (
    <div className="tab-body">
      <div className="add-guest">
        <input
          placeholder="Guest name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <input
          className="group-input"
          placeholder="Group"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <button className="btn" onClick={add} disabled={!name.trim()}>
          Add
        </button>
      </div>
      <button className="linklike" onClick={() => setShowImport((v) => !v)}>
        {showImport ? 'Hide paste import' : 'Paste a list…'}
      </button>
      {showImport && (
        <div className="import-box">
          <textarea
            rows={5}
            placeholder={'One guest per line:\nAva Bell, Bell family\nMarco Ramirez'}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <button
            className="btn"
            disabled={!importText.trim()}
            onClick={() => {
              dispatch({ type: 'importGuests', text: importText });
              setImportText('');
              setShowImport(false);
            }}
          >
            Add guests
          </button>
        </div>
      )}
      <ul className="guest-list">
        {plan.guests.map((g) => {
          const sk = seatOf.get(g.id);
          const tn = sk ? tableName.get(parseSeatKey(sk).tableId) : undefined;
          const inConflict = conflicts.apartSet.has(g.id);
          return (
            <li key={g.id} className={armed === g.id ? 'guest armed' : 'guest'}>
              <div
                className="guest-main"
                role="button"
                tabIndex={0}
                onClick={() => setArmed(armed === g.id ? null : g.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setArmed(armed === g.id ? null : g.id);
                }}
              >
                <span className="dot" style={{ background: groupColor(g.group) ?? 'var(--line)' }} />
                <span className="guest-name">
                  {g.name}
                  {g.lockedTable && <span className="pin" title={`Pinned to ${tableName.get(g.lockedTable) ?? '?'}`}>⌖</span>}
                  {inConflict && <span className="warn" title="Keep-apart conflict">!</span>}
                </span>
                <span className={tn ? 'seat-chip' : 'seat-chip unseated'}>{tn ?? 'unseated'}</span>
              </div>
              <button className="iconbtn" title="Edit guest" onClick={() => setEditing(editing === g.id ? null : g.id)}>
                ✎
              </button>
              {editing === g.id && (
                <GuestEditor plan={plan} guestId={g.id} dispatch={dispatch} onDone={() => setEditing(null)} />
              )}
            </li>
          );
        })}
      </ul>
      {plan.guests.length === 0 && (
        <p className="hint">No guests yet. Add names above, or paste a whole list — one per line, with an optional group after a comma.</p>
      )}
    </div>
  );
}

function RulesTab(props: { plan: Plan; dispatch: Dispatch<Action>; conflicts: Conflicts }) {
  const { plan, dispatch, conflicts } = props;
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [kind, setKind] = useState<PairKind>('together');
  const nameOf = useMemo(() => new Map(plan.guests.map((g) => [g.id, g.name] as const)), [plan.guests]);

  const add = (): void => {
    if (!a || !b || a === b) return;
    dispatch({ type: 'addPair', a, b, kind });
    setA('');
    setB('');
  };

  return (
    <div className="tab-body">
      <div className="pair-add">
        <select value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Guest…</option>
          {plan.guests.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <div className="seg">
          <button className={kind === 'together' ? 'seg-btn on' : 'seg-btn'} onClick={() => setKind('together')}>
            together
          </button>
          <button className={kind === 'apart' ? 'seg-btn on' : 'seg-btn'} onClick={() => setKind('apart')}>
            apart
          </button>
        </div>
        <select value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">Guest…</option>
          {plan.guests.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button className="btn" onClick={add} disabled={!a || !b || a === b}>
          Add rule
        </button>
      </div>
      <ul className="pair-list">
        {plan.pairs.map((p) => (
          <li key={p.id} className="pair">
            <span className={p.kind === 'apart' ? 'pair-kind apart' : 'pair-kind'}>
              {p.kind === 'apart' ? '⇹' : '⇄'}
            </span>
            <span className="pair-names">
              {nameOf.get(p.a) ?? '?'} · {nameOf.get(p.b) ?? '?'}
            </span>
            <button className="iconbtn" title="Delete rule" onClick={() => dispatch({ type: 'delPair', id: p.id })}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {plan.pairs.length === 0 && (
        <p className="hint">
          Rules steer the auto-seat solver: keep couples together, keep feuds apart. Guests sharing a group already
          attract each other.
        </p>
      )}
      <div className="conflict-card">
        <h3>Conflicts</h3>
        {conflicts.apart.length === 0 && conflicts.lockViol.length === 0 && conflicts.togetherSplit.length === 0 ? (
          <p className="ok-line">Nothing to worry about.</p>
        ) : (
          <>
            {conflicts.apart.map((c, i) => (
              <p key={`a${i}`} className="bad-line">
                {c.text}
              </p>
            ))}
            {conflicts.lockViol.map((c, i) => (
              <p key={`l${i}`} className="bad-line">
                {c}
              </p>
            ))}
            {conflicts.togetherSplit.map((c, i) => (
              <p key={`t${i}`} className="mid-line">
                {c.text}
              </p>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function Sidebar(props: {
  plan: Plan;
  dispatch: Dispatch<Action>;
  armed: string | null;
  setArmed: (g: string | null) => void;
  conflicts: Conflicts;
  tab: SidebarTab;
  setTab: (t: SidebarTab) => void;
}) {
  const { plan, dispatch, armed, setArmed, conflicts, tab, setTab } = props;
  const seated = Object.keys(plan.seating).length;
  return (
    <aside className="sidebar">
      <div className="tabs">
        <button className={tab === 'guests' ? 'tab on' : 'tab'} onClick={() => setTab('guests')}>
          Guests <span className="tab-count">{plan.guests.length}</span>
        </button>
        <button className={tab === 'rules' ? 'tab on' : 'tab'} onClick={() => setTab('rules')}>
          Rules{' '}
          {conflicts.apart.length + conflicts.lockViol.length > 0 && (
            <span className="tab-count bad">{conflicts.apart.length + conflicts.lockViol.length}</span>
          )}
        </button>
      </div>
      {tab === 'guests' ? (
        <GuestsTab plan={plan} dispatch={dispatch} armed={armed} setArmed={setArmed} conflicts={conflicts} />
      ) : (
        <RulesTab plan={plan} dispatch={dispatch} conflicts={conflicts} />
      )}
      <div className="sidebar-foot">
        {seated} of {plan.guests.length} seated
      </div>
    </aside>
  );
}
