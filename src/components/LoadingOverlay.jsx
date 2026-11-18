import './LoadingOverlay.css';

export default function LoadingOverlay({ progress, error }) {
  return (
    <div className="loading-overlay">
      <div className="loading-card">
        {error ? (
          <>
            <h2>Model load nahi hua</h2>
            <p>
              Check karo ki <code>public/models/Yard_ICD.glb</code> file maujood hai, aur{' '}
              <code>npm install</code> ke baad <code>public/draco</code> folder bana hai.
            </p>
            <pre>{String(error.message || error)}</pre>
          </>
        ) : (
          <>
            <h2>ICD Yard load ho raha hai…</h2>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="pct">{Math.round(progress * 100)}%</p>
          </>
        )}
      </div>
    </div>
  );
}
