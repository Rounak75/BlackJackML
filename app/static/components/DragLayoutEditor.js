/*
 * components/DragLayoutEditor.js
 * ─────────────────────────────────────────────────────────
 * Drag & Drop Layout Editor — P3 Feature
 *
 * Lets users rearrange sidebar panels via drag-and-drop.
 * Layout is stored in localStorage ('bjml_layout') and
 * restored on mount.
 *
 * ARCHITECTURE:
 *   Pure client-side. Uses HTML5 Drag and Drop API.
 *   Each panel slot has a unique key. The editor emits
 *   the ordered arrays for left and right columns.
 *
 * Props:
 *   isOpen          — boolean, show/hide the editor overlay
 *   onClose         — callback to close the editor
 *   leftPanels      — array of { key, label, icon }
 *   rightPanels     — array of { key, label, icon }
 *   onLayoutChange  — callback({ left: string[], right: string[] })
 */

function DragLayoutEditor({ isOpen, onClose, leftPanels, rightPanels, onLayoutChange }) {
  var useState = React.useState;
  var useCallback = React.useCallback;
  var useEffect = React.useEffect;
  var useRef = React.useRef;

  var _left = useState(leftPanels.map(function (p) { return p.key; }));
  var leftOrder = _left[0];
  var setLeftOrder = _left[1];

  var _right = useState(rightPanels.map(function (p) { return p.key; }));
  var rightOrder = _right[0];
  var setRightOrder = _right[1];

  var _dragging = useState(null);
  var dragging = _dragging[0];
  var setDragging = _dragging[1];

  var _dragOverItem = useState(null);
  var dragOverItem = _dragOverItem[0];
  var setDragOverItem = _dragOverItem[1];

  var _dragCol = useState(null);
  var dragCol = _dragCol[0];
  var setDragCol = _dragCol[1];

  // All panel definitions keyed by key
  var allPanels = {};
  leftPanels.forEach(function (p) { allPanels[p.key] = p; });
  rightPanels.forEach(function (p) { allPanels[p.key] = p; });

  // Load saved layout from localStorage
  useEffect(function () {
    try {
      var saved = localStorage.getItem('bjml_layout');
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed.left && Array.isArray(parsed.left)) {
          // Validate keys exist
          var validLeft = parsed.left.filter(function (k) { return allPanels[k]; });
          if (validLeft.length > 0) setLeftOrder(validLeft);
        }
        if (parsed.right && Array.isArray(parsed.right)) {
          var validRight = parsed.right.filter(function (k) { return allPanels[k]; });
          if (validRight.length > 0) setRightOrder(validRight);
        }
      }
    } catch (e) { /* ignore parse errors */ }
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
    setDragOverItem(key);
  }

  function handleDrop(e, targetKey, targetColumn) {
    e.preventDefault();
    if (!dragging) return;

    var sourceCol = dragCol;

    // Get source and target arrays
    var sourceArr = sourceCol === 'left' ? leftOrder.slice() : rightOrder.slice();
    var targetArr = targetColumn === 'left' ? leftOrder.slice() : rightOrder.slice();

    if (sourceCol === targetColumn) {
      // Reorder within same column
      var fromIdx = sourceArr.indexOf(dragging);
      var toIdx = sourceArr.indexOf(targetKey);
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        sourceArr.splice(fromIdx, 1);
        sourceArr.splice(toIdx, 0, dragging);
        if (sourceCol === 'left') setLeftOrder(sourceArr);
        else setRightOrder(sourceArr);
      }
    } else {
      // Move across columns
      var fromIdx = sourceArr.indexOf(dragging);
      if (fromIdx !== -1) {
        sourceArr.splice(fromIdx, 1);
        var toIdx = targetArr.indexOf(targetKey);
        if (toIdx === -1) toIdx = targetArr.length;
        targetArr.splice(toIdx, 0, dragging);

        if (sourceCol === 'left') {
          setLeftOrder(sourceArr);
          setRightOrder(targetArr);
        } else {
          setRightOrder(sourceArr);
          setLeftOrder(targetArr);
        }
      }
    }

    setDragging(null);
    setDragOverItem(null);
    setDragCol(null);
  }

  function handleDragEnd() {
    setDragging(null);
    setDragOverItem(null);
    setDragCol(null);
  }

  function handleSave() {
    var layout = { left: leftOrder, right: rightOrder };
    localStorage.setItem('bjml_layout', JSON.stringify(layout));
    if (onLayoutChange) onLayoutChange(layout);
    onClose();
  }

  function handleReset() {
    var defLeft = leftPanels.map(function (p) { return p.key; });
    var defRight = rightPanels.map(function (p) { return p.key; });
    setLeftOrder(defLeft);
    setRightOrder(defRight);
    localStorage.removeItem('bjml_layout');
    if (onLayoutChange) onLayoutChange({ left: defLeft, right: defRight });
  }

  function renderSlot(key, column) {
    var panel = allPanels[key];
    if (!panel) return null;
    var isDragOver = dragOverItem === key;
    var isBeingDragged = dragging === key;
    return React.createElement('div', {
      key: key,
      draggable: true,
      onDragStart: function (e) { handleDragStart(e, key, column); },
      onDragOver: function (e) { handleDragOver(e, key); },
      onDrop: function (e) { handleDrop(e, key, column); },
      onDragEnd: handleDragEnd,
      className: 'dle-slot' + (isDragOver ? ' dle-over' : '') + (isBeingDragged ? ' dle-dragging' : ''),
      style: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8,
        background: isDragOver ? 'rgba(255,212,71,0.12)' : 'rgba(255,255,255,0.04)',
        border: isDragOver ? '2px dashed rgba(255,212,71,0.6)' : '1.5px solid rgba(255,255,255,0.1)',
        cursor: 'grab',
        opacity: isBeingDragged ? 0.4 : 1,
        transition: 'all 0.15s ease',
        marginBottom: 4,
        userSelect: 'none',
      },
    },
      React.createElement('span', {
        style: { fontSize: 14, flexShrink: 0, lineHeight: 1 }
      }, panel.icon || '▪'),
      React.createElement('span', {
        style: { fontSize: 11, fontWeight: 600, color: '#f0f4ff', flex: 1 }
      }, panel.label),
      React.createElement('span', {
        style: { fontSize: 10, color: '#6b7f96', fontFamily: 'DM Mono, monospace' }
      }, '⣿')
    );
  }

  function renderColumn(title, order, column) {
    return React.createElement('div', {
      style: { flex: 1 },
      onDragOver: function (e) { e.preventDefault(); },
      onDrop: function (e) {
        if (order.length === 0 && dragging) {
          // Drop into empty column
          handleDrop(e, null, column);
        }
      },
    },
      React.createElement('div', {
        style: {
          fontSize: 10, fontWeight: 800, color: '#8fa5be',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 8, paddingBottom: 4,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }
      }, title),
      order.map(function (key) { return renderSlot(key, column); })
    );
  }

  // Overlay
  return React.createElement('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    onClick: function (e) { if (e.target === e.currentTarget) onClose(); },
  },
    React.createElement('div', {
      style: {
        width: 640, maxHeight: '80vh', overflow: 'auto',
        background: '#1c2540',
        border: '1.5px solid rgba(255,255,255,0.15)',
        borderRadius: 14,
        padding: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      },
      onClick: function (e) { e.stopPropagation(); },
    },
      // Header
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { fontSize: 18 } }, '🎯'),
          React.createElement('span', {
            style: { fontSize: 14, fontWeight: 800, color: '#f0f4ff', fontFamily: 'Syne, sans-serif' }
          }, 'Layout Editor'),
          React.createElement('span', {
            style: {
              fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              background: 'rgba(255,212,71,0.15)', border: '1px solid rgba(255,212,71,0.4)',
              color: '#ffd447', textTransform: 'uppercase',
            }
          }, 'DRAG')
        ),
        React.createElement('button', {
          onClick: onClose,
          style: {
            background: 'transparent', border: 'none', color: '#6b7f96',
            fontSize: 18, cursor: 'pointer', padding: '4px 8px',
          },
          'aria-label': 'Close layout editor',
        }, '✕')
      ),
      // Info
      React.createElement('div', {
        style: {
          fontSize: 10, color: '#94a7c4', marginBottom: 16,
          padding: '6px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }
      }, 'Drag panels between columns to customize your layout. Changes persist across sessions.'),
      // Two columns
      React.createElement('div', {
        style: { display: 'flex', gap: 16 }
      },
        renderColumn('← Left Column', leftOrder, 'left'),
        React.createElement('div', {
          style: { width: 1, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }
        }),
        renderColumn('Right Column →', rightOrder, 'right')
      ),
      // Footer buttons
      React.createElement('div', {
        style: {
          display: 'flex', gap: 8, marginTop: 16,
          paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)',
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
        }, '💾 Save Layout'),
        React.createElement('button', {
          onClick: handleReset,
          style: {
            padding: '10px 16px', borderRadius: 8,
            background: 'transparent',
            border: '1.5px solid rgba(255,92,92,0.4)',
            color: '#ff8888', fontWeight: 700, fontSize: 12,
            cursor: 'pointer',
          }
        }, '↺ Reset Default'),
        React.createElement('button', {
          onClick: onClose,
          style: {
            padding: '10px 16px', borderRadius: 8,
            background: 'transparent',
            border: '1.5px solid rgba(255,255,255,0.15)',
            color: '#8fa5be', fontWeight: 600, fontSize: 12,
            cursor: 'pointer',
          }
        }, 'Cancel')
      )
    )
  );
}