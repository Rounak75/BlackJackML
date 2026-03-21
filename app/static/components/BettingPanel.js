/*
 * components/BettingPanel.js
 * ─────────────────────────────────────────────────────────
 * Bet sizing panel with:
 *   • Custom bet input (user can type any amount)
 *   • Currency selector — any world fiat + top 10 crypto
 *   • Kelly criterion breakdown
 *   • Doubled toggle — doubles the recorded bet when player doubled down
 *   • Insurance toggle — user confirms they physically placed insurance bet
 *   • Auto-resolve — fires record_result automatically when outcome is known
 *   • Cashout suggestion — alerts when count turns negative after winning
 *
 * AUTO-RESOLVE LOGIC:
 * ───────────────────
 *   Player bust          → instant LOSS (full bet)
 *   Player BJ, dealer no BJ → WIN at 3:2
 *   Both BJ              → PUSH
 *   Dealer BJ, player no BJ → LOSS (full bet)
 *   Dealer bust          → WIN (full bet, or 2× if doubled)
 *   Dealer stands        → compare values → WIN / PUSH / LOSS
 *
 * INSURANCE SETTLEMENT (only if toggle is ON):
 *   Dealer BJ  → insurance wins: +bet×0.5×2 = +bet added to profit
 *   Dealer no BJ → insurance loses: -bet×0.5 subtracted from profit
 *
 * DOUBLED TOGGLE:
 *   When ON, the recorded bet is activeBet×2 (player doubled down).
 *   The payout calc uses the doubled amount.
 *
 * Props:
 *   betting              — betting object from server
 *   count                — count object from server
 *   lastBet              — most recent recommended bet amount
 *   onRecordResult       — callback(result, betAmount, profit)
 *   currency             — { code, symbol, isCrypto } from App state
 *   onCurrencyChange     — callback(currencyObj)
 *   customBet            — user-entered bet amount (controlled from App)
 *   onCustomBetChange    — callback(amount)
 *   playerHand           — player hand object (for auto-resolve)
 *   dealerHand           — dealer hand object (for auto-resolve)
 *   insurance            — insurance object from server
 *   isDoubled            — boolean: lifted from App state
 *   onIsDoubledChange    — callback(bool): updates App state
 *   tookInsurance        — boolean: lifted from App state
 *   onTookInsuranceChange — callback(bool): updates App state
 */

