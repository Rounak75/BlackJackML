/*
 * components/StopAlerts.js
 * ─────────────────────────────────────────────────────────
 * Stop-Loss / Stop-Win alert panel with audio notification.
 *
 * Configurable thresholds that fire when:
 *   • Session profit drops below stop-loss (e.g. -₹5,000)
 *   • Session profit rises above stop-win  (e.g. +₹3,000)
 *
 * Features:
 *   • Persistent banner when threshold crossed
 *   • Audio beep (Web Audio API — no file needed)
 *   • Snooze button (dismiss for 10 hands)
 *   • Progress bar showing current P&L vs targets
 *
 * Props:
 *   session  — session object { total_profit, hands_played }
 *   currency — { symbol }
 */

function StopAlerts({ session, currency }) {
  const { useState, useEffect, useRef } = React;

  const profit  = session?.total_profit ?? 0;
  const hands   = session?.hands_played ?? 0;
  const sym     = currency?.symbol ?? '₹';

  const [stopLoss,   setStopLoss]   = useState(-5000);
  const [stopWin,    setStopWin]    = useState(3000);
  const [snoozedAt,  setSnoozedAt]  = useState(null);  // hand count when snoozed
  const [dismissed,  setDismissed]  = useState({ loss: false, win: false });
  const [editing,    setEditing]    = useState(false);
  const [tempLoss,   setTempLoss]   = useState(-5000);
  const [tempWin,    setTempWin]    = useState(3000);
  const alertedRef = useRef({ loss: false, win: false });

  // Web Audio beep — no file needed, pure tone via oscillator
  const playAlert = (type) => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = type === 'loss' ? 220 : 660;  // low=loss, high=win
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) { /* audio blocked — silent */ }
  };

  const snoozeActive = snoozedAt !== null && (hands - snoozedAt) < 10;

  const lossHit = profit <= stopLoss;
  const winHit  = profit >= stopWin;

  // Fire alerts when thresholds crossed for the first time
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

  const snooze = () => { setSnoozedAt(hands); };
  const dismiss = (type) => setDismissed(d => ({ ...d, [type]: true }));

  // Progress toward targets
  const lossRange  = Math.abs(stopLoss);
  const winRange   = stopWin;
  const lossFill   = Math.min(1, Math.max(0, (profit - stopLoss) / lossRange));
  const winFill    = Math.min(1, Math.max(0, profit / winRange));

  const showLossAlert = lossHit && !dismissed.loss && !snoozeActive;
  const showWinAlert  = winHit  && !dismissed.win  && !snoozeActive;

  return (
    <Widget title="Stop Alerts" badge={showLossAlert || showWinAlert ? '⚠ TRIGGERED' : 'ARMED'}>

      {/* ── Session status: explicit Continue / Leave indicator ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 6, marginBottom: 10,
        background: (lossHit || winHit)
          ? 'rgba(255,92,92,0.08)' : 'rgba(68,232,130,0.07)',
        border: `1px solid ${(lossHit || winHit)
          ? 'rgba(255,92,92,0.35)' : 'rgba(68,232,130,0.25)'}`,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>
          {lossHit ? '❌' : winHit ? '🏆' : '✅'}
        </span>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800,
            color: lossHit ? '#ff5c5c' : winHit ? '#ffd447' : '#44e882',
          }}>
            {lossHit ? 'LEAVE TABLE — Stop-Loss Hit'
              : winHit ? 'LEAVE TABLE — Stop-Win Hit'
              : 'Continue Playing'}
          </div>
          <div style={{ fontSize: 9, color: '#94a7c4', marginTop: 1 }}>
            {lossHit
              ? `Down ${sym}${Math.abs(profit).toLocaleString()} — limit: ${sym}${Math.abs(stopLoss).toLocaleString()}`
              : winHit
                ? `Up ${sym}${profit.toLocaleString()} — target: ${sym}${stopWin.toLocaleString()}`
                : `${sym}${Math.abs(profit - stopLoss).toLocaleString()} buffer to stop-loss`}
          </div>
        </div>
      </div>

      {/* Loss alert banner */}
      {showLossAlert && (
        <div style={{
          padding: '10px 12px', borderRadius: 8, marginBottom: 8,
          background: 'rgba(255,92,92,0.15)', border: '2px solid rgba(255,92,92,0.6)',
          animation: 'live-pulse 1s ease-in-out infinite',
        }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#ff5c5c', marginBottom: 3 }}>
            🛑 STOP-LOSS HIT
          </div>
          <div style={{ fontSize: 10, color: '#ffaaaa', marginBottom: 8 }}>
            You're down {sym}{Math.abs(profit).toLocaleString()} — limit was {sym}{Math.abs(stopLoss).toLocaleString()}. Stop playing now.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={snooze} aria-label="Snooze stop-loss alert for 10 hands" style={{
              flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
              background: 'rgba(255,92,92,0.2)', border: '1px solid rgba(255,92,92,0.4)',
              color: '#ff5c5c',
            }}>Snooze 10 hands</button>
            <button onClick={() => dismiss('loss')} aria-label="Dismiss stop-loss alert" style={{
              flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: '#94a7c4',
            }}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Win alert banner */}
      {showWinAlert && (
        <div style={{
          padding: '10px 12px', borderRadius: 8, marginBottom: 8,
          background: 'rgba(68,232,130,0.12)', border: '2px solid rgba(68,232,130,0.5)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#44e882', marginBottom: 3 }}>
            🏆 STOP-WIN HIT
          </div>
          <div style={{ fontSize: 10, color: '#a0eec0', marginBottom: 8 }}>
            You're up {sym}{profit.toLocaleString()} — target was {sym}{stopWin.toLocaleString()}. Lock in your profit.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={snooze} aria-label="Continue playing for 10 more hands" style={{
              flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
              background: 'rgba(68,232,130,0.15)', border: '1px solid rgba(68,232,130,0.4)',
              color: '#44e882',
            }}>Continue 10 more hands</button>
            <button onClick={() => dismiss('win')} aria-label="Dismiss stop-win alert" style={{
              flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: '#94a7c4',
            }}>Dismiss</button>
          </div>
        </div>
      )}

      {/* P&L progress */}
      <div style={{ marginBottom: 10 }}>
        {/* Current P&L display */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: '#94a7c4', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Session P&L
          </span>
          <span style={{
            fontSize: 16, fontWeight: 800, fontFamily: 'DM Mono,monospace',
            color: profit >= 0 ? '#44e882' : '#ff5c5c',
          }}>
            {profit >= 0 ? '+' : ''}{sym}{Math.abs(profit).toLocaleString()}
          </span>
        </div>

        {/* Loss meter: left side */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a7c4', marginBottom: 2 }}>
            <span>Stop-Loss: {sym}{Math.abs(stopLoss).toLocaleString()}</span>
            <span>{lossHit ? '❌ HIT' : `${sym}${Math.abs(profit - stopLoss).toLocaleString()} buffer`}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${lossFill * 100}%`,
              background: profit < 0 ? '#ff5c5c' : '#44e882',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Win meter: right side */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a7c4', marginBottom: 2 }}>
            <span>Stop-Win: {sym}{stopWin.toLocaleString()}</span>
            <span>{winHit ? '✅ HIT' : `${sym}${Math.max(0, stopWin - profit).toLocaleString()} to target`}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${winFill * 100}%`,
              background: 'linear-gradient(90deg, #44e882, #ffd447)',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Settings */}
      {!editing ? (
        <button onClick={() => { setTempLoss(stopLoss); setTempWin(stopWin); setEditing(true); }}
          aria-label="Edit stop-loss and stop-win limits"
          style={{
            width: '100%', padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a7c4',
          }}>
          ⚙ Set limits
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Stop-Loss', val: tempLoss, set: setTempLoss, min: true },
            { label: 'Stop-Win',  val: tempWin,  set: setTempWin,  min: false },
          ].map(({ label: l, val, set, min: isNeg }) => (
            <div key={l}>
              <div style={{ fontSize: 8, color: '#94a7c4', marginBottom: 2 }}>{l} ({sym})</div>
              <input type="number"
                aria-label={l}
                value={isNeg ? Math.abs(val) : val}
                onChange={e => set(isNeg ? -(parseFloat(e.target.value)||0) : (parseFloat(e.target.value)||0))}
                style={{
                  width: '100%', padding: '5px 8px', fontSize: 11, borderRadius: 5,
                  background: '#1a2236', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#f0f4ff', fontFamily: 'DM Mono,monospace',
                }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setStopLoss(tempLoss); setStopWin(tempWin); setEditing(false); setDismissed({ loss: false, win: false }); }}
              aria-label="Save limits"
              style={{ flex: 2, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
                background: 'rgba(68,232,130,0.12)', border: '1px solid rgba(68,232,130,0.3)', color: '#44e882' }}>
              Save
            </button>
            <button onClick={() => setEditing(false)}
              aria-label="Cancel"
              style={{ flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#94a7c4' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Widget>
  );
}