/*
 * components/HandDisplay.js
 * ─────────────────────────────────────────────────────────
 * Shows the dealer's full hand (all cards) and the player's hand.
 *
 * FIX: Dealer now shows ALL cards, not just the upcard.
 *   • 1st dealer card = upcard (face-up, always shown)
 *   • 2nd dealer card = hole card (face-down until revealed — then show it)
 *   • 3rd+ dealer cards = dealer hit cards (always shown)
 *
 * AUTO-RESOLVE DISPLAY:
 *   When the outcome is deterministic, an outcome banner is shown
 *   in the player zone with the resolved result and calculated profit.
 *   BettingPanel handles the actual emit — HandDisplay just shows it.
 *
 * Props:
 *   playerHand     — player hand object from server
 *   dealerUpcard   — first dealer card string (backward compat)
 *   dealerHand     — full dealer hand object { cards[], value, is_soft,
 *                    is_blackjack, is_bust, card_count, dealer_stands }
 *   dealerMustDraw — boolean: dealer must hit (value < 17 with 2+ cards)
 *   sideBets       — side_bets object from server (Perfect Pairs, 21+3 only)
 *   insurance      — insurance object from server { available, recommended,
 *                    ev, ten_probability, reason } — separate from side bets
 *   isDoubled      — boolean: player doubled down this hand (from App state)
 *   tookInsurance  — boolean: player placed insurance bet (from App state)
 *   activeBet      — current bet amount (for outcome profit display)
 */

