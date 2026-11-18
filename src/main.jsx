import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// StrictMode is intentionally not used: it mounts components twice in dev,
// which would download and decode the 22 MB GLB two times.
createRoot(document.getElementById('root')).render(<App />);
