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

// PHASE 7 T3: SocketContext — single connection exposed without prop drilling.
// Value is null until the first connect, then stable for the session.
window.SocketContext = window.SocketContext || React.createContext(null);
const SocketContext = window.SocketContext;

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
  // PHASE 2: floating TC HUD demoted to opt-in. TopBar already owns the canonical
  // TC reading — the HUD is reserved for overlay/screenshot scanning sessions.
  const [showFloatingHud, setShowFloatingHud] = useState(() => {
    try { return localStorage.getItem('bjml_floating_hud') === '1' } catch(e) { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('bjml_floating_hud', showFloatingHud ? '1' : '0') } catch(e) {}
  }, [showFloatingHud])

  // PHASE 2: responsive column widths — degrade narrow side columns on small screens.
  const [colWidths, setColWidths] = useState(() => {
    if (typeof window === 'undefined') return { left: 280, right: 320 }
    const w = window.innerWidth
    return w >= 1440 ? { left: 300, right: 360 }
         : w >= 1280 ? { left: 280, right: 320 }
         :             { left: 240, right: 240 }
  })
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth
      setColWidths(
        w >= 1440 ? { left: 300, right: 360 }
      : w >= 1280 ? { left: 280, right: 320 }
      :             { left: 240, right: 240 }
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
  // PHASE 4: Hotkey overlay
  const [showHotkeys, setShowHotkeys] = useState(false)

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

  // PHASE 7 T3: socket as state mirrors socketRef so SocketContext consumers
  // re-render once the connection is established.
  const [socket, setSocket] = useState(null);

  // ── REFS ───────────────────────────────────────────────────────────────────
  const socketRef = useRef(null)
  const undoStack = useRef([])
  // PHASE 8.5: redo stack — populated when undo pops, cleared on any forward action.
  const redoStack = useRef([])
  const dealTargetRef = useRef('player')
  const gameStateRef = useRef(null)
  const dealOrderRef = useRef(null)
  // FIX CRIT-03: Guard to block all input during undo replay window.
  // Previously, user actions during the ~1s setTimeout replay would race
  // with queued replay events, corrupting hand state.
  const isReplayingRef = useRef(false)
  const replayTimeoutsRef = useRef([])

  const setTarget = (t) => { dealTargetRef.current = t; setDealTarget(t); }


  // ── WEBSOCKET SETUP ────────────────────────────────────────────────────────
  useEffect(() => {
    const sock = io()
    // §3 Debug: wrap socket for network event logging
    if (typeof DebugNet !== 'undefined') DebugNet.wrapEmit(sock)
    socketRef.current = sock
    setSocket(sock)              // PHASE 7 T3: trigger context provider re-render

    sock.on('state_update', (data) => {
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

    sock.on('notification', (data) => {
      if (typeof DebugNet !== 'undefined') DebugNet.logReceive('notification', data)
      showToast(data.message, data.type || 'info')
    })
    sock.on('error', (data) => {
      if (typeof DebugNet !== 'undefined') DebugNet.logError('error', data)
      showToast(data.message, 'error')
    })
    sock.on('pending_cards_update', (data) => setPendingCards(data.pending || []))

    // §3 Debug: listen for backend debug_log events
    sock.on('debug_log', (data) => {
      if (typeof DebugController !== 'undefined' && DebugController.isActive()) {
        DebugController.log(data.cat || 'GENERAL', 3, '[SRV] ' + (data.msg || ''), data.data || null)
      }
    })

    return () => sock.disconnect()
  }, [])


  // ── HANDLERS ───────────────────────────────────────────────────────────────
  const handleDealCard = useCallback((rank, suit, targetOverride) => {
    // FIX CRIT-03: Block user-initiated deals during undo replay
    if (isReplayingRef.current) {
      showToast('Undo in progress — please wait', 'warning')
      return
    }
    const target = targetOverride || dealTargetRef.current
    undoStack.current.push({ rank, suit, target })
    redoStack.current = []  // PHASE 8.5: any new forward action invalidates redo
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
    if (isReplayingRef.current) return
    undoStack.current.push({ type: 'split' })
    redoStack.current = []  // PHASE 8.5: clear redo on forward action
    socketRef.current?.emit('player_split')
  }, [])

  const handleNextSplitHand = useCallback(() => {
    if (isReplayingRef.current) return
    socketRef.current?.emit('next_split_hand')
  }, [])

  const handleNewHand = useCallback(() => {
    if (isReplayingRef.current) {
      showToast('Undo in progress — please wait', 'warning')
      return
    }
    undoStack.current = []
    redoStack.current = []  // PHASE 8.5: clear redo on new hand
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
    if (isReplayingRef.current) {
      showToast('Undo in progress — please wait', 'warning')
      return
    }
    const shuffleType = document.getElementById('shuffle-type')?.value || 'machine'
    undoStack.current = []
    redoStack.current = []  // PHASE 8.5: clear redo on shuffle
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
    // PHASE 1: block result entry while undo replay is in flight
    if (isReplayingRef.current) {
      showToast('Undo in progress — please wait', 'warning')
      return
    }
    const profit = precalcProfit !== undefined
      ? precalcProfit
      : result === 'win'  ?  bet
      : result === 'loss' ? -bet
      : 0

    socketRef.current?.emit('record_result', { bet, profit })
    socketRef.current?.emit('new_hand')

    undoStack.current = []
    redoStack.current = []  // PHASE 8.5: clear redo on hand resolution
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
    // FIX CRIT-03: Block re-entry during replay
    if (isReplayingRef.current) {
      showToast('Undo already in progress', 'warning')
      return
    }
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
      redoStack.current.push(removed)  // PHASE 8.5: capture for redo
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

    redoStack.current.push(removed)  // PHASE 8.5: capture removed event for redo
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

    // FIX CRIT-03: Set replay guard. All input handlers check this ref and
    // refuse to process events while true. Cleared when last timeout fires.
    if (replay.length > 0) {
      isReplayingRef.current = true
      // Clear any lingering timeouts from a prior aborted replay
      replayTimeoutsRef.current.forEach(id => clearTimeout(id))
      replayTimeoutsRef.current = []
    }

    // Server replay (cards re-emitted so server hand rebuilds)
    replay.forEach((c, i) => {
      const isLast = (i === replay.length - 1)
      const timeoutId = setTimeout(() => {
        undoStack.current.push(c)
        socketRef.current?.emit('deal_card', { rank: c.rank, suit: c.suit, target: c.target })
        if (isLast) {
          // Last card of replay dispatched — clear the guard
          isReplayingRef.current = false
          replayTimeoutsRef.current = []
        }
      }, 80 * i + 120)
      replayTimeoutsRef.current.push(timeoutId)
    })

    showToast(`Undid ${removed.rank} → ${removed.target}`, 'info')
  }, [dealOrderEnabled])

  // PHASE 8.5: redo — single-step replay of the most recent undo
  const handleRedo = useCallback(() => {
    if (isReplayingRef.current) {
      showToast('Undo in progress — please wait', 'warning')
      return
    }
    if (redoStack.current.length === 0) {
      showToast('Nothing to redo', 'warning')
      return
    }
    const event = redoStack.current.pop()
    if (event.type === 'split') {
      undoStack.current.push({ type: 'split' })
      socketRef.current?.emit('player_split')
      showToast('Redid split', 'info')
      return
    }
    // Card event
    undoStack.current.push(event)
    if (dealOrderRef.current && dealOrderEnabled) {
      dealOrderRef.current.recordCard(event.rank, event.suit, event.target)
    }
    socketRef.current?.emit('deal_card', { rank: event.rank, suit: event.suit, target: event.target })
    showToast(`Redid ${event.rank} → ${event.target}`, 'info')
  }, [dealOrderEnabled])


  // PHASE 4: shuffleHoldRef declared here (refs are TDZ-safe regardless of order);
  // the actual keydown effect is mounted below, after derived state, so its deps
  // can safely reference splitHands / dealerStandsFlag without TDZ errors.
  const shuffleHoldRef = useRef({ timer: null, holding: false })


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

  // ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────
  // PHASE 4: Full keymap rewrite. CardGrid owns rank/suit keys (digits + J/Q/K
  // and Shift+rank for suit popover); App.jsx owns everything else.
  //
  //   Actions:    H  Hit (target → player)   X  Stand (target → dealer)
  //               B  Double                  P  Split        R  Surrender
  //   Results:    W  Win                     L  Loss         U  Push
  //   Targets:    ,  player                  .  dealer       /  seen
  //   Session:    N  New hand                ⇧+S (hold)  Shuffle
  //               Ctrl+Z  Undo
  //   UI:         M  Mode cycle              T  HUD toggle
  //               ⇧+L  Layout editor         ⇧+E  Deal-order engine
  //               ?  Hotkey overlay          Esc  Close overlay/popover
  //   Bet ramp:   [  −1u   ]  +1u   =  Kelly
  useEffect(() => {
    const handler = (e) => {
      // Esc and Ctrl+Z are global — work even when focus is in inputs.
      const t = e.target
      const inEditable = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

      // ── Esc — close overlays in priority order (works in inputs too) ─
      if (e.key === 'Escape') {
        let consumed = false
        setShowHotkeys(prev => { if (prev) { consumed = true; return false } return prev })
        if (consumed) return
        setShowLayoutEditor(prev => { if (prev) { consumed = true; return false } return prev })
        return
      }

      // ── Ctrl/Cmd+Shift+Z — redo (must come before plain Ctrl+Z) ─────
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        handleRedo()
        return
      }

      // ── Ctrl/Cmd+Z — undo (global, works in inputs too) ─────────────
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        handleUndo()
        return
      }

      // ── Hotkey overlay (?) — global, works even when focus is in inputs ──
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowHotkeys(prev => !prev)
        return
      }

      // From here on: bail if focus is inside an input/select/textarea so
      // typing isn't interpreted as an action/result/rank shortcut.
      if (inEditable) return

      // ── Shift+S (hold) — shuffle ────────────────────────────────────
      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        if (!shuffleHoldRef.current.holding) {
          shuffleHoldRef.current.holding = true
          showToast('Hold Shift+S to shuffle…', 'warning')
          shuffleHoldRef.current.timer = setTimeout(() => {
            handleShuffle()
            shuffleHoldRef.current.holding = false
            shuffleHoldRef.current.timer = null
          }, 400)
        }
        return
      }

      // ── Shift+L — layout editor (since plain L is now Loss) ─────────
      if (e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault()
        setShowLayoutEditor(prev => !prev)
        return
      }
      // ── Shift+E — toggle deal-order engine ──────────────────────────
      if (e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault()
        setDealOrderEnabled(prev => !prev)
        return
      }

      // Any other Shift+key: defer to CardGrid (rank popover) — don't claim.
      if (e.shiftKey) return
      // Plain Ctrl/Alt/Meta — defer.
      if (e.ctrlKey || e.altKey || e.metaKey) return

      // ── Plain N — new hand ──────────────────────────────────────────
      if (e.key === 'n' || e.key === 'N') { handleNewHand(); return }

      // ── Player actions ──────────────────────────────────────────────
      if (e.key === 'h' || e.key === 'H') { setTarget('player'); return }
      if (e.key === 'x' || e.key === 'X') { setTarget('dealer'); return }
      if (e.key === 'b' || e.key === 'B') {
        if (isReplayingRef.current) { showToast('Undo in progress', 'warning'); return }
        socketRef.current?.emit('player_double')
        setIsDoubled(true)
        return
      }
      if (e.key === 'p' || e.key === 'P') { handleSplit(); return }
      if (e.key === 'r' || e.key === 'R') {
        if (isReplayingRef.current) return
        socketRef.current?.emit('player_surrender')
        showToast('Surrender', 'info')
        return
      }

      // ── Results — gated on resolution + replay guard ────────────────
      if (e.key === 'w' || e.key === 'W'
       || e.key === 'l' || e.key === 'L'
       || e.key === 'u' || e.key === 'U') {
        const pCards = playerHand?.cards?.length ?? 0
        const dCards = dealerHand?.card_count ?? 0
        const isResolved = splitHands.length === 0
          && pCards >= 2 && dCards >= 2
          && (playerHand?.is_bust || dealerHand?.is_bust
              || playerHand?.is_blackjack || dealerHand?.is_blackjack
              || dealerStandsFlag)
        if (!isResolved) {
          showToast('Result locked — finish the hand first', 'warning')
          return
        }
        const k = e.key.toLowerCase()
        const result = k === 'w' ? 'win' : k === 'l' ? 'loss' : 'push'
        handleRecordResult(result, customBet)
        return
      }

      // ── Targets ─────────────────────────────────────────────────────
      if (e.key === ',') { setTarget('player'); return }
      if (e.key === '.') { setTarget('dealer'); return }
      if (e.key === '/') { setTarget('seen'); return }

      // ── UI ──────────────────────────────────────────────────────────
      if (e.key === 't' || e.key === 'T') { setShowFloatingHud(prev => !prev); return }
      if (e.key === 'm' || e.key === 'M') { cycleMode(); return }

      // ── Bet ramp ────────────────────────────────────────────────────
      if (e.key === '[' || e.key === ']' || e.key === '=') {
        const minB = betting?.min_bet ?? 1
        const recBet = betting?.recommended_bet ?? minB
        const units = Math.max(1, betting?.units ?? 1)
        const baseUnit = Math.max(1, Math.round(recBet / units))
        if (e.key === '=') {
          setCustomBet(Math.max(minB, Math.round(recBet)))
        } else if (e.key === '[') {
          setCustomBet(prev => Math.max(minB, (prev ?? recBet) - baseUnit))
        } else {
          setCustomBet(prev => (prev ?? recBet) + baseUnit)
        }
        return
      }
    }

    const upHandler = (e) => {
      if (e.key === 'S' || e.key === 's' || e.key === 'Shift') {
        if (shuffleHoldRef.current.timer) {
          clearTimeout(shuffleHoldRef.current.timer)
          shuffleHoldRef.current.timer = null
          shuffleHoldRef.current.holding = false
        }
      }
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('keyup', upHandler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keyup', upHandler)
    }
  }, [
    handleNewHand, handleShuffle, handleUndo, handleRedo, handleSplit, handleRecordResult,
    cycleMode, customBet, betting, playerHand, dealerHand, splitHands.length, dealerStandsFlag
  ])

  useEffect(() => {
    if (dealerMustDraw) setTarget('dealer')
  }, [dealerMustDraw])

  // ── PHASE 1: Auto-target switching (all modes, was Speed-only) ────────────
  // After 2 player cards → switch to dealer. After 2 dealer cards → back to player.
  // User can still override manually by clicking the target button — the effect
  // only re-fires when card counts change.
  useEffect(() => {
    const pCards = playerHand?.cards?.length ?? 0
    const dCards = dealerHand?.card_count ?? 0
    if (splitHands.length > 0) return // don't auto-switch during splits
    if (pCards === 2 && dCards === 0 && dealTargetRef.current === 'player') {
      setTarget('dealer')
    } else if (pCards >= 2 && dCards === 2 && dealTargetRef.current === 'dealer' && !dealerMustDraw) {
      setTarget('player')
    }
  }, [playerHand?.cards?.length, dealerHand?.card_count, splitHands.length, dealerMustDraw])

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


  // ── PHASE 8.8: SKELETON LOADING SCREEN ─────────────────────────────────────
  // Layout-matching skeleton (top bar + 3-col grid + bottom status bar) so the
  // first paint doesn't shift. Shimmer is paused under prefers-reduced-motion.
  if (!gameState) {
    const block = (h, w) => React.createElement('div', {
      className: 'sk-shimmer',
      style: {
        height: h, width: w || '100%', borderRadius: 8,
        background: '#1c2540', marginBottom: 10,
      },
    });
    const col = (children) => React.createElement('div', {
      style: {
        display: 'flex', flexDirection: 'column', gap: 0,
        padding: 12, background: 'rgba(28,37,64,0.4)',
        border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12,
      },
    }, children);

    return React.createElement('div', {
      style: {
        background: '#0a0e18', minHeight: '100vh', color: '#ccdaec',
        display: 'flex', flexDirection: 'column',
      },
    },
      // Inline shimmer keyframes — matches phase 7 motion policy
      React.createElement('style', null, `
        @keyframes sk-shimmer-anim {
          0%   { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        .sk-shimmer {
          background-image: linear-gradient(90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.05) 50%,
            rgba(255,255,255,0) 100%);
          background-size: 200px 100%;
          background-repeat: no-repeat;
          animation: sk-shimmer-anim 1.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .sk-shimmer { animation: none; background-image: none; }
        }
      `),
      // Top bar skeleton (56px)
      React.createElement('div', {
        style: {
          height: 56, padding: '12px 18px',
          background: '#111827',
          borderBottom: '1.5px solid rgba(255,255,255,0.09)',
          display: 'flex', alignItems: 'center', gap: 14,
        },
      },
        React.createElement('div', { className: 'sk-shimmer', style: { width: 90, height: 28, borderRadius: 6, background: '#1c2540' } }),
        React.createElement('div', { className: 'sk-shimmer', style: { width: 130, height: 28, borderRadius: 6, background: '#1c2540' } }),
        React.createElement('div', { style: { flex: 1 } }),
        React.createElement('div', { className: 'sk-shimmer', style: { width: 80, height: 28, borderRadius: 6, background: '#1c2540' } }),
      ),
      // 3-column grid
      React.createElement('div', {
        style: {
          flex: 1, display: 'grid',
          gridTemplateColumns: '240px 1fr 240px',
          gap: 14, padding: 14, paddingBottom: 38,
        },
      },
        col([
          block(120),
          block(80),
          block(140),
        ].map((b, i) => React.cloneElement(b, { key: i }))),
        col([
          block(70),
          block(160),
          block(120),
          block(90),
        ].map((b, i) => React.cloneElement(b, { key: i }))),
        col([
          block(110),
          block(160),
          block(90),
        ].map((b, i) => React.cloneElement(b, { key: i }))),
      ),
      // Bottom status bar skeleton (28px)
      React.createElement('div', {
        style: {
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: 28, background: 'rgba(13,19,32,0.95)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: 18, padding: '0 12px',
          fontSize: 9, color: '#6b7f96', letterSpacing: '0.1em',
          textTransform: 'uppercase', fontWeight: 700,
        },
      }, 'Connecting to BlackjackML server…')
    );
  }

  // ── Status bar data ────────────────────────────────────────────────────────
  const handsPlayed = session?.hands_played ?? 0
  const lastUpdateAgo = lastUpdateTime ? Math.round((Date.now() - lastUpdateTime) / 1000) : null

  // ── PHASE 2: trimmed registry — only left-column panels remain.
  // Right-column panels are now rendered directly inside the right-column JSX
  // (fixed slots + TabStrip) so they don't need registry entries.
  const _panelRegistry = {
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
  }

  // PHASE 2: left column keeps the DragLayoutEditor for power users; right column
  // is now a fixed structure (2 slots + TabStrip) so we no longer compute _rightKeys.
  const _DEFAULT_LEFT  = ['betting', 'sidecount', 'strategy']

  const _leftKeys  = (layoutOrder?.left  || _DEFAULT_LEFT).filter(k => _panelRegistry[k] != null)

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <SocketContext.Provider value={socket}>
    <div className="min-h-screen font-body" style={{ background: 'var(--surface-base)', color: 'var(--text-1)', display: 'flex', flexDirection: 'column' }}>

      {/* ── TOP BAR (Issue #12: condensed brand, Issue #2: TC hero) ───── */}
      <PerfProbe id="topbar">
        <TopBar
          count={count}
          onNewHand={handleNewHand}
          onShuffle={handleShuffle}
          onChangeSystem={handleChangeSystem}
          currentAction={rec?.action}
          uiMode={uiMode}
          onModeChange={setUiMode}
          sideCounts={sideCounts}
          onShowLayoutEditor={() => setShowLayoutEditor(true)}
        />
      </PerfProbe>

      {/* ── PHASE 2/3: Deviation Banner — full-width, conditional ── */}
      {!isMinimal && (
        <DeviationBanner
          recommendation={rec}
          count={count}
          playerHand={playerHand}
          dealerUpcard={dealerUp}
        />
      )}

      {/* ── LAYOUT: 3-column (normal) or single centered column (zen/speed) ── */}
      {isMinimal ? (
        /* ═══ ZEN / SPEED: single centered column ═══════════════════════ */
        <div style={{
          maxWidth: isZen ? 780 : 800,
          margin: '0 auto',
          padding: isZen ? 20 : 10,
          paddingBottom: 38, // PHASE 2: clear room for StatusBar
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
                  — keys: 2-9 J Q K A=suit prompt · ⇧+rank=spades · 1-4 picks suit · H/X/B/P/R · W/L/U · N · ⇧+S=shuffle · ?=help
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
            insurance={insurance}
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
              onNextHand={handleNextSplitHand}
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
              shoe={shoe}
            />
          )}
        </div>
      ) : (
        /* ═══ NORMAL: 3-column grid ═════════════════════════════════════ */
        <div className="dashboard-grid" style={{
          display: 'grid',
          gridTemplateColumns: `${colWidths.left}px 1fr ${colWidths.right}px`,
          gap: 10, padding: 10, alignItems: 'start',
          flex: 1, paddingBottom: 38, // PHASE 2: clear room for StatusBar
        }}>

        {/* ── LEFT COLUMN (dynamic order from DragLayoutEditor) ──── */}
        <PerfProbe id="left-column">
          <div className="flex flex-col gap-2.5">
            {_leftKeys.map(key => (
              <div key={key}>{_panelRegistry[key]}</div>
            ))}
          </div>
        </PerfProbe>


        {/* ── CENTER COLUMN ─────────────────────────────────────────── */}
        <PerfProbe id="center-column">
        <div className="flex flex-col gap-2.5">

          {/* ── Action recommendation banner ── */}
          <ActionPanel
            recommendation={rec}
            count={count}
            mlModelInfo={gameState?.ml_model_info}
            compDep16={rec?.comp_dep_16}
            uiMode={uiMode}
            insurance={insurance}
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
              onNextHand={handleNextSplitHand}
            />
          )}

          {/* CenterToolbar — row-1 only (PHASE 2: row-2 stripped) */}
          <CenterToolbar
            recommendation={rec}
            count={count}
            playerHand={playerHand}
            dealerUpcard={dealerUp}
            sideBets={sideBets}
            analytics={gameState?.analytics}
            shoe={shoe}
          />

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

          {/* OutcomeStrip — placed below CardGrid so it never pushes the grid
              below the fold. Self-hides until ≥2 player cards are dealt. */}
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
            splitHandsActive={splitHands.length > 0}
          />
        </div>
        </PerfProbe>


        {/* ── PHASE 2: RIGHT COLUMN — fixed structure (2 slots + TabStrip) ─── */}
        <PerfProbe id="right-column">
        <div className="panel-right flex flex-col gap-2.5">

          {/* PHASE 5: live-scan widgets (Zone / Confirmation / Wong) moved
              into ScannerHub inside the TabStrip's Scanner tab. */}

          {/* Slot 1 — Shoe & Edge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <EdgeMeter count={count} />
            <ShoePanel shoe={shoe} />
          </div>

          {/* Slot 2 — Bet Reference */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {typeof BettingRampPanel !== 'undefined' && (
              <BettingRampPanel count={count} betting={betting} currency={currency} />
            )}
            {typeof BetSpreadHelper !== 'undefined' && (
              <BetSpreadHelper count={count} betting={betting} currency={currency} shoe={shoe} />
            )}
          </div>

          {/* Slot 3 — TabStrip: reference + analytics, one body at a time.
              Order is editable through the Layout Editor (PHASE 5). */}
          {(() => {
            const _allTabs = [
              { key: 'i18',       label: 'I18 · Fab4',  render: () => <I18Panel count={count} /> },
              { key: 'session',   label: 'Session',     render: () => <SessionStats session={session} currency={currency} /> },
              { key: 'sidebet',   label: 'Side EV',     render: () => <SideBetPanel sideBets={sideBets} /> },
              { key: 'analytics', label: 'Analytics',   render: () => <AnalyticsPanel analytics={gameState?.analytics} /> },
              { key: 'shuffle',   label: 'Shuffle ML',  render: () => <ShuffleTrackerPanel tracker={tracker} /> },
              { key: 'risk',      label: 'Casino Risk', render: () => <CasinoRiskMeter casinoRisk={casinoRisk} /> },
              { key: 'history',   label: 'History',     render: () => <CountHistoryPanel history={history} /> },
              { key: 'multi',     label: 'Multi-Sys',
                render: () => typeof MultiSystemPanel !== 'undefined'
                  ? <MultiSystemPanel count={count} shoe={shoe} />
                  : null
              },
              { key: 'stops',     label: 'Stops',
                render: () => <StopAlertsConfig session={session} currency={currency} />
              },
              { key: 'scanner',   label: 'Scanner',
                render: () => <ScannerHub
                                                  count={gameState?.count}
                                scanMode={scanMode}
                                onSetMode={setScanMode}
                                onDealCard={handleDealCardWrapped}
                                dealTarget={dealTarget}
                                zoneConfig={zoneConfig}
                                confirmationMode={confirmationMode}
                                pendingCards={pendingCards}
                                wonging={wongingData}
                              />
              },
            ];
            const _byKey = Object.fromEntries(_allTabs.map(t => [t.key, t]));
            const _userOrder = layoutOrder?.rightTabs || []
            const _ordered = [
              ..._userOrder.map(k => _byKey[k]).filter(Boolean),
              ..._allTabs.filter(t => !_userOrder.includes(t.key)),
            ]
            return (
              <TabStrip
                ariaLabel="Reference panels"
                defaultKey={_ordered[0]?.key || 'i18'}
                tabs={_ordered}
              />
            )
          })()}

        </div>
        </PerfProbe>

      {/* PHASE 5: Layout Editor — left panels reorder, right TabStrip tabs reorder.
          The two right-column fixed slots (Edge & Shoe / Bet Reference) are
          shown as locked rows for context but cannot be moved. */}
      {typeof DragLayoutEditor !== 'undefined' && (
        <DragLayoutEditor
          isOpen={showLayoutEditor}
          onClose={() => setShowLayoutEditor(false)}
          leftPanels={[
            { key: 'betting',   label: 'Bet Sizing (Kelly)',     lucide: 'wallet' },
            { key: 'sidecount', label: 'Ace & Ten Side Counts',  lucide: 'layers' },
            { key: 'strategy',  label: 'Basic Strategy Grid',    lucide: 'bar-chart-3' },
          ]}
          lockedSlots={[
            { key: 'edgeshoe',     label: 'Edge & Shoe (fixed)',     lucide: 'trending-up' },
            { key: 'betreference', label: 'Bet Reference (fixed)',   lucide: 'ruler' },
          ]}
          rightTabs={[
            { key: 'i18',       label: 'I18 · Fab 4',          lucide: 'spade' },
            { key: 'session',   label: 'Session Stats',        lucide: 'clipboard-list' },
            { key: 'sidebet',   label: 'Side Bet EV',          lucide: 'dice' },
            { key: 'analytics', label: 'Analytics',            lucide: 'microscope' },
            { key: 'shuffle',   label: 'Shuffle ML',           lucide: 'shuffle' },
            { key: 'risk',      label: 'Casino Risk',          lucide: 'landmark' },
            { key: 'history',   label: 'Count History',        lucide: 'trending-down' },
            { key: 'multi',     label: 'Multi-System',         lucide: 'refresh-ccw' },
            { key: 'stops',     label: 'Stop Alerts',          lucide: 'alert-triangle' },
            { key: 'scanner',   label: 'Live Scanner',         lucide: 'camera' },
          ]}
          onLayoutChange={(layout) => setLayoutOrder(layout)}
        />
      )}

        </div>
      )}{/* end normal/minimal layout conditional */}

      {/* ── PHASE 2: Status Bar — sticky at bottom (one row, glanceable) ── */}
      <PerfProbe id="statusbar">
        <StatusBar
          session={session}
          count={count}
          wonging={wongingData}
          mlModelInfo={gameState?.ml_model_info}
          lastUpdateAgo={lastUpdateAgo}
          onShowHelp={() => setShowHotkeys(true)}
          betting={betting}
        />
      </PerfProbe>

      {/* ── PHASE 4: Hotkey overlay (modal) ─────────────────────────── */}
      <HotkeyOverlay
        isOpen={showHotkeys}
        onClose={() => setShowHotkeys(false)}
      />

      {/* ── StopAlerts floating overlay (lifted above StatusBar) ───────── */}
      <div style={{
        position: 'fixed', bottom: 36, right: 16,
        zIndex: 1000, pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <StopAlerts session={session} currency={currency} />
        </div>
      </div>

      {/* ── Floating TC HUD — opt-in via T key (PHASE 2: default off, lifted above StatusBar) ─── */}
      {showFloatingHud && count && (
        <div
          aria-label="Floating True Count HUD"
          style={{
            position: 'fixed', bottom: 36, left: 16, zIndex: 999,
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
    </SocketContext.Provider>
  )
}

// Mount React app
function mountApp() {
  var container = document.getElementById('root');
  if (!container) { setTimeout(mountApp, 10); return; }
  // PHASE 7 T2: ErrorBoundary lives in its own file and always ships,
  // even in production builds where DebugLayer is excluded.
  var Boundary = (typeof ErrorBoundary !== 'undefined') ? ErrorBoundary : React.Fragment;
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