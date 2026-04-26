/*
 * components/TabStrip.js
 * ─────────────────────────────────────────────────────────
 * PHASE 2 — Replaces the right-column 9-panel accordion stack
 * with a single tabbed container. Only one body renders at a time;
 * the others stay unmounted to keep render cost flat.
 *
 * State persists across reloads via localStorage key 'bjml_tab_active'.
 *
 * Props:
 *   tabs           — [{ key, label, badge?, render: () => ReactNode }]
 *   defaultKey     — initial tab key (overridden by saved state)
 *   storageKey     — optional localStorage slot (default 'bjml_tab_active')
 *   ariaLabel      — group aria-label
 */

function TabStrip({ tabs, defaultKey, storageKey, ariaLabel, minHeight }) {
  const { useState, useEffect, useRef } = React;
  const SLOT = storageKey || 'bjml_tab_active';
  // PHASE 2 polish: a fixed body height keeps the right column from shifting
  // each time a tab changes — important for pro players who skim by position.
  const BODY_MIN_H = typeof minHeight === 'number' ? minHeight : 320;

  const initialKey = (() => {
    try {
      const saved = localStorage.getItem(SLOT);
      if (saved && tabs.some(t => t.key === saved)) return saved;
    } catch (e) {}
    return defaultKey || (tabs[0] && tabs[0].key);
  })();

  const [activeKey, setActiveKey] = useState(initialKey);
  const tablistRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(SLOT, activeKey); } catch (e) {}
  }, [activeKey]);

  // Keyboard navigation across tablist (Left/Right/Home/End)
  const onKeyDown = (e) => {
    const idx = tabs.findIndex(t => t.key === activeKey);
    if (idx === -1) return;
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    setActiveKey(tabs[next].key);
  };

  const active = tabs.find(t => t.key === activeKey) || tabs[0];

  return (
    <div
      style={{
        background: '#1c2540',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Tablist — horizontal, scrollable */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label={ariaLabel || 'Reference panels'}
        onKeyDown={onKeyDown}
        style={{
          display: 'flex',
          overflowX: 'auto',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: '#171e30',
          scrollbarWidth: 'thin',
        }}
      >
        {tabs.map(t => {
          const isActive = t.key === activeKey;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${t.key}`}
              id={`tab-${t.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveKey(t.key)}
              style={{
                flexShrink: 0,
                padding: '8px 12px',
                background: isActive ? 'rgba(255,212,71,0.10)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #ffd447' : '2px solid transparent',
                color: isActive ? '#ffd447' : '#94a7c4',
                fontSize: 10, fontWeight: 700,
                fontFamily: 'Syne, sans-serif',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {t.label}
              {t.badge != null && (
                <span style={{
                  display: 'inline-block',
                  fontSize: 8, fontWeight: 800,
                  padding: '1px 5px', borderRadius: 4,
                  background: 'rgba(255,212,71,0.2)',
                  color: '#ffd447',
                  fontFamily: 'DM Mono, monospace',
                }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active body — only the active tab renders */}
      <div
        role="tabpanel"
        id={`tabpanel-${active.key}`}
        aria-labelledby={`tab-${active.key}`}
        style={{
          padding: 12,
          minHeight: BODY_MIN_H,
          display: 'flex', flexDirection: 'column',
        }}
      >
        {active && active.render && active.render()}
      </div>
    </div>
  );
}
