// @ts-nocheck
/*
 * components/SplitHandPanel.js
 * ─────────────────────────────────────────────────────────
 * Shown when the player splits a pair.
 * Replaces the normal single-hand display with two side-by-side
 * hand zones, each with its own:
 *   • Card display
 *   • Hand total
 *   • Independent AI recommendation
 *   • Status (active / complete / bust / BJ)
 *
 * Rules enforced and displayed:
 *   • Split aces: one card each, no further hit (shown as STAND forced)
 *   • No double after split (config ALLOW_DOUBLE_AFTER_SPLIT = false)
 *   • No surrender on split hands
 *   • Independent strategy for each hand vs same dealer upcard
 *
 * Props:
 *   splitHands       — array of split hand objects from server
 *   activeHandIndex  — which hand is currently being played (0 or 1)
 *   dealerUpcard     — dealer upcard string
 *   socket           — socket for emitting next_split_hand
 *   onNextHand       — callback when moving to next split hand
 */

const ACTION_COLORS_SP = {
  HIT: '#ff5c5c', STAND: '#44e882', DOUBLE: '#ffd447',
  SPLIT: '#b99bff', SURRENDER: '#ff9944',
};

function SplitHandCard({ cardStr }) {
  if (!cardStr) return null;
  const suit = cardStr.slice(-1);
  const rank = cardStr.slice(0, -1);
  const isRed = suit === '♥' || suit === '♦';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', width: 40, height: 56, borderRadius: 6,
      background: '#1a2236', border: `1.5px solid ${isRed ? 'rgba(255,120,120,0.5)' : 'rgba(255,255,255,0.2)'}`,
      fontFamily: 'DM Mono, monospace', fontWeight: 800,
      color: isRed ? '#ff7a7a' : '#ffffff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      fontSize: 13, gap: 1,
    }}>
      <span>{rank}</span>
      <span style={{ fontSize: 10 }}>{suit}</span>
    </div>
  );
}

function SplitHandZone({ hand, handNumber, isActive, dealerUpcard, onComplete }) {
  const { useState } = React;

  if (!hand) return null;

  const rec    = hand.recommendation;
  const action = rec?.action;
  const acCol  = action ? (ACTION_COLORS_SP[action] || '#ffffff') : '#94a7c4';
  const val    = hand.value;
  const isBust = hand.is_bust;
  const isBJ   = hand.is_blackjack;
  const isSplitAce = hand.is_split_ace;

  const status = isBust ? 'BUST' : isBJ ? 'BJ' : hand.cards.length === 0 ? 'WAITING' : null;
  const statusColor = isBust ? '#ff5c5c' : isBJ ? '#ffd447' : '#94a7c4';

  return (
    <div style={{
      flex: 1, borderRadius: 10, padding: '12px',
      background: isActive ? 'rgba(255,212,71,0.06)' : 'rgba(255,255,255,0.02)',
      border: `2px solid ${isActive ? 'rgba(255,212,71,0.5)' : 'rgba(255,255,255,0.1)'}`,
      position: 'relative', transition: 'all 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: isActive ? '#ffd447' : '#94a7c4',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Hand {handNumber}
          </span>
          {isActive && (
            <span style={{ fontSize: 8, fontWeight: 700, color: '#ffd447',
              background: 'rgba(255,212,71,0.15)', border: '1px solid rgba(255,212,71,0.4)',
              borderRadius: 3, padding: '1px 5px' }}>ACTIVE</span>
          )}
          {isSplitAce && (
            <span style={{ fontSize: 8, color: '#b99bff',
              background: 'rgba(185,155,255,0.12)', border: '1px solid rgba(185,155,255,0.3)',
              borderRadius: 3, padding: '1px 5px' }}>ACE — 1 card</span>
          )}
        </div>
        {/* Hand total */}
        <div style={{
          fontSize: 18, fontWeight: 900, fontFamily: 'DM Mono, monospace',
          color: isBust ? '#ff5c5c' : isBJ ? '#ffd447' : '#ffffff',
        }}>
          {hand.cards.length > 0 ? (hand.is_soft && !isBust ? `S${val}` : val) : '—'}
          {status && <span style={{ fontSize: 11, color: statusColor, marginLeft: 5 }}>{status}</span>}
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10, minHeight: 60 }}>
        {hand.cards.length === 0
          ? <div style={{ fontSize: 10, color: '#94a7c4', alignSelf: 'center' }}>Deal a card</div>
          : hand.cards.map((c, i) => <SplitHandCard key={i} cardStr={c} />)
        }
      </div>

      {/* AI Recommendation */}
      {isActive && rec && (
        <div style={{
          padding: '8px 10px', borderRadius: 7,
          background: `${acCol}12`, border: `1px solid ${acCol}45`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: acCol,
            fontFamily: 'Syne, sans-serif', textShadow: `0 0 12px ${acCol}50` }}>
            {action}
          </span>
          {rec.is_deviation && (
            <span style={{ fontSize: 8, fontWeight: 700, color: '#b99bff',
              background: 'rgba(185,155,255,0.12)', border: '1px solid rgba(185,155,255,0.3)',
              borderRadius: 3, padding: '1px 4px' }}>DEV</span>
          )}
          {isSplitAce && (
            <span style={{ fontSize: 9, color: '#94a7c4' }}>Forced STAND (split aces)</span>
          )}
        </div>
      )}

      {/* Waiting / complete states */}
      {!isActive && !isBust && !isBJ && hand.cards.length > 0 && (
        <div style={{ fontSize: 10, color: '#94a7c4', textAlign: 'center', paddingTop: 4 }}>
          {action ? `→ ${action} when active` : 'Complete'}
        </div>
      )}

      {/* Done button — when active hand is complete */}
      {isActive && !isBust && hand.cards.length >= 2 && onComplete && (
        <button onClick={onComplete} aria-label={`Done with split hand ${handNumber}`} style={{
          width: '100%', marginTop: 8, padding: '6px', fontSize: 10, fontWeight: 700,
          borderRadius: 6, cursor: 'pointer',
          background: 'rgba(106,175,255,0.12)', border: '1px solid rgba(106,175,255,0.4)',
          color: '#6aafff',
        }}>
          ✓ Done with Hand {handNumber} → Next Hand
        </button>
      )}
    </div>
  );
}

