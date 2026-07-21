// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useMemo, useState } from 'react';
import { StaticPlan } from './Canvas';
import type { Conflicts } from './solver';
import type { Plan } from './types';
import { parseSeatKey } from './types';

type Doc = 'chart' | 'tables' | 'alpha' | 'cards';

const DOCS: Array<{ v: Doc; label: string; note: string }> = [
  { v: 'chart', label: 'Floor chart', note: 'The room, for the venue and caterers' },
  { v: 'tables', label: 'Table lists', note: 'One list per table, in seat order' },
  { v: 'alpha', label: 'Find-your-seat', note: 'Every guest A–Z with their table' },
  { v: 'cards', label: 'Place cards', note: 'Cut-out cards, one per seated guest' },
];

export function PrintCenter(props: { plan: Plan; conflicts: Conflicts; onClose: () => void }) {
  const { plan, conflicts, onClose } = props;
  const [doc, setDoc] = useState<Doc>('chart');

  useEffect(() => {
    document.body.classList.add('print-open');
    return () => document.body.classList.remove('print-open');
  }, []);

  const tableName = useMemo(() => new Map(plan.tables.map((t) => [t.id, t.name] as const)), [plan.tables]);
  const guestName = useMemo(() => new Map(plan.guests.map((g) => [g.id, g.name] as const)), [plan.guests]);

  const byTable = useMemo(() => {
    const m = new Map<string, Array<{ idx: number; name: string }>>();
    for (const [k, gid] of Object.entries(plan.seating)) {
      const { tableId, idx } = parseSeatKey(k);
      const nm = guestName.get(gid);
      if (!nm) continue;
      const arr = m.get(tableId) ?? [];
      arr.push({ idx, name: nm });
      m.set(tableId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.idx - b.idx);
    return m;
  }, [plan.seating, guestName]);

  const seatedAlpha = useMemo(() => {
    const rows: Array<{ name: string; table: string }> = [];
    for (const [k, gid] of Object.entries(plan.seating)) {
      const nm = guestName.get(gid);
      if (!nm) continue;
      rows.push({ name: nm, table: tableName.get(parseSeatKey(k).tableId) ?? '?' });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [plan.seating, guestName, tableName]);

  const unseatedNames = useMemo(() => {
    const seated = new Set(Object.values(plan.seating));
    return plan.guests.filter((g) => !seated.has(g.id)).map((g) => g.name).sort((a, b) => a.localeCompare(b));
  }, [plan]);

  const subtitle =
    doc === 'chart' ? 'Floor chart' : doc === 'tables' ? 'Table lists' : doc === 'alpha' ? 'Please find your seat' : 'Place cards';

  return (
    <div className="modal-backdrop print-backdrop" onClick={onClose}>
      <div className="print-modal" onClick={(e) => e.stopPropagation()}>
        <div className="print-controls">
          <h2>Print & PDF</h2>
          {DOCS.map((d) => (
            <label key={d.v} className={doc === d.v ? 'doc-choice on' : 'doc-choice'}>
              <input type="radio" name="doc" checked={doc === d.v} onChange={() => setDoc(d.v)} />
              <span className="doc-label">{d.label}</span>
              <span className="doc-note">{d.note}</span>
            </label>
          ))}
          <p className="hint">Use your browser's print dialog to save any of these as a PDF.</p>
          <div className="row-actions">
            <button className="btn primary" onClick={() => window.print()}>
              Print…
            </button>
            <button className="btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="sheet">
          <header className="sheet-head">
            <h1>{plan.eventName}</h1>
            <div className="sheet-sub">{subtitle}</div>
          </header>
          {doc === 'chart' && <StaticPlan plan={plan} conflicts={conflicts} />}
          {doc === 'tables' && (
            <div className="doc-tables">
              {plan.tables.map((t) => {
                const rows = byTable.get(t.id) ?? [];
                return (
                  <div className="tblock" key={t.id}>
                    <h3>
                      {t.name} <span className="tblock-count">{rows.length}/{t.seats}</span>
                    </h3>
                    {rows.length === 0 ? (
                      <p className="tblock-empty">No one seated</p>
                    ) : (
                      <ol>
                        {rows.map((r) => (
                          <li key={r.idx} value={r.idx + 1}>
                            {r.name}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {doc === 'alpha' && (
            <div className="doc-alpha">
              <div className="alpha-cols">
                {seatedAlpha.map((r, i) => (
                  <div className="alpha-row" key={i}>
                    <span className="alpha-name">{r.name}</span>
                    <span className="alpha-dots" />
                    <span className="alpha-table">{r.table}</span>
                  </div>
                ))}
              </div>
              {unseatedNames.length > 0 && (
                <p className="alpha-unseated">Not yet seated: {unseatedNames.join(', ')}</p>
              )}
              {seatedAlpha.length === 0 && <p className="tblock-empty">No one is seated yet.</p>}
            </div>
          )}
          {doc === 'cards' && (
            <div className="doc-cards">
              {seatedAlpha.map((r, i) => (
                <div className="place-card" key={i}>
                  <div className="card-name">{r.name}</div>
                  <div className="card-table">{r.table}</div>
                </div>
              ))}
              {seatedAlpha.length === 0 && <p className="tblock-empty">No one is seated yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
