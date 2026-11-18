import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { createScene } from '../three/createScene.js';
import { loadYard, disposeObject } from '../three/loadYard.js';
import { applyRealism } from '../three/realism.js';
import { EquipmentTracker } from '../three/equipmentTracker.js';
import { CAMERA_PRESETS, CameraFlyer } from '../three/cameraPresets.js';
import './YardViewer.css';

/**
 * Full-screen three.js canvas that renders the yard GLB.
 *
 * Props:
 *  onProgress(0..1)        – loading progress
 *  onLoaded(machineNames)  – GLB ready
 *  onError(error)
 *  onMachines(snapshot[])  – called after every live update
 *
 * Methods (via ref):
 *  applyEquipment(data), flyToPreset(key), focusMachine(name),
 *  setFollow(name|null), setLabels(bool), setShadows(bool), resetView()
 */
const YardViewer = forwardRef(function YardViewer(
  { onProgress, onLoaded, onError, onMachines },
  ref
) {
  const containerRef = useRef(null);
  const api = useRef({}); // live three.js objects

  // keep latest callbacks without re-running the effect
  const cb = useRef({});
  cb.current = { onProgress, onLoaded, onError, onMachines };

  useEffect(() => {
    const container = containerRef.current;
    const ctx = createScene(container);
    const flyer = new CameraFlyer(ctx.camera, ctx.controls);
    const clock = new THREE.Clock();
    let tracker = null;
    let yardRoot = null;
    let cancelled = false;
    let frame = 0;

    api.current = { ctx, flyer, tracker: null, follow: null, pending: null };
    window.__yard = api.current; // handy for debugging in the browser console

    // stop an automatic flight / follow as soon as the user grabs the mouse
    const stopAuto = () => {
      flyer.cancel();
    };
    ctx.controls.addEventListener('start', stopAuto);

    loadYard((p) => cb.current.onProgress?.(p))
      .then(({ root, machines }) => {
        if (cancelled) {
          disposeObject(root);
          return;
        }
        yardRoot = root;
        applyRealism(root);
        ctx.scene.add(root);
        // optional start view from URL: ?view=inGate | train | stacks | top ...
        const v = new URLSearchParams(window.location.search).get('view');
        if (v && CAMERA_PRESETS[v]) {
          ctx.camera.position.copy(CAMERA_PRESETS[v].position);
          ctx.controls.target.copy(CAMERA_PRESETS[v].target);
        }
        tracker = new EquipmentTracker(machines);
        api.current.tracker = tracker;
        cb.current.onLoaded?.([...machines.keys()]);
        cb.current.onMachines?.(tracker.snapshot());
        if (api.current.pending) {
          tracker.update(api.current.pending);
          api.current.pending = null;
          cb.current.onMachines?.(tracker.snapshot());
        }
      })
      .catch((err) => !cancelled && cb.current.onError?.(err));

    const ro = new ResizeObserver(() => ctx.resize());
    ro.observe(container);

    const followOffset = new THREE.Vector3();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);

      flyer.update(dt);

      if (tracker) {
        // remember camera offset before machines move (for follow mode)
        const f = api.current.follow;
        const before = f ? tracker.getPosition(f)?.clone() : null;
        tracker.tick(dt);
        if (f && before && !flyer.busy) {
          followOffset.copy(tracker.getPosition(f)).sub(before);
          ctx.camera.position.add(followOffset);
          ctx.controls.target.add(followOffset);
        }
      }

      ctx.controls.update();
      ctx.updateSun();
      ctx.render();
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      ctx.controls.removeEventListener('start', stopAuto);
      tracker?.dispose();
      if (yardRoot) {
        ctx.scene.remove(yardRoot);
        disposeObject(yardRoot);
      }
      ctx.dispose();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    applyEquipment(data) {
      const t = api.current.tracker;
      if (!t) {
        api.current.pending = data; // model still loading
        return;
      }
      t.update(data);
      cb.current.onMachines?.(t.snapshot());
    },
    flyToPreset(key) {
      const p = CAMERA_PRESETS[key];
      if (!p) return;
      api.current.follow = null;
      api.current.flyer.flyTo(p.position, p.target);
    },
    focusMachine(name) {
      const pos = api.current.tracker?.getPosition(name);
      if (pos) api.current.flyer.focusPoint(pos, 38);
    },
    setFollow(name) {
      api.current.follow = name || null;
      if (name) this.focusMachine(name);
    },
    setLabels(v) {
      api.current.tracker?.setLabelsVisible(v);
    },
    setShadows(v) {
      const { renderer, sun } = api.current.ctx;
      renderer.shadowMap.enabled = v;
      sun.castShadow = v;
      // materials must recompile when the shadow state changes
      api.current.ctx.scene.traverse((o) => {
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(
            (m) => (m.needsUpdate = true)
          );
        }
      });
    },
    setUltra(v) {
      api.current.ctx.setUltra(v);
    },
    resetView() {
      this.flyToPreset('overview');
    },
  }));

  return <div ref={containerRef} className="yard-viewer" />;
});

export default YardViewer;
