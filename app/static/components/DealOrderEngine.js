/*
 * components/DealOrderEngine.js
 * ─────────────────────────────────────────────────────────
 * Deal-Order Engine + Seat-Aware Decision System
 *
 * PURPOSE:
 *   Tracks real blackjack deal order across all seats at the table,
 *   captures the running count at the exact moment YOUR seat receives
 *   its 2nd card ("countAtMyDecision"), and provides position-edge
 *   analysis so betting decisions use the most accurate count.
 *
 * ARCHITECTURE:
 *   This is a PURE CLIENT-SIDE component. It does NOT modify the server
 *   state. It reads count/shoe data from the existing state_update and
 *   wraps around the existing handleDealCard flow as a passive observer.
 *
 * COMPACT / EXPANDED:
 *   Default is COMPACT (~160px) showing: seat dots, deal position, 
 *   decision count, and action buttons in a dense horizontal layout.
 *   EXPANDED reveals: setup controls, per-seat cards, full decision 
 *   panel, trend chart, and round log.
 *
 * PROPS:
 *   count     — count object from server { running, true, advantage }
 *   shoe      — shoe object from server { cards_remaining, decks_remaining }
 *
 * IMPERATIVE METHODS (via ref):
 *   recordCard(rank, suit, target) — called by App when a card is tapped
 *   resetForNewHand()              — called by App on new hand
 *   resetForShuffle()              — called by App on shuffle
 */

