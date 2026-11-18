import * as THREE from 'three';

// Blue gradient sky + soft procedural clouds + sun glow (matches the Blender world).
export function createSkyDome(sunDir, radius = 12000) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSun: { value: sunDir.clone().normalize() },
      uZenith: { value: new THREE.Color(0.06, 0.22, 0.62) },
      uMid: { value: new THREE.Color(0.32, 0.52, 0.85) },
      uHorizon: { value: new THREE.Color(0.74, 0.81, 0.89) },
      uGround: { value: new THREE.Color(0.42, 0.38, 0.33) },
      uCloudCover: { value: 0.58 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        gl_Position = p.xyww; // always at far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun, uZenith, uMid, uHorizon, uGround; uniform float uCloudCover;
      varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.02+vec2(3.1,1.7); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 col = y > 0.0
          ? mix(mix(uHorizon, uMid, smoothstep(0.0, 0.18, y)), uZenith, smoothstep(0.18, 0.75, y))
          : mix(uHorizon, uGround, smoothstep(0.0, -0.08, y));
        float sd = max(dot(d, uSun), 0.0);
        col += vec3(1.0,0.9,0.75) * (pow(sd, 8.0)*0.25 + pow(sd, 64.0)*0.6);
        col += vec3(1.0,0.95,0.85) * smoothstep(0.9995, 0.99985, sd) * 8.0; // sun disc
        if (y > 0.0) {
          vec2 uv = d.xz / max(y, 0.06) * 0.9;
          float c = fbm(uv*1.1 + vec2(4.0, 1.0));
          float cov = smoothstep(1.0-uCloudCover, 1.0-uCloudCover+0.16, c);
          cov *= smoothstep(0.03, 0.2, y);
          vec3 cloud = mix(vec3(0.70,0.73,0.79), vec3(1.0), smoothstep(0.45, 0.8, c));
          cloud += vec3(1.0,0.9,0.8) * pow(sd, 6.0) * 0.25;
          col = mix(col, cloud, cov);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}
