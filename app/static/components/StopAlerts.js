/*
 * components/StopAlerts.js
 * ─────────────────────────────────────────────────────────
 * Two components exported as globals:
 *
 *  StopAlerts        — floating overlay (bottom-right fixed position).
 *                      Renders null when idle. Slides in as a compact
 *                      warning toast within 20% of a threshold, upgrades
 *                      to a full pulsing banner when triggered.
 *                      Positioned by the fixed-overlay wrapper in App.jsx.
 *
 *  StopAlertsConfig  — always-visible inline panel in the right column
 *                      Tier 1. Shows live P&L progress bars toward each
 *                      threshold and a ⚙ gear button to edit the limits.
 *                      This solves the "I can't find Stop Alerts" problem:
 *                      users always see the thresholds and can configure
 *                      them without needing to trigger an alert first.
 *
 * Shared props:
 *   session  — { total_profit, hands_played, should_leave,
 *                stop_reason, stop_loss, stop_win }
 *   currency — { symbol }
 *   socket   — socket.io instance for set_stop_thresholds
 *
 * The two components are intentionally independent (no shared state ref)
 * so either can be used standalone without the other.
 */


// ══════════════════════════════════════════════════════════════════════
// SHARED EDIT FORM — reused by both components
// ══════════════════════════════════════════════════════════════════════

