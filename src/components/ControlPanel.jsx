import { useState } from 'react';
import { CAMERA_PRESETS } from '../three/cameraPresets.js';
import './ControlPanel.css';

const STATUS_TEXT = { moving: 'Chal rahi', idle: 'Khadi', nogps: 'GPS nahi' };

function timeAgo(date) {
  if (!date) return '—';
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  return s < 5 ? 'abhi' : `${s}s pehle`;
}

export default function ControlPanel({
  machines,
  live,
  follow,
  labels,
  shadows,
  ultra,
  onUltra,
  onPreset,
  onFocus,
  onFollow,
  onLabels,
  onShadows,
}) {
  const [open, setOpen] = useState(true);
  const moving = machines.filter((m) => m.status === 'moving').length;

  return (
    <aside className={`panel ${open ? 'is-open' : ''}`}>
      <button className="panel-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle panel">
        {open ? '‹' : '›'}
      </button>

      <header className="panel-head">
        <h1>ICD Yard · 3D Live</h1>
        <div className={`live-pill live-${live.status}`}>
          <span className="live-dot" />
          {live.status === 'live' ? 'LIVE' : live.status === 'error' ? 'API error' : 'Connecting…'}
          <span className="live-time">{timeAgo(live.lastUpdate)}</span>
        </div>
        {live.status === 'error' && <p className="panel-error">{live.error}</p>}
      </header>

      <section className="panel-section">
        <h2>Camera</h2>
        <div className="preset-grid">
          {Object.entries(CAMERA_PRESETS).map(([key, p]) => (
            <button key={key} className="btn" onClick={() => onPreset(key)}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h2>
          Reach Stackers <span className="muted">({moving} chal rahi / {machines.length})</span>
        </h2>
        <ul className="machine-list">
          {machines.map((m) => (
            <li key={m.name} className={`machine-row st-${m.status}`}>
              <button className="machine-name" onClick={() => onFocus(m.name)} title="Is machine par jao">
                <span className="st-dot" />
                {m.name}
              </button>
              <span className="machine-status">{STATUS_TEXT[m.status] || m.status}</span>
              <button
                className={`btn-follow ${follow === m.name ? 'on' : ''}`}
                onClick={() => onFollow(follow === m.name ? null : m.name)}
                title="Camera is machine ke saath chalega"
              >
                {follow === m.name ? 'Following' : 'Follow'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-section toggles">
        <label className="switch">
          <input type="checkbox" checked={labels} onChange={(e) => onLabels(e.target.checked)} />
          <span>Machine naam dikhao</span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={ultra} onChange={(e) => onUltra(e.target.checked)} />
          <span>Ultra HD effects (AO, glow, film look)</span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={shadows} onChange={(e) => onShadows(e.target.checked)} />
          <span>Shadows (band karo agar slow ho)</span>
        </label>
      </section>

      <footer className="panel-help">
        <b>Mouse:</b> Left drag = ghumao · Right drag = khiskao · Scroll = zoom
        <br />
        <b>Touch:</b> 1 ungli = ghumao · 2 ungli = zoom / khiskao
      </footer>
    </aside>
  );
}