const CURRENCIES = [
  // ── Fiat ──────────────────────────────────────────────
  { code: 'USD', symbol: '$',   name: 'US Dollar',          isCrypto: false },
  { code: 'EUR', symbol: '€',   name: 'Euro',               isCrypto: false },
  { code: 'GBP', symbol: '£',   name: 'British Pound',      isCrypto: false },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',       isCrypto: false },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee',       isCrypto: false },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar',  isCrypto: false },
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar',    isCrypto: false },
  { code: 'CHF', symbol: 'Fr',  name: 'Swiss Franc',        isCrypto: false },
  { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan',       isCrypto: false },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham',         isCrypto: false },
  { code: 'SAR', symbol: '﷼',   name: 'Saudi Riyal',        isCrypto: false },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar',   isCrypto: false },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar',   isCrypto: false },
  { code: 'KRW', symbol: '₩',   name: 'South Korean Won',   isCrypto: false },
  { code: 'BRL', symbol: 'R$',  name: 'Brazilian Real',     isCrypto: false },
  { code: 'MXN', symbol: 'Mex$',name: 'Mexican Peso',       isCrypto: false },
  { code: 'ZAR', symbol: 'R',   name: 'South African Rand', isCrypto: false },
  { code: 'TRY', symbol: '₺',   name: 'Turkish Lira',       isCrypto: false },
  { code: 'RUB', symbol: '₽',   name: 'Russian Ruble',      isCrypto: false },
  { code: 'SEK', symbol: 'kr',  name: 'Swedish Krona',      isCrypto: false },
  // ── Top 10 Crypto ─────────────────────────────────────
  { code: 'BTC',  symbol: '₿',    name: 'Bitcoin',      isCrypto: true, decimals: 5 },
  { code: 'ETH',  symbol: 'Ξ',    name: 'Ethereum',     isCrypto: true, decimals: 4 },
  { code: 'BNB',  symbol: 'BNB',  name: 'BNB',          isCrypto: true, decimals: 3 },
  { code: 'SOL',  symbol: 'SOL',  name: 'Solana',       isCrypto: true, decimals: 3 },
  { code: 'XRP',  symbol: 'XRP',  name: 'XRP',          isCrypto: true, decimals: 2 },
  { code: 'ADA',  symbol: 'ADA',  name: 'Cardano',      isCrypto: true, decimals: 2 },
  { code: 'DOGE', symbol: 'Ð',    name: 'Dogecoin',     isCrypto: true, decimals: 1 },
  { code: 'DOT',  symbol: 'DOT',  name: 'Polkadot',     isCrypto: true, decimals: 3 },
  { code: 'AVAX', symbol: 'AVAX', name: 'Avalanche',    isCrypto: true, decimals: 3 },
  { code: 'MATIC',symbol: 'MATIC',name: 'Polygon',      isCrypto: true, decimals: 2 },
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
  const [currencySearch,     setCurrencySearch]     = useState('');
  // Tracks whether we already auto-fired for this hand to avoid double-emit
  const autoFiredRef = useRef(false);
  const inputRef     = useRef(null);

  const cur       = currency || CURRENCIES[0];
  const adv       = betting ? (betting.player_advantage || 0) : 0;
  const activeBet = customBet || (betting ? betting.recommended_bet : 10);
  const dec       = cur.decimals || 2;
  // The bet at risk — doubles if player doubled down
  const effectiveBet = isDoubled ? activeBet * 2 : activeBet;

  const fmtBet = (n) => cur.isCrypto
    ? Number(n).toFixed(dec)
    : Number(n).toFixed(2);

  const filtered = currencySearch
    ? CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
        c.name.toLowerCase().includes(currencySearch.toLowerCase()))
    : CURRENCIES;

  const fiat   = filtered.filter(c => !c.isCrypto);
  const crypto = filtered.filter(c => c.isCrypto);

  // ── AUTO-RESOLVE ──────────────────────────────────────────────────────
  // Runs every time playerHand or dealerHand updates.
  // Fires onRecordResult automatically when the outcome is deterministic.
  // Per casino rules (from rule images):
  //   • Blackjack pays 3:2
  //   • Both BJ = push
  //   • Dealer bust = player wins
  //   • Dealer stands (≥17) = compare values
  //   • Insurance settles separately based on tookInsurance toggle
  useEffect(() => {
    if (!playerHand || !dealerHand) return;

    const pCards   = playerHand.cards?.length ?? 0;
    const dCards   = dealerHand.card_count ?? 0;

    // Need at least 2 player cards and 2 dealer cards to resolve
    if (pCards < 2 || dCards < 2) {
      // Reset auto-fire guard when a new hand starts (no cards yet)
      if (pCards === 0) autoFiredRef.current = false;
      return;
    }

    // Don't fire twice for the same resolved hand
    if (autoFiredRef.current) return;

    const playerBj   = playerHand.is_blackjack;
    const playerBust = playerHand.is_bust;
    const playerVal  = playerHand.value;
    const dealerBj   = dealerHand.is_blackjack;
    const dealerBust = dealerHand.is_bust;
    const dealerVal  = dealerHand.value;
    const dealerStands = dealerHand.dealer_stands;

    // Helper: calculate insurance profit/loss to add on top of main result
    // Only applies if user toggled tookInsurance ON
    const insuranceAdj = () => {
      if (!tookInsurance) return 0;
      const halfBet = activeBet * 0.5;
      // Insurance pays 2:1 when dealer has BJ, loses the stake otherwise
      return dealerBj ? halfBet * 2 : -halfBet;
    };

    let result = null;
    let profit = 0;

    // ── Case 1: Player bust — instant loss regardless of dealer ──────
    if (playerBust) {
      result = 'loss';
      profit = -effectiveBet + insuranceAdj();
    }

    // ── Case 2: Both blackjack — push (but insurance still settles) ──
    else if (playerBj && dealerBj) {
      result = 'push';
      profit = 0 + insuranceAdj();
    }

    // ── Case 3: Player blackjack, dealer no BJ — 3:2 payout ─────────
    // Per rules: blackjack only from initial 2-card hand, pays 3:2
    else if (playerBj && !dealerBj) {
      result = 'win';
      profit = activeBet * 1.5 + insuranceAdj(); // 3:2 — NOT effectiveBet (can't double on BJ)
    }

    // ── Case 4: Dealer blackjack, player no BJ — player loses ────────
    else if (dealerBj && !playerBj) {
      result = 'loss';
      profit = -effectiveBet + insuranceAdj();
    }

    // ── Case 5: Dealer bust — player wins ────────────────────────────
    else if (dealerBust) {
      result = 'win';
      profit = effectiveBet + insuranceAdj();
    }

    // ── Case 6: Dealer stands — compare values ────────────────────────
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

    // ── No deterministic outcome yet — dealer still drawing ──────────
    if (result === null) return;

    // Fire auto-resolve — mark as fired so we don't double-emit
    autoFiredRef.current = true;

    // Small delay so the user can see the final state before it clears
    setTimeout(() => {
      onRecordResult(result, effectiveBet, profit);
      // Toggles are reset in App.handleRecordResult — no need to call here
    }, 900);

  }, [playerHand, dealerHand]);

  // ── CASHOUT SUGGESTION ────────────────────────────────────────────────
  // Suggest leaving / dropping to minimum when count turns unfavourable
  // after the player has been winning (positive session profit).
  const tc      = count?.true ?? 0;
  const session = betting?.session_profit ?? 0;
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

      {/* ── Cashout suggestion ───────────────────────────────────────── */}
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

      {/* ── Currency selector button ─────────────────────────────────── */}
      <div className="relative mb-3">
        <button
          onClick={() => setShowCurrencyPicker(p => !p)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold"
          style={{
            background: '#111827',
            border: '1.5px solid rgba(255,255,255,0.15)',
            color: '#f0f4ff',
          }}
        >
          <span style={{ color: cur.isCrypto ? '#ffd447' : '#6aafff' }}>
            {cur.isCrypto ? '🔐' : '💱'} {cur.code} — {cur.name}
          </span>
          <span style={{ color: '#b8ccdf' }}>{showCurrencyPicker ? '▲' : '▼'}</span>
        </button>

        {showCurrencyPicker && (
          <div
            className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden"
            style={{
              background: '#1a2236',
              border: '1.5px solid rgba(255,255,255,0.18)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              maxHeight: 280,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="p-2">
              <input
                autoFocus
                value={currencySearch}
                onChange={e => setCurrencySearch(e.target.value)}
                placeholder="Search currency or crypto…"
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
                    💱 Fiat Currencies
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
                    🔐 Cryptocurrency
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

      {/* ── Custom bet input ──────────────────────────────────────────── */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: '#b8ccdf' }}>
          Your Bet
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center flex-1 rounded-lg overflow-hidden"
            style={{ background: '#111827', border: '1.5px solid rgba(68,232,130,0.4)' }}
          >
            <span className="px-2 font-mono font-bold text-sm" style={{ color: '#44e882' }}>
              {cur.symbol}
            </span>
            <input
              ref={inputRef}
              type="number"
              value={activeBet}
              min="0"
              step={cur.isCrypto ? Math.pow(10, -dec) : 1}
              onChange={e => onCustomBetChange(parseFloat(e.target.value) || 0)}
              className="flex-1 py-2 text-sm font-mono font-bold bg-transparent outline-none"
              style={{ color: '#44e882', minWidth: 0 }}
            />
          </div>
          {/* Quick bet buttons */}
          {[0.5, 1, 2, 5].map(mult => (
            <button
              key={mult}
              onClick={() => onCustomBetChange(parseFloat((activeBet * mult).toFixed(dec)))}
              className="text-[10px] px-2 py-1.5 rounded-md font-semibold"
              style={{
                background: '#212d45',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#ccdaec',
              }}
            >
              ×{mult}
            </button>
          ))}
        </div>
        <div className="text-[10px] mt-1" style={{ color: '#b8ccdf' }}>
          Recommended: {cur.symbol}{fmtBet(betting.recommended_bet)} · {betting.units} unit{betting.units !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Hand modifier toggles ─────────────────────────────────────── */}
      {/* Doubled and Insurance toggles sit here so user sets them BEFORE
          the outcome resolves. Auto-resolve reads these values.
          State is lifted to App — changes call onIsDoubledChange /
          onTookInsuranceChange so HandDisplay can also read them. */}
      <div className="flex gap-2 mb-3">

        {/* Doubled toggle */}
        <button
          onClick={() => onIsDoubledChange(!isDoubled)}
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

        {/* Insurance toggle — only shown when dealer upcard is Ace */}
        {insurance?.available ? (
          <button
            onClick={() => onTookInsuranceChange(!tookInsurance)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: tookInsurance ? 'rgba(106,175,255,0.15)' : '#111827',
              border: `1.5px solid ${tookInsurance ? 'rgba(106,175,255,0.6)' : 'rgba(255,255,255,0.12)'}`,
              color: tookInsurance ? '#6aafff' : '#b8ccdf',
            }}
          >
            <span>🛡️</span>
            <span>{tookInsurance ? 'INSURED' : 'Took Insurance?'}</span>
          </button>
        ) : (
          /* Placeholder so layout doesn't jump */
          <div className="flex-1" />
        )}
      </div>

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
          Doubled down — effective bet: {cur.symbol}{fmtBet(effectiveBet)}
        </div>
      )}

      {/* Insurance stake reminder when toggled */}
      {tookInsurance && insurance?.available && (
        <div
          className="mb-3 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-center"
          style={{
            background: 'rgba(106,175,255,0.08)',
            border: '1px solid rgba(106,175,255,0.25)',
            color: '#6aafff',
          }}
        >
          Insurance stake: {cur.symbol}{fmtBet(activeBet * 0.5)} · pays {cur.symbol}{fmtBet(activeBet)} if dealer BJ
        </div>
      )}

      {/* Bet action label */}
      <div className="text-xs font-medium mb-3" style={{ color: '#ccdaec' }}>
        {betting.action || '—'}
      </div>

      {/* ── Kelly breakdown ───────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
        <KV
          label="Player Edge"
          value={`${adv >= 0 ? '+' : ''}${adv}%`}
          valueClass={adv > 0 ? 'text-jade' : 'text-ruby'}
        />
        <KV label="Kelly Bet"    value={`${cur.symbol}${fmtBet(betting.kelly_bet)}`} />
        <KV label="Spread Bet"   value={`${cur.symbol}${fmtBet(betting.spread_bet)}`} />
        <KV label="Bankroll"     value={`${cur.symbol}${Number(betting.bankroll || 0).toLocaleString()}`} />
        <KV label="Risk of Ruin" value={`${betting.risk_of_ruin}%`} />
      </div>

      {/* ── Manual result buttons ─────────────────────────────────────── */}
      {/* Still shown as override in case auto-resolve misfires or user
          wants to manually correct — e.g. surrender was taken mid-hand */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 10 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-widest font-display font-bold" style={{ color: '#ccdaec' }}>
            Manual override:
          </div>
          <div className="text-[9px]" style={{ color: '#ccdaec' }}>
            Auto-resolves when outcome is known
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { label: '🏆 WIN',     result: 'win',       color: '#44e882', bg: 'rgba(68,232,130,0.1)',  border: 'rgba(68,232,130,0.4)'  },
            { label: '🤝 PUSH',    result: 'push',      color: '#6aafff', bg: 'rgba(106,175,255,0.1)', border: 'rgba(106,175,255,0.4)' },
            { label: '💀 LOSS',    result: 'loss',      color: '#ff5c5c', bg: 'rgba(255,92,92,0.1)',   border: 'rgba(255,92,92,0.4)'   },
            { label: '🏳️ SURR',   result: 'surrender', color: '#ff9a20', bg: 'rgba(255,154,32,0.1)',  border: 'rgba(255,154,32,0.4)'  },
          ].map(({ label, result, color, bg, border }) => (
            <button
              key={result}
              onClick={() => {
                // Manual override — calculate profit based on result type
                let profit;
                if (result === 'win')       profit = effectiveBet;
                else if (result === 'push') profit = 0;
                else if (result === 'loss') profit = -effectiveBet;
                else if (result === 'surrender') profit = -(activeBet * 0.5); // late surrender: lose half
                // Add insurance adjustment if toggled
                if (tookInsurance && insurance?.available) {
                  const halfBet = activeBet * 0.5;
                  const dealerBj = dealerHand?.is_blackjack;
                  profit += dealerBj ? halfBet * 2 : -halfBet;
                }
                onRecordResult(result === 'surrender' ? 'loss' : result, effectiveBet, profit);
                // Toggles reset in App.handleRecordResult
              }}
              className="flex-1 rounded-lg py-2 text-[11px] font-mono font-bold transition-all"
              style={{ color, background: bg, border: `1.5px solid ${border}` }}
              onMouseEnter={e => { e.currentTarget.style.background = bg.replace('0.1', '0.2'); }}
              onMouseLeave={e => { e.currentTarget.style.background = bg; }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Bet preview */}
        <div className="mt-2 text-center text-[10px] font-mono" style={{ color: '#c8d4e8', lineHeight: 1.8 }}>
          <div>
            Base {cur.symbol}{fmtBet(activeBet)}
            {isDoubled && <span style={{ color: '#ffd447' }}> → doubled {cur.symbol}{fmtBet(effectiveBet)}</span>}
            {' '}· win = <span style={{ color: '#44e882' }}>+{cur.symbol}{fmtBet(effectiveBet)}</span>
          </div>
          <div>loss = <span style={{ color: '#ff5c5c' }}>-{cur.symbol}{fmtBet(effectiveBet)}</span></div>
        </div>
      </div>
    </Widget>
  );
}