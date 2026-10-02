// Pista estilo arcade (Cruis'n USA): uma estrada procedural com curvas e morros.
// A lógica do jogo continua em "espaço da pista" (x lateral, y altura, z = distância relativa, negativo à frente).
// A renderização mapeia cada vértice pra posição real na curva/morro usando amostras da pista
// calculadas a cada frame no referencial do jogador.
import * as THREE from 'three';

const STEP = 5; // metros entre amostras
const BACK = 40; // amostras começam 40 m atrás
const N = 65; // 65 amostras: de -40 a +280 m
const AHEAD = (N - 1) * STEP - BACK;

export const CURVE = { uTrk: { value: Array.from({ length: N }, () => new THREE.Vector4()) } };
const S = CURVE.uTrk.value; // (x, y, z, heading) no referencial do jogador

export function curveMaterial(m) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTrk = CURVE.uTrk;
    shader.vertexShader =
      `uniform vec4 uTrk[${N}];\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 bwp = modelMatrix * mvPosition;
float dd = -bwp.z;
float fi = clamp( ( dd + ${BACK.toFixed(1)} ) / ${STEP.toFixed(1)}, 0.0, ${(N - 1.001).toFixed(3)} );
int i0 = int( floor( fi ) );
vec4 ta = uTrk[ i0 ];
vec4 tb = uTrk[ i0 + 1 ];
vec4 tt = mix( ta, tb, fi - float( i0 ) );
float extra = max( 0.0, dd - ${AHEAD.toFixed(1)} ) + min( 0.0, dd + ${BACK.toFixed(1)} );
vec3 fw = vec3( sin( tt.w ), 0.0, -cos( tt.w ) );
vec3 rt = vec3( cos( tt.w ), 0.0, sin( tt.w ) );
bwp.xyz = tt.xyz + rt * bwp.x + vec3( 0.0, bwp.y, 0.0 ) + fw * extra;
mvPosition = viewMatrix * bwp;
gl_Position = projectionMatrix * mvPosition;`
      );
  };
  m.customProgramCacheKey = () => 'track';
  return m;
}

// ------------------------------------------------------------------ gerador da pista (absoluto)
class TrackGen {
  constructor() {
    this.reset();
  }
  reset() {
    this.th = [0]; // direção acumulada por amostra
    this.h = [0]; // altura por amostra
    this.k = 0; // curvatura atual
    this.kT = 0;
    this.segLeft = 200;
    this.hillA = 0; // amplitude dos morros (suavizada)
    this.ph1 = Math.random() * 6.28;
    this.ph2 = Math.random() * 6.28;
    this.curvy = 0.5;
    this.hilly = 0.5;
  }
  extend(sMax) {
    while ((this.th.length - 1) * STEP < sMax) {
      const i = this.th.length;
      const s = i * STEP;
      this.segLeft -= STEP;
      if (this.segLeft <= 0) {
        this.segLeft = 120 + Math.random() * 260;
        const straight = Math.random() < 0.38 - this.curvy * 0.2;
        this.kT = straight ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.0012 + Math.random() * 0.0024) * (0.5 + this.curvy);
      }
      this.k += (this.kT - this.k) * 0.06;
      this.th.push(this.th[i - 1] + this.k * STEP);
      this.hillA += (this.hilly - this.hillA) * 0.01;
      const hgt = this.hillA * (9 * Math.sin(s / 95 + this.ph1) + 3 * Math.sin(s / 37 + this.ph2));
      this.h.push(hgt);
    }
  }
  sample(s, out) {
    const f = Math.max(0, s / STEP);
    const i = Math.floor(f);
    const r = f - i;
    this.extend((i + 2) * STEP);
    out.th = this.th[i] + (this.th[i + 1] - this.th[i]) * r;
    out.h = this.h[i] + (this.h[i + 1] - this.h[i]) * r;
    return out;
  }
}
export const TRACK = new TrackGen();
const _sm = { th: 0, h: 0 };
const _s0 = { th: 0, h: 0 };
const _pos = Array.from({ length: N }, () => new THREE.Vector4());
export const TRACK_STATE = { heading: 0, dist: 0 };

// recalcula as amostras no referencial do jogador (chamado 1x por frame)
export function updateTrack(dist) {
  TRACK.sample(dist + 300, _sm);
  TRACK.sample(dist, _s0);
  TRACK_STATE.heading = _s0.th;
  TRACK_STATE.dist = dist;
  const i0 = BACK / STEP;
  S[i0].set(0, 0, 0, 0);
  // pra frente
  for (let i = i0 + 1; i < N; i++) {
    const d = (i - i0) * STEP;
    TRACK.sample(Math.max(0, dist + d - STEP / 2), _sm);
    const ps = _sm.th - _s0.th;
    TRACK.sample(Math.max(0, dist + d), _sm);
    const p = S[i - 1];
    S[i].set(p.x + Math.sin(ps) * STEP, _sm.h - _s0.h, p.z - Math.cos(ps) * STEP, _sm.th - _s0.th);
  }
  // pra trás
  for (let i = i0 - 1; i >= 0; i--) {
    const d = (i - i0) * STEP;
    const sa = dist + d;
    TRACK.sample(Math.max(0, sa + STEP / 2), _sm);
    const ps = _sm.th - _s0.th;
    TRACK.sample(Math.max(0, sa), _sm);
    const p = S[i + 1];
    S[i].set(p.x - Math.sin(ps) * STEP, sa < 0 ? 0 : _sm.h - _s0.h, p.z + Math.cos(ps) * STEP, sa < 0 ? 0 : _sm.th - _s0.th);
  }
}

function sampleAt(d, out) {
  const fi = Math.min(Math.max((d + BACK) / STEP, 0), N - 1.001);
  const i = Math.floor(fi);
  const r = fi - i;
  const a = S[i];
  const b = S[i + 1];
  out.set(a.x + (b.x - a.x) * r, a.y + (b.y - a.y) * r, a.z + (b.z - a.z) * r, a.w + (b.w - a.w) * r);
  return out;
}
const _t4 = new THREE.Vector4();

// espaço da pista -> mundo (in-place)
export function toWorld(v) {
  const d = -v.z;
  const t = sampleAt(d, _t4);
  const extra = Math.max(0, d - AHEAD) + Math.min(0, d + BACK);
  const c = Math.cos(t.w);
  const s = Math.sin(t.w);
  const x = v.x;
  const y = v.y;
  v.x = t.x + c * x + s * extra;
  v.y = t.y + y;
  v.z = t.z + s * x - c * extra;
  return v;
}

// mundo -> espaço da pista (in-place, iterativo)
export function fromWorld(v) {
  let d = -v.z;
  for (let k = 0; k < 4; k++) {
    const t = sampleAt(d, _t4);
    const fx = Math.sin(t.w);
    const fz = -Math.cos(t.w);
    d += (v.x - t.x) * fx + (v.z - t.z) * fz;
  }
  const t = sampleAt(d, _t4);
  const x = (v.x - t.x) * Math.cos(t.w) + (v.z - t.z) * Math.sin(t.w);
  v.y = v.y - t.y;
  v.x = x;
  v.z = -d;
  return v;
}

// altura aproximada do chão no mundo pra um ponto à distância -z
export function groundY(z) {
  return sampleAt(-z, _t4).y;
}
export function groundHeight(v) {
  return v.y - groundY(v.z);
}
// direção (heading) da pista num ponto do mundo
export function headingAt(z) {
  return sampleAt(-z, _t4).w;
}
