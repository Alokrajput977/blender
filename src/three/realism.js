import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural "Blender-like" surface detail for the flat-coloured GLB.
// Every material is patched with onBeforeCompile: world-space noise adds
// dirt, rust, streaks, stains, worn paint, stones and micro bump – no textures
// to download, so the app stays light.
// ---------------------------------------------------------------------------

const NOISE_GLSL = /* glsl */ `
varying vec3 vYW;   // world position
varying vec3 vYL;   // local (object) position
varying vec3 vYN;   // world normal
varying float vSeed;// per object / per instance random

float yHash(vec3 p3){ p3=fract(p3*0.1031); p3+=dot(p3, p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
float yNoise(vec3 x){
  vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(yHash(i+vec3(0,0,0)),yHash(i+vec3(1,0,0)),f.x),
                 mix(yHash(i+vec3(0,1,0)),yHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(yHash(i+vec3(0,0,1)),yHash(i+vec3(1,0,1)),f.x),
                 mix(yHash(i+vec3(0,1,1)),yHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float yFbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*yNoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
float yCell(vec3 p){ // distance to nearest feature point (stones)
  vec3 i=floor(p); vec3 f=fract(p); float d=1.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
    vec3 o=vec3(x,y,z); vec3 r=o+vec3(yHash(i+o),yHash(i+o+11.1),yHash(i+o+27.3))-f; d=min(d,dot(r,r));
  }
  return sqrt(d);
}
vec3 yBump(vec3 n, float h, float strength, vec3 viewPos){
  vec3 dpdx=dFdx(viewPos), dpdy=dFdy(viewPos);
  float dhx=dFdx(h), dhy=dFdy(h);
  vec3 r1=cross(dpdy,n), r2=cross(n,dpdx);
  float det=dot(dpdx,r1);
  vec3 g=sign(det)*(dhx*r1+dhy*r2);
  return normalize(abs(det)*n - g*strength);
}
`;

const VERTEX_INJECT = /* glsl */ `
#include <begin_vertex>
vYL = position;
vec4 yW = vec4(transformed, 1.0);
vec3 yNrm = objectNormal;
#ifdef USE_INSTANCING
  yW = instanceMatrix * yW;
  yNrm = mat3(instanceMatrix) * yNrm;
  vSeed = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898,78.233,37.719))) * 43758.5453);
#else
  vSeed = fract(sin(dot(modelMatrix[3].xyz, vec3(12.9898,78.233,37.719))) * 43758.5453);
#endif
yW = modelMatrix * yW;
vYW = yW.xyz;
vYN = normalize(mat3(modelMatrix) * yNrm);
`;

