/*
 * components/BettingPanel.js
 * ─────────────────────────────────────────────────────────
 * Bet sizing panel with phase-aware display (Issue #6).
 *
 * PHASES:
 *   PRE-HAND  (no cards dealt) → bet input + Kelly prominent
 *   MID-HAND  (cards dealt, no outcome) → doubled/insurance toggles
 *   POST-HAND (outcome resolved) → result buttons prominent
 *
 * AUTO-RESOLVE LOGIC (unchanged):
 *   Player bust          → instant LOSS
 *   Player BJ, no dealer BJ → WIN at 3:2
 *   Both BJ              → PUSH
 *   Dealer BJ, no player BJ → LOSS
 *   Dealer bust           → WIN
 *   Dealer stands         → compare values
 *
 * Props: (unchanged from original)
 */

const CURRENCIES = [
  // ── Fiat ──────────────────────────────────────────────
  { code: 'USD', symbol: '$', name: 'US Dollar', isCrypto: false },
  { code: 'EUR', symbol: '€', name: 'Euro', isCrypto: false },
  { code: 'GBP', symbol: '£', name: 'British Pound', isCrypto: false },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', isCrypto: false },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', isCrypto: false },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', isCrypto: false },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', isCrypto: false },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', isCrypto: false },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', isCrypto: false },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', isCrypto: false },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', isCrypto: false },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', isCrypto: false },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', isCrypto: false },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', isCrypto: false },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', isCrypto: false },
  { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', isCrypto: false },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', isCrypto: false },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', isCrypto: false },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', isCrypto: false },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', isCrypto: false },
  // ── Top 10 Crypto ─────────────────────────────────────
  { code: 'BTC', symbol: '₿', name: 'Bitcoin', isCrypto: true, decimals: 5 },
  { code: 'ETH', symbol: 'Ξ', name: 'Ethereum', isCrypto: true, decimals: 4 },
  { code: 'BNB', symbol: 'BNB', name: 'BNB', isCrypto: true, decimals: 3 },
  { code: 'SOL', symbol: 'SOL', name: 'Solana', isCrypto: true, decimals: 3 },
  { code: 'XRP', symbol: 'XRP', name: 'XRP', isCrypto: true, decimals: 2 },
  { code: 'ADA', symbol: 'ADA', name: 'Cardano', isCrypto: true, decimals: 2 },
  { code: 'DOGE', symbol: 'Ð', name: 'Dogecoin', isCrypto: true, decimals: 1 },
  { code: 'DOT', symbol: 'DOT', name: 'Polkadot', isCrypto: true, decimals: 3 },
  { code: 'AVAX', symbol: 'AVAX', name: 'Avalanche', isCrypto: true, decimals: 3 },
  { code: 'MATIC', symbol: 'MATIC', name: 'Polygon', isCrypto: true, decimals: 2 },
];