function _StopEditForm({ sym, tempLoss, tempWin, setTempLoss, setTempWin, onSave, onCancel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[
        { label: 'Stop-Loss', val: tempLoss, set: setTempLoss, neg: true },
        { label: 'Stop-Win',  val: tempWin,  set: setTempWin,  neg: false },
      ].map(({ label: l, val, set, neg }) => (
        <div key={l}>
          <div style={{ fontSize: 8, color: '#94a7c4', marginBottom: 2 }}>{l} ({sym})</div>
          <input
            type="number"
            aria-label={l}
            value={neg ? Math.abs(val) : val}
            onChange={e => set(neg
              ? -(parseFloat(e.target.value) || 0)
              :  (parseFloat(e.target.value) || 0)
            )}
            style={{
              width: '100%', padding: '5px 8px', fontSize: 11, borderRadius: 5,
              background: '#1a2236', border: '1px solid rgba(255,255,255,0.15)',
              color: '#f0f4ff', fontFamily: 'monospace', boxSizing: 'border-box',
            }}
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onSave}
          style={{
            flex: 2, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
            background: 'rgba(68,232,130,0.12)', border: '1px solid rgba(68,232,130,0.3)',
            color: '#44e882',
          }}
        >Save</button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a7c4',
          }}
        >Cancel</button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
// StopAlertsConfig — always-visible inline panel (right column Tier 1)
// ══════════════════════════════════════════════════════════════════════

function StopAlertsConfig({ session, currency, socket }) {
  const { useState, useEffect } = React;

  const profit = session?.total_profit ?? 0;
  const sym    = currency?.symbol ?? '₹';

  const serverStopLoss = session?.stop_loss ?? -5000;
  const serverStopWin  = session?.stop_win  ??  3000;

  const [stopLoss,  setStopLoss]  = useState(serverStopLoss);
  const [stopWin,   setStopWin]   = useState(serverStopWin);
  const [editing,   setEditing]   = useState(false);
  const [tempLoss,  setTempLoss]  = useState(serverStopLoss);
  const [tempWin,   setTempWin]   = useState(serverStopWin);

  // Keep local state in sync when server sends updated thresholds
  useEffect(() => {
    if (!editing) {
      setStopLoss(serverStopLoss);
      setStopWin(serverStopWin);
    }
  }, [serverStopLoss, serverStopWin]);

  // P&L progress toward each threshold (clamped 0-100%)
  const lossRange   = Math.abs(stopLoss);
  const winRange    = stopWin;
  // How far we've moved toward the stop-loss (profit is negative when losing)
  const lossPct     = lossRange > 0 ? Math.min(100, Math.max(0, (Math.abs(Math.min(0, profit)) / lossRange) * 100)) : 0;
  // How far we've moved toward the stop-win
  const winPct      = winRange  > 0 ? Math.min(100, Math.max(0, (Math.max(0, profit) / winRange)  * 100)) : 0;

  // Colour the bar depending on proximity
  const lossColor = lossPct >= 80 ? '#ff5c5c' : lossPct >= 50 ? '#ff9944' : '#94a7c4';
  const winColor  = winPct  >= 80 ? '#44e882' : winPct  >= 50 ? '#ffd447' : '#94a7c4';

  const handleSave = () => {
    setStopLoss(tempLoss);
    setStopWin(tempWin);
    setEditing(false);

    // reset alert suppression after config change
    if (window.__resetStopAlerts) window.__resetStopAlerts();

    if (socket) socket.emit('set_stop_thresholds', { stop_loss: tempLoss, stop_win: tempWin });
  };

  return (
    <div style={{
      background: '#111827',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      padding: '10px 12px',
    }}>

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: editing ? 10 : 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11 }}>🛑</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#ccdaec', letterSpacing: '0.04em' }}>
            SESSION LIMITS
          </span>
        </div>
        {!editing && (
          <button
            onClick={() => { setTempLoss(stopLoss); setTempWin(stopWin); setEditing(true); }}
            aria-label="Edit stop limits"
            title="Edit stop-loss / stop-win limits"
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 5, color: '#94a7c4', cursor: 'pointer',
              fontSize: 11, padding: '2px 7px', lineHeight: 1.4,
            }}
          >⚙ Edit</button>
        )}
      </div>

      {editing ? (
        <_StopEditForm
          sym={sym}
          tempLoss={tempLoss} tempWin={tempWin}
          setTempLoss={setTempLoss} setTempWin={setTempWin}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>

          {/* Stop-Loss bar */}
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 8, color: '#94a7c4', marginBottom: 3,
            }}>
              <span style={{ color: lossColor, fontWeight: lossPct >= 80 ? 700 : 400 }}>
                Stop-Loss {lossPct >= 80 ? '⚠' : ''}
              </span>
              <span style={{ fontFamily: 'monospace' }}>
                <span style={{ color: profit < 0 ? '#ff7070' : '#94a7c4' }}>
                  {profit < 0 ? sym + Math.abs(profit).toLocaleString() : sym + '0'}
                </span>
                <span style={{ color: '#4a5568' }}> / </span>
                <span>{sym}{lossRange.toLocaleString()}</span>
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${lossPct}%`,
                background: lossColor,
                transition: 'width 0.4s ease, background 0.3s ease',
              }} />
            </div>
          </div>

          {/* Stop-Win bar */}
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 8, color: '#94a7c4', marginBottom: 3,
            }}>
              <span style={{ color: winColor, fontWeight: winPct >= 80 ? 700 : 400 }}>
                Stop-Win {winPct >= 80 ? '🏆' : ''}
              </span>
              <span style={{ fontFamily: 'monospace' }}>
                <span style={{ color: profit > 0 ? '#44e882' : '#94a7c4' }}>
                  {profit > 0 ? sym + profit.toLocaleString() : sym + '0'}
                </span>
                <span style={{ color: '#4a5568' }}> / </span>
                <span>{sym}{winRange.toLocaleString()}</span>
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${winPct}%`,
                background: winColor,
                transition: 'width 0.4s ease, background 0.3s ease',
              }} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════
// StopAlerts — floating overlay toast (bottom-right, renders null idle)
// ══════════════════════════════════════════════════════════════════════

