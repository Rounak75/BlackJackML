/*
 * components/SeenCardsPanel.js — Other Players' Cards (Feature 2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Feature 2: Seen Cards / Multi-Player Tracking
 *
 * WHAT IS THIS?
 * ─────────────
 * In a live blackjack game (online or in-person), there are usually
 * multiple players at the table. All their cards go through the shoe —
 * so a card counter MUST count every visible card, not just their own.
 *
 * This panel shows cards detected in the "seen" zone (right third of the
 * screen, or whichever zone is assigned to other players) so the user can
 * verify they were correctly routed.
 *
 * Seen cards are counted for the running count but NOT added to the
 * player's or dealer's displayed hand. They reset on new_hand.
 *
 * The panel is hidden when there are no seen cards (clean UI).
 *
 * Props:
 *   seenCards    string[]  — card strings like ["A♠", "7♥", "K♦"]
 *                            (seen_cards_this_hand from server state)
 */

function SeenCardsPanel({ seenCards }) {

  // Hidden when empty — no empty-state widget cluttering the layout
  if (!seenCards || seenCards.length === 0) return null;

  // Keep track of collapsed state — starts collapsed when there are many cards
  const [collapsed, setCollapsed] = React.useState(seenCards.length > 8);

  // When card count changes drastically (new hand), reset collapse state
  const prevLen = React.useRef(seenCards.length);
  React.useEffect(() => {
    if (seenCards.length === 0 && prevLen.current > 0) {
      setCollapsed(false);  // new hand — auto-expand (empty so will hide anyway)
    }
    prevLen.current = seenCards.length;
  }, [seenCards.length]);

  // Hi-Lo count sum for the seen cards (for quick sanity check display)
  const HILO = { A:-1, '2':1,'3':1,'4':1,'5':1,'6':1,'7':0,'8':0,'9':0,'10':-1,J:-1,Q:-1,K:-1 };
  const seenCount = seenCards.reduce((sum, card) => {
    // card string is like "A♠" or "10♥" — rank is everything except last char
    const rank = card.slice(0, -1);
    return sum + (HILO[rank] || 0);
  }, 0);

  return (
    <div className="widget-card" role="region" aria-labelledby="wgt-seen-cards"
      style={{ borderLeft: '3px solid #b99bff' }}>

      {/* ── Collapsible header ──────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls="seen-cards-body"
        style={{
          width: '100%', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          marginBottom: collapsed ? 0 : 10,
        }}
      >
        <span id="wgt-seen-cards" className="widget-title" style={{ pointerEvents: 'none' }}>
          Other Players' Cards
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Card count badge */}
          <span className="font-mono text-[9px] border rounded px-2 py-0.5"
            style={{
              color: '#b99bff', borderColor: 'rgba(185,155,255,0.4)',
              background: 'rgba(185,155,255,0.08)',
            }}>
            {seenCards.length} card{seenCards.length !== 1 ? 's' : ''}
          </span>
          {/* Hi-Lo contribution badge */}
          <span className="font-mono text-[9px] border rounded px-2 py-0.5"
            style={{
              color: seenCount > 0 ? '#44e882' : seenCount < 0 ? '#ff5c5c' : '#94a7c4',
              borderColor: 'rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
            }}>
            {seenCount > 0 ? `+${seenCount}` : seenCount} Hi-Lo
          </span>
          <span style={{ fontSize: 10, color: '#94a7c4' }}>
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </button>

      {/* ── Card display ────────────────────────────────────────────────── */}
      {!collapsed && (
        <div id="seen-cards-body">
          {/* Cards in a wrapping flex row */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4,
            padding: '8px 0', minHeight: 44,
          }}>
            {seenCards.map((card, i) => (
              <SeenMiniCard key={i} str={card} index={i} />
            ))}
          </div>

          {/* Footer note */}
          <div style={{
            fontSize: 9, color: '#94a7c4', lineHeight: 1.6,
            marginTop: 4, paddingTop: 6,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            Cards from other seats — counted in running count, not added to
            your hand. Resets on New Hand.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SeenMiniCard — compact card display for seen cards.
 * Uses slightly different styling to the main MiniCard to visually
 * distinguish these as "observed" not "held" cards.
 */
function SeenMiniCard({ str, index }) {
  if (!str) return null;
  const suit  = str.slice(-1);
  const rank  = str.slice(0, -1);
  const isRed = suit === '♥' || suit === '♦';
  return (
    <div
      aria-label={`Seen card ${index + 1}: ${rank} ${suit}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 0,
        width: 34, height: 44,
        borderRadius: 5,
        background: isRed ? 'rgba(255,80,80,0.10)' : 'rgba(200,215,240,0.07)',
        border: `1.5px solid ${isRed ? 'rgba(255,80,80,0.3)' : 'rgba(200,215,240,0.18)'}`,
        color: isRed ? '#ff7a7a' : '#ccdaec',
        fontSize: 12, fontWeight: 700,
        fontFamily: 'DM Mono, monospace',
        userSelect: 'none',
        opacity: 0.85,
      }}
    >
      <span style={{ lineHeight: 1 }}>{rank}</span>
      <span style={{ fontSize: 10, lineHeight: 1 }}>{suit}</span>
    </div>
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function SeenCardsPanel(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  SeenCardsPanel = React.memo(SeenCardsPanel);
}
