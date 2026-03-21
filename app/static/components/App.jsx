/*
 * components/App.js — The Root Component
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BEGINNER GUIDE — What is a "root component"?
 * ─────────────────────────────────────────────
 * Think of App.js as the MANAGER of the entire dashboard.
 * It owns all the shared data (called "state") and passes pieces of
 * it down to child components that need it.
 *
 * The data flow looks like this:
 *
 *   Flask server  →  WebSocket  →  App.js  →  TopBar / ActionPanel / CardGrid…
 *       (Python)      (socket.io)  (owns state)   (just display the data)
 *
 * When the user clicks a card in CardGrid, the event bubbles UP to App.js,
 * which sends it to the server. The server responds with new game state,
 * which flows back DOWN to every display component. This one-way data flow
 * keeps everything predictable and easy to debug.
 *
 * KEY REACT CONCEPTS USED HERE:
 * ──────────────────────────────
 * useState    — stores data; changing it causes the UI to re-render
 * useEffect   — runs code at the right time (on mount, on value change)
 * useRef      — stores a value WITHOUT causing re-renders (socket, undo stack)
 * useCallback — memoises a function so child components don't re-render needlessly
 *
 * WHAT THIS FILE DOES:
 * ─────────────────────
 * 1. Opens a WebSocket connection to Flask and listens for game-state updates
 * 2. Owns all shared state (game data, deal target, scan mode, bet amounts)
 * 3. Defines handlers for every user action (deal card, new hand, shuffle, undo)
 * 4. Renders the three-column dashboard and passes props to each panel
 */

// ── Pull out the React hooks we need ──────────────────────────────────────────
// React is loaded globally from CDN in index.html, so we destructure here.
const { useState, useEffect, useRef, useCallback } = React;


// ══════════════════════════════════════════════════════════════════════════════
// APP — the one and only root component
// ══════════════════════════════════════════════════════════════════════════════

