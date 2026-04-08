// @ts-nocheck
/*
 * components/App.js — The Root Component
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * UX AUDIT OVERHAUL:
 *   Issue #1  — ActionPanel moved to center column top (already done)
 *   Issue #3  — Right column: Tier 1 (always visible) + Tier 2 (accordion)
 *   Issue #4  — CenterToolbar stripped to unique data only
 *   Issue #5  — scanMode passed to CardGrid for collapse logic
 *   Issue #8  — CompDepAlert removed as standalone; inline in ActionPanel
 *   Issue #9  — StrategyRefTable moved to right column Tier 2 accordion
 *   Issue #10 — SessionStats + SideBetPanel moved to right column
 *   Issue #11 — CountHistoryPanel moved to right column Tier 2
 *   Issue #12 — TopBar receives currentAction for action stripe
 *   NEW       — Status bar at bottom (trading-style)
 *   NEW       — Grid narrowed: 260px | 1fr | 260px
 */

const { useState, useEffect, useRef, useCallback } = React;
// ErrorBoundary is now DebugErrorBoundary — defined in DebugLayer.js
// (includes safe mode, recovery button, copy-to-clipboard, and debug logging)

// ══════════════════════════════════════════════════════════════════════════════
// APP — the one and only root component
// ══════════════════════════════════════════════════════════════════════════════

