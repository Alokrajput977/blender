import * as THREE from 'three';
import { GEO_ORIGIN } from '../config.js';

const R = 6378137.0; // WGS84 radius used in Blender
const toRad = (d) => (d * Math.PI) / 180;

/**
 * Convert latitude / longitude to Blender metres (x = east, y = north).
 * Same formula that was used to build the GLB.
 */
export function latLonToBlender(lat, lon) {
  const x = toRad(lon - GEO_ORIGIN.lon) * R * Math.cos(toRad(GEO_ORIGIN.lat));
  const y = toRad(lat - GEO_ORIGIN.lat) * R;
  return { x, y };
}

/**
 * glTF / three.js is Y-up. Blender is Z-up.
 * Blender (x, y, z)  ->  three (x, z, -y)
 */
export function blenderToThree(x, y, z = 0, target = new THREE.Vector3()) {
  return target.set(x, z, -y);
}

export function latLonToThree(lat, lon, height = 0, target) {
  const { x, y } = latLonToBlender(lat, lon);
  return blenderToThree(x, y, height, target);
}