function App() {

  // ── STATE ──────────────────────────────────────────────────────────────────
  // useState(initialValue) returns [currentValue, setterFn].
  // Calling the setter causes React to re-render the component with the new value.

  // The full game-state object sent by Flask every time something changes.
  // null = not yet received (shows loading screen instead of the dashboard).
  const [gameState,  setGameState]  = useState(null)

  // Which hand the next card will go to: 'player', 'dealer', or 'seen'.
  // 'seen' = card is counted for the running count but NOT added to either
  //          displayed hand (useful for burn cards or mid-hand seen cards).
  const [dealTarget, setDealTarget] = useState('player')

  // The last server-recommended bet size — used to pre-fill the bet input.
  const [lastBet,    setLastBet]    = useState(10)

  // The bet the user has actually chosen (may differ from the recommendation).
  const [customBet,  setCustomBet]  = useState(10)

  // Currency display settings (symbol, code) — user can change in BettingPanel.
  const [currency, setCurrency] = useState({
    code: 'INR', symbol: '₹', name: 'Indian Rupee', isCrypto: false
  })

  // Whether the player doubled down this hand.
  // Lifted into App so HandDisplay can show a "DOUBLED" banner.
  const [isDoubled, setIsDoubled] = useState(false)

  // Whether the player took insurance this hand.
  // Lifted into App so HandDisplay can show the insurance settlement.
  const [tookInsurance, setTookInsurance] = useState(false)

  // Which card-entry mode is active (controls the Card Scanner panel):
  //   'manual'     → user clicks the 52-card grid
  //   'screenshot' → user pastes an OS screenshot, CV reads the cards
  //   'live'       → Flask server scans the screen automatically via mss
  const [scanMode, setScanMode] = useState('manual')


  // ── REFS ───────────────────────────────────────────────────────────────────
  // useRef stores a value that should NOT trigger re-renders when it changes.
  // Think of it as a "box" you can read/write at any time without React noticing.

  // The active Socket.IO connection to the Flask server.
  // We store it in a ref (not state) because swapping the socket object should
  // NOT cause a visual re-render — it's infrastructure, not display data.
  const socketRef = useRef(null)

  // A stack of every card dealt this hand, in order.
  // Used by the Undo feature: pop the last card and replay all the others.
  const undoStack = useRef([])

  // A ref that mirrors the dealTarget state value.
  // Why? Callbacks created with useCallback "close over" state values at
  // creation time. If dealTarget changes later the callback still sees the OLD
  // value (a stale closure). By reading the REF instead we always get current.
  const dealTargetRef = useRef('player')

  // Helper: update both state (re-render) AND the ref (stays always-current).
  const setTarget = (t) => { dealTargetRef.current = t; setDealTarget(t); }


  // ── WEBSOCKET SETUP ────────────────────────────────────────────────────────
  // useEffect with [] runs ONCE when the component first appears on screen.
  // The returned function is a "cleanup" — it runs on unmount (page close).
  useEffect(() => {
    // io() connects to the Socket.IO server (Flask) on the same origin.
    const socket = io()
    socketRef.current = socket   // save so all handlers can reach it

    // 'state_update' is the main data channel from the server.
    // It fires after every card dealt, every new hand, every shuffle, etc.
    socket.on('state_update', (data) => {
      setGameState(data)

      // Auto-update the recommended bet if the user hasn't overridden it.
      if (data.betting) {
        setLastBet(data.betting.recommended_bet || 10)
        setCustomBet(prev =>
          // Only auto-update if user is still following the recommendation
          prev === lastBet
            ? (data.betting.recommended_bet || 10)
            : prev
        )
      }
    })

    // 'notification' = informational toasts (e.g. "Shuffled! Count reset.")
    socket.on('notification', (data) => showToast(data.message, data.type || 'info'))

    // 'error' = server ran into a problem processing a card
    socket.on('error', (data) => showToast(data.message, 'error'))

    // Cleanup: disconnect when App unmounts (e.g. page close or hot-reload)
    return () => socket.disconnect()
  }, [])   // empty [] = run once only, on first mount


  // ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────
  // This effect adds keyboard listeners. It re-runs when lastBet changes
  // so the handler captures the latest bet value (avoiding stale closure).
  useEffect(() => {
    const handler = (e) => {
      // Ignore keystrokes while typing in input or select elements
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return

      if (e.key === 'n' || e.key === 'N') handleNewHand()      // N = new hand
      if (e.key === 's' || e.key === 'S') handleShuffle()      // S = reshuffle
      if (e.key === 'p' || e.key === 'P') setTarget('player')  // P = deal to player
      if (e.key === 'd' || e.key === 'D') setTarget('dealer')  // D = deal to dealer
    }
    window.addEventListener('keydown', handler)
    // Cleanup removes the listener before attaching the new one on next render
    return () => window.removeEventListener('keydown', handler)
  }, [lastBet])


  // ── HANDLERS ───────────────────────────────────────────────────────────────
  // useCallback memoises these functions — they keep the same reference between
  // renders unless their listed dependencies change. This prevents child
  // components from re-rendering just because App re-rendered.

  /**
   * handleDealCard — submit a single card to the server.
   *
   * Called by:
   *   • CardGrid (user clicks a card button)
   *   • ScreenshotMode (CV applies a detected card)
   *   • LiveMode (server pushes a detected card via WebSocket)
   *
   * targetOverride lets CV modes specify per-card routing ('player' / 'dealer' /
   * 'seen') instead of using the global dealTarget toggle.
   */
  const handleDealCard = useCallback((rank, suit, targetOverride) => {
    // Read ref for current target — avoids stale-closure bug
    const target = targetOverride || dealTargetRef.current
    // Save to undo stack for potential replay
    undoStack.current.push({ rank, suit, target })
    // Send to server — server counts the card, updates strategy, emits state_update
    socketRef.current?.emit('deal_card', { rank, suit, target })
  }, [])   // no deps — reads only refs, not state


  /**
   * handleNewHand — clear hands and start a fresh round.
   *
   * IMPORTANT: this does NOT reset the count!
   * The running count accumulates across ALL hands within the same shoe.
   * Only a real casino reshuffle should reset the count (see handleShuffle).
   */
  const handleSplit = useCallback(() => {
    // Emit split event to server — server creates two hands
    socketRef.current?.emit('player_split')
  }, [])

  const handleNextSplitHand = useCallback(() => {
    socketRef.current?.emit('next_split_hand')
  }, [])

  const handleNewHand = useCallback(() => {
    undoStack.current = []           // clear undo stack — new hand, fresh start
    dealTargetRef.current = 'player' // every new hand starts by dealing to player
    setDealTarget('player')
    socketRef.current?.emit('new_hand')   // server clears player and dealer hands
    showToast('New hand — count continues', 'info')
  }, [])


  /**
   * handleShuffle — reset count and shoe tracking.
   *
   * Call this ONLY when the casino dealer physically reshuffles the cards.
   * This wipes the running count back to zero and resets shoe penetration.
   * Calling it between normal hands is wrong — you would lose your count!
   */
  const handleShuffle = useCallback(() => {
    // Read the shuffle type dropdown (riffle / strip / machine etc.)
    const shuffleType = document.getElementById('shuffle-type')?.value || 'machine'
    undoStack.current = []
    socketRef.current?.emit('shuffle', { type: shuffleType })
  }, [])


  /**
   * handleChangeSystem — switch active card-counting system.
   * Options: 'hi_lo', 'ko', 'omega_ii', 'zen'
   * The server recalculates from the same cards-seen history.
   */
  const handleChangeSystem = useCallback((system) => {
    socketRef.current?.emit('change_system', { system })
    showToast(`Switched to ${system.replace('_', '-').toUpperCase()}`, 'info')
  }, [])


  /**
   * handleRecordResult — log the financial outcome of a completed hand.
   *
   * Parameters:
   *   result        'win' | 'loss' | 'push'
   *   bet           the amount wagered
   *   precalcProfit (optional) pre-calculated profit from BettingPanel
   *
   * precalcProfit is provided by BettingPanel's auto-resolve buttons.
   * It correctly accounts for:
   *   • Doubled bet (stake is 2×)
   *   • Blackjack 3:2 payout (+1.5× instead of +1×)
   *   • Insurance settlement (2:1 on half the bet if dealer has BJ)
   *   • Surrender (lose only half the bet)
   *
   * Without precalcProfit we fall back to a simpler +bet / -bet / 0 calc,
   * which is fine for keyboard shortcuts but imprecise for edge cases.
   */
  const handleRecordResult = useCallback((result, bet, precalcProfit) => {
    const profit = precalcProfit !== undefined
      ? precalcProfit                     // BettingPanel's accurate figure
      : result === 'win'  ?  bet          // simple fallback
      : result === 'loss' ? -bet
      : 0

    socketRef.current?.emit('record_result', { bet, profit })  // update bankroll on server
    socketRef.current?.emit('new_hand')                         // clear hands for next round

    undoStack.current = []
    dealTargetRef.current = 'player'
    setDealTarget('player')

    // Reset per-hand flags so the next hand starts clean
    setIsDoubled(false)
    setTookInsurance(false)

    // Show a result toast (green for win, red for loss, grey for push)
    showToast(
      `${result.toUpperCase()} — ${formatMoney(profit)}`,
      result === 'win' ? 'success' : result === 'loss' ? 'error' : 'info'
    )
  }, [])


  /**
   * handleUndo — remove the last card dealt this hand.
   *
   * Why we replay instead of just "un-emitting" one card:
   * The server's state (running count, shoe composition, hand totals) is the
   * accumulated result of all cards seen IN ORDER. There is no "subtract one
   * card" operation — we have to reset to zero and replay from scratch.
   *
   * Steps:
   *   1. Save all cards except the last one
   *   2. Tell server 'new_hand' to wipe current state
   *   3. Re-emit the saved cards with small delays (server needs to process in order)
   */
  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) {
      showToast('Nothing to undo', 'warning')
      return
    }
    const replay  = [...undoStack.current.slice(0, -1)]                         // all but last
    const removed = undoStack.current[undoStack.current.length - 1]              // the removed card

    undoStack.current = []
    dealTargetRef.current = 'player'
    setDealTarget('player')
    socketRef.current?.emit('new_hand')   // wipe server state

    // Re-emit all saved cards in order, with 80ms gaps so the server
    // has time to process each one before the next arrives.
    replay.forEach((c, i) => {
      setTimeout(() => {
        undoStack.current.push(c)
        socketRef.current?.emit('deal_card', { rank: c.rank, suit: c.suit, target: c.target })
      }, 80 * i + 120)   // 120ms head start, then 80ms between cards
    })

    showToast(`Undid ${removed.rank} → ${removed.target}`, 'info')
  }, [])


  // ── DERIVED STATE ──────────────────────────────────────────────────────────
  // Destructure named sub-sections from gameState for cleaner prop passing.
  // Optional chaining (?.) safely returns undefined when gameState is null,
  // so we never crash while waiting for the first server update.

  const count      = gameState?.count            // running/true count, advantage
  const shoe       = gameState?.shoe             // cards remaining, decks left
  const rec        = gameState?.recommendation   // AI action recommendation
  const betting    = gameState?.betting          // bet size, Kelly, risk of ruin
  const sideBets   = gameState?.side_bets        // Perfect Pairs / 21+3 / Lucky Ladies
  const tracker    = gameState?.shuffle_tracker  // ML shuffle-tracking state
  const session    = gameState?.session          // win rate, profit, hands played
  const playerHand = gameState?.player_hand      // player's cards + total + flags
  const dealerUp   = gameState?.dealer_upcard    // dealer's face-up card (string)
  const dealerHand = gameState?.dealer_hand      // full dealer hand (all cards)
  const history        = gameState?.count_history       // last 60 count snapshots
  const sideCounts     = gameState?.side_counts         // ace + ten side count state
  const casinoRisk     = gameState?.casino_risk         // counter detection risk meter
  const splitHands     = gameState?.split_hands    ?? []// split hand array
  const activeHandIdx  = gameState?.active_hand_index ?? 0

  // Insurance is a core game mechanic (not a side bet) — it's its own key.
  // It's only populated when the dealer's upcard is an Ace.
  const insurance = gameState?.insurance


  // ── DEALER DRAW DETECTION (S17 rule) ──────────────────────────────────────
  // S17 = "dealer Stands on all 17s" — the standard rule.
  // The dealer MUST draw on 16 or less, and MUST stand on 17 or more.
  //
  // We detect this so the UI can automatically switch the deal target to
  // 'dealer' when it's the dealer's turn, saving the user a button click.
  //
  // We prefer the server's authoritative `must_draw` flag when available.
  // If it hasn't arrived yet, we compute it locally as a fallback.

  const dealerMustDraw = !!(dealerHand && (
    dealerHand.must_draw !== undefined
      ? dealerHand.must_draw              // server says so (authoritative)
      : (dealerHand.card_count >= 2       // has at least 2 cards
         && !dealerHand.is_bust           // not already bust
         && !dealerHand.is_blackjack      // not blackjack
         && dealerHand.value < 17)        // under 17: must hit
  ))

  const dealerStandsFlag = !!(dealerHand && (
    dealerHand.dealer_stands !== undefined
      ? dealerHand.dealer_stands
      : (dealerHand.card_count >= 2
         && !dealerHand.is_bust
         && dealerHand.value >= 17)       // 17 or more: must stand
  ))

  // Auto-switch deal target to 'dealer' whenever it's the dealer's turn
  useEffect(() => {
    if (dealerMustDraw) setTarget('dealer')
  }, [dealerMustDraw])


  // ── LOADING SCREEN ─────────────────────────────────────────────────────────
  // gameState stays null until the first WebSocket update arrives.
  // Show a simple loading screen instead of a broken/empty dashboard.
  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: '#0a0e18' }}>
        <div className="text-center">
          <div className="text-6xl mb-5 font-display font-extrabold"
            style={{ color: '#ffd447', filter: 'drop-shadow(0 0 20px rgba(255,212,71,0.6))' }}>
            ♠
          </div>
          <div className="text-base font-semibold mb-2" style={{ color: '#ccdaec' }}>
            Connecting to BlackjackML server…
          </div>
          <div className="text-xs" style={{ color: '#b8ccdf' }}>
            Make sure{' '}
            <code style={{ background:'#1a2236', padding:'2px 6px', borderRadius:4, color:'#ffd447' }}>
              python main.py web
            </code>
            {' '}is running
          </div>
        </div>
      </div>
    )
  }


  // ── RENDER ─────────────────────────────────────────────────────────────────
  // JSX looks like HTML but compiles to JavaScript function calls.
  // Rules:
  //   • Use className instead of class (class is reserved in JS)
  //   • Curly braces {} inject any JavaScript expression
  //   • Self-closing tags need a slash: <Component />
  //   • Comments inside JSX use {/* ... */}
  return (
    <div className="min-h-screen font-body" style={{ background: '#0a0e18', color: '#f0f4ff' }}>

      {/* ── TOP BAR ───────────────────────────────────────────────────────
          Sticky header showing running count, true count, deal target toggle,
          new hand / shuffle buttons, and counting system selector. */}
      <TopBar
        count={count}
        onNewHand={handleNewHand}
        onShuffle={handleShuffle}
        onChangeSystem={handleChangeSystem}
      />

      {/* ── THREE-COLUMN GRID ─────────────────────────────────────────────
          Layout: fixed 280px left | flexible center | fixed 280px right
          gap:10px between columns, 10px outer padding */}
      <div className="dashboard-grid" style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 280px',
        gap: 10, padding: 10, alignItems: 'start',
      }}>

        {/* ── LEFT COLUMN ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">

          {/* AI action recommendation */}
          <ActionPanel recommendation={rec} count={count} />

          {/* Bet sizing — Kelly criterion, custom bet, auto-resolve */}
          <BettingPanel
            betting={betting}
            count={count}
            lastBet={lastBet}
            onRecordResult={handleRecordResult}
            currency={currency}
            onCurrencyChange={setCurrency}
            customBet={customBet}
            onCustomBetChange={setCustomBet}
            playerHand={playerHand}
            dealerHand={dealerHand}
            insurance={insurance}
            isDoubled={isDoubled}
            onIsDoubledChange={setIsDoubled}
            tookInsurance={tookInsurance}
            onTookInsuranceChange={setTookInsurance}
          />

          {/* Basic strategy grid */}
          <StrategyRefTable playerHand={playerHand} dealerUpcard={dealerUp} />

        </div>


        {/* ── CENTER COLUMN ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">

          {/* Hand display */}
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
            currency={currency}
          />

          {/* Split hand panel — shown only when player has split */}
          {splitHands && splitHands.length > 0 && (
            <SplitHandPanel
              splitHands={splitHands}
              activeHandIndex={activeHandIdx}
              dealerUpcard={dealerUp}
              socket={socketRef.current}
              onNextHand={() => {}}
            />
          )}

          {/* Card entry grid */}
          <CardGrid
            target={dealTarget}
            onTargetChange={setTarget}
            remainingByRank={shoe?.remaining_by_rank}
            onDealCard={handleDealCard}
            onUndo={handleUndo}
            onSplit={handleSplit}
            canSplit={!!(playerHand?.can_split && splitHands.length === 0)}
            dealerMustDraw={dealerMustDraw}
            dealerStands={dealerStandsFlag}
          />

          {/* Compact info strip — now includes side counts + casino risk */}
          <CenterToolbar
            recommendation={rec}
            count={count}
            playerHand={playerHand}
            dealerUpcard={dealerUp}
            betting={betting}
            history={history}
            session={session}
            currency={currency}
            sideCounts={sideCounts}
            casinoRisk={casinoRisk}
          />

          {/* ── Center data grid — fills empty space below cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Side Bet EV + Session Stats side by side, equal height */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, alignItems:'stretch' }}>
              <SideBetPanel sideBets={sideBets} />
              <SessionStats session={session} currency={currency} />
            </div>

            {/* Count history sparkline */}
            <CountHistoryPanel history={history} />

          </div>
        </div>


        {/* ── RIGHT COLUMN ──────────────────────────────────────────────── */}
        <div className="panel-right flex flex-col gap-2.5">

          {/* Card scanner — Manual / Screenshot / Live Scan */}
          <LiveOverlayPanel
            socket={socketRef.current}
            count={gameState?.count}
            scanMode={scanMode}
            onSetMode={setScanMode}
            onDealCard={handleDealCard}
            dealTarget={dealTarget}
          />

          {/* Shoe composition */}
          <ShoePanel shoe={shoe} />

          {/* Edge meter */}
          <EdgeMeter count={count} />

          {/* Illustrious 18 + Fab 4 */}
          <I18Panel count={count} />

          {/* ML shuffle tracker */}
          <ShuffleTrackerPanel tracker={tracker} />

          {/* Ace + Ten side count — Ace-adjusted TC for bet sizing */}
          <SideCountPanel sideCounts={sideCounts} count={count} />

          {/* Casino counter detection risk meter */}
          <CasinoRiskMeter casinoRisk={casinoRisk} />

          {/* Stop-loss / stop-win alerts with audio */}
          <StopAlerts session={session} currency={currency} />
        </div>

      </div>

      {/* Keyboard shortcut reminder at the bottom of the page */}
      <div className="shortcut-hint">
        <kbd>N</kbd> <span>New Hand</span>
        <span className="sep">·</span>
        <kbd>S</kbd> <span>Real Shuffle</span>
        <span className="sep">·</span>
        <kbd>P</kbd> <span>Player</span>
        <span className="sep">·</span>
        <kbd>D</kbd> <span>Dealer</span>
      </div>
    </div>
  )
}

// ── Mount the App ──────────────────────────────────────────────────────────────
// ReactDOM.createRoot() takes the <div id="root"> from index.html and hands
// control of it to React. From this point React manages all DOM updates
// efficiently using its virtual DOM diffing algorithm — we never touch
// the DOM directly.
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)