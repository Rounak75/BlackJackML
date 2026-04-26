/*
 * components/DragLayoutEditor.js
 * ─────────────────────────────────────────────────────────
 * Drag & Drop Layout Editor — PHASE 5 revision.
 *
 * The right column is no longer a free-form panel stack — it has
 * two LOCKED slots (Edge & Shoe / Bet Reference) followed by a
 * TabStrip. So this editor now manages two independent orderings:
 *
 *   • Left column   — free-form drag of left-column panels
 *   • Right tabs    — drag to reorder the TabStrip's tabs
 *
 * Locked slots are displayed read-only so users understand they
 * cannot be moved (preserves a stable "always-on" header for the
 * right column).
 *
 * Storage:
 *   localStorage 'bjml_layout' → { left: string[], rightTabs: string[] }
 *
 * Props:
 *   isOpen          — boolean
 *   onClose         — () => void
 *   leftPanels      — [{ key, label, icon }]
 *   rightTabs       — [{ key, label, icon }]   (TabStrip tabs only)
 *   lockedSlots     — [{ key, label, icon }]   (read-only header rows)
 *   onLayoutChange  — ({ left, rightTabs }) => void
 */

function DragLayoutEditor({
  isOpen, onClose,
  leftPanels = [],
  rightTabs = [],
  lockedSlots = [],
  onLayoutChange,
}) {
  var useState    = React.useState;
  var useEffect   = React.useEffect;

  // Lookup tables for label/icon by key
  var allPanels = {};
  leftPanels.forEach(function (p) { allPanels[p.key] = p; });
  rightTabs.forEach(function (p) { allPanels[p.key] = p; });

  var leftKeys  = leftPanels.map(function (p) { return p.key; });
  var rightKeys = rightTabs.map(function (p) { return p.key; });

  var _left = useState(leftKeys);
  var leftOrder    = _left[0];
  var setLeftOrder = _left[1];

  var _right = useState(rightKeys);
  var rightOrder    = _right[0];
  var setRightOrder = _right[1];

  var _dragging = useState(null);
  var dragging    = _dragging[0];
  var setDragging = _dragging[1];

  var _dragOver = useState(null);
  var dragOver    = _dragOver[0];
  var setDragOver = _dragOver[1];

  var _dragCol = useState(null);
  var dragCol    = _dragCol[0];
  var setDragCol = _dragCol[1];

  // Restore from localStorage on mount
  useEffect(function () {
    try {
      var saved = localStorage.getItem('bjml_layout');
      if (!saved) return;
      var parsed = JSON.parse(saved);
      if (parsed.left && Array.isArray(parsed.left)) {
        var validLeft = parsed.left.filter(function (k) { return allPanels[k] && leftKeys.indexOf(k) !== -1; });
        // Append any keys present in props but missing in saved order
        leftKeys.forEach(function (k) { if (validLeft.indexOf(k) === -1) validLeft.push(k); });
        if (validLeft.length > 0) setLeftOrder(validLeft);
      }
      if (parsed.rightTabs && Array.isArray(parsed.rightTabs)) {
        var validRight = parsed.rightTabs.filter(function (k) { return allPanels[k] && rightKeys.indexOf(k) !== -1; });
        rightKeys.forEach(function (k) { if (validRight.indexOf(k) === -1) validRight.push(k); });
        if (validRight.length > 0) setRightOrder(validRight);
      }
    } catch (e) { /* ignore */ }
  }, []);

  if (!isOpen) return null;

  function handleDragStart(e, key, column) {
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(key);
    setDragCol(column);
  }

  function handleDragOver(e, key) {
    e.preventDefault();
    setDragOver(key);
  }

  function handleDrop(e, targetKey, targetColumn) {
    e.preventDefault();
    if (!dragging || dragCol !== targetColumn) {
      // Cross-column moves are disallowed in PHASE 5 — left/right are now
      // semantically distinct (panels vs tabs).
      setDragging(null); setDragOver(null); setDragCol(null);
      return;
    }
    var arr = (targetColumn === 'left' ? leftOrder : rightOrder).slice();
    var fromIdx = arr.indexOf(dragging);
    var toIdx   = arr.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      setDragging(null); setDragOver(null); setDragCol(null);
      return;
    }
    arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, dragging);
    if (targetColumn === 'left') setLeftOrder(arr);
    else setRightOrder(arr);

    setDragging(null);
    setDragOver(null);
    setDragCol(null);
  }

  function handleDragEnd() {
    setDragging(null);
    setDragOver(null);
    setDragCol(null);
  }

  function handleSave() {
    var layout = { left: leftOrder, rightTabs: rightOrder };
    try { localStorage.setItem('bjml_layout', JSON.stringify(layout)); } catch (e) {}
    if (onLayoutChange) onLayoutChange(layout);
    onClose();
  }

  function handleReset() {
    setLeftOrder(leftKeys);
    setRightOrder(rightKeys);
    try { localStorage.removeItem('bjml_layout'); } catch (e) {}
    if (onLayoutChange) onLayoutChange({ left: leftKeys, rightTabs: rightKeys });
  }

  function renderSlot(key, column) {
    var panel = allPanels[key];
    if (!panel) return null;
    var isOver    = dragOver === key && dragCol === column;
    var isDragged = dragging === key && dragCol === column;

    return React.createElement('div', {
      key: key,
      draggable: true,
      onDragStart: function (e) { handleDragStart(e, key, column); },
      onDragOver:  function (e) { handleDragOver(e, key); },
      onDrop:      function (e) { handleDrop(e, key, column); },
      onDragEnd:   handleDragEnd,
      style: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8,
        background: isOver ? 'rgba(255,212,71,0.12)' : 'rgba(255,255,255,0.04)',
        border: isOver ? '2px dashed rgba(255,212,71,0.6)' : '1.5px solid rgba(255,255,255,0.10)',
        cursor: 'grab',
        opacity: isDragged ? 0.4 : 1,
        transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
        marginBottom: 6,
        userSelect: 'none',
      },
    },
      renderIcon(panel),
      React.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: '#f0f4ff', flex: 1 } },
        panel.label),
      React.createElement('span', { style: { fontSize: 10, color: '#8fa5be', fontFamily: 'DM Mono, monospace' } },
        '⋮⋮')
    );
  }

  // PHASE 6 A1: prefer Lucide via panel.lucide; fall back to emoji panel.icon.
  function renderIcon(p) {
    if (p && p.lucide && typeof Icon === 'function') {
      return React.createElement('span', {
        style: { display: 'inline-flex', flexShrink: 0, color: 'var(--text-1)' },
      }, React.createElement(Icon, { name: p.lucide, size: 14 }));
    }
    return React.createElement('span', {
      style: { fontSize: 14, lineHeight: 1, flexShrink: 0 },
    }, (p && p.icon) || '▪');
  }

  function renderLockedSlot(slot) {
    return React.createElement('div', {
      key: 'locked-' + slot.key,
      title: 'This slot is fixed — it always shows the same panel for predictable scanning.',
      style: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8,
        background: 'rgba(255,255,255,0.02)',
        border: '1.5px dashed rgba(255,255,255,0.10)',
        marginBottom: 6, userSelect: 'none',
        opacity: 0.75,
      },
    },
      renderIcon(slot),
      React.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: '#ccdaec', flex: 1 } },
        slot.label),
      React.createElement('span', {
        style: {
          fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
          background: 'rgba(255,255,255,0.06)', color: '#94a7c4',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }
      }, 'Fixed')
    );
  }

  function renderColumn(title, subtitle, slots, order, column) {
    return React.createElement('div', {
      style: { flex: 1, minWidth: 0 },
      onDragOver: function (e) { e.preventDefault(); },
    },
      React.createElement('div', {
        style: {
          fontSize: 10, fontWeight: 800, color: '#a8bcd4',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 4, paddingBottom: 4,
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }
      }, title),
      subtitle && React.createElement('div', {
        style: { fontSize: 10, color: '#8fa5be', marginBottom: 8 }
      }, subtitle),
      slots && slots.length > 0 && React.createElement('div', { style: { marginBottom: 6 } },
        slots.map(renderLockedSlot)
      ),
      order.map(function (key) { return renderSlot(key, column); })
    );
  }

  return React.createElement('div', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Layout editor',
    style: {
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    },
    onClick: function (e) { if (e.target === e.currentTarget) onClose(); },
  },
    React.createElement('div', {
      style: {
        width: 720, maxWidth: '100%', maxHeight: '88vh', overflow: 'auto',
        background: '#1c2540',
        border: '1.5px solid rgba(255,255,255,0.15)',
        borderRadius: 14,
        padding: 22,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      },
      onClick: function (e) { e.stopPropagation(); },
    },
      // Header
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          React.createElement('span', {
            style: {
              fontFamily: 'Syne, sans-serif',
              fontSize: 16, fontWeight: 900, color: '#f0f4ff', letterSpacing: '0.02em',
            }
          }, 'Layout Editor'),
          React.createElement('span', {
            style: {
              fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 4,
              background: 'rgba(255,212,71,0.15)', border: '1px solid rgba(255,212,71,0.4)',
              color: '#ffd447', textTransform: 'uppercase', letterSpacing: '0.08em',
            }
          }, 'Drag to reorder')
        ),
        React.createElement('button', {
          onClick: onClose,
          'aria-label': 'Close layout editor',
          style: {
            background: 'transparent', border: 'none', color: '#8fa5be',
            fontSize: 18, cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
          },
        }, '✕')
      ),

      // Hint
      React.createElement('div', {
        style: {
          fontSize: 11, color: '#a8bcd4', marginBottom: 14,
          padding: '8px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          lineHeight: 1.45,
        }
      }, 'Drag panels within a column to reorder. Cross-column moves are disabled — the right column has fixed slots for shoe/edge and bet reference, and a tabbed reference strip below them.'),

      // Two columns
      React.createElement('div', { style: { display: 'flex', gap: 18 } },
        renderColumn(
          'Left Column',
          'Bet sizing, side counts, strategy reference',
          null,
          leftOrder, 'left'
        ),
        React.createElement('div', { style: { width: 1, background: 'rgba(255,255,255,0.10)', flexShrink: 0 } }),
        renderColumn(
          'Right Column — Tab Order',
          'Reorder the reference tabs that appear below the fixed slots',
          lockedSlots,
          rightOrder, 'right'
        )
      ),

      // Footer
      React.createElement('div', {
        style: {
          display: 'flex', gap: 8, marginTop: 16,
          paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.10)',
        }
      },
        React.createElement('button', {
          onClick: handleSave,
          style: {
            flex: 1, padding: '10px', borderRadius: 8,
            background: '#3b82f6', border: 'none',
            color: '#ffffff', fontWeight: 700, fontSize: 12,
            cursor: 'pointer', letterSpacing: '0.02em',
          }
        }, 'Save Layout'),
        React.createElement('button', {
          onClick: handleReset,
          style: {
            padding: '10px 16px', borderRadius: 8,
            background: 'transparent',
            border: '1.5px solid rgba(255,92,92,0.4)',
            color: '#ff8888', fontWeight: 700, fontSize: 12,
            cursor: 'pointer',
          }
        }, 'Reset to Default'),
        React.createElement('button', {
          onClick: onClose,
          style: {
            padding: '10px 16px', borderRadius: 8,
            background: 'transparent',
            border: '1.5px solid rgba(255,255,255,0.15)',
            color: '#a8bcd4', fontWeight: 600, fontSize: 12,
            cursor: 'pointer',
          }
        }, 'Cancel')
      )
    )
  );
}