var DealOrderEngine = React.forwardRef(function DealOrderEngine(props, ref) {
  var useState = React.useState;
  var useCallback = React.useCallback;
  var useImperativeHandle = React.useImperativeHandle;
  var useMemo = React.useMemo;

  var count = props.count;
  var shoe = props.shoe;
  var onAppUndo = props.onAppUndo;
  var onNewHand = props.onNewHand;
  var onShuffle = props.onShuffle;
  var inputMode = props.inputMode || 'deal_engine'; // 'deal_engine' | 'manual'

  // ══════════════════════════════════════════════════════════════
  // TABLE CONFIGURATION STATE
  // ══════════════════════════════════════════════════════════════

  var _players = useState(3);
  var players = _players[0];
  var setPlayers = _players[1];

  var _mySeat = useState(1);
  var mySeat = _mySeat[0];
  var setMySeat = _mySeat[1];

  // ══════════════════════════════════════════════════════════════
  // DEAL SEQUENCE STATE
  // ══════════════════════════════════════════════════════════════
  // dealRound: 0 = 1st card to each seat, 1 = 2nd card, 2 = done
  // dealPos:   0..players = seats 0..N-1 then dealer (index=players)

  var _dealPos = useState(0);
  var dealPos = _dealPos[0];
  var setDealPos = _dealPos[1];

  var _dealRound = useState(0);
  var dealRound = _dealRound[0];
  var setDealRound = _dealRound[1];

  // Per-seat card arrays: seatCards[i] = [{label, hilo, suit}]
  // Index 0..players-1 = player seats, index players = dealer
  var _seatCards = useState(function () {
    return initSeatCards(3);
  });
  var seatCards = _seatCards[0];
  var setSeatCards = _seatCards[1];

  // Count snapshot at the moment my seat receives its 2nd card
  var _countAtDecision = useState(null);
  var countAtMyDecision = _countAtDecision[0];
  var setCountAtMyDecision = _countAtDecision[1];

  // Undo stack for deal-order tracking (separate from server undo)
  var _cardLog = useState([]);
  var cardLog = _cardLog[0];
  var setCardLog = _cardLog[1];

  // Round tracking
  var _roundNum = useState(1);
  var roundNum = _roundNum[0];
  var setRoundNum = _roundNum[1];

  var _roundLog = useState([]);
  var roundLog = _roundLog[0];
  var setRoundLog = _roundLog[1];

  var _roundCountHistory = useState([]);
  var roundCountHistory = _roundCountHistory[0];
  var setRoundCountHistory = _roundCountHistory[1];

  // Panel visibility toggles
  var _showLog = useState(false);
  var showLog = _showLog[0];
  var setShowLog = _showLog[1];

  // Compact / expanded mode — compact by default
  var _expanded = useState(false);
  var expanded = _expanded[0];
  var setExpanded = _expanded[1];

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  function initSeatCards(numPlayers) {
    return Array.from({ length: numPlayers + 1 }, function () { return []; });
  }

  /** Count tag for a given rank string — system-aware.
   *  Falls back to HILO_TAG if system lookup not found. */
  function countVal(rank) {
    var sys = (count && count.system) || 'hi_lo';
    var tags = (typeof COUNT_TAGS !== 'undefined' && COUNT_TAGS[sys]) || HILO_TAG;
    var key = (['J','Q','K'].indexOf(rank) !== -1) ? '10' : rank;
    var v = tags[key];
    return v !== undefined ? v : 0;
  }

  /** Seat label for display */
  function seatLabel(idx, numP, mySeatIdx) {
    if (idx === numP) return 'Dealer';
    if (idx === mySeatIdx) return 'ME';
    return 'S' + (idx + 1);
  }

  /** Short seat label for arc nodes */
  function seatArcLabel(idx, numP) {
    if (idx === 0) return '1B';
    if (idx === numP - 1 && numP > 1) return '3B';
    return 'M' + idx;
  }

  /** Position edge label based on seat */
  function getPositionEdge(seat, numP) {
    if (numP === 1) return { label: 'Only Player', cls: 'm' };
    if (seat === numP) return { label: 'Max (3rd Base)', cls: 'g' };
    if (seat === 1) return { label: 'Min (1st Base)', cls: 'b' };
    var pct = (seat - 1) / (numP - 1);
    if (pct >= 0.7) return { label: 'Strong', cls: 'g' };
    if (pct >= 0.4) return { label: 'Moderate', cls: 'm' };
    return { label: 'Low', cls: 'b' };
  }

  /** Info visibility: % of round cards visible before my decision (2nd card).
   *  FIX M9: The previous formula used (numP + seat) for cardsBeforeMe.
   *  Correct derivation:
   *    Round 1: numP cards dealt before player sees their 2nd card (all of round 1)
   *    Round 2: (seat - 1) cards dealt before player's 2nd card (seats 1..seat-1 ahead of me)
   *    Total cards before my 2nd card = numP + (seat - 1)
   *  Old formula overcounted by 1 for every seat (added seat not seat-1).
   */
  function getInfoVisibility(seat, numP) {
    var cardsBeforeMe = numP + (seat - 1);          // FIX M9: was numP + seat
    var totalRoundCards = numP * 2 + 1;             // N player cards × 2 rounds + 1 dealer upcard
    return Math.round((cardsBeforeMe / totalRoundCards) * 100);
  }

  /** Bet action string from count value */
  function getBetAction(c) {
    if (c >= 5) return 'MAX BET';
    if (c >= 3) return 'BET BIG';
    if (c >= 1) return 'SLIGHT EDGE';
    if (c === 0) return 'NEUTRAL';
    return 'SIT OUT';
  }

  // ══════════════════════════════════════════════════════════════
  // DEAL SEQUENCE LOGIC
  // ══════════════════════════════════════════════════════════════

  /** Get description of current deal phase */
  function getDealDescription() {
    if (dealRound >= 2) return 'Round complete — press End Round';
    var cardNum = dealRound === 0 ? '1st' : '2nd';
    var who = dealPos === players ? 'Dealer'
      : dealPos === mySeat - 1 ? 'ME'
      : 'Seat ' + (dealPos + 1);
    return cardNum + ' card \u2192 ' + who;
  }

  /** Label for "Next card for" indicator */
  function getNextLabel() {
    if (dealRound >= 2) return '\u2014';
    if (dealPos === players) return 'DEALER';
    if (dealPos === mySeat - 1) return 'MY CARD';
    return 'SEAT ' + (dealPos + 1);
  }

  /** Short next label for compact mode */
  function getNextShort() {
    if (dealRound >= 2) return 'DONE';
    if (dealPos === players) return 'DLR';
    if (dealPos === mySeat - 1) return 'ME';
    return 'S' + (dealPos + 1);
  }

  // ══════════════════════════════════════════════════════════════
  // CARD RECORDING — called by App when user taps a card
  // ══════════════════════════════════════════════════════════════

  var recordCard = useCallback(function (rank, suit, target) {
    if (dealRound >= 2) return; // round done, must end round first

    var seatIdx = dealPos;
    var hilo = countVal(rank);
    var serverRC = count ? count.running : 0;

    // Add card to seat
    setSeatCards(function (prev) {
      var next = prev.map(function (a) { return a.slice(); });
      next[seatIdx].push({ label: rank, hilo: hilo, suit: suit });
      return next;
    });

    // Push to undo log
    setCardLog(function (prev) {
      return prev.concat([{
        seatIdx: seatIdx, label: rank, hilo: hilo, suit: suit,
        dealRound: dealRound, dealPos: dealPos, skipped: false
      }]);
    });

    // ── CRITICAL: Snapshot count when my seat gets its 2nd card ──
    // serverRC is BEFORE this card (server hasn't processed it yet),
    // so add this card's hilo to get the count AFTER this card.
    if (dealRound === 1 && seatIdx === mySeat - 1) {
      setCountAtMyDecision(serverRC + hilo);
    }

    // Advance deal position
    var nextPos = dealPos + 1;
    var nextRound = dealRound;
    if (nextPos > players) {
      nextPos = 0;
      nextRound = dealRound + 1;
    }
    if (nextRound >= 2) nextRound = 2; // cap — round complete

    setDealPos(nextPos);
    setDealRound(nextRound);
  }, [dealPos, dealRound, players, mySeat, count]);

  /** Skip a card (dealer hole card or unseen card) */
  var skipCard = useCallback(function () {
    if (dealRound >= 2) return;

    var seatIdx = dealPos;

    setSeatCards(function (prev) {
      var next = prev.map(function (a) { return a.slice(); });
      next[seatIdx].push({ label: '?', hilo: 0, suit: null });
      return next;
    });

    setCardLog(function (prev) {
      return prev.concat([{
        seatIdx: seatIdx, label: '?', hilo: 0, suit: null,
        dealRound: dealRound, dealPos: dealPos, skipped: true
      }]);
    });

    // Advance
    var nextPos = dealPos + 1;
    var nextRound = dealRound;
    if (nextPos > players) {
      nextPos = 0;
      nextRound = dealRound + 1;
    }
    if (nextRound >= 2) nextRound = 2;
    setDealPos(nextPos);
    setDealRound(nextRound);
  }, [dealPos, dealRound, players]);

  /** Undo last deal-order card */
  var undoDealCard = useCallback(function () {
    if (cardLog.length === 0) return;

    var last = cardLog[cardLog.length - 1];

    // Remove from seat cards
    setSeatCards(function (prev) {
      var next = prev.map(function (a) { return a.slice(); });
      if (next[last.seatIdx] && next[last.seatIdx].length) {
        next[last.seatIdx].pop();
      }
      return next;
    });

    // Restore deal position
    setDealPos(last.dealPos);
    setDealRound(last.dealRound);

    // Clear decision snapshot if undoing my 2nd card
    if (last.seatIdx === mySeat - 1 && last.dealRound === 1) {
      setCountAtMyDecision(null);
    }

    // Pop from log
    setCardLog(function (prev) { return prev.slice(0, -1); });
  }, [cardLog, mySeat]);

  /** End the current round */
  var endRound = useCallback(function () {
    var serverRC = count ? count.running : 0;
    var serverTC = count ? count.true : 0;
    var decisionCount = countAtMyDecision !== null ? countAtMyDecision : serverRC;

    // Log this round
    setRoundLog(function (prev) {
      return prev.concat([{
        round: roundNum,
        count: serverRC,
        tc: serverTC.toFixed(1),
        countAtDecision: decisionCount,
        action: getBetAction(decisionCount)
      }]);
    });

    setRoundCountHistory(function (prev) {
      var next = prev.concat([serverRC]);
      if (next.length > 20) next = next.slice(next.length - 20);
      return next;
    });

    // Reset for next round (count keeps running)
    setRoundNum(function (n) { return n + 1; });
    setDealPos(0);
    setDealRound(0);
    setSeatCards(initSeatCards(players));
    setCountAtMyDecision(null);
    setCardLog([]);
  }, [count, countAtMyDecision, roundNum, players]);

  /** Full reset on shuffle / new shoe */
  var resetForShuffle = useCallback(function () {
    setDealPos(0);
    setDealRound(0);
    setSeatCards(initSeatCards(players));
    setCountAtMyDecision(null);
    setCardLog([]);
    setRoundNum(1);
    setRoundLog([]);
    setRoundCountHistory([]);
  }, [players]);

  /** Reset deal state for new hand (count persists) */
  var resetForNewHand = useCallback(function () {
    if (cardLog.length > 0) {
      endRound();
    } else {
      setDealPos(0);
      setDealRound(0);
      setSeatCards(initSeatCards(players));
      setCountAtMyDecision(null);
      setCardLog([]);
    }
  }, [cardLog, endRound, players]);

  /** Soft reset — clears deal state without logging a round (used by App undo) */
  var softReset = useCallback(function () {
    setDealPos(0);
    setDealRound(0);
    setSeatCards(initSeatCards(players));
    setCountAtMyDecision(null);
    setCardLog([]);
  }, [players]);

  /** Replay an array of {rank, suit, target} cards into deal engine state (used by App undo) */
  var replayCards = useCallback(function (cards) {
    var pos = 0;
    var round = 0;
    var seats = initSeatCards(players);
    var log = [];
    var snapshot = null;

    cards.forEach(function (card) {
      if (round >= 2) return;
      var seatIdx = pos;
      var hilo = countVal(card.rank);

      seats[seatIdx] = seats[seatIdx].concat([{ label: card.rank, hilo: hilo, suit: card.suit || null }]);
      log.push({
        seatIdx: seatIdx, label: card.rank, hilo: hilo, suit: card.suit || null,
        dealRound: round, dealPos: pos, skipped: false
      });

      // Capture decision snapshot: sum hilo of all cards up to & including this one
      if (round === 1 && seatIdx === mySeat - 1) {
        var cumHilo = 0;
        log.forEach(function (e) { cumHilo += e.hilo; });
        // We don't know absolute serverRC here; store delta for now
        snapshot = cumHilo;
      }

      pos++;
      if (pos > players) { pos = 0; round++; }
      if (round >= 2) round = 2;
    });

    setDealPos(pos);
    setDealRound(round);
    setSeatCards(seats);
    setCardLog(log);
    // Snapshot is relative; set null so fallback to serverRC is used
    // until the next natural card tap captures it accurately
    setCountAtMyDecision(null);
  }, [players, mySeat]);

  // ── Player/seat adjustment ─────────────────────────────────
  var adjPlayers = useCallback(function (d) {
    setPlayers(function (prev) {
      var next = Math.max(1, Math.min(7, prev + d));
      setMySeat(function (s) { return Math.min(s, next); });
      setDealPos(0);
      setDealRound(0);
      setSeatCards(initSeatCards(next));
      setCountAtMyDecision(null);
      setCardLog([]);
      return next;
    });
  }, []);

  var adjMySeat = useCallback(function (d) {
    setMySeat(function (prev) {
      return Math.max(1, Math.min(players, prev + d));
    });
  }, [players]);

  // ══════════════════════════════════════════════════════════════
  // EXPOSE IMPERATIVE API TO APP VIA REF
  // ══════════════════════════════════════════════════════════════

  // C9/C10 fix: resolve the server-side target for the current deal position
  var getCurrentTarget = useCallback(function () {
    if (dealPos === mySeat - 1) return 'player';
    if (dealPos === players) return 'dealer';
    return 'seen';
  }, [dealPos, mySeat, players]);

  useImperativeHandle(ref, function () {
    return {
      recordCard: recordCard,
      resetForNewHand: resetForNewHand,
      resetForShuffle: resetForShuffle,
      skipCard: skipCard,
      undoDealCard: undoDealCard,
      softReset: softReset,
      replayCards: replayCards,
      getCurrentTarget: getCurrentTarget,
    };
  }, [recordCard, resetForNewHand, resetForShuffle, skipCard, undoDealCard, softReset, replayCards, getCurrentTarget]);

  // ══════════════════════════════════════════════════════════════
  // DERIVED VALUES
  // ══════════════════════════════════════════════════════════════

  var serverRC = count ? count.running : 0;
  var serverTC = count ? count.true : 0;
  // Use effective_true (IRC-adjusted) for all EV decisions — correct for KO
  var serverEffTC = count ? (count.effective_true !== undefined ? count.effective_true : count.true) : 0;
  var isKO = count ? count.is_ko : false;
  var decisionCount = countAtMyDecision !== null ? countAtMyDecision : serverRC;
  var decksLeft = shoe ? parseFloat(shoe.decks_remaining) : 6.0;
  // For KO: effective TC = (RC - IRC) / decks; we use serverEffTC directly when no snapshot
  var decisionTC = countAtMyDecision !== null
    ? (decksLeft > 0 ? parseFloat((decisionCount / decksLeft).toFixed(1)) : 0)
    : serverEffTC;
  var mySeatIdx = mySeat - 1;
  var posEdge = getPositionEdge(mySeat, players);
  var infoVis = getInfoVisibility(mySeat, players);
  var isMyTurn = dealPos === mySeatIdx && dealRound < 2;
  var myCards = seatCards[mySeatIdx] || [];
  var totalCardsDealt = cardLog.length;

  // FIX U5: Bet signals must use TRUE COUNT (decisionTC), not the raw running count.
  // RC-based thresholds are only meaningful at exactly 1 deck remaining.
  // At 6 decks remaining, RC=+5 is only TC≈+0.8 — a neutral count.
  // Using TC as the signal gives consistent, deck-adjusted recommendations.
  // Thresholds: TC≥+2 = bet up, TC≥+3 = big bet, TC≥+4 = max bet (Hi-Lo equivalents).
  var betTC = decisionTC; // true count at decision point

  // Count class for decision count colour — use TC for colouring too
  var dcCls = betTC >= 2 ? 'g' : betTC < 0 ? 'b' : 'a';

  // Bet recommendation based on True Count
  var recText, recClass;
  if (betTC >= 4) {
    recClass = 'de-rec-hot'; recText = '\uD83D\uDD25 MAX BET \u2014 TC ' + (betTC >= 0 ? '+' : '') + betTC.toFixed(1);
  } else if (betTC >= 3) {
    recClass = 'de-rec-big'; recText = 'BET BIG \u2014 TC ' + (betTC >= 0 ? '+' : '') + betTC.toFixed(1) + ' strong advantage';
  } else if (betTC >= 1) {
    recClass = 'de-rec-mid'; recText = 'Slight edge \u2014 TC ' + (betTC >= 0 ? '+' : '') + betTC.toFixed(1) + ' moderate bet';
  } else if (betTC === 0) {
    recClass = 'de-rec-mid'; recText = 'Neutral \u2014 minimum bet';
  } else {
    recClass = 'de-rec-small'; recText = 'House advantage (TC ' + betTC.toFixed(1) + ') \u2014 sit out or min';
  }

  // Add hand hint to rec
  if (myCards.length >= 2) {
    var handLabels = myCards.map(function (c) { return c.label; }).join('+');
    recText += ' \u00B7 My hand: ' + handLabels;
  }

  // Short bet signal for compact mode (TC-based)
  var betSignalText, betSignalCls;
  if (betTC >= 4) { betSignalText = 'MAX'; betSignalCls = 'de-sig-hot'; }
  else if (betTC >= 3) { betSignalText = 'BIG'; betSignalCls = 'de-sig-big'; }
  else if (betTC >= 1) { betSignalText = 'UP'; betSignalCls = 'de-sig-mid'; }
  else if (betTC >= 0) { betSignalText = 'MIN'; betSignalCls = 'de-sig-neu'; }
  else { betSignalText = 'OUT'; betSignalCls = 'de-sig-neg'; }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    React.createElement('div', {
      className: 'deal-engine' + (expanded ? ' de-expanded' : ' de-compact'),
      role: 'region',
      'aria-label': 'Deal-Order Engine'
    },

      // ── Header Row — always visible ──────────────────────────
      React.createElement('div', {
        className: 'de-header',
        onClick: function () { setExpanded(function (v) { return !v; }); },
        title: expanded ? 'Click to collapse' : 'Click to expand'
      },
        React.createElement('div', { className: 'de-header-left' },
          React.createElement('span', { className: 'de-htitle' }, 'Deal Engine'),
          React.createElement('span', { className: 'de-badge', style: { animation: 'none' } }, 'LIVE'),
          // ── Mode isolation indicator ──────────────────────────────
          React.createElement('span', {
            className: 'de-badge',
            title: 'Deal Engine mode: cards go to seats only. Player & Dealer hands are isolated.',
            style: {
              background: 'rgba(255,212,71,0.15)',
              border: '1px solid rgba(255,212,71,0.5)',
              color: '#ffd447',
              fontSize: '0.55rem',
              letterSpacing: '0.05em',
              animation: 'none',
            }
          }, '🎯 SEATS ONLY'),
          totalCardsDealt > 0 && React.createElement('span', { className: 'de-card-count' },
            totalCardsDealt + ' card' + (totalCardsDealt !== 1 ? 's' : ''))
        ),
        React.createElement('div', { className: 'de-header-right' },
          React.createElement('span', { className: 'de-toggle-hint' },
            expanded ? 'Less' : 'More'),
          React.createElement('span', { className: 'de-toggle-arrow' + (expanded ? ' up' : '') },
            '\u25BC')
        )
      ),

      // ═════════════════════════════════════════════════════════
      // COMPACT BODY — always visible (dense horizontal layout)
      // ═════════════════════════════════════════════════════════
      React.createElement('div', { className: 'de-compact-body' },

        // ── Mini Seat Dots ───────────────────────────────────
        React.createElement('div', { className: 'de-mini-seats' },
          Array.from({ length: players }, function (_, i) {
            var isMe = i === mySeatIdx;
            var isActive = i === dealPos && dealRound < 2;
            var cls = 'de-dot' + (isMe ? ' me' : '') + (isActive ? ' active' : '');
            return React.createElement('div', {
              key: 'md-' + i, className: cls,
              style: { animation: 'none' },
              onClick: function (e) { e.stopPropagation(); setMySeat(i + 1); },
              title: isMe ? 'Your seat (S' + (i+1) + ')' : 'Click to set as your seat'
            }, isMe ? 'M' : (i + 1));
          }),
          React.createElement('div', {
            key: 'md-d',
            className: 'de-dot dlr' + (dealPos === players && dealRound < 2 ? ' active' : ''),
            style: { animation: 'none' },
          }, 'D')
        ),

        // ── Deal Status (compact) ────────────────────────────
        React.createElement('div', { className: 'de-mini-status' },
          React.createElement('span', { className: 'de-ms-round' },
            'R' + roundNum + (dealRound < 2 ? '.' + (dealRound + 1) : '')),
          React.createElement('span', { className: 'de-ms-arrow' }, '\u2192'),
          React.createElement('span', {
            className: 'de-ms-next' + (isMyTurn ? ' mine' : '')
          }, getNextShort())
        ),

        // ── Decision Count (compact) ─────────────────────────
        React.createElement('div', { className: 'de-mini-count' },
          React.createElement('span', { className: 'de-mc-label' }, 'Count'),
          React.createElement('span', { className: 'de-mc-val ' + dcCls },
            decisionCount > 0 ? '+' + decisionCount : '' + decisionCount)
        ),

        // ── Bet Signal Chip ──────────────────────────────────
        React.createElement('div', { className: 'de-signal ' + betSignalCls },
          betSignalText
        ),

        // ── Compact Action Buttons ───────────────────────────
        React.createElement('div', { className: 'de-mini-actions' },
          React.createElement('button', {
            className: 'de-ma',
            onClick: function (e) { e.stopPropagation(); if (onAppUndo) onAppUndo(); else undoDealCard(); },
            title: 'Undo last deal card'
          }, '\u21A9'),
          React.createElement('button', {
            className: 'de-ma',
            onClick: function (e) { e.stopPropagation(); if (onNewHand) onNewHand(); else endRound(); },
            title: 'End current round'
          }, '\u25CE'),
          React.createElement('button', {
            className: 'de-ma',
            onClick: function (e) { e.stopPropagation(); skipCard(); },
            title: 'Skip / hidden card'
          }, '\u21E5'),
          React.createElement('button', {
            className: 'de-ma warn',
            onClick: function (e) { e.stopPropagation(); if (onShuffle) onShuffle(); else resetForShuffle(); },
            title: 'New shoe (reset)'
          }, '\u27F3')
        )
      ),

      // ═════════════════════════════════════════════════════════
      // EXPANDED BODY — only when expanded
      // ═════════════════════════════════════════════════════════
      expanded && React.createElement('div', { className: 'de-expanded-body' },

        // ── Table Arc Visualization ────────────────────────────
        React.createElement('div', { className: 'de-table' },
          React.createElement('div', { className: 'de-felt' }),
          React.createElement('div', { className: 'de-dealer-label' }, 'DEALER'),
          React.createElement('div', { className: 'de-seats' },
            Array.from({ length: 7 }, function (_, i) {
              if (i < players) {
                var isMe = i === mySeatIdx;
                var isActive = i === dealPos && dealRound < 2;
                var cls = 'de-seat occ' + (isMe ? ' me' : '') + (isActive ? ' active-deal' : '');
                return React.createElement('div', {
                  key: 'seat-' + i,
                  className: cls,
                  style: { animation: 'none' },
                  'data-lbl': seatArcLabel(i, players),
                  onClick: function () { setMySeat(i + 1); },
                  title: isMe ? 'Your seat' : 'Click to set as your seat'
                }, isMe ? 'ME' : (i + 1));
              }
              return React.createElement('div', {
                key: 'seat-' + i,
                className: 'de-seat empty',
                'data-lbl': ''
              }, '\u00B7');
            }),
            React.createElement('div', {
              key: 'dealer',
              className: 'de-seat occ' + (dealPos === players && dealRound < 2 ? ' active-deal' : ''),
              style: { animation: 'none' },
              'data-lbl': 'DLR'
            }, 'D')
          )
        ),

        // ── Setup Controls ────────────────────────────────────
        React.createElement('div', { className: 'de-setup' },
          React.createElement('div', { className: 'de-ctrl' },
            React.createElement('div', { className: 'de-ctrl-lbl' }, 'Players'),
            React.createElement('div', { className: 'de-stepper' },
              React.createElement('button', {
                className: 'de-sb', onClick: function () { adjPlayers(-1); },
                'aria-label': 'Decrease players'
              }, '\u2212'),
              React.createElement('div', { className: 'de-sv' }, players),
              React.createElement('button', {
                className: 'de-sb', onClick: function () { adjPlayers(1); },
                'aria-label': 'Increase players'
              }, '+')
            )
          ),
          React.createElement('div', { className: 'de-ctrl' },
            React.createElement('div', { className: 'de-ctrl-lbl' }, 'My Seat'),
            React.createElement('div', { className: 'de-stepper' },
              React.createElement('button', {
                className: 'de-sb', onClick: function () { adjMySeat(-1); },
                'aria-label': 'Move seat left'
              }, '\u2212'),
              React.createElement('div', { className: 'de-sv' }, mySeat),
              React.createElement('button', {
                className: 'de-sb', onClick: function () { adjMySeat(1); },
                'aria-label': 'Move seat right'
              }, '+')
            )
          )
        ),

        // ── Deal Status Bar ───────────────────────────────────
        React.createElement('div', { className: 'de-status' },
          React.createElement('div', { className: 'de-status-left' },
            React.createElement('div', { className: 'de-round' }, 'Round ' + roundNum),
            React.createElement('div', { className: 'de-desc' }, getDealDescription())
          ),
          React.createElement('div', { className: 'de-status-right' },
            React.createElement('div', { className: 'de-next-lbl' }, 'Next card for'),
            React.createElement('div', { className: 'de-next' }, getNextLabel())
          )
        ),

        // ── Per-Seat Card Display ─────────────────────────────
        React.createElement('div', { className: 'de-seat-cards' },
          Array.from({ length: players + 1 }, function (_, i) {
            var isMe = i === mySeatIdx;
            var isDealer = i === players;
            var lbl = isDealer ? 'Dealer' : (isMe ? 'ME' : 'S' + (i + 1));
            var boxCls = 'de-sc-box' + (isMe ? ' mine' : '') + (isDealer ? ' dealer' : '');
            var cards = seatCards[i] || [];
            return React.createElement('div', { key: 'scb-' + i, className: boxCls },
              React.createElement('div', { className: 'de-sc-lbl' }, lbl),
              React.createElement('div', { className: 'de-sc-cards' },
                cards.map(function (c, ci) {
                  var cls = c.label === '?' ? 'hid'
                    : c.hilo > 0 ? 'p'
                    : c.hilo < 0 ? 'm'
                    : 'z';
                  return React.createElement('span', {
                    key: ci, className: 'de-sc-card ' + cls
                  }, c.label);
                })
              )
            );
          })
        ),

        // ── My Decision Panel ─────────────────────────────────
        React.createElement('div', {
          className: 'de-decision' + (isMyTurn ? ' active' : '')
        },
          React.createElement('div', { className: 'de-decision-title' },
            'My Seat Analysis \u2014 Seat ' + mySeat
          ),
          React.createElement('div', { className: 'de-decision-grid' },
            React.createElement('div', { className: 'de-d-item' },
              React.createElement('span', { className: 'de-d-key' }, 'Count when I act'),
              React.createElement('span', { className: 'de-d-val ' + dcCls },
                decisionCount > 0 ? '+' + decisionCount : '' + decisionCount
              )
            ),
            React.createElement('div', { className: 'de-d-item' },
              React.createElement('span', { className: 'de-d-key' }, 'True count'),
              React.createElement('span', { className: 'de-d-val a' }, decisionTC)
            ),
            React.createElement('div', { className: 'de-d-item' },
              React.createElement('span', { className: 'de-d-key' }, 'Info visible'),
              React.createElement('span', { className: 'de-d-val a' }, infoVis + '% of round')
            ),
            React.createElement('div', { className: 'de-d-item' },
              React.createElement('span', { className: 'de-d-key' }, 'Position edge'),
              React.createElement('span', { className: 'de-d-val ' + posEdge.cls }, posEdge.label)
            )
          ),
          React.createElement('div', { className: recClass }, recText)
        ),

        // ── Full Action Buttons ───────────────────────────────
        React.createElement('div', { className: 'de-actions' },
          React.createElement('button', {
            className: 'de-act',
            onClick: onAppUndo || undoDealCard,
            'aria-label': 'Undo last deal-order card'
          }, '\u21A9 Undo'),
          React.createElement('button', {
            className: 'de-act',
            onClick: onNewHand || endRound,
            'aria-label': 'End current round'
          }, '\u25CE End Round'),
          React.createElement('button', {
            className: 'de-act',
            onClick: onShuffle || resetForShuffle,
            'aria-label': 'Reset for new shoe'
          }, '\u27F3 New Shoe'),
          React.createElement('button', {
            className: 'de-act',
            onClick: skipCard,
            'aria-label': 'Skip hidden or unseen card'
          }, '\u21E5 Skip/Hidden'),
          React.createElement('button', {
            className: 'de-act' + (showLog ? ' hi' : ''),
            onClick: function () { setShowLog(function (v) { return !v; }); },
            'aria-label': 'Toggle round log'
          }, '\u25A4 Round Log')
        ),

        // ── Shoe Count Trend (hidden when empty) ──────────────
        roundCountHistory.length > 0 && React.createElement('div', { className: 'de-trend' },
          React.createElement('div', { className: 'de-trend-title' }, 'Shoe Count Trend \u2014 Round by Round'),
          React.createElement('div', { className: 'de-trend-chart' },
            roundCountHistory.map(function (c, i) {
              var maxAbs = Math.max(
                Math.abs(Math.min.apply(null, roundCountHistory)),
                Math.abs(Math.max.apply(null, roundCountHistory)),
                3
              );
              var pct = Math.max(4, Math.abs(c) / maxAbs * 100);
              var bg = c >= 3 ? 'var(--jade)' : c < 0 ? 'var(--ruby)' : 'var(--sapph)';
              var opacity = 0.4 + Math.abs(c) / maxAbs * 0.6;
              return React.createElement('div', {
                key: i,
                className: 'de-trend-bar',
                style: {
                  height: pct + '%',
                  background: bg,
                  opacity: opacity
                },
                title: 'Count: ' + (c > 0 ? '+' : '') + c
              });
            })
          ),
          React.createElement('div', { className: 'de-trend-labels' },
            React.createElement('span', null, 'Oldest'),
            React.createElement('span', null, 'Latest')
          )
        ),

        // ── Round Log (collapsible) ───────────────────────────
        showLog && React.createElement('div', { className: 'de-log' },
          React.createElement('div', { className: 'de-log-title' }, 'Round Log \u2014 Count at Decision'),
          roundLog.length === 0
            ? React.createElement('div', { className: 'de-log-empty' }, 'No rounds logged yet')
            : roundLog.slice().reverse().map(function (r, i) {
                var cc = r.countAtDecision !== null ? r.countAtDecision : r.count;
                var ccCls = cc >= 3 ? 'p' : cc < 0 ? 'n' : 'z';
                var aCls = r.action.indexOf('BIG') !== -1 || r.action.indexOf('MAX') !== -1
                  ? 'big' : r.action.indexOf('SIT') !== -1 ? 'small' : 'wait';
                return React.createElement('div', { key: i, className: 'de-log-entry' },
                  React.createElement('span', { className: 'de-le-round' }, 'R' + r.round),
                  React.createElement('span', { className: 'de-le-count ' + ccCls },
                    'Count: ' + (cc >= 0 ? '+' : '') + cc + ' (TC ' + r.tc + ')'
                  ),
                  React.createElement('span', { className: 'de-le-action ' + aCls }, r.action)
                );
              })
        )
      )
    )
  );
});