function StopAlerts({ session, currency, socket }) {
  const { useState, useEffect, useRef } = React;

  const profit = session?.total_profit ?? 0;
  const hands  = session?.hands_played ?? 0;
  const sym    = currency?.symbol ?? '₹';

  const serverStopLoss = session?.stop_loss ?? -5000;
  const serverStopWin  = session?.stop_win  ??  3000;

  const [stopLoss,  setStopLoss]  = useState(serverStopLoss);
  const [stopWin,   setStopWin]   = useState(serverStopWin);
  const [snoozedAt, setSnoozedAt] = useState(null);
  const [dismissed, setDismissed] = useState({ loss: false, win: false });
  const [editing,   setEditing]   = useState(false);
  const [tempLoss,  setTempLoss]  = useState(serverStopLoss);
  const [tempWin,   setTempWin]   = useState(serverStopWin);
  const alertedRef = useRef({ loss: false, win: false });

  const prevHandsRef = useRef(hands);

  useEffect(() => {
    if (hands < prevHandsRef.current) {
      setDismissed({ loss: false, win: false });
      setSnoozedAt(null);
      alertedRef.current = { loss: false, win: false };
    }
    prevHandsRef.current = hands;
  }, [hands]);

  useEffect(() => {
    window.__resetStopAlerts = () => {
      setDismissed({ loss: false, win: false });
      setSnoozedAt(null);
      alertedRef.current = { loss: false, win: false };
    };
    return () => { delete window.__resetStopAlerts; };
  }, []);

  useEffect(() => {
    if (!editing) {
      setStopLoss(serverStopLoss);
      setStopWin(serverStopWin);
    }
  }, [serverStopLoss, serverStopWin]);

  const backendShouldLeave = session?.should_leave ?? false;
  const backendStopReason  = session?.stop_reason  ?? null;

  const playAlert = (type) => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = type === 'loss' ? 220 : 660;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {}
  };

  const snoozeActive = snoozedAt !== null && (hands - snoozedAt) < 10;

  const lossHit = backendShouldLeave
    ? backendStopReason === 'STOP_LOSS'
    : profit <= stopLoss;
  const winHit = backendShouldLeave
    ? backendStopReason === 'STOP_WIN'
    : profit >= stopWin;

  // Within 20% of the threshold range — show a warning before it fires
  const lossRange   = Math.abs(stopLoss);
  const winRange    = stopWin;
  const lossWarning = !lossHit && profit < 0 && Math.abs(profit) >= lossRange * 0.8;
  const winWarning  = !winHit  && profit > 0 && profit >= winRange * 0.8;

  useEffect(() => {
    if (lossHit && !alertedRef.current.loss && !dismissed.loss) {
      alertedRef.current.loss = true;
      if (!snoozeActive) playAlert('loss');
    }
    if (winHit && !alertedRef.current.win && !dismissed.win) {
      alertedRef.current.win = true;
      if (!snoozeActive) playAlert('win');
    }
    if (!lossHit) alertedRef.current.loss = false;
    if (!winHit)  alertedRef.current.win  = false;
  }, [lossHit, winHit]);

  const snooze = () => {
    setSnoozedAt(hands);
    setDismissed({ loss: false, win: false });
  };
  const dismiss = (type) => setDismissed(d => ({ ...d, [type]: true }));

  const showLossAlert   = lossHit     && !dismissed.loss && !snoozeActive;
  const showWinAlert    = winHit      && !dismissed.win  && !snoozeActive;
  const showLossWarning = lossWarning && !dismissed.loss && !snoozeActive;
  const showWinWarning  = winWarning  && !dismissed.win  && !snoozeActive;

  // ── IDLE: render nothing — StopAlertsConfig handles the always-visible UI ──
  if (!showLossAlert && !showWinAlert && !showLossWarning && !showWinWarning && !editing) {
    return null;
  }

  const isTriggered = showLossAlert || showWinAlert;
  const isLoss      = showLossAlert || showLossWarning;

  const shellStyle = {
    width: 280,
    background: '#111827',
    border: `1.5px solid ${
      isTriggered
        ? (isLoss ? 'rgba(255,92,92,0.7)' : 'rgba(68,232,130,0.6)')
        : 'rgba(255,212,71,0.45)'
    }`,
    borderRadius: 12,
    padding: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    animation: isTriggered ? 'live-pulse 1.2s ease-in-out infinite' : 'toastSlide 0.25s ease',
  };

  // ── WARNING toast (compact) ─────────────────────────────────────────────
  if (!isTriggered) {
    const buffer = showLossWarning
      ? Math.max(0, Math.abs(stopLoss) - Math.abs(profit))
      : Math.max(0, stopWin - profit);
    return (
      <div style={shellStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ffd447' }}>
                {showLossWarning ? 'Approaching stop-loss' : 'Approaching stop-win'}
              </div>
              <div style={{ fontSize: 9, color: '#94a7c4', marginTop: 1 }}>
                {sym}{buffer.toLocaleString()} remaining
              </div>
            </div>
          </div>
          <button
            onClick={() => dismiss(showLossWarning ? 'loss' : 'win')}
            aria-label="Dismiss warning"
            style={{
              background: 'transparent', border: 'none', color: '#94a7c4',
              cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2,
            }}
          >✕</button>
        </div>
      </div>
    );
  }

  // ── TRIGGERED banner (full) ─────────────────────────────────────────────
  const lossFill = lossRange > 0
    ? Math.min(1, Math.max(0, Math.abs(profit) / lossRange))
    : 0;

  const winFill = winRange > 0
    ? Math.min(1, Math.max(0, profit / winRange))
    : 0;

  return (
    <div style={shellStyle}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>
          {showLossAlert ? '🛑' : '🏆'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 12, fontWeight: 800,
            color: showLossAlert ? '#ff5c5c' : '#44e882',
          }}>
            {showLossAlert ? 'STOP-LOSS HIT — Leave table' : 'STOP-WIN HIT — Lock profit'}
          </div>
          <div style={{ fontSize: 9, color: '#94a7c4', marginTop: 1 }}>
            {showLossAlert
              ? `Down ${sym}${Math.abs(profit).toLocaleString()} · limit ${sym}${Math.abs(stopLoss).toLocaleString()}`
              : `Up ${sym}${profit.toLocaleString()} · target ${sym}${stopWin.toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* P&L progress bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a7c4', marginBottom: 3 }}>
          <span>{showLossAlert ? 'Stop-Loss' : 'Stop-Win'}</span>
          <span style={{
            fontFamily: 'monospace', fontWeight: 700,
            color: profit >= 0 ? '#44e882' : '#ff5c5c',
          }}>
            {profit >= 0 ? '+' : ''}{sym}{Math.abs(profit).toLocaleString()}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${(showLossAlert ? lossFill : winFill) * 100}%`,
            background: showLossAlert ? '#ff5c5c' : '#44e882',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Actions */}
      {!editing ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={snooze}
            aria-label="Snooze for 10 hands"
            style={{
              flex: 1, padding: '5px 0', fontSize: 9, borderRadius: 6, cursor: 'pointer',
              background: showLossAlert ? 'rgba(255,92,92,0.15)' : 'rgba(68,232,130,0.12)',
              border: `1px solid ${showLossAlert ? 'rgba(255,92,92,0.35)' : 'rgba(68,232,130,0.3)'}`,
              color: showLossAlert ? '#ff5c5c' : '#44e882',
            }}
          >Snooze 10 hands</button>
          <button
            onClick={() => dismiss(showLossAlert ? 'loss' : 'win')}
            aria-label="Dismiss alert"
            style={{
              flex: 1, padding: '5px 0', fontSize: 9, borderRadius: 6, cursor: 'pointer',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a7c4',
            }}
          >Dismiss</button>
          <button
            onClick={() => { setTempLoss(stopLoss); setTempWin(stopWin); setEditing(true); }}
            aria-label="Edit limits"
            style={{
              padding: '5px 8px', fontSize: 9, borderRadius: 6, cursor: 'pointer',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a7c4',
            }}
          >⚙</button>
        </div>
      ) : (
        <_StopEditForm
          sym={sym}
          tempLoss={tempLoss} tempWin={tempWin}
          setTempLoss={setTempLoss} setTempWin={setTempWin}
          onSave={() => {
            setStopLoss(tempLoss); setStopWin(tempWin);
            setEditing(false); setDismissed({ loss: false, win: false });
            if (socket) socket.emit('set_stop_thresholds', { stop_loss: tempLoss, stop_win: tempWin });
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}