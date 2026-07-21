// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Canvas } from './Canvas';
import type { Selection, View } from './Canvas';
import { Inspector } from './Inspector';
import { PrintCenter } from './PrintCenter';
import { Sidebar } from './Sidebar';
import type { SidebarTab } from './Sidebar';
import { download, reducer, validatePlan } from './model';
import { classroomSample, weddingSample } from './sample';
import { decodePlan, encodePlan } from './share';
import { autoSeat, liveConflicts } from './solver';
import { loadPlan, savePlan } from './storage';
import type { Plan, TableKind } from './types';
import { emptyPlan } from './types';

const SOURCE_URL = 'https://github.com/bell-kevin/triclinium';

function Logo() {
  return (
    <svg viewBox="0 0 64 64" width={20} height={20} aria-hidden="true">
      <circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
      <g fill="currentColor">
        <circle cx="32" cy="10" r="4.4" />
        <circle cx="47.6" cy="16.4" r="4.4" />
        <circle cx="54" cy="32" r="4.4" />
        <circle cx="47.6" cy="47.6" r="4.4" />
        <circle cx="32" cy="54" r="4.4" />
        <circle cx="16.4" cy="47.6" r="4.4" />
        <circle cx="10" cy="32" r="4.4" />
        <circle cx="16.4" cy="16.4" r="4.4" />
      </g>
    </svg>
  );
}

