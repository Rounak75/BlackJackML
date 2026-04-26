/*
 * components/ErrorBoundary.js — Phase 7 T2
 * ─────────────────────────────────────────────────────────
 * Always-shipped React error boundary. Was previously fused into
 * DebugLayer.js as DebugErrorBoundary; extracted so production
 * builds (without BJML_DEBUG) can still recover from render errors.
 *
 * All DebugController references are guarded — the boundary works
 * standalone when DebugLayer is absent.
 */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: null, recovered: false, safeMode: false };
  }

  static getDerivedStateFromError(err) {
    return { error: err.toString() };
  }

  componentDidCatch(err, info) {
    var stack = (info && info.componentStack) || '';
    this.setState({ stack: stack });

    if (typeof DebugController !== 'undefined' && typeof DEBUG_LEVELS !== 'undefined') {
      DebugController.log('ERROR', DEBUG_LEVELS.ERROR,
        'React Error Boundary caught: ' + err.toString(),
        { stack: stack, component: info && info.componentStack });

      if (DebugController.features && DebugController.features.safeModeAuto
          && typeof _activateSafeMode === 'function') {
        _activateSafeMode('Error boundary triggered: ' + err.message);
        this.setState({ safeMode: true });
      }
    } else {
      // No debug layer available — log to console as a baseline.
      try { console.error('[ErrorBoundary]', err, stack); } catch (e) {}
    }
  }

  render() {
    if (this.state.error && !this.state.recovered) {
      var self = this;
      return React.createElement('div', {
        style: {
          padding: 30, fontFamily: 'DM Mono, monospace',
          background: 'var(--surface-base, #0a0e18)',
          color: 'var(--text-0, #f0f4ff)', minHeight: '100vh',
        },
      },
        this.state.safeMode ? React.createElement('div', {
          style: {
            background: 'rgba(255,92,92,0.15)', border: '1px solid rgba(255,92,92,0.4)',
            borderRadius: 8, padding: 12, marginBottom: 16, color: '#ff9a9a',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
          },
        }, '🛡 Safe Mode activated — risky features disabled') : null,

        React.createElement('div', {
          style: { color: 'var(--ruby, #ff5c5c)', fontSize: 22, marginBottom: 16, fontWeight: 800 },
        }, 'BlackjackML — Render Error'),

        React.createElement('div', {
          style: {
            background: 'var(--surface-raised, #1c2540)', padding: 16, borderRadius: 8,
            marginBottom: 16, border: '1px solid rgba(255,92,92,0.4)', color: '#ff9a9a',
            fontSize: 14, lineHeight: 1.7,
          },
        }, this.state.error),

        React.createElement('div', {
          style: {
            background: 'var(--surface-chrome, #111827)', padding: 16, borderRadius: 8,
            color: 'var(--text-2, #94a7c4)', fontSize: 11, whiteSpace: 'pre-wrap',
            maxHeight: 300, overflowY: 'auto', marginBottom: 16,
          },
        }, this.state.stack),

        React.createElement('div', { style: { display: 'flex', gap: 10 } },
          React.createElement('button', {
            onClick: function () { self.setState({ error: null, stack: null, recovered: true }); },
            style: {
              background: 'rgba(68,232,130,0.15)', border: '1px solid rgba(68,232,130,0.4)',
              color: 'var(--jade, #44e882)', borderRadius: 6, padding: '8px 20px',
              cursor: 'pointer', fontWeight: 700, fontFamily: 'DM Mono, monospace',
            },
          }, 'Try Recovery'),
          React.createElement('button', {
            onClick: function () {
              try {
                navigator.clipboard.writeText(
                  'Error: ' + self.state.error + '\n\nStack:\n' + self.state.stack
                );
              } catch (e) { /* ignore */ }
            },
            style: {
              background: 'rgba(106,175,255,0.15)', border: '1px solid rgba(106,175,255,0.4)',
              color: 'var(--sapph, #6aafff)', borderRadius: 6, padding: '8px 20px',
              cursor: 'pointer', fontWeight: 700, fontFamily: 'DM Mono, monospace',
            },
          }, 'Copy Error'),
          React.createElement('button', {
            onClick: function () { window.location.reload(); },
            style: {
              background: 'rgba(255,212,71,0.15)', border: '1px solid rgba(255,212,71,0.4)',
              color: 'var(--gold, #ffd447)', borderRadius: 6, padding: '8px 20px',
              cursor: 'pointer', fontWeight: 700, fontFamily: 'DM Mono, monospace',
            },
          }, 'Full Reload')
        ),

        React.createElement('p', {
          style: { color: 'var(--gold, #ffd447)', marginTop: 16, fontSize: 12 },
        }, 'Screenshot this and share it.')
      );
    }
    return this.props.children;
  }
}
