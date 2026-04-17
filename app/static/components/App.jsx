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
  const [showFloatingHud, setShowFloatingHud] = useState(true)

  // ── UI MODE: normal | zen | speed ─────────────────────────────────────────
  const [uiMode, setUiMode] = useState(() => {
    try { return localStorage.getItem('bjml_ui_mode') || 'normal' } catch(e) { return 'normal' }
  })
  const isZen    = uiMode === 'zen'
  const isSpeed  = uiMode === 'speed'
  const isMinimal = isZen || isSpeed

  // Deal-Order Engine state
  const [dealOrderEnabled, setDealOrderEnabled] = useState(true)

  // Feature state
  const [zoneConfig, setZoneConfig] = useState({ player_end: 0.33, dealer_end: 0.66 })
  const [seenCards, setSeenCards] = useState([])
  const [confirmationMode, setConfirmationMode] = useState(false)
  const [pendingCards, setPendingCards]         = useState([])
  const [wongingData, setWongingData] = useState(null)

  // Status bar — last update timestamp
  const [lastUpdateTime, setLastUpdateTime] = useState(null)

  // P3: Layout editor
  const [showLayoutEditor, setShowLayoutEditor] = useState(false)

  // P3: Layout order from localStorage
  const [layoutOrder, setLayoutOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('bjml_layout')
      return saved ? JSON.parse(saved) : null
    } catch(e) { return null }
  })

  // Persist uiMode to localStorage
  useEffect(() => {
    try { localStorage.setItem('bjml_ui_mode', uiMode) } catch(e) {}
  }, [uiMode])

  const cycleMode = useCallback(() => {
    setUiMode(prev => prev === 'normal' ? 'zen' : prev === 'zen' ? 'speed' : 'normal')
  }, [])

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

  // Wrapped handler: also notifies DealOrderEngine when a card is dealt
  const handleDealCardWrapped = useCallback((rank, suit, targetOverride) => {
    handleDealCard(rank, suit, targetOverride)
    if (dealOrderRef.current && dealOrderEnabled) {
      dealOrderRef.current.recordCard(rank, suit, targetOverride || dealTargetRef.current)
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
    replay.forEach((c, i) => {
      setTimeout(() => {
        undoStack.current.push(c)
        socketRef.current?.emit('deal_card', { rank: c.rank, suit: c.suit, target: c.target })
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
      if (e.key === 't' || e.key === 'T') setShowFloatingHud(prev => !prev)
      if (e.key === 'm' || e.key === 'M') cycleMode()
      if (e.key === 'l' || e.key === 'L') setShowLayoutEditor(prev => !prev)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lastBet, handleNewHand, handleShuffle, handleUndo, cycleMode])


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

  // ── SPEED MODE: Auto-target switching ──────────────────────────────────────
  // After 2 player cards → switch to dealer. After 2 dealer cards → back to player.
  useEffect(() => {
    if (!isSpeed) return
    const pCards = playerHand?.cards?.length ?? 0
    const dCards = dealerHand?.card_count ?? 0
    if (splitHands.length > 0) return // don't auto-switch during splits
    if (pCards === 2 && dCards === 0 && dealTargetRef.current === 'player') {
      setTarget('dealer')
    } else if (pCards >= 2 && dCards === 2 && dealTargetRef.current === 'dealer' && !dealerMustDraw) {
      setTarget('player')
    }
  }, [isSpeed, playerHand?.cards?.length, dealerHand?.card_count, splitHands.length, dealerMustDraw])

  // ── SPEED MODE: Auto-new-hand on resolved outcome ─────────────────────────
  const autoNewHandTimer = useRef(null)
  useEffect(() => {
    if (!isSpeed) return
    const pCards = playerHand?.cards?.length ?? 0
    const dCards = dealerHand?.card_count ?? 0
    if (pCards < 2 || dCards < 2) return

    const pBust = playerHand?.is_bust
    const dBust = dealerHand?.is_bust
    const pBJ   = playerHand?.is_blackjack
    const dBJ   = dealerHand?.is_blackjack
    const dStands = dealerHand?.dealer_stands

    const resolved = pBust || dBust || (pBJ && dCards >= 2) || (dBJ && pCards >= 2) || dStands
    if (resolved) {
      if (autoNewHandTimer.current) clearTimeout(autoNewHandTimer.current)
      autoNewHandTimer.current = setTimeout(() => {
        handleNewHand()
        setIsDoubled(false)
        setTookInsurance(false)
      }, 1500)
    }
    return () => { if (autoNewHandTimer.current) clearTimeout(autoNewHandTimer.current) }
  }, [isSpeed, playerHand, dealerHand, handleNewHand])

  // ── SPEED MODE: Auto-insurance ─────────────────────────────────────────────
  useEffect(() => {
    if (!isSpeed) return
    if (insurance?.available && !tookInsurance) {
      const tc = count?.true ?? 0
      if (tc >= 3) {
        setTookInsurance(true)
        showToast('⚡ Auto-insured (TC ≥ 3)', 'info')
      }
    }
  }, [isSpeed, insurance?.available, count?.true])


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

  // ── PANEL REGISTRY for DragLayoutEditor ─────────────────────────────────
  // Maps each draggable key to its rendered JSX element.
  // Used by layoutOrder to dynamically reorder panels.
  const _panelRegistry = {
    // Left column defaults
    betting: (
      <BettingPanel
        betting={betting} count={count} lastBet={lastBet}
        onRecordResult={handleRecordResult} currency={currency}
        onCurrencyChange={setCurrency} customBet={customBet}
        onCustomBetChange={setCustomBet} playerHand={playerHand}
        dealerHand={dealerHand} insurance={insurance}
        isDoubled={isDoubled} onIsDoubledChange={setIsDoubled}
        tookInsurance={tookInsurance} onTookInsuranceChange={setTookInsurance}
      />
    ),
    strategy: <StrategyRefTable playerHand={playerHand} dealerUpcard={dealerUp} />,
    sidecount: <SideCountPanel sideCounts={sideCounts} count={count} />,

    // Right column — Tier 1 (always visible)
    scanner: (
      <LiveOverlayPanel
        socket={socketRef.current} count={gameState?.count}
        scanMode={scanMode} onSetMode={setScanMode}
        onDealCard={handleDealCardWrapped} dealTarget={dealTarget}
      />
    ),
    edge: <EdgeMeter count={count} />,
    shoe: <ShoePanel shoe={shoe} />,
    session: <SessionStats session={session} currency={currency} />,

    // Right column — Tier 2 (accordion-wrapped)
    sidebet: (<AccordionPanel label="Side Bet EV"><SideBetPanel sideBets={sideBets} /></AccordionPanel>),
    casinorisk: (<AccordionPanel label="Casino Risk Meter"><CasinoRiskMeter casinoRisk={casinoRisk} /></AccordionPanel>),
    history: (<AccordionPanel label="Count History"><CountHistoryPanel history={history} /></AccordionPanel>),
    i18: (<AccordionPanel label="Illustrious 18 & Fab 4"><I18Panel count={count} /></AccordionPanel>),
    shuffle: (<AccordionPanel label="Shuffle Tracker (ML)"><ShuffleTrackerPanel tracker={tracker} /></AccordionPanel>),
    analytics: (<AccordionPanel label="Analytics"><AnalyticsPanel analytics={gameState?.analytics} /></AccordionPanel>),
    stopalerts: (<AccordionPanel label="Stop Alerts ⚙"><StopAlertsConfig session={session} currency={currency} socket={socketRef.current} /></AccordionPanel>),
    multisystem: typeof MultiSystemPanel !== 'undefined'
      ? (<AccordionPanel label="Multi-System Compare"><MultiSystemPanel socket={socketRef.current} count={count} shoe={shoe} /></AccordionPanel>)
      : null,
    betspread: typeof BetSpreadHelper !== 'undefined'
      ? (<AccordionPanel label="Bet Spread Helper"><BetSpreadHelper count={count} betting={betting} currency={currency} shoe={shoe} /></AccordionPanel>)
      : null,
  }

  const _DEFAULT_LEFT  = ['betting', 'strategy', 'sidecount']
  const _DEFAULT_RIGHT = ['scanner', 'edge', 'shoe', 'session', 'sidebet', 'casinorisk', 'history', 'i18', 'shuffle', 'analytics', 'stopalerts', 'multisystem', 'betspread']

  // Resolve ordered keys — use saved layout if valid, else defaults.
  // Filter out any keys whose component is null/undefined (guard for missing globals).
  const _leftKeys  = (layoutOrder?.left  || _DEFAULT_LEFT).filter(k => _panelRegistry[k] != null)
  const _rightKeys = (layoutOrder?.right || _DEFAULT_RIGHT).filter(k => _panelRegistry[k] != null)

  // Safety: append any registry keys missing from both lists (prevents panels vanishing
  // if the layout was saved before a new panel was added to the codebase).
  const _allUsed = new Set([..._leftKeys, ..._rightKeys])
  const _DEFAULT_ALL = [..._DEFAULT_LEFT, ..._DEFAULT_RIGHT]
  _DEFAULT_ALL.forEach(k => {
    if (!_allUsed.has(k) && _panelRegistry[k] != null) _rightKeys.push(k)
  })

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
        uiMode={uiMode}
        onModeChange={setUiMode}
      />

      {/* ── LAYOUT: 3-column (normal) or single centered column (zen/speed) ── */}
      {isMinimal ? (
        /* ═══ ZEN / SPEED: single centered column ═══════════════════════ */
        <div style={{
          maxWidth: isZen ? 780 : 800,
          margin: '0 auto', padding: isZen ? 20 : 10,
          width: '100%', flex: 1,
          display: 'flex', flexDirection: 'column', gap: isZen ? 14 : 8,
          ...(isSpeed ? {
            borderLeft: '2px solid rgba(68,232,130,0.15)',
            borderRight: '2px solid rgba(68,232,130,0.15)',
            boxShadow: '0 0 40px rgba(68,232,130,0.04)',
          } : {}),
        }}>

          {/* Speed mode indicator badge */}
          {isSpeed && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '4px 0',
            }}>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: '#44e882',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 12 }}>⚡</span>
                SPEED MODE
                <span style={{ color: '#6b7f96', fontWeight: 500, letterSpacing: '0.05em' }}>
                  — keys: 1-9,0=rank · 1-4=suit · N=new · S=shuffle
                </span>
              </div>
            </div>
          )}

          {/* Zen mode breathing label */}
          {isZen && (
            <div style={{
              textAlign: 'center', padding: '2px 0',
              fontSize: 9, fontWeight: 600, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: '#4a5568',
            }}>
              🧘 ZEN — focus on the count
            </div>
          )}

          <ActionPanel
            recommendation={rec}
            count={count}
            mlModelInfo={gameState?.ml_model_info}
            compDep16={rec?.comp_dep_16}
            uiMode={uiMode}
          />

          {/* Deal-Order Engine — included in all modes */}
          {dealOrderEnabled && (
            <DealOrderEngine
              ref={dealOrderRef}
              count={count}
              shoe={shoe}
              onAppUndo={handleUndo}
              onNewHand={handleNewHand}
              onShuffle={handleShuffle}
            />
          )}

          <HandDisplay
            playerHand={playerHand}
            dealerUpcard={dealerUp}
            dealerHand={dealerHand}
            dealerMustDraw={dealerMustDraw}
            sideBets={isZen ? sideBets : null}
            insurance={isSpeed ? null : insurance}
            isDoubled={isDoubled}
            tookInsurance={tookInsurance}
            onInsuranceChange={setTookInsurance}
            activeBet={customBet}
            currency={currency}
            uiMode={uiMode}
          />

          {splitHands && splitHands.length > 0 && (
            <SplitHandPanel
              splitHands={splitHands}
              activeHandIndex={activeHandIdx}
              dealerUpcard={dealerUp}
              socket={socketRef.current}
              onNextHand={() => {}}
            />
          )}

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
            uiMode={uiMode}
          />

          {/* Zen: show side bet EV below cards (pros use this for bet sizing) */}
          {isZen && (
            <CenterToolbar
              recommendation={rec}
              count={count}
              playerHand={playerHand}
              dealerUpcard={dealerUp}
              sideBets={sideBets}
              analytics={gameState?.analytics}
            />
          )}
        </div>
      ) : (
        /* ═══ NORMAL: 3-column grid ═════════════════════════════════════ */
        <div className="dashboard-grid" style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 260px',
          gap: 10, padding: 10, alignItems: 'start',
          flex: 1,
        }}>

        {/* ── LEFT COLUMN (dynamic order from DragLayoutEditor) ──── */}
        <div className="flex flex-col gap-2.5">
          {_leftKeys.map(key => (
            <div key={key}>{_panelRegistry[key]}</div>
          ))}
        </div>


        {/* ── CENTER COLUMN ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5">

          {/* ── Action recommendation banner ── */}
          <ActionPanel
            recommendation={rec}
            count={count}
            mlModelInfo={gameState?.ml_model_info}
            compDep16={rec?.comp_dep_16}
            uiMode={uiMode}
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
            uiMode={uiMode}
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

          {/* CRIT-03: Outcome Strip — fills center column dead space */}
          <OutcomeStrip
            onRecordResult={handleRecordResult}
            activeBet={customBet}
            effectiveBet={isDoubled ? customBet * 2 : customBet}
            isDoubled={isDoubled}
            tookInsurance={tookInsurance}
            insurance={insurance}
            dealerHand={dealerHand}
            currency={currency}
            playerHand={playerHand}
          />
        </div>


        {/* ── RIGHT COLUMN (dynamic order from DragLayoutEditor) ─── */}
        <div className="panel-right flex flex-col gap-2.5">

          {/* Fixed conditional panels — not in drag editor, mode-dependent */}
          {(scanMode === 'live' || scanMode === 'screenshot') && (
            <ZoneConfigPanel
              socket={socketRef.current}
              zoneConfig={zoneConfig}
              onApply={(msg) => showToast(msg, 'info')}
            />
          )}
          {scanMode === 'live' && (
            <ConfirmationPanel
              socket={socketRef.current}
              confirmationMode={confirmationMode}
              pendingCards={pendingCards}
            />
          )}
          {scanMode === 'live' && (
            <WongPanel
              socket={socketRef.current}
              wonging={wongingData}
              count={gameState?.count}
            />
          )}

          {/* Dynamic panels — ordered by DragLayoutEditor */}
          {_rightKeys.map(key => (
            <div key={key}>{_panelRegistry[key]}</div>
          ))}

        </div>

      {/* P3: Layout Editor button — floating in bottom-right area */}
      {!isMinimal && (
        <button
          onClick={() => setShowLayoutEditor(true)}
          aria-label="Open layout editor"
          title="Customize panel layout (L key)"
          style={{
            position: 'fixed', bottom: 60, right: 16, zIndex: 999,
            width: 40, height: 40, borderRadius: '50%',
            background: '#1c2540', border: '1.5px solid rgba(255,255,255,0.15)',
            color: '#8fa5be', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#263257'; e.currentTarget.style.color = '#ffd447'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1c2540'; e.currentTarget.style.color = '#8fa5be'; }}
        >
          🎯
        </button>
      )}

      {/* P3: Layout Editor Overlay */}
      {typeof DragLayoutEditor !== 'undefined' && (
        <DragLayoutEditor
          isOpen={showLayoutEditor}
          onClose={() => setShowLayoutEditor(false)}
          leftPanels={[
            { key: 'betting', label: 'Bet Sizing (Kelly)', icon: '💰' },
            { key: 'strategy', label: 'Basic Strategy Grid', icon: '📊' },
            { key: 'sidecount', label: 'Ace & Ten Side Counts', icon: '🎴' },
          ]}
          rightPanels={[
            { key: 'scanner', label: 'Card Scanner', icon: '📷' },
            { key: 'edge', label: 'Edge Meter', icon: '📈' },
            { key: 'shoe', label: 'Shoe Composition', icon: '👟' },
            { key: 'session', label: 'Session Statistics', icon: '📋' },
            { key: 'sidebet', label: 'Side Bet EV', icon: '🎰' },
            { key: 'casinorisk', label: 'Casino Risk Meter', icon: '🏦' },
            { key: 'history', label: 'Count History', icon: '📉' },
            { key: 'i18', label: 'Illustrious 18 & Fab 4', icon: '🃏' },
            { key: 'shuffle', label: 'Shuffle Tracker (ML)', icon: '🔀' },
            { key: 'analytics', label: 'Analytics', icon: '🔬' },
            { key: 'stopalerts', label: 'Stop Alerts', icon: '⚠️' },
            { key: 'multisystem', label: 'Multi-System Compare', icon: '🔄' },
            { key: 'betspread', label: 'Bet Spread Helper', icon: '📐' },
          ]}
          onLayoutChange={(layout) => {
            setLayoutOrder(layout)
          }}
        />
      )}

        </div>
      )}{/* end normal/minimal layout conditional */}

      {/* ── StopAlerts floating overlay ───────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 16, right: 16,
        zIndex: 1000, pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <StopAlerts session={session} currency={currency} socket={socketRef.current} />
        </div>
      </div>

      {/* ── CRIT-05: Floating TC HUD — always visible, toggle with T key ─── */}
      {showFloatingHud && count && (
        <div
          aria-label="Floating True Count HUD"
          style={{
            position: 'fixed', bottom: 16, left: 16, zIndex: 999,
            background: 'rgba(12,17,30,0.92)',
            backdropFilter: 'blur(12px)',
            border: `1.5px solid ${(count?.true ?? 0) >= 2 ? 'rgba(68,232,130,0.5)' : (count?.true ?? 0) <= -1 ? 'rgba(255,92,92,0.5)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 12, padding: '10px 14px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            minWidth: 180,
            cursor: 'default',
            transition: 'border-color 0.3s, box-shadow 0.3s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 8, color: '#6b7f96', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>True Count</div>
              <div style={{
                fontSize: 24, fontWeight: 900, fontFamily: 'DM Mono, monospace', lineHeight: 1,
                color: (count.true ?? 0) >= 3 ? '#44e882' : (count.true ?? 0) >= 1 ? '#88eebb' : (count.true ?? 0) <= -1 ? '#ff5c5c' : '#f0f4ff',
              }}>
                {(count.true ?? 0) >= 0 ? '+' : ''}{(count.true ?? 0).toFixed(1)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {rec?.action && (
                <div style={{
                  fontSize: 14, fontWeight: 800, fontFamily: 'Syne, sans-serif',
                  color: rec.action === 'HIT' ? '#44e882' : rec.action === 'STAND' ? '#6aafff' : rec.action === 'DOUBLE' ? '#ffd447' : rec.action === 'SPLIT' ? '#b99bff' : rec.action === 'SURRENDER' ? '#ff5c5c' : '#f0f4ff',
                  letterSpacing: '0.05em',
                }}>
                  ▶ {rec.action}
                </div>
              )}
              <div style={{ fontSize: 9, color: '#6b7f96', marginTop: 2 }}>
                Edge: <span style={{ color: (count.advantage ?? 0) >= 0 ? '#44e882' : '#ff5c5c', fontWeight: 700 }}>
                  {(count.advantage ?? 0) >= 0 ? '+' : ''}{(count.advantage ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 7, color: '#4a5568', textAlign: 'center', marginTop: 4 }}>
            Press T to hide
          </div>
        </div>
      )}

      {/* Keyframe for CRIT-10 split advance button */}
      <style>{`
        @keyframes split-advance-pulse {
          0%, 100% { box-shadow: 0 0 6px rgba(106,175,255,0.3); }
          50%       { box-shadow: 0 0 18px rgba(106,175,255,0.6); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.7; }
        }
      `}</style>
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