// Per-kind colour/roughness/bump code. Inputs: diffuseColor.rgb (GLB colour).
// Outputs: diffuseColor.rgb, yRough (-1 = keep), yH (bump height), yBS (bump strength)
const KINDS = {
  container: /* glsl */ `
    vec3 c = diffuseColor.rgb;
    c = mix(vec3(dot(c, vec3(0.3,0.59,0.11))), c, 0.72);               // real paint is less saturated
    float s = vSeed;
    c *= mix(0.62, 1.0, fract(s*7.31));                              // newer / older paint
    c = mix(c, vec3(dot(c, vec3(0.333))), fract(s*3.17)*0.25);         // sun-faded
    float hgt = vYL.y;
    float st = yFbm(vec3(vYW.x*1.3, vYW.y*0.35, vYW.z*1.3) + s*10.0);  // vertical streaks
    float streak = smoothstep(0.5, 0.85, st) * 0.28;
    c = mix(c, vec3(0.085,0.072,0.06), streak);
    float rn = yFbm(vYW*2.2 + s*5.0);
    float rust = smoothstep(0.68, 0.82, rn + (1.0-smoothstep(0.0,0.8,hgt))*0.12);
    c = mix(c, vec3(0.15,0.065,0.028), rust*0.6);
    float top = smoothstep(0.7, 1.0, vYN.y);
    c = mix(c, vec3(0.40,0.36,0.30), top * 0.45 * yFbm(vYW*0.7));      // dust on roofs
    diffuseColor.rgb = c;
    yRough = clamp(mix(0.42, 0.86, st*0.55 + rust*0.6), 0.0, 1.0);
    yH = yFbm(vYW*1.4)*0.5 + rust*0.5; yBS = 0.012;
  `,
  asphalt: /* glsl */ `
    float n1 = yFbm(vYW*0.035);
    float g  = yNoise(vYW*22.0);
    vec3 c = vec3(0.058,0.058,0.062) * (0.72 + 0.55*n1) * (0.86 + 0.28*g);
    float oil = smoothstep(0.63, 0.76, yFbm(vYW*0.32 + 3.0));
    c *= 1.0 - oil*0.5;
    float dust = smoothstep(0.5, 0.78, yFbm(vYW*0.011 + 7.0));
    c = mix(c, vec3(0.21,0.19,0.16), dust*0.32);
    float lane = smoothstep(0.55, 0.75, yFbm(vec3(vYW.x*0.6, 0.0, vYW.z*0.02)));   // tyre wear bands
    c *= 1.0 - lane*0.18;
    float cr = 1.0 - smoothstep(0.0, 0.006, abs(yFbm(vYW*0.11) - 0.5));
    c *= 1.0 - cr*0.28;
    diffuseColor.rgb = c;
    yRough = mix(0.93, 0.42, oil);
    yH = g*0.35 + yFbm(vYW*0.8)*0.65 - cr*0.2; yBS = 0.03;
  `,
  concrete: /* glsl */ `
    vec3 c = diffuseColor.rgb * 0.5 * (0.8 + 0.4*yFbm(vYW*0.5));
    float stain = smoothstep(0.48, 0.72, yFbm(vYW*0.22 + 5.0));
    c = mix(c, c*0.45, stain*0.6);
    c *= 0.9 + 0.2*yNoise(vYW*30.0);
    diffuseColor.rgb = c;
    yRough = 0.9;
    yH = yNoise(vYW*30.0)*0.5 + yFbm(vYW*2.0)*0.5; yBS = 0.015;
  `,
  plaster: /* glsl */ `
    vec3 c = diffuseColor.rgb * (0.85 + 0.25*yFbm(vYW*0.6));
    float low = 1.0 - smoothstep(0.1, 1.3, vYW.y);
    float dirt = clamp(low * (0.6 + 0.6*yFbm(vYW*1.5)), 0.0, 1.0);
    c = mix(c, vec3(0.19,0.15,0.10), dirt*0.75);
    float st = smoothstep(0.55, 0.8, yFbm(vec3(vYW.x*3.0, vYW.y*0.3, vYW.z*3.0)));
    c = mix(c, c*0.55, st*0.5);
    diffuseColor.rgb = c;
    yRough = 0.95;
    yH = yNoise(vYW*25.0); yBS = 0.02;
  `,
  paint: /* glsl */ `
    float wear = smoothstep(0.42, 0.62, yFbm(vYW*3.2));
    vec3 c = mix(diffuseColor.rgb*0.72, vec3(0.08,0.08,0.085), wear*0.85);
    c *= 0.9 + 0.15*yNoise(vYW*25.0);
    diffuseColor.rgb = c;
    yRough = 0.75;
    yH = 0.0; yBS = 0.0;
  `,
  ballast: /* glsl */ `
    float cell = yCell(vYW*9.0);
    float id = yHash(floor(vYW*9.0));
    vec3 c = mix(vec3(0.16,0.15,0.14), vec3(0.44,0.41,0.37), id);
    c = mix(c, vec3(0.30,0.24,0.18), yFbm(vYW*0.8)*0.35);
    c *= 0.55 + 0.6*smoothstep(0.0, 0.6, 1.0-cell);
    diffuseColor.rgb = c;
    yRough = 0.96;
    yH = 1.0 - cell; yBS = 0.06;
  `,
  steel: /* glsl */ `
    vec3 c = diffuseColor.rgb;
    float r = smoothstep(0.5, 0.75, yFbm(vYW*1.5));
    c = mix(c, vec3(0.16,0.08,0.04), r*0.7);
    diffuseColor.rgb = c;
    yRough = mix(0.45, 0.85, r);
    yH = yFbm(vYW*3.0); yBS = 0.008;
  `,
  wagon: /* glsl */ `
    vec3 c = diffuseColor.rgb * mix(0.8, 1.1, vSeed);
    float rn = yFbm(vYW*2.0 + vSeed*7.0);
    float rust = smoothstep(0.58, 0.76, rn);
    c = mix(c, vec3(0.12,0.055,0.03), rust*0.8);
    c = mix(c, vec3(0.32,0.28,0.22), smoothstep(0.75,1.0,vYN.y)*0.35*yFbm(vYW*0.9));
    diffuseColor.rgb = c;
    yRough = mix(0.55, 0.9, rust);
    yH = rn; yBS = 0.01;
  `,
  machine: /* glsl */ `
    vec3 c = diffuseColor.rgb;
    float low = 1.0 - smoothstep(0.2, 2.2, vYW.y);
    float d = clamp(low * (0.5 + 0.7*yFbm(vYW*2.0)), 0.0, 1.0);
    c = mix(c, vec3(0.20,0.17,0.13), d*0.6);
    float sc = smoothstep(0.7, 0.85, yFbm(vYW*4.0));
    c = mix(c, c*0.6, sc*0.4);
    diffuseColor.rgb = c;
    yRough = clamp(mix(0.38, 0.75, d + sc*0.5), 0.0, 1.0);
    yH = yFbm(vYW*5.0); yBS = 0.004;
  `,
  terrain: /* glsl */ `
    float n = yFbm(vYW*0.004);
    float m = yFbm(vYW*0.05);
    vec3 soil = vec3(0.24,0.19,0.13);
    vec3 grass = vec3(0.20,0.21,0.10);
    vec3 dry = vec3(0.34,0.29,0.19);
    vec3 c = mix(soil, grass, smoothstep(0.3,0.75,n)*0.7);
    c = mix(c, dry, smoothstep(0.45,0.8,m)*0.35);
    c *= 0.85 + 0.3*yNoise(vYW*3.0);
    diffuseColor.rgb = c;
    yRough = 1.0;
    yH = yNoise(vYW*3.0); yBS = 0.02;
  `,
};

