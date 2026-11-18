# ICD Yard – 3D Live Viewer (React + three.js)

Blender se banayi `Yard_ICD.glb` ko browser mein 3D mein dikhata hai.
Reach stackers API se live chalti hain (har 10 second mein update).

## Folder structure

```
yard-3d-viewer/
├── index.html
├── package.json
├── vite.config.js              ← dev server + API proxy (CORS fix)
├── README.md
├── scripts/
│   └── copy-draco.mjs          ← npm install ke baad Draco decoder copy karta hai
├── public/
│   ├── models/
│   │   └── Yard_ICD.glb        ← ⚠️ YAHAN apni GLB file daalo
│   └── draco/                  ← (apne aap banta hai)
└── src/
    ├── main.jsx                ← React entry
    ├── App.jsx / App.css       ← layout
    ├── index.css               ← global styles
    ├── config.js               ← API URL, poll time, geo origin
    ├── hooks/
    │   └── useEquipmentPolling.js   ← API polling
    ├── components/
    │   ├── YardViewer.jsx / .css    ← three.js canvas
    │   ├── ControlPanel.jsx / .css  ← side panel (camera, machines, toggles)
    │   └── LoadingOverlay.jsx / .css
    └── three/
        ├── createScene.js      ← renderer, sky, sun, shadows, controls
        ├── loadYard.js         ← GLB + Draco loader
        ├── equipmentTracker.js ← live machine movement + labels
        ├── cameraPresets.js    ← camera views + smooth fly
        └── geo.js              ← lat/lon → 3D position
```

## Chalane ke steps

1. **Node.js 18+** install hona chahiye (`node -v` se check karo).
2. Ye folder kholo terminal mein:
   ```bash
   cd yard-3d-viewer
   npm install
   ```
3. **GLB file copy karo:** `~/Downloads/Yard_ICD.glb` → `yard-3d-viewer/public/models/Yard_ICD.glb`
   ```bash
   cp ~/Downloads/Yard_ICD.glb public/models/
   ```
4. Start karo:
   ```bash
   npm run dev
   ```
   Browser apne aap `http://localhost:5173` kholega.

## Controls
- **Left drag** – ghumao (rotate)
- **Right drag** – khiskao (pan)
- **Scroll / pinch** – zoom in / out
- Camera zameen ke neeche nahi jaata.
- Panel mein camera buttons: Poora Yard, Top, IN Gate, OUT Gate, Train, Stacks.
- Machine ke naam par click → camera wahan jaata hai. **Follow** → camera machine ke saath chalta hai.

## Live movement
- API: `https://kycl.in/api/api/equipments`, har 10 s (`config.js` → `POLL_MS`).
- RTG ignore hote hain (`IGNORE_PREFIXES`).
- Machine aaram se (smooth) nayi jagah jaati hai aur chalne ki disha mein mudti hai.
- Label: 🟢 chal rahi · ⚪ khadi · ⚫ GPS galat / yard se bahar.

## Production (server par deploy)
`npm run build` → `dist/` folder banta hai, use kisi bhi web server par daalo.
Production mein Vite proxy nahi hota, isliye:
- ya to `kycl.in` API mein apni website ke liye **CORS** allow karwao,
- ya apne backend par `/api/api/equipments` ka proxy banao,

aur `.env` file mein URL do:
```
VITE_EQUIPMENT_URL=https://your-domain.com/api/api/equipments
```

## Realistic (Ultra HD) look
- `src/three/realism.js` – containers par zang, dhool, paint fade, daag; asphalt par tel ke daag, daraarein;
  concrete, wall, gitti (patthar), wagons aur machines par detail. Ye shaders se bante hain, koi texture download nahi.
- `src/three/skyDome.js` – neela aasmaan, badal, sooraj.
- `createScene.js` – ambient occlusion (N8AO), halki glow (bloom), film tone mapping, vignette, SMAA anti-aliasing.
- Panel mein **Ultra HD effects** ka switch hai. Laptop garam ho ya slow chale to ise band kar do.

## Performance tips
- Slow lage to panel mein **Shadows** band karo.
- GLB mein containers aur sleepers GPU instancing se hain, isliye load halka rehta hai.
