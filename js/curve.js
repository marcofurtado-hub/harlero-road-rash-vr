// Pista estilo arcade (Cruis'n USA): uma estrada procedural com curvas e morros.
// A lógica do jogo continua em "espaço da pista" (x lateral, y altura, z = distância relativa, negativo à frente).
// A renderização mapeia cada vértice pra posição real na curva/morro usando amostras da pista
// calculadas a cada frame no referencial do jogador.
import * as THREE from 'three';

const STEP = 5; // metros entre amostras
const BACK = 40; // amostras começam 40 m atrás
const N = 65; // 65 amostras: de -40 a +280 m
const AHEAD = (N - 1) * STEP - BACK;

export const CURVE = {
  uTrk: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
  // desfiladeiro sob a ponte alta: (início, fim) em metros à frente, profundidade
  uChasm: { value: new THREE.Vector4(-1e4, -1e4, 0, 0) },
};
const S = CURVE.uTrk.value; // (x, y, z, heading) no referencial do jogador

// o chão afunda num vale (com rio no fundo) onde passa a ponte alta
const CHASM_V = `
float chK = smoothstep( uChasm.x - 8.0, uChasm.x + 24.0, dd ) * ( 1.0 - smoothstep( uChasm.y - 24.0, uChasm.y + 8.0, dd ) );
chK *= 1.0 - 0.72 * smoothstep( 32.0, 105.0, abs( bwp.x ) );
bwp.y -= uChasm.z * chK;
vCh = chK;
vChX = bwp.x;
`;

