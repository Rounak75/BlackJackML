/*
 * components/App.js
 * ─────────────────────────────────────────────────────────
 * Root component. Owns all state, manages WebSocket, renders layout.
 *
 * KEY FIXES in this version:
 * ───────────────────────────
 * 1. handleRecordResult no longer calls handleShuffle after recording.
 *    Previously it called:  socketRef.current?.emit('new_hand')
 *    AND the old code path was incorrectly emitting shuffle events
 *    between hands, which reset the count every round.
 *    NOW: record_result → new_hand only. Shuffle = separate button.
 *
 * 2. dealerHand prop passed to HandDisplay so all dealer cards show,
 *    not just the upcard.
 *
 * 3. insurance extracted from gameState and passed to HandDisplay as a
 *    separate prop — insurance is a game mechanic, not a side bet.
 *    It only appears when dealer upcard is an Ace.
 *
 * 4. handleRecordResult updated to accept a pre-calculated profit value
 *    from BettingPanel's auto-resolve logic. When profit is passed in,
 *    it is used directly instead of being recalculated here. This allows
 *    BettingPanel to handle 3:2 BJ payouts, doubled bets, insurance
 *    settlement, and surrender correctly without App needing to know.
 *
 * 5. playerHand, dealerHand, and insurance passed to BettingPanel so
 *    it can run auto-resolve logic when outcome becomes deterministic.
 *
 * 6. isDoubled and tookInsurance lifted from BettingPanel into App state
 *    so HandDisplay can read them for the outcome banner and insurance UI.
 *    Both are reset in handleRecordResult after each hand.
 */

const { useState, useEffect, useRef, useCallback } = React;