function HandDisplay({
  playerHand, dealerUpcard, dealerHand, dealerMustDraw,
  sideBets, insurance,
  isDoubled, tookInsurance, onInsuranceChange, activeBet, currency,
  dealEngineActive,
}) {
  const bv   = playerHand?.cards?.length > 0 ? playerHand.value : null
  const bj   = playerHand?.is_blackjack
  const bust = playerHand?.is_bust

  // Dealer data — prefer the full dealerHand object if available
  const dealerCards     = dealerHand?.cards ?? (dealerUpcard ? [dealerUpcard] : [])
  const dealerValue     = dealerHand?.value ?? 0
  const dealerBj        = dealerHand?.is_blackjack
  const dealerBust      = dealerHand?.is_bust
  const dealerSoft      = dealerHand?.is_soft
  const dealerCardCount = dealerHand?.card_count ?? dealerCards.length

  // ── Outcome calculation (mirrors BettingPanel auto-resolve) ──────────
  // Used only for DISPLAY — BettingPanel is the source of truth for emitting.
  // Shows the resolved result and profit in the player zone.
  const effectiveBet = isDoubled ? (activeBet || 0) * 2 : (activeBet || 0)

  const insuranceAdj = () => {
    if (!tookInsurance) return 0
    const halfBet = (activeBet || 0) * 0.5
    return dealerBj ? halfBet * 2 : -halfBet
  }

  let resolvedResult = null   // 'win' | 'loss' | 'push' | null
  let resolvedProfit = 0

  const pCards = playerHand?.cards?.length ?? 0
  const dCards = dealerHand?.card_count ?? 0

  if (pCards >= 2 && dCards >= 2) {
    if (bust) {
      resolvedResult = 'loss'
      resolvedProfit = -effectiveBet + insuranceAdj()
    } else if (bj && dealerBj) {
      resolvedResult = 'push'
      resolvedProfit = 0 + insuranceAdj()
    } else if (bj && !dealerBj) {
      resolvedResult = 'win'
      resolvedProfit = (activeBet || 0) * 1.5 + insuranceAdj() // 3:2
    } else if (dealerBj && !bj) {
      resolvedResult = 'loss'
      resolvedProfit = -effectiveBet + insuranceAdj()
    } else if (dealerBust) {
      resolvedResult = 'win'
      resolvedProfit = effectiveBet + insuranceAdj()
    } else if (dealerHand?.dealer_stands) {
      const pv = playerHand?.value ?? 0
      if (pv > dealerValue)      { resolvedResult = 'win';  resolvedProfit = effectiveBet + insuranceAdj() }
      else if (pv < dealerValue) { resolvedResult = 'loss'; resolvedProfit = -effectiveBet + insuranceAdj() }
      else                       { resolvedResult = 'push'; resolvedProfit = 0 + insuranceAdj() }
    }
  }

  const resultMeta = {
    win:  { label: '🏆 YOU WIN',  color: '#44e882', bg: 'rgba(68,232,130,0.15)',  border: 'rgba(68,232,130,0.5)'  },
    loss: { label: '💀 YOU LOSE', color: '#ff5c5c', bg: 'rgba(255,92,92,0.15)',   border: 'rgba(255,92,92,0.5)'   },
    push: { label: '🤝 PUSH',     color: '#6aafff', bg: 'rgba(106,175,255,0.15)', border: 'rgba(106,175,255,0.5)' },
  }

  const sym = currency?.symbol ?? '₹'
  const fmt = (n) => {
    const abs = Math.abs(n || 0)
    return `${n >= 0 ? '+' : '-'}${sym}${abs.toFixed(0)}`
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: '#1a2236',
        border: dealEngineActive
          ? '1.5px solid rgba(255,212,71,0.2)'
          : '1.5px solid rgba(255,255,255,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
        opacity: dealEngineActive ? 0.6 : 1,
        transition: 'opacity 0.2s, border-color 0.2s',
      }}
    >
      {/* ── Deal Engine isolation overlay ──────────────────────────── */}
      {dealEngineActive && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          borderRadius: 11,
          background: 'rgba(10,14,24,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(1px)',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(255,212,71,0.10)',
            border: '1.5px solid rgba(255,212,71,0.45)',
            borderRadius: 10,
            padding: '8px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ffd447', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              🎯 Deal Engine Active
            </div>
            <div style={{ fontSize: '0.58rem', color: '#b8ccdf', marginTop: 3 }}>
              Hands isolated · Press <kbd style={{ background: '#212d45', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3, padding: '0 3px', color: '#ffd447', fontFamily: 'monospace' }}>E</kbd> for Manual mode
            </div>
          </div>
        </div>
      )}

      {/* Inner grid — dealer left, player right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
      }}>
      {/* ══ LEFT — Dealer ════════════════════════════════════════════ */}
      <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: 14 }}>

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="text-[10px] uppercase tracking-widest font-display font-bold"
            style={{ color: '#b8ccdf' }}
          >
            Dealer Hand
          </div>
          {/* Dealer value badge — only show when 2+ cards are visible */}
          {dealerCards.length >= 2 && dealerValue > 0 && (
            <span
              className="font-mono text-xs px-2 py-0.5 rounded-full font-bold"
              style={{
                background: dealerBj
                  ? 'rgba(255,212,71,0.15)'
                  : dealerBust
                  ? 'rgba(255,92,92,0.15)'
                  : 'rgba(255,255,255,0.08)',
                border: `1.5px solid ${
                  dealerBj   ? 'rgba(255,212,71,0.5)'
                  : dealerBust ? 'rgba(255,92,92,0.5)'
                  : 'rgba(255,255,255,0.2)'}`,
                color: dealerBj ? '#ffd447' : dealerBust ? '#ff5c5c' : '#ccdaec',
              }}
            >
              {dealerBj ? 'BLACKJACK' : dealerBust ? 'BUST' : `${dealerValue}${dealerSoft ? ' soft' : ''}`}
            </span>
          )}
        </div>

        {/* MUST DRAW inline banner */}
        {dealerMustDraw && !dealerBust && !dealerBj && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2"
            style={{
              background: 'rgba(255,160,40,0.18)',
              border: '1.5px solid rgba(255,160,40,0.55)',
              color: '#ffb347',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          >
            ↓ MUST DRAW — Dealer has {dealerValue}{dealerSoft ? ' soft' : ''} — must draw (rule: hit on 16 or below, stand on 17+)
          </span>
        )}

        {/* ── INSURANCE PROMPT ─────────────────────────────────────────
            Insurance is NOT a side bet — it is a core game mechanic.
            Only appears when dealer upcard is an Ace.
            Pays 2:1 on half the main bet if dealer has blackjack.
            Profitable when True Count >= +3 (shoe rich in 10-value cards).
            Rule source: casino rules images — insurance offered before
            dealer peeks for blackjack, settled separately from main bet.
            User confirms they took it via the toggle in BettingPanel.
        ─────────────────────────────────────────────────────────────── */}
        {insurance?.available && (
          <div className="mb-3" style={{ borderRadius: 10, overflow: 'hidden' }}>

            {/* ── Top info strip ─────────────────────────────────────── */}
            <div style={{
              padding: '8px 12px',
              background: tookInsurance
                ? 'rgba(106,175,255,0.15)'
                : 'rgba(255,212,71,0.08)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🛡</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#ffffff', marginBottom: 1 }}>
                    Insurance Available
                    {tookInsurance && (
                      <span style={{
                        marginLeft: 8, fontSize: 9, fontWeight: 700, padding: '1px 6px',
                        borderRadius: 10, background: 'rgba(106,175,255,0.3)',
                        color: '#6aafff', border: '1px solid rgba(106,175,255,0.6)',
                      }}>✓ INSURED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#b8ccdf' }}>
                    Pays 2:1 · Costs {sym}{activeBet > 0 ? (activeBet * 0.5).toFixed(0) : '½ bet'}
                    {activeBet > 0 && tookInsurance && (
                      <span style={{ color: '#6aafff', fontWeight: 700 }}>
                        {' '}· win {sym}{(activeBet).toFixed(0)} if dealer BJ
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* EV badge */}
              {insurance.ev !== null && (
                <div style={{
                  textAlign: 'right', fontSize: 11, fontFamily: 'DM Mono, monospace',
                }}>
                  <div style={{ fontWeight: 800, color: insurance.ev >= 0 ? '#44e882' : '#ff5c5c' }}>
                    {insurance.ev >= 0 ? '+' : ''}{insurance.ev?.toFixed(1)}% EV
                  </div>
                  <div style={{ fontSize: 9, color: '#94a7c4' }}>
                    {insurance.ten_probability?.toFixed(1)}% tens left
                  </div>
                </div>
              )}
            </div>

            {/* ── AI recommendation + action button ──────────────────── */}
            <div style={{
              background: tookInsurance
                ? 'rgba(106,175,255,0.10)'
                : insurance.recommended
                ? 'rgba(68,232,130,0.06)'
                : 'rgba(255,92,92,0.06)',
              padding: '10px 12px',
              border: `1.5px solid ${
                tookInsurance ? 'rgba(106,175,255,0.5)'
                : insurance.recommended ? 'rgba(68,232,130,0.35)'
                : 'rgba(255,92,92,0.25)'}`,
              borderTop: 'none',
            }}>

              {/* Reason */}
              <div style={{ fontSize: 10, color: '#ccdaec', marginBottom: 8, lineHeight: 1.5 }}>
                {insurance.reason}
              </div>

              {/* Big YES / NO button */}
              {!tookInsurance ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* TAKE button */}
                  <button
                    onClick={() => onInsuranceChange && onInsuranceChange(true)}
                    style={{
                      flex: insurance.recommended ? 2 : 1,
                      padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                      fontWeight: 800, fontSize: 13, border: 'none',
                      background: insurance.recommended
                        ? 'linear-gradient(135deg,#44e882,#22cc66)'
                        : 'rgba(255,255,255,0.07)',
                      color: insurance.recommended ? '#0a0e18' : '#94a7c4',
                      boxShadow: insurance.recommended ? '0 2px 12px rgba(68,232,130,0.35)' : 'none',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.filter = 'brightness(1.1)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.filter = '';
                      e.currentTarget.style.transform = '';
                    }}
                    aria-label="Take insurance — I placed the insurance side bet"
                  >
                    ✓ Take Insurance
                  </button>
                  {/* DECLINE button */}
                  <button
                    onClick={() => onInsuranceChange && onInsuranceChange(false)}
                    style={{
                      flex: !insurance.recommended ? 2 : 1,
                      padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                      fontWeight: 800, fontSize: 13, border: 'none',
                      background: !insurance.recommended
                        ? 'linear-gradient(135deg,#ff5c5c,#cc2222)'
                        : 'rgba(255,255,255,0.07)',
                      color: !insurance.recommended ? '#ffffff' : '#94a7c4',
                      boxShadow: !insurance.recommended ? '0 2px 12px rgba(255,92,92,0.35)' : 'none',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.filter = 'brightness(1.1)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.filter = '';
                      e.currentTarget.style.transform = '';
                    }}
                    aria-label="Decline insurance — continue without insurance bet"
                  >
                    ✗ Decline
                  </button>
                </div>
              ) : (
                /* Already took insurance — show settlement + undo */
                <div>
                  <div style={{
                    padding: '7px 10px', borderRadius: 7, marginBottom: 6,
                    background: 'rgba(106,175,255,0.1)', border: '1px solid rgba(106,175,255,0.3)',
                    fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#6aafff',
                    textAlign: 'center', fontWeight: 700,
                  }}>
                    {dealerBj
                      ? `🎯 Dealer BJ! Insurance pays +${sym}${(activeBet).toFixed(0)}`
                      : dealerHand?.card_count >= 2
                      ? `❌ No dealer BJ — lost insurance ${sym}${(activeBet * 0.5).toFixed(0)}`
                      : `⏳ Insured ${sym}${(activeBet * 0.5).toFixed(0)} · waiting for hole card`}
                  </div>
                  <button
                    onClick={() => onInsuranceChange && onInsuranceChange(false)}
                    aria-label="Undo — I did not actually take insurance"
                    style={{
                      width: '100%', padding: '5px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 10, fontWeight: 600,
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#94a7c4',
                    }}
                  >
                    ↩ Undo insurance
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="flex items-center gap-2 flex-wrap" style={{ minHeight: 64 }}>
          {dealerCards.length === 0 ? (
            <span className="text-xs italic" style={{ color: '#b8ccdf' }}>
              Click a card with "Dealer" selected
            </span>
          ) : (
            <>
              {dealerCards.map((c, i) => (
                <MiniCard key={i} str={c} />
              ))}
              {/* Show a face-down card placeholder when dealer has only the upcard
                  (hole card not yet entered) */}
              {dealerCards.length === 1 && (
                <MiniCardBack label="?" />
              )}
            </>
          )}
        </div>

        {/* Dealer card count indicator */}
        {dealerCards.length > 0 && (
          <div className="mt-1.5 text-[10px] font-mono" style={{ color: '#b8ccdf' }}>
            {dealerCards.length === 1
              ? 'Upcard shown · add hole card when revealed'
              : `${dealerCards.length} cards — enter next dealer card (S17: stand on 17+)`}
          </div>
        )}

        {/* Dealer outcome banners */}
        {dealerBust && (
          <div className="mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
            style={{ background: 'rgba(255,92,92,0.15)', border: '1.5px solid rgba(255,92,92,0.5)', color: '#ff5c5c' }}>
            💥 DEALER BUST — resolving…
          </div>
        )}
        {dealerHand && dealerHand.dealer_stands && !dealerBust && !dealerBj && (
          <div className="mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
            style={{ background: 'rgba(50,200,120,0.12)', border: '1.5px solid rgba(50,200,120,0.4)', color: '#5eead4' }}>
            ✓ Dealer stands on {dealerValue}{dealerSoft ? ' soft' : ''} — comparing hands…
          </div>
        )}
        {dealerBj && (
          <div className="mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
            style={{ background: 'rgba(255,212,71,0.15)', border: '1.5px solid rgba(255,212,71,0.5)', color: '#ffd447' }}>
            ⚠ DEALER BLACKJACK — resolving…
          </div>
        )}
      </div>

      {/* ══ RIGHT — Player ═══════════════════════════════════════════ */}
      <div>

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="text-[10px] uppercase tracking-widest font-display font-bold"
            style={{ color: '#b8ccdf' }}
          >
            Your Hand
          </div>
          {bv !== null && (
            <span
              className="font-mono text-xs px-2 py-0.5 rounded-full font-bold"
              style={{
                background: bj
                  ? 'rgba(255,212,71,0.15)'
                  : bust
                  ? 'rgba(255,92,92,0.15)'
                  : 'rgba(255,255,255,0.08)',
                border: `1.5px solid ${
                  bj   ? 'rgba(255,212,71,0.5)'
                  : bust ? 'rgba(255,92,92,0.5)'
                  : 'rgba(255,255,255,0.2)'}`,
                color: bj ? '#ffd447' : bust ? '#ff5c5c' : '#ccdaec',
              }}
            >
              {bj ? 'BLACKJACK' : bust ? 'BUST' : `${bv}${playerHand?.is_soft ? ' soft' : ''}`}
            </span>
          )}
          {/* Doubled badge — shown when isDoubled prop is true */}
          {isDoubled && (
            <span
              className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(255,212,71,0.15)',
                border: '1px solid rgba(255,212,71,0.45)',
                color: '#ffd447',
              }}
            >
              ×2 DOUBLED
            </span>
          )}
        </div>

        {/* Cards */}
        <div className="flex items-center gap-2 flex-wrap" style={{ minHeight: 64 }}>
          {playerHand?.cards?.length > 0 ? (
            playerHand.cards.map((c, i) => <MiniCard key={i} str={c} />)
          ) : (
            <span className="text-xs italic" style={{ color: '#b8ccdf' }}>
              Click cards with "Player" selected
            </span>
          )}
        </div>

        {/* ── AUTO-RESOLVED OUTCOME BANNER ─────────────────────────────
            Shows the calculated result with profit/loss amount.
            BettingPanel is simultaneously firing the auto-emit with a
            900ms delay — this banner appears at the same time.
            Shows "resolving…" animation while the delay ticks down.
        ─────────────────────────────────────────────────────────────── */}
        {resolvedResult && (() => {
          const meta = resultMeta[resolvedResult]
          return (
            <div
              className="mt-2 px-3 py-2.5 rounded-lg font-bold flex items-center justify-between"
              style={{
                background: meta.bg,
                border: `1.5px solid ${meta.border}`,
                color: meta.color,
                animation: 'fadeIn 0.3s ease',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{meta.label}</span>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-extrabold">
                  {fmt(resolvedProfit)}
                </div>
                <div className="text-[9px] font-normal opacity-70">
                  auto-resolving…
                </div>
              </div>
            </div>
          )
        })()}

        {/* Player bust banner — only show when not yet resolved (bust is instant) */}
        {bust && !resolvedResult && (
          <div className="mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
            style={{ background: 'rgba(255,92,92,0.15)', border: '1.5px solid rgba(255,92,92,0.5)', color: '#ff5c5c' }}>
            💥 PLAYER BUST — resolving…
          </div>
        )}

        {/* Player blackjack banner — shown before dealer hole card is revealed */}
        {bj && !resolvedResult && (
          <div className="mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
            style={{ background: 'rgba(255,212,71,0.15)', border: '1.5px solid rgba(255,212,71,0.5)', color: '#ffd447' }}>
            ⭐ BLACKJACK! Pays 3:2 — waiting for dealer hole card…
          </div>
        )}

        {/* +EV side bet alerts inline in player zone.
            Insurance is intentionally excluded here — it lives in the
            dealer zone above since it relates to the dealer's upcard.
            Only true side bets (Perfect Pairs, 21+3, Lucky Ladies) shown.
            Hidden once outcome is resolved (hand is over). */}
        {!resolvedResult && sideBets && (() => {
          const BET_META = [
            { key: 'perfect_pairs',     icon: '👯', name: 'Perfect Pairs', color: '#b99bff' },
            { key: 'twenty_one_plus_3', icon: '🃏', name: '21+3',          color: '#ffd447' },
            { key: 'lucky_ladies',      icon: '👑', name: 'Lucky Ladies',  color: '#ff9a20' },
          ]
          const active = BET_META.filter(b => sideBets[b.key]?.recommended)
          if (active.length === 0) return null
          return (
            <div className="mt-3 space-y-1.5">
              <div className="text-[9px] uppercase tracking-widest font-bold"
                style={{ color: '#b8ccdf' }}>
                +EV Side Bets
              </div>
              {active.map(({ key, icon, name, color }) => (
                <div key={key}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                  style={{ background: `${color}14`, border: `1.5px solid ${color}44` }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: '0.85rem' }}>{icon}</span>
                    <span className="text-xs font-semibold" style={{ color }}>{name}</span>
                  </div>
                  <span className="font-mono font-bold text-xs" style={{ color: '#44e882' }}>
                    +{(sideBets[key].ev || 0).toFixed(1)}% EV
                  </span>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
      </div>{/* end inner grid */}
    </div>
  )
}

/** Mini playing card rendered from a string like "A♠" or "10♥" */
function MiniCard({ str }) {
  if (!str) return null
  const suit  = str.slice(-1)
  const rank  = str.slice(0, -1)
  const isRed = suit === '♥' || suit === '♦'
  return (
    <div className={`mini-card ${isRed ? 'red' : 'black'}`}>
      <span>{rank}</span>
      <span className="card-suit">{suit}</span>
    </div>
  )
}

/** Face-down card — shown as dealer hole card before reveal */
function MiniCardBack({ label = '?' }) {
  return (
    <div
      className="mini-card"
      style={{
        background: 'linear-gradient(135deg, #1e2c48 25%, #26395c 75%)',
        color: '#b8ccdf',
        fontSize: '1.2rem',
        border: '1.5px solid rgba(255,255,255,0.15)',
      }}
    >
      {label}
    </div>
  )
}