export function curveMaterial(m, opts = {}) {
  const ground = !!opts.ground;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTrk = CURVE.uTrk;
    if (ground) shader.uniforms.uChasm = CURVE.uChasm;
    shader.vertexShader =
      `uniform vec4 uTrk[${N}];\n` +
      (ground ? 'uniform vec4 uChasm;\nvarying float vCh;\nvarying float vChX;\n' : '') +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 bwp = modelMatrix * mvPosition;
float dd = -bwp.z;
${ground ? CHASM_V : ''}
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
    if (ground) {
      // paredões mais escuros e um rio no fundo do vale
      shader.fragmentShader =
        'varying float vCh;\nvarying float vChX;\n' +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
float rv = smoothstep( 0.82, 0.97, vCh ) * ( 1.0 - smoothstep( 16.0, 26.0, abs( vChX ) ) );
diffuseColor.rgb = mix( diffuseColor.rgb * mix( 1.0, 0.55, smoothstep( 0.05, 0.6, vCh ) ), vec3( 0.10, 0.32, 0.52 ), rv );`
        );
    }
  };
  m.customProgramCacheKey = () => (ground ? 'track-ground' : 'track');
  return m;
}

// ------------------------------------------------------------------ gerador da pista (absoluto)
// trechos especiais (comprimentos fixos: a geometria é construída uma vez só)
export const FEAT_LEN = { tunnel: 230, bridge: 270 };
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - Math.cos(Math.PI * t)) / 2);
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

class TrackGen {
  constructor() {
    this.weights = { none: 1 };
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
    this.features = []; // { kind: 'tunnel'|'bridge', s0, s1 }
    this.events = []; // descidas/subidas { s0, s1, dh }
    this.baseDone = 0; // soma das descidas/subidas já concluídas
    this.planS = 260; // primeiro trecho especial
    this.lastKind = 'none';
  }
  // agenda os próximos trechos (sempre bem à frente da geração das amostras)
  plan(sMax) {
    while (this.planS < sMax) {
      const s0 = this.planS;
      const W = this.weights;
      const keys = Object.keys(W).filter((k) => W[k] > 0);
      let kind = 'none';
      let r = Math.random() * keys.reduce((a, k) => a + W[k], 0);
      for (const k of keys) {
        r -= W[k];
        if (r <= 0) {
          kind = k;
          break;
        }
      }
      if (kind === this.lastKind && kind !== 'none') kind = 'none';
      this.lastKind = kind;
      let len;
      if (kind === 'tunnel' || kind === 'bridge') {
        len = FEAT_LEN[kind];
        this.features.push({ kind, s0, s1: s0 + len });
      } else if (kind === 'mega') {
        // DESCIDA ABSURDA: longa e íngreme, com rampa de largada lá no topo
        len = 650 + Math.random() * 400;
        this.features.push({ kind: 'ramp', s0: s0 - 30, s1: s0 - 22, x: 0, w: 18 });
        this.events.push({ s0, s1: s0 + len, dh: -(95 + Math.random() * 70), drop: true });
      } else if (kind === 'ramp') {
        // rampa numa faixa (passe por ela pra voar); às vezes a pista despenca logo depois
        len = 60;
        const w = Math.random() < 0.3 ? 18 : 6.5;
        const x = w > 10 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 3.5);
        this.features.push({ kind: 'ramp', s0, s1: s0 + 8, x, w });
        if (Math.random() < 0.6) {
          this.events.push({ s0: s0 + 12, s1: s0 + 200, dh: -(20 + Math.random() * 18), drop: true });
          len = 210;
        }
      } else if (kind === 'descent' || kind === 'climb') {
        len = 230 + Math.random() * 120;
        // descidas fortes, subidas leves
        const dh = kind === 'descent' ? -(18 + Math.random() * 18) : 10 + Math.random() * 14;
        this.events.push({ s0, s1: s0 + len, dh });
      } else len = 120 + Math.random() * 160;
      this.planS = s0 + len + 140 + Math.random() * 200;
    }
  }
  // 1 dentro de túnel/ponte (rampas de 50 m): achata morros e curvas
  flatAt(s) {
    let m = 0;
    for (const f of this.features) {
      if ((f.kind !== 'tunnel' && f.kind !== 'bridge') || s < f.s0 - 60 || s > f.s1 + 60) continue;
      m = Math.max(m, sstep(f.s0 - 55, f.s0 - 5, s) * (1 - sstep(f.s1 + 5, f.s1 + 55, s)));
    }
    return m;
  }
  baseAt(s) {
    let b = this.baseDone;
    for (const e of this.events) {
      if (s <= e.s0) continue;
      const t = Math.min(1, (s - e.s0) / (e.s1 - e.s0));
      // "drop": despenca logo na saída da rampa e vai suavizando lá embaixo
      b += e.dh * (e.drop ? 1 - (1 - t) * (1 - t) : ease(t));
    }
    return b;
  }
  // rampa sob o ponto s (pra moto subir / decolar)
  rampAt(s) {
    for (const f of this.features) if (f.kind === 'ramp' && s >= f.s0 && s <= f.s1) return f;
    return null;
  }
  extend(sMax) {
    while ((this.th.length - 1) * STEP < sMax) {
      const i = this.th.length;
      const s = i * STEP;
      this.plan(s + 700);
      // eventos de altura já concluídos viram base fixa
      while (this.events.length && this.events[0].s1 < s - STEP) this.baseDone += this.events.shift().dh;
      this.segLeft -= STEP;
      if (this.segLeft <= 0) {
        this.segLeft = 120 + Math.random() * 260;
        const straight = Math.random() < 0.38 - this.curvy * 0.2;
        this.kT = straight ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.0012 + Math.random() * 0.0024) * (0.5 + this.curvy);
      }
      const flat = this.flatAt(s);
      this.k += (this.kT * (1 - 0.65 * flat) - this.k) * 0.06;
      this.th.push(this.th[i - 1] + this.k * STEP);
      this.hillA += (this.hilly - this.hillA) * 0.01;
      const hills = this.hillA * (9 * Math.sin(s / 95 + this.ph1) + 3 * Math.sin(s / 37 + this.ph2));
      this.h.push(this.baseAt(s) + hills * (1 - flat));
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
  // troca de fase: descarta o que ainda não apareceu e replaneja com os pesos novos
  replan(fromS) {
    this.features = this.features.filter((f) => f.s0 < fromS);
    this.events = this.events.filter((e) => e.s0 < fromS);
    let end = fromS;
    for (const f of this.features) end = Math.max(end, f.s1 + 140);
    for (const e of this.events) end = Math.max(end, e.s1 + 140);
    this.planS = end;
    this.lastKind = 'none';
  }
  // trecho especial que contém s (com folga)
  featureAt(s, pad = 0) {
    for (const f of this.features) if (s >= f.s0 - pad && s <= f.s1 + pad) return f;
    return null;
  }
  // cenário lateral (árvores, placas...) não pode aparecer dentro do túnel nem flutuando sobre o desfiladeiro
  blocked(s, ax) {
    for (const f of this.features) {
      if (f.kind === 'tunnel' && s > f.s0 - 12 && s < f.s1 + 12 && ax < 48) return true;
      if (f.kind === 'bridge' && s > f.s0 - 6 && s < f.s1 + 6) return true;
    }
    return false;
  }
}
export const TRACK = new TrackGen();
const _sm = { th: 0, h: 0 };
const _s0 = { th: 0, h: 0 };
const _pos = Array.from({ length: N }, () => new THREE.Vector4());
export const TRACK_STATE = { heading: 0, dist: 0, slope: 0, tunnel: 0, bridge: 0 };

// recalcula as amostras no referencial do jogador (chamado 1x por frame)
export function updateTrack(dist) {
  TRACK.sample(dist + 300, _sm);
  TRACK.sample(dist, _s0);
  TRACK_STATE.heading = _s0.th;
  TRACK_STATE.dist = dist;
  TRACK_STATE.h = _s0.h;
  TRACK.sample(dist + 6, _sm);
  const hA = _sm.h;
  TRACK.sample(Math.max(0, dist - 6), _sm);
  TRACK_STATE.slope = (hA - _sm.h) / 12;
  // onde o jogador está: dentro do túnel? em cima da ponte?
  let tun = 0;
  let bri = 0;
  const ch = CURVE.uChasm.value;
  ch.set(-1e4, -1e4, 0, 0);
  for (let i = TRACK.features.length - 1; i >= 0; i--) {
    const f = TRACK.features[i];
    if (f.s1 < dist - 400) {
      TRACK.features.splice(i, 1);
      continue;
    }
    const k = Math.min(1, Math.max(0, (dist - f.s0 + 2) / 14)) * Math.min(1, Math.max(0, (f.s1 - dist + 2) / 14));
    if (f.kind === 'tunnel') tun = Math.max(tun, k);
    else if (f.kind === 'bridge') {
      bri = Math.max(bri, k);
      if (f.s0 - dist < 900 && f.s1 - dist > -200) ch.set(f.s0 - dist, f.s1 - dist, 80, 0);
    }
  }
  TRACK_STATE.tunnel = tun;
  TRACK_STATE.bridge = bri;
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