/** Which procedural kind a GLB material should use (by material name). */
export function kindForMaterial(name = '') {
  if (name === 'Container_Steel') return 'steel';
  if (name.startsWith('Container_')) return 'container';
  if (name.startsWith('Yard_Asphalt')) return 'asphalt';
  if (name.startsWith('Yard_Concrete') || name.startsWith('Wall_Concrete') || name.startsWith('Booth_Wall'))
    return 'concrete';
  if (name.startsWith('Wall_Plaster')) return 'plaster';
  if (name.startsWith('Yard_Paint') || name.startsWith('Road_Paint')) return 'paint';
  if (name.startsWith('Rail_Ballast')) return 'ballast';
  if (name.startsWith('Rail_Steel') || name.startsWith('Fence_Steel') || name.startsWith('Gate_Steel'))
    return 'steel';
  if (name.startsWith('Wagon_Body')) return 'wagon';
  if (name.startsWith('RS_Yellow') || name.startsWith('RS_Red')) return 'machine';
  return null;
}

/** Patch one MeshStandardMaterial with procedural detail of `kind`. */
export function patchMaterial(mat, kind) {
  if (!mat || !KINDS[kind] || mat.userData.yardPatched) return;
  mat.userData.yardPatched = true;
  const prev = mat.onBeforeCompile;

  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${'varying vec3 vYW; varying vec3 vYL; varying vec3 vYN; varying float vSeed;'}`)
      .replace('#include <begin_vertex>', VERTEX_INJECT);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\nfloat yRough = -1.0; float yH = 0.0; float yBS = 0.0;\n{ ${KINDS[kind]} }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nif (yRough >= 0.0) roughnessFactor = yRough;'
      )
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nyBS *= 1.0 - smoothstep(25.0, 120.0, length(vViewPosition));\nif (yBS > 0.0) normal = yBump(normal, yH, yBS, -vViewPosition);'
      );
  };
  mat.customProgramCacheKey = () => `yard-${kind}`;
  mat.needsUpdate = true;
}

/** Walk the loaded GLB and add realism to every recognised material. */
export function applyRealism(root) {
  const done = new Set();
  root.traverse((o) => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (done.has(m)) return;
      done.add(m);
      const kind = kindForMaterial(m.name);
      if (kind) patchMaterial(m, kind);
      // glass / chrome: a bit more reflective in the sky environment
      if (/Glass|Chrome/.test(m.name)) m.envMapIntensity = 1.6;
    });
  });
}