function BettingPanel({
  betting, count, lastBet, onRecordResult,
  currency, onCurrencyChange, customBet, onCustomBetChange,
  playerHand, dealerHand, insurance,
  isDoubled, onIsDoubledChange,
  tookInsurance, onTookInsuranceChange,
}) {
  const { useState, useRef, useEffect } = React;
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [showKellyDetails, setShowKellyDetails] = useState(false);
  const autoFiredRef = useRef(false);
  const autoResolveTimer = useRef(null);
  const inputRef = useRef(null);

  const cur = currency || CURRENCIES[0];
  const adv = betting ? (betting.player_advantage || 0) : 0;
  const activeBet = customBet || (betting ? betting.recommended_bet : 10);
  const dec = cur.decimals || 2;
  const effectiveBet = isDoubled ? activeBet * 2 : activeBet;

  const fmtBet = (n) => cur.isCrypto
    ? Number(n).toFixed(dec)
    : Number(n).toFixed(2);

  const filtered = currencySearch
    ? CURRENCIES.filter(c =>
      c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.name.toLowerCase().includes(currencySearch.toLowerCase()))
    : CURRENCIES;

  const fiat = filtered.filter(c => !c.isCrypto);
  const crypto = filtered.filter(c => c.isCrypto);

  // ── PHASE DETECTION ────────────────────────────────────
  const pCards = playerHand?.cards?.length ?? 0;
  const phase = pCards === 0 ? 'pre' : 'mid'; // post is handled by auto-resolve clearing

  // ── AUTO-RESOLVE ───────────────────────────────────────
  useEffect(() => {
    if (!playerHand || !dealerHand) return;

    const pCards = playerHand.cards?.length ?? 0;
    const dCards = dealerHand.card_count ?? 0;

    if (pCards < 2 || dCards < 2) {
      if (pCards === 0) {
        autoFiredRef.current = false;
        if (autoResolveTimer.current) {
          clearTimeout(autoResolveTimer.current);
          autoResolveTimer.current = null;
        }
      }
      return;
    }

    if (autoFiredRef.current) return;

    const playerBj = playerHand.is_blackjack;
    const playerBust = playerHand.is_bust;
    const playerVal = playerHand.value;
    const dealerBj = dealerHand.is_blackjack;
    const dealerBust = dealerHand.is_bust;
    const dealerVal = dealerHand.value;
    const dealerStands = dealerHand.dealer_stands;

    const insuranceAdj = () => {
      if (!tookInsurance) return 0;
      const halfBet = activeBet * 0.5;
      return dealerBj ? halfBet * 2 : -halfBet;
    };

    let result = null;
    let profit = 0;

    if (playerBust) {
      result = 'loss';
      profit = -effectiveBet + insuranceAdj();
    }
    else if (playerBj && dealerBj) {
      result = 'push';
      profit = 0 + insuranceAdj();
    }
    else if (playerBj && !dealerBj) {
      result = 'win';
      profit = activeBet * 1.5 + insuranceAdj();
    }
    else if (dealerBj && !playerBj) {
      result = 'loss';
      profit = -effectiveBet + insuranceAdj();
    }
    else if (dealerBust) {
      result = 'win';
      profit = effectiveBet + insuranceAdj();
    }
    else if (dealerStands) {
      if (playerVal > dealerVal) {
        result = 'win';
        profit = effectiveBet + insuranceAdj();
      } else if (playerVal < dealerVal) {
        result = 'loss';
        profit = -effectiveBet + insuranceAdj();
      } else {
        result = 'push';
        profit = 0 + insuranceAdj();
      }
    }

    if (result === null) return;
    autoFiredRef.current = true;
    autoResolveTimer.current = setTimeout(() => {
      autoResolveTimer.current = null;
      onRecordResult(result, effectiveBet, profit);
    }, 900);

  }, [playerHand, dealerHand]);

  // ── CASHOUT SUGGESTION ─────────────────────────────────
  const tc = count?.true ?? 0;
  const session = betting?.total_profit ?? 0;
  const showCashout = tc < -1 && session > 0;

  if (!betting) {
    return (
      <Widget title="Bet Sizing" badge="KELLY">
        <div className="text-xs" style={{ color: '#b8ccdf' }}>Waiting for count data…</div>
      </Widget>
    );
  }

  return (
    <Widget title="Bet Sizing" badge="KELLY" badgeColor="text-jade">

      {/* ── Cashout suggestion ──────────────────────────── */}
      {showCashout && (
        <div
          className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold flex items-start gap-2"
          style={{
            background: 'rgba(255,212,71,0.1)',
            border: '1.5px solid rgba(255,212,71,0.45)',
            color: '#ffd447',
          }}
        >
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>💰</span>
          <div>
            <div className="font-bold mb-0.5">Cashout Suggested</div>
            <div className="font-normal" style={{ color: '#ccdaec' }}>
              Count has turned negative (TC {tc.toFixed(1)}) while you're ahead.
              Consider leaving the table or dropping to minimum bet.
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          PRE-HAND PHASE — bet input + Kelly prominent
          ═══════════════════════════════════════════════════ */}

      {/* PHASE 3: Bet ramp pill — current units vs spread cap. Glance value:
          "you're at 4u of 12u max" tells a pro instantly whether they're spreading. */}
      {phase === 'pre' && (() => {
        const minB = betting?.min_bet ?? 1;
        const recBet = betting?.recommended_bet ?? betting?.units ?? minB;
        const maxBet = betting?.max_bet ?? Math.max(recBet * 4, minB * 12);
        const baseUnit = Math.max(minB, 1);
        const curUnits = Math.max(1, Math.round((customBet || recBet) / baseUnit));
        const maxUnits = Math.max(1, Math.round(maxBet / baseUnit));
        const ratio = Math.min(1, curUnits / maxUnits);
        const overSpread = curUnits >= 12; // PHASE 8 hook — flag heavy spread
        const rampCol = overSpread ? '#ff5c5c' : ratio >= 0.6 ? '#ffd447' : '#88a8c8';
        return (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            marginBottom: 8, padding:'4px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: 10,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{
                fontSize: 8, fontWeight: 700, color: '#6b7f96',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>Ramp</span>
              <span style={{
                fontFamily: 'DM Mono, monospace', fontWeight: 800,
                color: rampCol, fontVariantNumeric: 'tabular-nums',
                fontSize: 12,
              }}>
                {curUnits}u / {maxUnits}u
              </span>
              {overSpread && (
                <span style={{
                  fontSize: 8, fontWeight: 800, padding: '1px 5px',
                  borderRadius: 4, background: 'rgba(255,92,92,0.15)',
                  border: '1px solid rgba(255,92,92,0.4)', color: '#ff8888',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>HEAVY</span>
              )}
            </div>
            {/* Mini ramp bar */}
            <div style={{
              flex: 1, marginLeft: 10, marginRight: 4,
              height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${ratio * 100}%`, height: '100%',
                background: rampCol,
                transition: 'width 0.3s, background 0.3s',
              }} />
            </div>
          </div>
        );
      })()}

      {/* P3.6 (FEAT-01): Pre-hand BET LOCK chip — large, color-coded by Kelly tier.
          Shown only when no cards are dealt; tapping a chip writes that bet into
          customBet. Visible reminder of the right bet for the current TC. */}
      {phase === 'pre' && (() => {
        const rec  = betting?.recommended_bet ?? betting?.units ?? 0;
        const minB = betting?.min_bet ?? 1;
        const maxB = betting?.max_bet ?? Math.max(rec * 4, minB * 12);
        const chips = [
          { label: 'MIN',  amt: Math.round(minB),                tier: 'min'  },
          { label: '½K',   amt: Math.max(minB, Math.round(rec/2)), tier: 'half' },
          { label: 'KELLY',amt: Math.max(minB, Math.round(rec)),   tier: 'kelly'},
          { label: '2×',   amt: Math.max(minB, Math.round(Math.min(rec*2, maxB))), tier: 'aggr' },
          { label: 'MAX',  amt: Math.round(maxB),                tier: 'max'  },
        ];
        const tierColor = { min:'#6b7fa3', half:'#6aafff', kelly:'#44e882', aggr:'#ffd447', max:'#ff5c5c' };
        return (
          <div style={{
            display:'flex', gap:6, marginBottom:10,
            padding:'8px', background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.08)', borderRadius:10,
          }}>
            {chips.map(c => (
              <button key={c.label}
                onClick={() => onCustomBetChange && onCustomBetChange(c.amt)}
                title={`Set bet to ${cur.symbol}${c.amt}`}
                style={{
                  flex:1, padding:'8px 4px', borderRadius:8,
                  background: customBet === c.amt ? tierColor[c.tier] : 'transparent',
                  color:     customBet === c.amt ? '#0a0e18' : tierColor[c.tier],
                  border:`1.5px solid ${tierColor[c.tier]}`,
                  fontWeight:800, cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  transition:'all 0.15s ease',
                }}>
                <span style={{ fontSize:9, letterSpacing:'0.08em' }}>{c.label}</span>
                <span style={{ fontSize:11, fontFamily:'DM Mono,monospace' }}>
                  {cur.symbol}{c.amt}
                </span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* Currency selector — compact button with ⚙ icon */}
      <div className="relative mb-2">
        <button
          onClick={() => setShowCurrencyPicker(p => !p)}
          aria-label={`Currency: ${cur.code}. Click to change`}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold"
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8fa5be',
          }}
        >
          <span>⚙</span>
          <span>{cur.symbol} {cur.code}</span>
          <span style={{ color: '#6b7f96' }}>{showCurrencyPicker ? '▲' : '▼'}</span>
        </button>

        {showCurrencyPicker && (
          <div
            className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden"
            style={{
              background: '#1c2540',
              border: '1.5px solid rgba(255,255,255,0.18)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              maxHeight: 280,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 220,
            }}
          >
            <div className="p-2">
              <input
                autoFocus
                value={currencySearch}
                onChange={e => setCurrencySearch(e.target.value)}
                placeholder="Search currency…"
                className="w-full rounded-lg px-3 py-1.5 text-xs"
                style={{
                  background: '#111827',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#f0f4ff',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {fiat.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[9px] uppercase tracking-widest font-bold" style={{ color: '#6aafff' }}>
                    💱 Fiat
                  </div>
                  {fiat.map(c => (
                    <button key={c.code}
                      onClick={() => { onCurrencyChange(c); setShowCurrencyPicker(false); setCurrencySearch(''); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5"
                      style={{ color: cur.code === c.code ? '#6aafff' : '#ccdaec', textAlign: 'left' }}>
                      <span className="font-mono font-bold w-10" style={{ color: '#6aafff' }}>{c.code}</span>
                      <span style={{ color: '#b8ccdf' }}>{c.symbol}</span>
                      <span>{c.name}</span>
                      {cur.code === c.code && <span style={{ marginLeft: 'auto', color: '#6aafff' }}>✓</span>}
                    </button>
                  ))}
                </>
              )}
              {crypto.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[9px] uppercase tracking-widest font-bold mt-1" style={{ color: '#ffd447' }}>
                    🔐 Crypto
                  </div>
                  {crypto.map(c => (
                    <button key={c.code}
                      onClick={() => { onCurrencyChange(c); setShowCurrencyPicker(false); setCurrencySearch(''); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5"
                      style={{ color: cur.code === c.code ? '#ffd447' : '#ccdaec', textAlign: 'left' }}>
                      <span className="font-mono font-bold w-10" style={{ color: '#ffd447' }}>{c.code}</span>
                      <span style={{ color: '#b8ccdf' }}>{c.symbol}</span>
                      <span>{c.name}</span>
                      {cur.code === c.code && <span style={{ marginLeft: 'auto', color: '#ffd447' }}>✓</span>}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bet input — prominent in pre-hand, compact strip in mid-hand */}
      <div className={phase === 'pre' ? 'mb-2' : 'mb-2'}>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center flex-1 rounded-lg overflow-hidden"
            style={{
              background: '#111827',
              border: `1.5px solid ${phase === 'pre' ? 'rgba(68,232,130,0.4)' : 'rgba(255,255,255,0.12)'}`,
            }}
          >
            <span className="px-2 font-mono font-bold text-sm" style={{ color: phase === 'pre' ? '#44e882' : '#8fa5be' }}>
              {cur.symbol}
            </span>
            <input
              ref={inputRef}
              type="number"
              aria-label={`Bet amount in ${cur.code}`}
              value={activeBet}
              min="0"
              step={cur.isCrypto ? Math.pow(10, -dec) : 1}
              onChange={e => onCustomBetChange(parseFloat(e.target.value) || 0)}
              readOnly={phase === 'mid'}
              className="flex-1 py-1.5 text-sm font-mono font-bold bg-transparent outline-none"
              style={{
                color: phase === 'pre' ? '#44e882' : '#8fa5be',
                minWidth: 0,
                cursor: phase === 'mid' ? 'default' : 'text',
              }}
            />
          </div>
          {/* Quick bet buttons — only in pre-hand (CRIT-04: replaced ×1 with Use Rec) */}
          {phase === 'pre' && (
            <>
              {[0.5, 2, 5].map(mult => (
                <button
                  key={mult}
                  aria-label={`Multiply bet by ${mult}`}
                  onClick={() => onCustomBetChange(parseFloat((activeBet * mult).toFixed(dec)))}
                  className="text-[10px] px-1.5 py-1 rounded-md font-semibold"
                  style={{
                    background: '#212d45',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#ccdaec',
                  }}
                >
                  ×{mult}
                </button>
              ))}
              <button
                aria-label="Use recommended Kelly bet"
                onClick={() => onCustomBetChange(betting.recommended_bet)}
                className="text-[10px] px-1.5 py-1 rounded-md font-semibold"
                style={{
                  background: 'rgba(68,232,130,0.1)',
                  border: '1px solid rgba(68,232,130,0.3)',
                  color: '#44e882',
                }}
              >
                Rec
              </button>
            </>
          )}
        </div>
        {phase === 'pre' && (
          <div className="text-[10px] mt-1" style={{ color: '#b8ccdf' }}>
            Rec: {cur.symbol}{fmtBet(betting.recommended_bet)} · {betting.units}u · Edge: <span style={{ color: adv > 0 ? '#44e882' : '#ff5c5c' }}>{adv >= 0 ? '+' : ''}{adv}%</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          MID-HAND PHASE — doubled/insurance toggles prominent
          ═══════════════════════════════════════════════════ */}
      {phase === 'mid' && (
        <div className="flex gap-2 mb-3">
          {/* Doubled toggle */}
          <button
            onClick={() => onIsDoubledChange(!isDoubled)}
            aria-pressed={isDoubled}
            aria-label={isDoubled ? "Undo double down" : "Mark hand as doubled down"}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: isDoubled ? 'rgba(255,212,71,0.15)' : '#111827',
              border: `1.5px solid ${isDoubled ? 'rgba(255,212,71,0.6)' : 'rgba(255,255,255,0.12)'}`,
              color: isDoubled ? '#ffd447' : '#b8ccdf',
            }}
          >
            <span>×2</span>
            <span>{isDoubled ? 'DOUBLED' : 'Double Down?'}</span>
          </button>

          {/* Insurance toggle */}
          {insurance?.available ? (
            <button
              onClick={() => onTookInsuranceChange(!tookInsurance)}
              aria-pressed={tookInsurance}
              aria-label={tookInsurance ? "Undo insurance bet" : "Mark insurance bet as placed"}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold transition-all"
              style={{
                fontSize: 13,
                background: tookInsurance
                  ? 'rgba(106,175,255,0.18)'
                  : 'rgba(255,212,71,0.10)',
                border: `2px solid ${tookInsurance
                  ? 'rgba(106,175,255,0.7)'
                  : 'rgba(255,212,71,0.5)'}`,
                color: tookInsurance ? '#6aafff' : '#ffd447',
                boxShadow: tookInsurance
                  ? '0 0 10px rgba(106,175,255,0.25)'
                  : '0 0 10px rgba(255,212,71,0.2)',
              }}
            >
              <span style={{ fontSize: 16 }}>🛡</span>
              <span>{tookInsurance ? '✓ INSURED' : 'Insurance?'}</span>
            </button>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      )}

      {/* Effective bet display when doubled */}
      {isDoubled && (
        <div
          className="mb-3 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-center"
          style={{
            background: 'rgba(255,212,71,0.08)',
            border: '1px solid rgba(255,212,71,0.25)',
            color: '#ffd447',
          }}
        >
          Doubled — effective bet: {cur.symbol}{fmtBet(effectiveBet)}
        </div>
      )}

      {/* Insurance stake reminder */}
      {tookInsurance && insurance?.available && (
        <div
          className="mb-3 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-center"
          style={{
            background: 'rgba(106,175,255,0.08)',
            border: '1px solid rgba(106,175,255,0.25)',
            color: '#6aafff',
          }}
        >
          Insurance: {cur.symbol}{fmtBet(activeBet * 0.5)} · pays {cur.symbol}{fmtBet(activeBet)} if dealer BJ
        </div>
      )}

      {/* Bet action label */}
      {phase === 'pre' && (
        <div className="text-xs font-medium mb-3" style={{ color: '#ccdaec' }}>
          {betting.action || '—'}
        </div>
      )}

      {/* ── Kelly breakdown — CRIT-04: collapsed by default, toggle to expand */}
      {phase === 'pre' && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
          <button
            onClick={() => setShowKellyDetails(d => !d)}
            aria-expanded={showKellyDetails}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '2px 0', color: '#b8ccdf',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600 }}>Kelly Details</span>
            <span style={{ fontSize: 9, color: '#6b7f96' }}>{showKellyDetails ? '▲' : '▼'}</span>
          </button>
          {showKellyDetails && (
            <div style={{ paddingTop: 4 }}>
              <KV label="Kelly Bet" value={`${cur.symbol}${fmtBet(betting.kelly_bet)}`} />
              <KV label="Spread Bet" value={`${cur.symbol}${fmtBet(betting.spread_bet)}`} />
              <KV label="Bankroll" value={`${cur.symbol}${Number(betting.bankroll || 0).toLocaleString()}`} />
              <KV label="Risk of Ruin" value={`${betting.risk_of_ruin}%`} />
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          PRE-HAND MANUAL OVERRIDE — only visible before any cards
          are dealt. Once a hand starts, OutcomeStrip below the
          CardGrid is the canonical result surface.
          ═══════════════════════════════════════════════════ */}
      {pCards === 0 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 8,
          marginTop: 10,
        }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-widest font-display font-bold" style={{ color: '#ccdaec' }}>
              Manual override:
            </div>
            <div className="text-[9px]" style={{ color: '#ccdaec' }}>
              Log a result without dealing cards
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: '🏆 WIN',  result: 'win',       color: '#44e882', bg: 'rgba(68,232,130,0.1)',  border: 'rgba(68,232,130,0.4)' },
              { label: '🤝 PUSH', result: 'push',      color: '#6aafff', bg: 'rgba(106,175,255,0.1)', border: 'rgba(106,175,255,0.4)' },
              { label: '💀 LOSS', result: 'loss',      color: '#ff5c5c', bg: 'rgba(255,92,92,0.1)',   border: 'rgba(255,92,92,0.4)' },
              { label: '🏳 SURR', result: 'surrender', color: '#ff9a20', bg: 'rgba(255,154,32,0.1)',  border: 'rgba(255,154,32,0.4)' },
            ].map(({ label, result, color, bg, border }) => (
              <button
                key={result}
                aria-label={`Record hand result as ${result}`}
                onClick={() => {
                  let profit;
                  if (result === 'win') profit = effectiveBet;
                  else if (result === 'push') profit = 0;
                  else if (result === 'loss') profit = -effectiveBet;
                  else if (result === 'surrender') profit = -(activeBet * 0.5);
                  if (tookInsurance && insurance?.available) {
                    const halfBet = activeBet * 0.5;
                    const dealerBj = dealerHand?.is_blackjack;
                    profit += dealerBj ? halfBet * 2 : -halfBet;
                  }
                  onRecordResult(result === 'surrender' ? 'loss' : result, effectiveBet, profit);
                }}
                className="flex-1 rounded-lg py-2 text-[11px] font-mono font-bold transition-all"
                style={{
                  color, background: bg,
                  border: `1.5px solid ${border}`,
                  fontSize: 11,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = bg.replace('0.1', '0.2'); }}
                onMouseLeave={e => { e.currentTarget.style.background = bg; }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Bet preview — compact */}
          <div className="mt-2 text-center text-[10px] font-mono" style={{ color: '#c8d4e8', lineHeight: 1.8 }}>
            <div>
              {cur.symbol}{fmtBet(activeBet)}
              {isDoubled && <span style={{ color: '#ffd447' }}> → ×2 {cur.symbol}{fmtBet(effectiveBet)}</span>}
              {' '}· win = <span style={{ color: '#44e882' }}>+{cur.symbol}{fmtBet(effectiveBet)}</span>
              {' '}· loss = <span style={{ color: '#ff5c5c' }}>-{cur.symbol}{fmtBet(effectiveBet)}</span>
            </div>
          </div>
        </div>
      )}
    </Widget>
  );
}