function SplitHandPanel({ splitHands, activeHandIndex, dealerUpcard, socket, onNextHand }) {
  if (!splitHands || splitHands.length === 0) return null;

  const handleComplete = () => {
    if (socket && socket.connected) {
      socket.emit('next_split_hand');
    }
    if (onNextHand) onNextHand();
  };

  const allDone = splitHands.every(h => h.is_bust || h.is_blackjack ||
    (h.is_split_ace && h.cards.length >= 2));

  return (
    <div style={{
      background: '#1a2236', border: '1.5px solid rgba(255,212,71,0.3)',
      borderRadius: 12, padding: '14px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#ffd447',
            textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'Syne, sans-serif' }}>
            ✂ Split Hands
          </span>
          <span style={{ fontSize: 9, color: '#94a7c4' }}>
            Playing Hand {activeHandIndex + 1} of {splitHands.length}
          </span>
        </div>
        {dealerUpcard && (
          <span style={{ fontSize: 10, color: '#94a7c4' }}>
            Dealer shows: <b style={{ color: '#ffffff' }}>{dealerUpcard}</b>
          </span>
        )}
      </div>

      {/* Rules reminder */}
      <div style={{
        fontSize: 9, color: '#94a7c4', marginBottom: 10,
        padding: '5px 8px', borderRadius: 5,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        lineHeight: 1.6,
      }}>
        <span style={{ color: '#b0bfd8', fontWeight: 600 }}>Split rules: </span>
        No surrender · No double after split · Split aces get 1 card each · Each hand plays independently
      </div>

      {/* Two hand zones */}
      <div style={{ display: 'flex', gap: 10 }}>
        {splitHands.map((hand, i) => (
          <SplitHandZone
            key={i}
            hand={hand}
            handNumber={i + 1}
            isActive={i === activeHandIndex}
            dealerUpcard={dealerUpcard}
            onComplete={i === activeHandIndex && i < splitHands.length - 1 ? handleComplete : null}
          />
        ))}
      </div>

      {/* All hands complete */}
      {allDone && (
        <div style={{
          marginTop: 10, padding: '8px', borderRadius: 6, textAlign: 'center',
          background: 'rgba(68,232,130,0.08)', border: '1px solid rgba(68,232,130,0.3)',
          fontSize: 11, color: '#44e882', fontWeight: 700,
        }}>
          All split hands complete — record results then press N for new hand
        </div>
      )}
    </div>
  );
}