function App() {

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [gameState,  setGameState]  = useState(null)
  const [dealTarget, setDealTarget] = useState('player')
  const [lastBet,    setLastBet]    = useState(10)
  const [customBet,  setCustomBet]  = useState(10)
  const [currency, setCurrency] = useState({
    code: 'INR', symbol: '₹', name: 'Indian Rupee', isCrypto: false
  })
  const [isDoubled, setIsDoubled] = useState(false)
  const [tookInsurance, setTookInsurance] = useState(false)
  const [scanMode, setScanMode] = useState('manual')

  // Deal-Order Engine state
  const [dealOrderEnabled, setDealOrderEnabled] = useState(true)

  // ── INPUT MODE ─────────────────────────────────────────────────────────────
  // 'deal_engine' → cards go ONLY to seats + count + shoe (not player/dealer hands)
  // 'manual'      → cards go ONLY to player/dealer hands (deal engine bypassed)
  // Derived: mode follows whether the Deal Engine is enabled.
  // Use this everywhere a card decision needs to be routed.
  const inputMode = dealOrderEnabled ? 'deal_engine' : 'manual'

  // Feature state
  const [zoneConfig, setZoneConfig] = useState({ player_end: 0.33, dealer_end: 0.66 })
  const [seenCards, setSeenCards] = useState([])
  const [confirmationMode, setConfirmationMode] = useState(false)
  const [pendingCards, setPendingCards]         = useState([])
  const [wongingData, setWongingData] = useState(null)

  // Status bar — last update timestamp
  const [lastUpdateTime, setLastUpdateTime] = useState(null)

  // ── REFS ───────────────────────────────────────────────────────────────────
  const socketRef = useRef(null)
  const undoStack = useRef([])
  const dealTargetRef = useRef('player')
  const gameStateRef = useRef(null)
  const dealOrderRef = useRef(null)

  const setTarget = (t) => { dealTargetRef.current = t; setDealTarget(t); }


  // ── WEBSOCKET SETUP ────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io()
    // §3 Debug: wrap socket for network event logging
    if (typeof DebugNet !== 'undefined') DebugNet.wrapEmit(socket)
    socketRef.current = socket

    socket.on('state_update', (data) => {
      // §3 Debug: log incoming state update
      if (typeof DebugNet !== 'undefined') DebugNet.logReceive('state_update', data)
      // §4 Debug: track state diff
      if (typeof DebugState !== 'undefined') DebugState.trackUpdate('state_update', data)
      // §5 Debug: track ML decision
      if (typeof DebugML !== 'undefined' && data.recommendation) {
        DebugML.trackDecision(data.recommendation, data.count, data.player_hand, data.dealer_upcard)
      }

      setGameState(data)
      gameStateRef.current = data
      setLastUpdateTime(Date.now())

      if (data.betting) {
        setLastBet(data.betting.recommended_bet || 10)
        setCustomBet(prev =>
          prev === lastBet
            ? (data.betting.recommended_bet || 10)
            : prev
        )
      }

      if (data.zone_config) setZoneConfig(data.zone_config)
      if (data.seen_cards_this_hand !== undefined) setSeenCards(data.seen_cards_this_hand)
      if (data.confirmation_mode !== undefined) setConfirmationMode(data.confirmation_mode)
      if (data.wonging) setWongingData(data.wonging)
    })

    socket.on('notification', (data) => {
      if (typeof DebugNet !== 'undefined') DebugNet.logReceive('notification', data)
      showToast(data.message, data.type || 'info')
    })
    socket.on('error', (data) => {
      if (typeof DebugNet !== 'undefined') DebugNet.logError('error', data)
      showToast(data.message, 'error')
    })
    socket.on('pending_cards_update', (data) => setPendingCards(data.pending || []))

    // §3 Debug: listen for backend debug_log events
    socket.on('debug_log', (data) => {
      if (typeof DebugController !== 'undefined' && DebugController.isActive()) {
        DebugController.log(data.cat || 'GENERAL', 3, '[SRV] ' + (data.msg || ''), data.data || null)
      }
    })

    return () => socket.disconnect()
  }, [])


  // ── HANDLERS ───────────────────────────────────────────────────────────────
  const handleDealCard = useCallback((rank, suit, targetOverride) => {
    const target = targetOverride || dealTargetRef.current
    undoStack.current.push({ rank, suit, target })
    // §2 Debug: track card deal action
    if (typeof DebugUI !== 'undefined') DebugUI.trackClick('DEAL_CARD', { rank, suit, target })
    socketRef.current?.emit('deal_card', { rank, suit, target })
  }, [])

  // Wrapped handler: routes cards based on inputMode
  // ─────────────────────────────────────────────────────────────────────────
  // ISOLATION CONTRACT:
  //   deal_engine mode → emit target='seen' (count + shoe only, NO hand update)
  //                       then record into DealOrderEngine seat tracker
  //   manual mode      → emit with real target (player/dealer/seen)
  //                       DealOrderEngine is NOT notified (it is disabled)
  // ─────────────────────────────────────────────────────────────────────────
  const handleDealCardWrapped = useCallback((rank, suit, targetOverride) => {
    if (dealOrderEnabled) {
      // DEAL ENGINE MODE: count the card but do NOT touch player/dealer hands
      handleDealCard(rank, suit, 'seen')
      if (dealOrderRef.current) {
        dealOrderRef.current.recordCard(rank, suit, targetOverride || dealTargetRef.current)
      }
    } else {
      // MANUAL MODE: normal routing to player/dealer/seen — no seat tracking
      handleDealCard(rank, suit, targetOverride)
    }
  }, [handleDealCard, dealOrderEnabled])

  const handleSplit = useCallback(() => {
    undoStack.current.push({ type: 'split' })
    socketRef.current?.emit('player_split')
  }, [])

  const handleNextSplitHand = useCallback(() => {
    socketRef.current?.emit('next_split_hand')
  }, [])

  const handleNewHand = useCallback(() => {
    undoStack.current = []
    dealTargetRef.current = 'player'
    setDealTarget('player')
    // §2 Debug: track new hand action
    if (typeof DebugUI !== 'undefined') DebugUI.trackClick('NEW_HAND')
    socketRef.current?.emit('new_hand')
    showToast('New hand — count continues', 'info')
    // Notify deal-order engine
    if (dealOrderRef.current) dealOrderRef.current.resetForNewHand()
  }, [])

  const handleShuffle = useCallback(() => {
    const shuffleType = document.getElementById('shuffle-type')?.value || 'machine'
    undoStack.current = []
    // §2 Debug: track shuffle action
    if (typeof DebugUI !== 'undefined') DebugUI.trackClick('SHUFFLE', { type: shuffleType })
    socketRef.current?.emit('shuffle', { type: shuffleType })
    // Notify deal-order engine — full reset on shuffle
    if (dealOrderRef.current) dealOrderRef.current.resetForShuffle()
  }, [])

  const handleChangeSystem = useCallback((system) => {
    socketRef.current?.emit('change_system', { system })
    showToast(`Switched to ${system.replace('_', '-').toUpperCase()}`, 'info')
  }, [])

  const handleRecordResult = useCallback((result, bet, precalcProfit) => {
    const profit = precalcProfit !== undefined
      ? precalcProfit
      : result === 'win'  ?  bet
      : result === 'loss' ? -bet
      : 0

    socketRef.current?.emit('record_result', { bet, profit })
    socketRef.current?.emit('new_hand')

    undoStack.current = []
    dealTargetRef.current = 'player'
    setDealTarget('player')

    setIsDoubled(false)
    setTookInsurance(false)

    // ▶ SYNC: reset deal engine when hand result is recorded
    if (dealOrderRef.current) dealOrderRef.current.resetForNewHand()

    showToast(
      `${result.toUpperCase()} — ${formatMoney(profit, currency.symbol)}`,
      result === 'win' ? 'success' : result === 'loss' ? 'error' : 'info'
    )
  }, [currency])

  const handleUndo = useCallback(() => {
    // §2 Debug: track undo action
    if (typeof DebugUI !== 'undefined') DebugUI.trackClick('UNDO', { depth: undoStack.current.length })
    if (undoStack.current.length === 0) {
      showToast('Nothing to undo', 'warning')
      return
    }

    const currentSplitHands = gameStateRef.current?.split_hands ?? []
    if (currentSplitHands.length > 0) {
      const top = undoStack.current[undoStack.current.length - 1]
      if (!top || top.type === 'split') {
        showToast('Nothing to undo — at the start of the split', 'warning')
        return
      }
      const removed = top
      undoStack.current = undoStack.current.slice(0, -1)
      socketRef.current?.emit('undo_split_card')
      // ▶ SYNC: also undo in deal engine
      if (dealOrderRef.current && dealOrderEnabled) {
        dealOrderRef.current.undoDealCard()
      }
      showToast(`Undid ${removed?.rank ?? 'card'} from split hand`, 'info')
      return
    }

    const replay  = [...undoStack.current.slice(0, -1)]
    const removed = undoStack.current[undoStack.current.length - 1]

    undoStack.current = []
    dealTargetRef.current = 'player'
    setDealTarget('player')

    socketRef.current?.emit('undo_hand')

    // ▶ SYNC: reset deal engine then replay N-1 cards into it
    if (dealOrderRef.current && dealOrderEnabled) {
      dealOrderRef.current.softReset()
      if (replay.length > 0) {
        dealOrderRef.current.replayCards(replay)
      }
    }

    // Server replay (cards re-emitted so server hand rebuilds)
    // In deal_engine mode, replay as 'seen' (count only) — not into hands
    replay.forEach((c, i) => {
      setTimeout(() => {
        undoStack.current.push(c)
        const replayTarget = dealOrderEnabled ? 'seen' : c.target
        socketRef.current?.emit('deal_card', { rank: c.rank, suit: c.suit, target: replayTarget })
      }, 80 * i + 120)
    })

    showToast(`Undid ${removed.rank} → ${removed.target}`, 'info')
  }, [dealOrderEnabled])


  // ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return

      if (e.key === 'n' || e.key === 'N') handleNewHand()
      if (e.key === 's' || e.key === 'S') handleShuffle()
      if (e.key === 'p' || e.key === 'P') setTarget('player')
      if (e.key === 'd' || e.key === 'D') setTarget('dealer')
      if (e.key === 'e' || e.key === 'E') setDealOrderEnabled(prev => !prev)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lastBet, handleNewHand, handleShuffle, handleUndo])


  // ── DERIVED STATE ──────────────────────────────────────────────────────────
  const count      = gameState?.count
  const shoe       = gameState?.shoe
  const rec        = gameState?.recommendation
  const betting    = gameState?.betting
  const sideBets   = gameState?.side_bets
  const tracker    = gameState?.shuffle_tracker
  const session    = gameState?.session
  const playerHand = gameState?.player_hand
  const dealerUp   = gameState?.dealer_upcard
  const dealerHand = gameState?.dealer_hand
  const history        = gameState?.count_history
  const sideCounts     = gameState?.side_counts
  const casinoRisk     = gameState?.casino_risk
  const splitHands     = gameState?.split_hands    ?? []
  const activeHandIdx  = gameState?.active_hand_index ?? 0
  const insurance = gameState?.insurance


  // ── DEALER DRAW DETECTION ──────────────────────────────────────────────────
  const dealerMustDraw = !!(dealerHand && (
    dealerHand.must_draw !== undefined
      ? dealerHand.must_draw
      : (dealerHand.card_count >= 2
         && !dealerHand.is_bust
         && !dealerHand.is_blackjack
         && dealerHand.value < 17)
  ))

  const dealerStandsFlag = !!(dealerHand && (
    dealerHand.dealer_stands !== undefined
      ? dealerHand.dealer_stands
      : (dealerHand.card_count >= 2
         && !dealerHand.is_bust
         && dealerHand.value >= 17)
  ))

  useEffect(() => {
    if (dealerMustDraw) setTarget('dealer')
  }, [dealerMustDraw])


  // ── LOADING SCREEN ─────────────────────────────────────────────────────────
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
            <code style={{ background:'#1c2540', padding:'2px 6px', borderRadius:4, color:'#ffd447' }}>
              python main.py web
            </code>
            {' '}is running
          </div>
        </div>
      </div>
    )
  }

  // ── Status bar data ────────────────────────────────────────────────────────
  const handsPlayed = session?.hands_played ?? 0
  const lastUpdateAgo = lastUpdateTime ? Math.round((Date.now() - lastUpdateTime) / 1000) : null

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-body" style={{ background: '#0a0e18', color: '#f0f4ff', display: 'flex', flexDirection: 'column' }}>

      {/* ── TOP BAR (Issue #12: condensed brand, Issue #2: TC hero) ───── */}
      <TopBar
        count={count}
        onNewHand={handleNewHand}
        onShuffle={handleShuffle}
        onChangeSystem={handleChangeSystem}
        currentAction={rec?.action}
      />

      {/* ── THREE-COLUMN GRID ─────────────────────────────────────────
          Layout: 260px left | flexible center | 260px right */}
      <div className="dashboard-grid" style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 260px',
        gap: 10, padding: 10, alignItems: 'start',
        flex: 1,
      }}>

        {/* ── LEFT COLUMN ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">

          {/* Bet sizing — phase-aware (Issue #6) */}
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

          {/* Basic Strategy Grid — moved here from right column for easier access */}
          <StrategyRefTable playerHand={playerHand} dealerUpcard={dealerUp} />

          {/* Ace & Ten Side Counts — moved here from right column */}
          <SideCountPanel sideCounts={sideCounts} count={count} />

        </div>


        {/* ── CENTER COLUMN ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">

          {/* ── Action recommendation banner (Issue #1: center, 4rem) ── */}
          <ActionPanel
            recommendation={rec}
            count={count}
            mlModelInfo={gameState?.ml_model_info}
            compDep16={rec?.comp_dep_16}
          />

          {/* CompDepAlert removed as standalone (Issue #8) —
              now inline badge in ActionPanel */}

          {/* Deal-Order Engine — seat tracking + decision-aware counting */}
          {dealOrderEnabled && (
            <DealOrderEngine
              ref={dealOrderRef}
              count={count}
              shoe={shoe}
              onAppUndo={handleUndo}
              onNewHand={handleNewHand}
              onShuffle={handleShuffle}
              inputMode={inputMode}
            />
          )}

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
            onInsuranceChange={setTookInsurance}
            activeBet={customBet}
            currency={currency}
            dealEngineActive={dealOrderEnabled}
          />

          {/* Split hand panel */}
          {splitHands && splitHands.length > 0 && (
            <SplitHandPanel
              splitHands={splitHands}
              activeHandIndex={activeHandIdx}
              dealerUpcard={dealerUp}
              socket={socketRef.current}
              onNextHand={() => {}}
            />
          )}

          {/* Seen cards */}
          {seenCards && seenCards.length > 0 && (
            <SeenCardsPanel seenCards={seenCards} />
          )}

          {/* Card entry grid (Issue #5: collapses in live/screenshot) */}
          <CardGrid
            target={dealTarget}
            onTargetChange={setTarget}
            remainingByRank={shoe?.remaining_by_rank}
            onDealCard={handleDealCardWrapped}
            onUndo={handleUndo}
            onSplit={handleSplit}
            canSplit={!!(playerHand?.can_split && splitHands.length === 0)}
            dealerMustDraw={dealerMustDraw}
            dealerStands={dealerStandsFlag}
            scanMode={scanMode}
            countSystem={count?.system || 'hi_lo'}
            dealEngineActive={dealOrderEnabled}
            inputMode={inputMode}
          />

          {/* CenterToolbar — stripped to unique data only (Issue #4) */}
          <CenterToolbar
            recommendation={rec}
            count={count}
            playerHand={playerHand}
            dealerUpcard={dealerUp}
            sideBets={sideBets}
            analytics={gameState?.analytics}
          />
        </div>


        {/* ── RIGHT COLUMN ──────────────────────────────────────────── */}
        <div className="panel-right flex flex-col gap-2.5">

          {/* ── Card scanner — Manual / Screenshot / Live Scan ── */}
          <LiveOverlayPanel
            socket={socketRef.current}
            count={gameState?.count}
            scanMode={scanMode}
            onSetMode={setScanMode}
            onDealCard={handleDealCardWrapped}
            dealTarget={dealTarget}
          />

          {/* Zone config — only in live/screenshot mode */}
          {(scanMode === 'live' || scanMode === 'screenshot') && (
            <ZoneConfigPanel
              socket={socketRef.current}
              zoneConfig={zoneConfig}
              onApply={(msg) => showToast(msg, 'info')}
            />
          )}

          {/* Confirmation mode — only in live mode */}
          {scanMode === 'live' && (
            <ConfirmationPanel
              socket={socketRef.current}
              confirmationMode={confirmationMode}
              pendingCards={pendingCards}
            />
          )}

          {/* Wonging — only in live mode */}
          {scanMode === 'live' && (
            <WongPanel
              socket={socketRef.current}
              wonging={wongingData}
              count={gameState?.count}
            />
          )}

          {/* ── TIER 1: Live decision panels (always visible) ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <EdgeMeter count={count} />
            <ShoePanel shoe={shoe} />

            {/* Session Analytics — always visible below shoe */}
            <AnalyticsPanel analytics={gameState?.analytics} />

            {/* SessionStats — hands, P&L, win rate */}
            <SessionStats session={session} currency={currency} />

            {/* Stop Alerts config — always visible, styled prominently */}
            <div style={{
              background: '#111827',
              border: '1.5px solid rgba(255,212,71,0.35)',
              borderRadius: 12,
              padding: 0,
              boxShadow: '0 0 12px rgba(255,212,71,0.06)',
            }}>
              <StopAlertsConfig session={session} currency={currency} socket={socketRef.current} />
            </div>
          </div>

          {/* ── TIER 2: Reference / analytics (collapsed by default) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

            <AccordionPanel label="Side Bet EV">
              <SideBetPanel sideBets={sideBets} />
            </AccordionPanel>

            <AccordionPanel label="Casino Risk Meter">
              <CasinoRiskMeter casinoRisk={casinoRisk} />
            </AccordionPanel>

            <AccordionPanel label="Count History">
              <CountHistoryPanel history={history} />
            </AccordionPanel>

            <AccordionPanel label="Illustrious 18 & Fab 4">
              <I18Panel count={count} />
            </AccordionPanel>

            <AccordionPanel label="Shuffle Tracker (ML)">
              <ShuffleTrackerPanel tracker={tracker} />
            </AccordionPanel>

          </div>

        </div>

      </div>

      {/* ── StopAlerts floating overlay ───────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 46, right: 16,
        zIndex: 1000, pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <StopAlerts session={session} currency={currency} socket={socketRef.current} />
        </div>
      </div>

      {/* ── Status bar — trading-style (bottom) ───────────────────── */}
      <div className="status-bar">
        <span className="dot" />
        <span>Connected</span>
        <span className="sep">│</span>
        <span>Hand #{handsPlayed}</span>
        <span className="sep">│</span>
        <span>
          Last update: {lastUpdateAgo !== null ? (lastUpdateAgo < 2 ? 'just now' : `${lastUpdateAgo}s ago`) : '—'}
        </span>
        <span className="sep">│</span>
        <span>
          <kbd style={{
            background: '#212d45', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 3, padding: '1px 4px', fontSize: '0.6rem',
            fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#ffd447',
          }}>N</kbd> New
          {' '}<kbd style={{
            background: '#212d45', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 3, padding: '1px 4px', fontSize: '0.6rem',
            fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#ffd447',
          }}>S</kbd> Shuffle
          {' '}<kbd style={{
            background: '#212d45', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 3, padding: '1px 4px', fontSize: '0.6rem',
            fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#ffd447',
          }}>P</kbd> Player
          {' '}<kbd style={{
            background: '#212d45', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 3, padding: '1px 4px', fontSize: '0.6rem',
            fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#ffd447',
          }}>D</kbd> Dealer
          {' '}<kbd style={{
            background: '#212d45', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 3, padding: '1px 4px', fontSize: '0.6rem',
            fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#ffd447',
          }}>E</kbd> {dealOrderEnabled ? '🎯 Engine (seats only)' : '✋ Manual (hands)'}
        </span>
      </div>
    </div>
  )
}

// Mount React app
function mountApp() {
  var container = document.getElementById('root');
  if (!container) { setTimeout(mountApp, 10); return; }
  // Use DebugErrorBoundary from DebugLayer.js (enhanced with safe mode + recovery)
  var Boundary = (typeof DebugErrorBoundary !== 'undefined') ? DebugErrorBoundary : React.Fragment;
  ReactDOM.createRoot(container).render(
    React.createElement(Boundary, null,
      React.createElement(App),
      // §7 Debug Panel — renders null when debug is OFF
      (typeof DebugPanel !== 'undefined') ? React.createElement(DebugPanel) : null
    )
  );
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}