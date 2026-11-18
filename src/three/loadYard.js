import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { DRACO_PATH, MODEL_URL } from '../config.js';

// Surfaces that only receive shadows (flat ground pieces).
const RECEIVE_ONLY = [
  'Yard_Ground_Asphalt',
  'Yard_Slot_Pads',
  'Yard_Slot_Markings',
  'Rail_Ballast',
];

/**
 * Loads the yard GLB.
 * Returns { root, machines } where machines is a Map: "ERS1" -> Object3D.
 */
export function loadYard(onProgress) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  return new Promise((resolve, reject) => {
    loader.load(
      MODEL_URL,
      (gltf) => {
        const root = gltf.scene;
        const machines = new Map();

        root.traverse((obj) => {
          const name = obj.name || '';

          // Blender text labels -> hidden (we draw crisp HTML labels instead)
          if (name.startsWith('LBL_')) {
            obj.visible = false;
            return;
          }

          // Reach stackers: RS_<EQUIPMENT_NAME>
          if (name.startsWith('RS_') && !machines.has(name.slice(3))) {
            machines.set(name.slice(3), obj);
          }

          if (obj.isMesh || obj.isInstancedMesh) {
            const receiveOnly = RECEIVE_ONLY.some((n) => name.startsWith(n));
            obj.castShadow = !receiveOnly;
            obj.receiveShadow = true;

            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              if (!m) return;
              if ('envMapIntensity' in m) m.envMapIntensity = 1.0;
              // flat lane / slot markings sit just above the ground
              if (name.startsWith('Yard_Slot_Markings')) {
                m.polygonOffset = true;
                m.polygonOffsetFactor = -2;
              }
            });
          }
        });

        draco.dispose();
        resolve({ root, machines });
      },
      (e) => {
        if (onProgress && e.total) onProgress(e.loaded / e.total);
        else if (onProgress && e.loaded) onProgress(Math.min(0.99, e.loaded / 23e6));
      },
      (err) => {
        draco.dispose();
        reject(err);
      }
    );
  });
}

/** Free GPU memory of everything under `root`. */
export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
      m.dispose();
    });
  });
}

export { THREE };