export default function App() {
  const [plan, dispatch] = useReducer(reducer, undefined, () => loadPlan() ?? emptyPlan());
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [selection, setSelection] = useState<Selection>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [tab, setTab] = useState<SidebarTab>('guests');
  const [fitSignal, setFitSignal] = useState(1);
  const [showPrint, setShowPrint] = useState(false);
  const [share, setShare] = useState<{ url: string; busy: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('triclinium.theme') ?? 'dark');
  const toastTimer = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const conflicts = useMemo(() => liveConflicts(plan), [plan]);
  const seatsTotal = useMemo(() => plan.tables.reduce((s, t) => s + t.seats, 0), [plan.tables]);
  const seated = Object.keys(plan.seating).length;
  const unseated = plan.guests.length - seated;
  const armedGuest = armed ? plan.guests.find((g) => g.id === armed) : undefined;

  const say = (msg: string): void => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  };

  const bumpFit = (): void => setFitSignal((n) => n + 1);

  const loadInto = (p: Plan, msg: string): void => {
    dispatch({ type: 'reset', plan: p });
    setSelection(null);
    setArmed(null);
    say(msg);
    window.setTimeout(bumpFit, 30);
  };

  // Load a shared plan from the URL hash, once.
  useEffect(() => {
    const h = location.hash;
    if (!h.startsWith('#p=')) return;
    void (async () => {
      const raw = await decodePlan(h.slice(3));
      history.replaceState(null, '', location.pathname + location.search);
      const shared = raw ? validatePlan(raw) : null;
      if (!shared) {
        say('That shared link could not be read.');
        return;
      }
      const existing = loadPlan();
      const hasWork = existing !== null && existing.tables.length + existing.guests.length > 0;
      if (hasWork && !confirm('Open the shared plan? Your current plan will be replaced.')) return;
      loadInto(shared, 'Shared plan opened');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave.
  useEffect(() => {
    const t = window.setTimeout(() => savePlan(plan), 350);
    return () => window.clearTimeout(t);
  }, [plan]);

  // Theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('triclinium.theme', theme);
  }, [theme]);

  // Keep transient state honest when things are deleted.
  useEffect(() => {
    if (armed && !plan.guests.some((g) => g.id === armed)) setArmed(null);
    if (selection) {
      const ok =
        selection.kind === 'table'
          ? plan.tables.some((t) => t.id === selection.id)
          : plan.fixtures.some((f) => f.id === selection.id);
      if (!ok) setSelection(null);
    }
  }, [plan, armed, selection]);

  // Keyboard: Esc clears, Delete removes the selected piece.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'Escape') {
        setArmed(null);
        setSelection(null);
        setShare(null);
        setShowPrint(false);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault();
        if (selection.kind === 'table') {
          const t = plan.tables.find((x) => x.id === selection.id);
          if (!t) return;
          const occ = Object.keys(plan.seating).filter((k) => k.startsWith(`${t.id}#`)).length;
          if (occ === 0 || confirm(`Delete ${t.name}? ${occ} guest${occ === 1 ? '' : 's'} will be unseated.`)) {
            dispatch({ type: 'delTable', id: t.id });
            setSelection(null);
          }
        } else {
          dispatch({ type: 'delFixture', id: selection.id });
          setSelection(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [plan, selection]);

  const viewCenter = (): { x: number; y: number } => {
    const el = document.querySelector('.canvas') as SVGSVGElement | null;
    if (!el) return { x: view.x + 300, y: view.y + 200 };
    const r = el.getBoundingClientRect();
    return { x: view.x + r.width / (2 * view.scale), y: view.y + r.height / (2 * view.scale) };
  };

  const addTable = (kind: TableKind): void => {
    const c = viewCenter();
    dispatch({ type: 'addTable', kind, x: Math.round(c.x / 4) * 4, y: Math.round(c.y / 4) * 4 });
  };
  const addFixture = (): void => {
    const c = viewCenter();
    dispatch({ type: 'addFixture', x: Math.round(c.x / 4) * 4, y: Math.round(c.y / 4) * 4 });
  };

  const runAutoSeat = (): void => {
    if (plan.guests.length === 0) {
      say('Add some guests first.');
      return;
    }
    if (seatsTotal === 0) {
      say('Add a table first.');
      return;
    }
    const t0 = performance.now();
    const res = autoSeat(plan);
    dispatch({ type: 'setSeating', seating: res.seating });
    const ms = Math.max(1, Math.round(performance.now() - t0));
    say(`${res.summary} · ${ms} ms`);
  };

  const openShare = (): void => {
    setShare({ url: '', busy: true });
    void encodePlan(plan).then((code) => {
      setShare({ url: `${location.origin}${location.pathname}#p=${code}`, busy: false });
    });
  };

  const exportJson = (): void => {
    download(`${plan.eventName.replace(/[^\w-]+/g, '_') || 'plan'}.triclinium.json`, JSON.stringify(plan, null, 2));
  };

  const maybeLoad = (p: Plan, msg: string): void => {
    if (plan.tables.length + plan.guests.length === 0 || confirm('Replace your current plan with the sample?')) {
      loadInto(p, msg);
    }
  };

  const importJson = (file: File): void => {
    void file.text().then((text) => {
      let p: Plan | null = null;
      try {
        p = validatePlan(JSON.parse(text));
      } catch {
        p = null;
      }
      if (!p) {
        say('That file is not a triclinium plan.');
        return;
      }
      if (plan.tables.length + plan.guests.length === 0 || confirm('Replace your current plan with this file?')) {
        loadInto(p, 'Plan imported');
      }
    });
  };

  const zoomBy = (f: number): void => {
    const ns = Math.min(3, Math.max(0.2, view.scale * f));
    setView({ ...view, scale: ns });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="iconbtn sidebar-toggle"
          title="Guests & rules"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰
        </button>
        <div className="brand">
          <Logo />
          <span>triclinium</span>
        </div>
        <input
          className="event-name"
          value={plan.eventName}
          onChange={(e) => dispatch({ type: 'eventName', name: e.target.value })}
          aria-label="Event name"
        />
        <div className="top-actions">
          <button className="btn primary" onClick={runAutoSeat} title="Let the solver seat everyone">
            Auto-seat
          </button>
          <button className="btn" onClick={openShare}>
            Share
          </button>
          <button className="btn" onClick={() => setShowPrint(true)}>
            Print
          </button>
          <details className="menu">
            <summary className="btn" aria-label="More">
              ⋯
            </summary>
            <div
              className="menu-pop"
              onClick={(e) => {
                const d = (e.currentTarget as HTMLElement).closest('details');
                if (d) (d as HTMLDetailsElement).open = false;
              }}
            >
              <button className="menu-item" onClick={exportJson}>
                Export plan (JSON)
              </button>
              <button className="menu-item" onClick={() => fileRef.current?.click()}>
                Import plan…
              </button>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => maybeLoad(weddingSample(), 'Sample wedding loaded')}>
                Sample: wedding reception
              </button>
              <button className="menu-item" onClick={() => maybeLoad(classroomSample(), 'Sample classroom loaded')}>
                Sample: classroom
              </button>
              <div className="menu-sep" />
              <button
                className="menu-item"
                onClick={() => {
                  if (seated === 0 || confirm('Unseat everyone? Tables and guests stay.')) dispatch({ type: 'clearSeating' });
                }}
              >
                Clear all seats
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  if (plan.tables.length + plan.guests.length === 0 || confirm('Start a new, empty plan?')) {
                    loadInto(emptyPlan(), 'New plan');
                  }
                }}
              >
                New plan
              </button>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              </button>
              <a className="menu-item" href={SOURCE_URL} target="_blank" rel="noreferrer">
                Source code (AGPL-3.0) ↗
              </a>
            </div>
          </details>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
            e.target.value = '';
          }}
        />
      </header>

      <div className="toolstrip">
        <span className="eyebrow">Add</span>
        <button className="btn ghost" onClick={() => addTable('round')}>
          ◯ Round
        </button>
        <button className="btn ghost" onClick={() => addTable('rect')}>
          ▭ Banquet
        </button>
        <button className="btn ghost" onClick={() => addTable('head')}>
          ⌐ Head
        </button>
        <button className="btn ghost" onClick={() => addTable('row')}>
          ⋯ Desk row
        </button>
        <button className="btn ghost" onClick={addFixture}>
          ▦ Fixture
        </button>
        <span className="spacer" />
        <button className="btn ghost" onClick={bumpFit} title="Zoom to fit">
          Fit
        </button>
        <button className="btn ghost" onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
          −
        </button>
        <span className="zoom-val">{Math.round(view.scale * 100)}%</span>
        <button className="btn ghost" onClick={() => zoomBy(1.2)} title="Zoom in">
          +
        </button>
      </div>

      <div className={sidebarOpen ? 'workspace sidebar-open' : 'workspace'}>
        <Sidebar
          plan={plan}
          dispatch={dispatch}
          armed={armed}
          setArmed={(g) => {
            setArmed(g);
            if (g) setSidebarOpen(false);
          }}
          conflicts={conflicts}
          tab={tab}
          setTab={setTab}
        />
        <div className="canvas-wrap">
          <Canvas
            plan={plan}
            conflicts={conflicts}
            dispatch={dispatch}
            view={view}
            setView={setView}
            selection={selection}
            setSelection={setSelection}
            armed={armed}
            setArmed={setArmed}
            fitSignal={fitSignal}
          />
          {armedGuest && (
            <div className="armed-banner">
              Placing <strong>{armedGuest.name}</strong> — click a seat
              <button className="btn ghost" onClick={() => dispatch({ type: 'unassignGuest', guestId: armedGuest.id })}>
                Unseat
              </button>
              <button className="btn ghost" onClick={() => setArmed(null)}>
                Cancel
              </button>
            </div>
          )}
          <Inspector plan={plan} selection={selection} dispatch={dispatch} onClose={() => setSelection(null)} />
          {plan.tables.length === 0 && plan.fixtures.length === 0 && (
            <div className="empty-state">
              <h2>The room is empty</h2>
              <p>Add a table from the strip above, or open a sample plan to see how it all works.</p>
              <div className="empty-actions">
                <button className="btn" onClick={() => maybeLoad(weddingSample(), 'Sample wedding loaded')}>
                  Sample wedding
                </button>
                <button className="btn" onClick={() => maybeLoad(classroomSample(), 'Sample classroom loaded')}>
                  Sample classroom
                </button>
              </div>
            </div>
          )}
          <div className="statsbar">
            <span>
              {plan.guests.length} guests · {seated} seated
              {unseated > 0 && <span className="stat-warn"> · {unseated} unseated</span>} · {plan.tables.length} tables ·{' '}
              {seatsTotal} seats
            </span>
            <span className="spacer" />
            {conflicts.apart.length + conflicts.lockViol.length > 0 ? (
              <button
                className="conflict-pill"
                onClick={() => {
                  setTab('rules');
                  setSidebarOpen(true);
                }}
              >
                {conflicts.apart.length + conflicts.lockViol.length} conflict
                {conflicts.apart.length + conflicts.lockViol.length === 1 ? '' : 's'}
              </button>
            ) : (
              <span className="ok-pill">no conflicts</span>
            )}
            <a className="foot-link" href={SOURCE_URL} target="_blank" rel="noreferrer">
              AGPL-3.0 · source
            </a>
          </div>
        </div>
      </div>

      {showPrint && <PrintCenter plan={plan} conflicts={conflicts} onClose={() => setShowPrint(false)} />}

      {share && (
        <div className="modal-backdrop" onClick={() => setShare(null)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Share this plan</h2>
            <p className="hint">
              The whole plan is compressed into the link itself — nothing is uploaded anywhere. Anyone who opens it gets
              their own editable copy.
            </p>
            {share.busy ? (
              <p className="hint">Packing the plan…</p>
            ) : (
              <>
                <textarea className="share-url" readOnly rows={4} value={share.url} onFocus={(e) => e.target.select()} />
                {share.url.length > 6000 && (
                  <p className="hint warn-hint">
                    This link is long ({share.url.length.toLocaleString()} characters). Most browsers and chat apps handle
                    it, but very old ones may not — the JSON export is a sturdy fallback.
                  </p>
                )}
                <div className="row-actions">
                  <button
                    className="btn primary"
                    onClick={() => {
                      void navigator.clipboard.writeText(share.url).then(
                        () => say('Link copied'),
                        () => say('Copy failed — select the text and copy manually.'),
                      );
                    }}
                  >
                    Copy link
                  </button>
                  <button className="btn ghost" onClick={() => setShare(null)}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