function App() {
  const [gameState,  setGameState]  = useState(null)
  const [dealTarget, setDealTarget] = useState('player')
  // Sync helper — always call this instead of bare setDealTarget so the ref stays current
  const setTarget = (t) => { dealTargetRef.current = t; setDealTarget(t); }
  const [lastBet,    setLastBet]    = useState(10)
  const [customBet,  setCustomBet]  = useState(10)
  const [currency,   setCurrency]   = useState({ code: 'USD', symbol: '$', name: 'US Dollar', isCrypto: false })

  // Lifted from BettingPanel so HandDisplay can read them
  const [isDoubled,     setIsDoubled]     = useState(false)
  const [tookInsurance, setTookInsurance] = useState(false)

  const socketRef      = useRef(null)
  const undoStack      = useRef([])
  const dealTargetRef  = useRef('player')  // mirrors dealTarget for sync reads in callbacks

  // ── WebSocket ──────────────────────────────────────────
  useEffect(() => {
    const socket = io()
    socketRef.current = socket

    socket.on('state_update', (data) => {
      setGameState(data)
      if (data.betting) {
        setLastBet(data.betting.recommended_bet || 10)
        // Only auto-update customBet if user hasn't manually set it yet
        setCustomBet(prev => prev === lastBet ? (data.betting.recommended_bet || 10) : prev)
      }
    })

    socket.on('notification', (data) => showToast(data.message, data.type || 'info'))
    socket.on('error',        (data) => showToast(data.message, 'error'))

    return () => socket.disconnect()
  }, [])

  // ── Keyboard shortcuts ─────────────────────────────────
  // Note: keyboard shortcuts 1/2/3 use simple profit calc (no doubled/insurance).
  // For accurate auto-resolved results, rely on BettingPanel's auto-resolve.
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.key === 'n' || e.key === 'N') handleNewHand()
      if (e.key === 's' || e.key === 'S') handleShuffle()
      if (e.key === 'p' || e.key === 'P') setTarget('player')
      if (e.key === 'd' || e.key === 'D') setTarget('dealer')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lastBet])

  // ── Handlers ───────────────────────────────────────────

  const handleDealCard = useCallback((rank, suit) => {
    const target = dealTargetRef.current   // always current — no stale closure
    undoStack.current.push({ rank, suit, target })
    socketRef.current?.emit('deal_card', { rank, suit, target })
  }, [])  // no dependency needed — reads ref synchronously

  const handleNewHand = useCallback(() => {
    undoStack.current = []
    dealTargetRef.current = 'player'   // reset synchronously — new hand always starts on player
    setDealTarget('player')
    socketRef.current?.emit('new_hand')
    // NOTE: no shuffle emitted here — count persists across hands
    showToast('New hand — count continues', 'info')
  }, [])

  const handleShuffle = useCallback(() => {
    // Only call this when the casino dealer physically reshuffles the shoe
    const shuffleType = document.getElementById('shuffle-type')?.value || 'machine'
    undoStack.current = []
    socketRef.current?.emit('shuffle', { type: shuffleType })
  }, [])

  const handleChangeSystem = useCallback((system) => {
    socketRef.current?.emit('change_system', { system })
    showToast(`Switched to ${system.replace('_', '-').toUpperCase()}`, 'info')
  }, [])

  const handleRecordResult = useCallback((result, bet, precalcProfit) => {
    // precalcProfit is passed by BettingPanel's auto-resolve and manual override
    // buttons — it already accounts for: doubled bet, 3:2 BJ payout, insurance
    // settlement, and surrender half-loss. When provided, use it directly.
    // Fallback: simple win/push/loss calc for keyboard shortcuts.
    const profit = precalcProfit !== undefined
      ? precalcProfit
      : (result === 'win' ? bet : result === 'loss' ? -bet : 0)

    // Record the result financially
    socketRef.current?.emit('record_result', { bet, profit })
    // Then start a fresh hand — count is NOT reset
    socketRef.current?.emit('new_hand')
    undoStack.current = []
    dealTargetRef.current = 'player'   // reset synchronously for next hand
    setDealTarget('player')
    // Reset hand modifier toggles for the next hand
    setIsDoubled(false)
    setTookInsurance(false)
    showToast(
      `${result.toUpperCase()} — ${formatMoney(profit)}`,
      result === 'win' ? 'success' : result === 'loss' ? 'error' : 'info'
    )
  }, [])

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) { showToast('Nothing to undo', 'warning'); return }
    const replay  = [...undoStack.current.slice(0, -1)]
    const removed = undoStack.current[undoStack.current.length - 1]
    undoStack.current = []
    dealTargetRef.current = 'player'
    setDealTarget('player')
    socketRef.current?.emit('new_hand')
    replay.forEach((c, i) => {
      setTimeout(() => {
        undoStack.current.push(c)
        socketRef.current?.emit('deal_card', { rank: c.rank, suit: c.suit, target: c.target })
      }, 80 * i + 120)
    })
    showToast(`Undid ${removed.rank} → ${removed.target}`, 'info')
  }, [])

  // ── Sub-state ──────────────────────────────────────────
  const count      = gameState?.count
  const shoe       = gameState?.shoe
  const rec        = gameState?.recommendation
  const betting    = gameState?.betting
  const sideBets   = gameState?.side_bets
  const tracker    = gameState?.shuffle_tracker
  const session    = gameState?.session
  const playerHand = gameState?.player_hand
  const dealerUp   = gameState?.dealer_upcard
  const dealerHand = gameState?.dealer_hand   // ← full dealer hand (all cards)
  const history    = gameState?.count_history
  // Insurance is a game mechanic, not a side bet — extracted separately.
  // Only available when dealer upcard is an Ace. Settled before main bet.
  const insurance  = gameState?.insurance

  // ── Auto-switch target when dealer must draw (S17 rules) ──────────────────
  // Use server-authoritative must_draw flag (S17: stand on all 17s)
  // Falls back to frontend computation if server hasn't sent the flag yet
  const dealerMustDraw = !!(
    dealerHand && (
      dealerHand.must_draw !== undefined
        ? dealerHand.must_draw   // server-computed (authoritative)
        : (dealerHand.card_count >= 2 && !dealerHand.is_bust &&
           !dealerHand.is_blackjack && dealerHand.value < 17)
    )
  )
  const dealerStandsFlag = !!(dealerHand && (
    dealerHand.dealer_stands !== undefined
      ? dealerHand.dealer_stands
      : (dealerHand.card_count >= 2 && !dealerHand.is_bust && dealerHand.value >= 17)
  ))

  // Auto-switch TO dealer when dealer must draw
  useEffect(() => {
    if (dealerMustDraw) setTarget('dealer')
  }, [dealerMustDraw])

  // ── Loading ────────────────────────────────────────────
  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0e18' }}>
        <div className="text-center">
          <div className="text-6xl mb-5 font-display font-extrabold"
            style={{ color: '#ffd447', filter: 'drop-shadow(0 0 20px rgba(255,212,71,0.6))' }}>
            ♠
          </div>
          <div className="text-base font-semibold mb-2" style={{ color: '#b0bfd8' }}>
            Connecting to BlackjackML server…
          </div>
          <div className="text-xs" style={{ color: '#7a8eab' }}>
            Make sure <code style={{ background:'#1a2236', padding:'2px 6px', borderRadius:4, color:'#ffd447' }}>python main.py web</code> is running
          </div>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="min-h-screen font-body" style={{ background: '#0a0e18', color: '#f0f4ff' }}>

      <TopBar
        count={count}
        onNewHand={handleNewHand}
        onShuffle={handleShuffle}
        onChangeSystem={handleChangeSystem}
      />

      <div className="dashboard-grid" style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 280px',
        gap: 10, padding: 10, alignItems: 'start',
      }}>

        {/* LEFT */}
        <div className="flex flex-col gap-2.5">
          <ActionPanel recommendation={rec} count={count} />
          <BettingPanel
            betting={betting}
            count={count}
            lastBet={lastBet}
            onRecordResult={handleRecordResult}
            currency={currency}
            onCurrencyChange={setCurrency}
            customBet={customBet}
            onCustomBetChange={setCustomBet}
            // Passed for auto-resolve and insurance settlement
            playerHand={playerHand}
            dealerHand={dealerHand}
            insurance={insurance}
            // Lifted toggle state — BettingPanel drives, App owns
            isDoubled={isDoubled}
            onIsDoubledChange={setIsDoubled}
            tookInsurance={tookInsurance}
            onTookInsuranceChange={setTookInsurance}
          />
          <SideBetPanel sideBets={sideBets} />
          <StrategyRefTable playerHand={playerHand} dealerUpcard={dealerUp} />
        </div>

        {/* CENTER */}
        <div className="flex flex-col gap-2.5">
          {/* Updated: pass dealerHand for full multi-card display.
              insurance passed separately — it is not a side bet.
              isDoubled, tookInsurance, activeBet passed from lifted state
              so HandDisplay can show the outcome banner and insurance UI. */}
          <HandDisplay
            playerHand={playerHand}
            dealerUpcard={dealerUp}
            dealerHand={dealerHand}
            dealerMustDraw={dealerMustDraw}
            sideBets={sideBets}
            insurance={insurance}
            isDoubled={isDoubled}
            tookInsurance={tookInsurance}
            activeBet={customBet}
          />
          <CardGrid
            target={dealTarget}
            onTargetChange={setTarget}
            remainingByRank={shoe?.remaining_by_rank}
            onDealCard={handleDealCard}
            onUndo={handleUndo}
            dealerMustDraw={dealerMustDraw}
            dealerStands={dealerStandsFlag}
          />
        </div>

        {/* RIGHT */}
        <div className="panel-right flex flex-col gap-2.5">
          <ShoePanel shoe={shoe} />
          <EdgeMeter count={count} />
          <SessionStats session={session} currency={currency} />
          <ShuffleTrackerPanel tracker={tracker} />
          <CountHistoryPanel history={history} />
          <I18Panel count={count} />
        </div>
      </div>

      <div className="shortcut-hint">
        <kbd>N</kbd> New Hand &nbsp;·&nbsp;
        <kbd>S</kbd> Real Shuffle &nbsp;·&nbsp;
        <kbd>P</kbd> → Player &nbsp;·&nbsp;
        <kbd>D</kbd> → Dealer
      </div>
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)