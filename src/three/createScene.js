import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { N8AOPass } from 'n8ao';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { createSkyDome } from './skyDome.js';
import { patchMaterial } from './realism.js';

// Sun direction (same as Blender, converted to Y-up).
export const SUN_DIR = new THREE.Vector3(-0.8, 0.5, 0.35).normalize();

// Film look: vignette + slight contrast/saturation + aerial haze is done by fog.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uSat: { value: 0.96 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVignette, uSat; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      vec2 d = vUv - 0.5; float v = 1.0 - dot(d,d) * uVignette * 2.2;
      c.rgb *= clamp(v, 0.0, 1.0);
      gl_FragColor = c;
    }`,
};

export function createScene(container) {
  const W = () => container.clientWidth || window.innerWidth;
  const H = () => container.clientHeight || window.innerHeight;

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic curve
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(W(), H());
  labelRenderer.domElement.className = 'yard-label-layer';
  container.appendChild(labelRenderer.domElement);

  // ---------- scene & camera ----------
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb4c6da, 0.00011); // aerial haze like Blender mist

  const camera = new THREE.PerspectiveCamera(42, W() / H(), 2.5, 6000);
  camera.position.set(650, 520, 950);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 8;
  controls.maxDistance = 2600;
  controls.maxPolarAngle = Math.PI / 2 - 0.06; // never below ground
  controls.zoomSpeed = 1.2;
  controls.target.set(-30, 0, 0);
  controls.update();

  // ---------- sky + image based light ----------
  const sky = createSkyDome(SUN_DIR, 12000);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = createSkyDome(SUN_DIR, 100);
  envSky.material.defines = { ENV: 1 };
  envScene.add(envSky);
  const envRT = pmrem.fromScene(envScene, 0.02, 1, 500);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.5;

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xc7dcff, 0x5e5040, 0.18);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffeed6, 5.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.9;
  sun.shadow.radius = 2.5;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 3000;
  scene.add(sun, sun.target);

  // ---------- terrain outside the wall ----------
  const terrainMat = new THREE.MeshStandardMaterial({ color: 0x6e5f45, roughness: 1 });
  patchMaterial(terrainMat, 'terrain');
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -0.6;
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ---------- post-processing (ultra) ----------
  const rt = new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(W(), H());

  // Ambient occlusion: dark contact shadows in gaps between containers,
  // under machines and wagons (the biggest step towards a "real" look).
  const gtao = new N8AOPass(scene, camera, W(), H());
  gtao.configuration.aoRadius = 3.0;
  gtao.configuration.distanceFalloff = 1.0;
  gtao.configuration.intensity = 1.8;
  gtao.configuration.color = new THREE.Color(0, 0, 0);
  gtao.configuration.gammaCorrection = false;
  gtao.setQualityMode('Medium');
  gtao.configuration.denoiseRadius = 14;
  composer.addPass(gtao);

  const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.18, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  const pr = renderer.getPixelRatio();
  const smaa = new SMAAPass(W() * pr, H() * pr); // smooth edges after AO
  composer.addPass(smaa);

  let ultra = true;

  function updateSun() {
    const dist = camera.position.distanceTo(controls.target);
    const size = THREE.MathUtils.clamp(dist * 0.85, 50, 750);
    const cam = sun.shadow.camera;
    if (Math.abs(cam.right - size) > 0.5) {
      cam.left = -size; cam.right = size; cam.top = size; cam.bottom = -size;
      cam.updateProjectionMatrix();
    }
    sun.target.position.copy(controls.target);
    sun.position.copy(controls.target).addScaledVector(SUN_DIR, 1400);
  }

  function render() {
    sky.position.copy(camera.position);
    if (ultra) composer.render();
    else renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  function setUltra(v) {
    ultra = v;
  }

  function resize() {
    const w = W(), h = H();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }

  function dispose() {
    controls.dispose();
    composer.dispose();
    rt.dispose();
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    labelRenderer.domElement.remove();
  }

  return { renderer, labelRenderer, scene, camera, controls, sun, composer, gtao, bloom, updateSun, render, setUltra, resize, dispose };
}
