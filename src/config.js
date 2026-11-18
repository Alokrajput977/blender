// ---------------------------------------------------------------------------
// Central configuration for the yard viewer.
// ---------------------------------------------------------------------------

// Geographic origin that was used in Blender to convert lat/lon -> metres.
// (Blender (0,0) == this lat/lon.)  DO NOT change unless the GLB is re-made.
export const GEO_ORIGIN = {
  lat: 28.513296015948903,
  lon: 77.2891731396578,
};

// GLB model (copy Yard_ICD.glb into /public/models/).
export const MODEL_URL = '/models/Yard_ICD.glb';

// Draco decoder (copied automatically into /public/draco on `npm install`).
export const DRACO_PATH = '/draco/';

// Live equipment API.
// In development Vite proxies /kycl -> https://kycl.in (see vite.config.js).
// For production set VITE_EQUIPMENT_URL in a .env file, e.g.
//   VITE_EQUIPMENT_URL=https://your-server.com/api/api/equipments
export const EQUIPMENT_URL =
  import.meta.env.VITE_EQUIPMENT_URL || '/kycl/api/api/equipments';

// How often to poll the API (ms).
export const POLL_MS = 10000;

// Equipment whose name starts with any of these prefixes is ignored.
export const IGNORE_PREFIXES = ['RTG'];

// Anything farther than this from the yard (in metres, Blender coords) is
// treated as a bad GPS fix and the machine is not moved.
export const YARD_BOUNDS = { minX: -420, maxX: 360, minY: -720, maxY: 720 };

// How fast machines glide to their new position (higher = faster).
export const MOVE_SMOOTHING = 1.4;
