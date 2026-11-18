import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { latLonToBlender, blenderToThree } from './geo.js';
import { IGNORE_PREFIXES, MOVE_SMOOTHING, YARD_BOUNDS } from '../config.js';

const MIN_HEADING_MOVE = 3; // metres; turn to face travel direction only on real moves

/**
 * Keeps the reach-stacker objects from the GLB in sync with the live API.
 * - smooth gliding to new GPS positions
 * - turns to face the direction of travel
 * - HTML label above every machine (green = moving, white = idle, grey = no GPS)
 */
export class EquipmentTracker {
  constructor(machines) {
    /** @type {Map<string, {obj:THREE.Object3D,target:THREE.Vector3,heading:number,label:CSS2DObject,el:HTMLElement,state:object}>} */
    this.items = new Map();

    machines.forEach((obj, name) => {
      // The GLB stores rotation as a quaternion; for headings beyond ±90°
      // three.js decomposes it into (π, π-a, π). Normalise to a pure Y turn
      // so we can animate rotation.y safely.
      const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(obj.quaternion);
      obj.rotation.set(0, Math.atan2(-fwd.z, fwd.x), 0);

      const el = document.createElement('div');
      el.className = 'machine-label';
      el.innerHTML = `<span class="dot"></span>${name}`;
      const label = new CSS2DObject(el);
      label.position.set(0, 16, 0);
      label.center.set(0.5, 1);
      obj.add(label);

      this.items.set(name, {
        obj,
        target: obj.position.clone(),
        heading: obj.rotation.y,
        label,
        el,
        state: { name, status: 'idle', speed: 0, lat: null, lon: null, updatedAt: null, inYard: true },
      });
    });
  }

  /** Apply one API response: [{EQUIPMENT_NAME, LATITUDE, LONGITUDE}, ...] */
  update(data) {
    const now = Date.now();
    data.forEach((e) => {
      const name = String(e.EQUIPMENT_NAME || '').trim();
      if (!name || IGNORE_PREFIXES.some((p) => name.toUpperCase().startsWith(p))) return;
      const it = this.items.get(name);
      if (!it) return;

      const lat = parseFloat(e.LATITUDE);
      const lon = parseFloat(e.LONGITUDE);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        this._setStatus(it, 'nogps');
        return;
      }
      const { x, y } = latLonToBlender(lat, lon);
      const inYard =
        x > YARD_BOUNDS.minX && x < YARD_BOUNDS.maxX && y > YARD_BOUNDS.minY && y < YARD_BOUNDS.maxY;
      it.state.lat = lat;
      it.state.lon = lon;
      it.state.inYard = inYard;
      it.state.updatedAt = now;
      if (!inYard) {
        this._setStatus(it, 'nogps');
        return;
      }

      const next = blenderToThree(x, y, it.obj.position.y);
      const move = next.clone().sub(it.target);
      move.y = 0;
      const dist = move.length();
      if (dist > MIN_HEADING_MOVE) {
        // object local +X is the machine's front (Blender convention)
        it.heading = Math.atan2(-move.z, move.x);
      }
      it.state.speed = dist;
      it.target.copy(next);
      this._setStatus(it, dist > MIN_HEADING_MOVE ? 'moving' : 'idle');
    });
  }

  _setStatus(it, status) {
    it.state.status = status;
    it.el.dataset.status = status;
  }

  /** Call every frame. */
  tick(dt) {
    const k = 1 - Math.exp(-dt * MOVE_SMOOTHING);
    this.items.forEach((it) => {
      it.obj.position.lerp(it.target, k);
      let d = it.heading - it.obj.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest turn
      it.obj.rotation.y += d * k;
    });
  }

  setLabelsVisible(v) {
    this.items.forEach((it) => (it.label.visible = v));
  }

  getPosition(name) {
    const it = this.items.get(name);
    return it ? it.obj.position : null;
  }

  snapshot() {
    return [...this.items.values()].map((it) => ({ ...it.state }));
  }

  dispose() {
    this.items.forEach((it) => {
      it.obj.remove(it.label);
      it.el.remove();
    });
    this.items.clear();
  }
}
