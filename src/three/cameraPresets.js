import * as THREE from 'three';

// Camera views (three.js coordinates: x = east, y = up, z = south).
// position = where the camera stands, target = what it looks at.
export const CAMERA_PRESETS = {
  overview: {
    label: 'Poora Yard',
    position: new THREE.Vector3(650, 520, 950),
    target: new THREE.Vector3(-30, 0, 0),
  },
  top: {
    label: 'Upar se (Top)',
    position: new THREE.Vector3(-25, 1650, 1),
    target: new THREE.Vector3(-25, 0, 0),
  },
  inGate: {
    label: 'IN Gate',
    position: new THREE.Vector3(-110, 32, 560),
    target: new THREE.Vector3(-37, 2, 514),
  },
  outGate: {
    label: 'OUT Gate',
    position: new THREE.Vector3(-85, 30, 690),
    target: new THREE.Vector3(-24, 2, 634),
  },
  train: {
    label: 'Train / Railway',
    position: new THREE.Vector3(-230, 45, 330),
    target: new THREE.Vector3(-312, 2, 220),
  },
  stacks: {
    label: 'Container Stacks',
    position: new THREE.Vector3(-120, 22, 200),
    target: new THREE.Vector3(-180, 4, 140),
  },
};

/**
 * Smooth camera flight. Call `update(dt)` every frame.
 */
export class CameraFlyer {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.active = null;
  }

  flyTo(position, target, duration = 1.4) {
    this.active = {
      fromPos: this.camera.position.clone(),
      fromTgt: this.controls.target.clone(),
      toPos: position.clone(),
      toTgt: target.clone(),
      t: 0,
      duration,
    };
  }

  /** Fly to look at a point from a nice offset (used for machines). */
  focusPoint(point, distance = 40) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    dir.y = 0;
    if (dir.lengthSq() < 1) dir.set(1, 0, 1);
    dir.normalize().multiplyScalar(distance);
    const pos = point.clone().add(dir);
    pos.y = point.y + distance * 0.55;
    this.flyTo(pos, point.clone().setY(point.y + 3));
  }

  cancel() {
    this.active = null;
  }

  get busy() {
    return !!this.active;
  }

  update(dt) {
    const a = this.active;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / a.duration);
    const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2; // easeInOutCubic
    this.camera.position.lerpVectors(a.fromPos, a.toPos, e);
    this.controls.target.lerpVectors(a.fromTgt, a.toTgt, e);
    if (a.t >= 1) this.active = null;
  }
}
