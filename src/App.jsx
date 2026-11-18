import { useCallback, useRef, useState } from 'react';
import YardViewer from './components/YardViewer.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import LoadingOverlay from './components/LoadingOverlay.jsx';
import { useEquipmentPolling } from './hooks/useEquipmentPolling.js';
import './App.css';

export default function App() {
  const viewerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [machines, setMachines] = useState([]);
  const [follow, setFollow] = useState(null);
  const [labels, setLabels] = useState(true);
  const [shadows, setShadows] = useState(true);
  const [ultra, setUltra] = useState(true);
  const showUi = new URLSearchParams(window.location.search).get('ui') !== '0';

  // live API -> 3D scene
  const live = useEquipmentPolling(
    useCallback((data) => viewerRef.current?.applyEquipment(data), [])
  );

  const handleMachines = useCallback(
    (snap) => setMachines([...snap].sort((a, b) => a.name.localeCompare(b.name))),
    []
  );

  return (
    <div className="app">
      <YardViewer
        ref={viewerRef}
        onProgress={setProgress}
        onLoaded={() => setLoaded(true)}
        onError={setLoadError}
        onMachines={handleMachines}
      />

      {loaded && showUi && (
        <ControlPanel
          machines={machines}
          live={live}
          follow={follow}
          labels={labels}
          shadows={shadows}
          ultra={ultra}
          onPreset={(k) => {
            setFollow(null);
            viewerRef.current?.flyToPreset(k);
          }}
          onFocus={(n) => viewerRef.current?.focusMachine(n)}
          onFollow={(n) => {
            setFollow(n);
            viewerRef.current?.setFollow(n);
          }}
          onLabels={(v) => {
            setLabels(v);
            viewerRef.current?.setLabels(v);
          }}
          onUltra={(v) => {
            setUltra(v);
            viewerRef.current?.setUltra(v);
          }}
          onShadows={(v) => {
            setShadows(v);
            viewerRef.current?.setShadows(v);
          }}
        />
      )}

      {(!loaded || loadError) && <LoadingOverlay progress={progress} error={loadError} />}
    </div>
  );
}
