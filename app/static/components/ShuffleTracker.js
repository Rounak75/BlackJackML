/*
 * components/ShuffleTracker.js
 * ─────────────────────────────────────────────────────────
 * ML Shuffle Tracker panel — Bayesian confidence, count
 * adjustment, Ace prediction probability, shuffles tracked.
 *
 * Props:
 *   tracker — shuffle_tracker object from server
 */

function ShuffleTrackerPanel({ tracker }) {
  const t    = tracker || {};
  const conf = t.bayesian_confidence || 1;

  return (
    <Widget title="ML Shuffle Tracker" badge="LSTM+BAYES" badgeColor="text-ameth">
      {/* Confidence bar */}
      <div
        style={{
          height: 6,
          background: '#111827',
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <div className="ml-fill" style={{ width: `${conf * 100}%` }} />
      </div>

      {/* Detail rows */}
      <div className="space-y-1">
        <KV
          label="Bayesian Confidence"
          value={`${(conf * 100).toFixed(0)}%`}
          valueClass={conf > 0.7 ? 'text-jade' : conf > 0.4 ? 'text-gold' : 'text-ruby'}
        />
        <KV
          label="Count Adjustment"
          value={`${(t.count_adjustment || 0) >= 0 ? '+' : ''}${(t.count_adjustment || 0).toFixed(2)}`}
        />
        <KV
          label="Ace Prediction"
          value={`${((t.ace_prediction || 0) * 100).toFixed(1)}%`}
        />
        <KV
          label="Shuffles Tracked"
          value={t.shuffle_count || 0}
        />
      </div>
    </Widget>
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function ShuffleTrackerPanel(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  ShuffleTrackerPanel = React.memo(ShuffleTrackerPanel);
}
