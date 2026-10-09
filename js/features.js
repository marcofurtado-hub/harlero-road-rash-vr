// Trechos especiais da estrada: TÚNEL na montanha e PONTE ALTA sobre o desfiladeiro.
// A geometria fica no espaço da pista (z de 0 até -comprimento) e o shader de curva dobra tudo
// junto com a estrada. Cada tipo tem uma malha só, reaproveitada a cada aparição.
import * as THREE from 'three';
import { G, rand, clamp, damp, chance } from './ctx.js';
import { Builder, mergeGeos, MAT } from './builder.js';
import { curveMaterial, TRACK, TRACK_STATE, FEAT_LEN } from './curve.js';
import { canvasTex, FW, FB, fitFont, strokeText } from './text.js';

const _c = new THREE.Color();

const featMat = curveMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
const glowMat = curveMaterial(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));

// "tubo" ao longo de -z a partir de um perfil 2D (x, y), subdividido pra acompanhar as curvas
function tube(profile, closed, z0, z1, step, colorFn) {
  const pos = [];
  const col = [];
  const n = Math.max(1, Math.round((z0 - z1) / step));
  const np = profile.length;
  const segs = closed ? np : np - 1;
  for (let k = 0; k < n; k++) {
    const za = z0 - ((z0 - z1) * k) / n;
    const zb = z0 - ((z0 - z1) * (k + 1)) / n;
    for (let j = 0; j < segs; j++) {
      const p = profile[j];
      const q = profile[(j + 1) % np];
      _c.set(colorFn(k, j));
      pos.push(p[0], p[1], za, q[0], q[1], za, q[0], q[1], zb, p[0], p[1], za, q[0], q[1], zb, p[0], p[1], zb);
      for (let v = 0; v < 6; v++) col.push(_c.r, _c.g, _c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function signTex(title, sub, bg, fg) {
  return canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 8;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, title, w - 50, 70, FW);
    strokeText(g, title, w / 2, h * 0.4, fg, 'rgba(0,0,0,0.35)', 4);
    fitFont(g, sub, w - 60, 28, FB);
    g.fillStyle = fg;
    g.fillText(sub, w / 2, h * 0.76);
  });
}

function signMesh(tex, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 4, 1), curveMaterial(new THREE.MeshBasicMaterial({ map: tex })));
  m.frustumCulled = false;
  return m;
}

// ------------------------------------------------------------------ TÚNEL
const TW = 10.6; // meia largura interna
const TH = 5.6; // altura da parede antes do arco
const TA = 4.4; // altura do arco

function tunnelProfile() {
  const p = [[-TW, -0.3], [-TW, TH]];
  for (let i = 1; i < 10; i++) {
    const a = Math.PI - (i / 10) * Math.PI;
    p.push([Math.cos(a) * TW, TH + Math.sin(a) * TA]);
  }
  p.push([TW, TH], [TW, -0.3]);
  return p;
}

function buildTunnel() {
  const L = FEAT_LEN.tunnel;
  const grp = new THREE.Group();
  // casca interna (concreto com juntas a cada 15 m)
  const prof = tunnelProfile();
  const shell = tube(prof, false, 2, -L - 2, 5, (k, j) => {
    const joint = k % 3 === 0;
    if (j === 0 || j === prof.length - 2) return joint ? 0x3a3a3c : 0x58585c; // paredes baixas
    return joint ? 0x4a4844 : j % 2 ? 0x7a7670 : 0x726e68;
  });
  // faixa amarela e preta na base das paredes
  const curbL = tube([[-TW + 0.01, 0], [-TW + 0.01, 0.9]], false, 2, -L - 2, 2.5, (k) => (k % 2 ? 0xe8c020 : 0x1a1a1a));
  const curbR = tube([[TW - 0.01, 0.9], [TW - 0.01, 0]], false, 2, -L - 2, 2.5, (k) => (k % 2 ? 0x1a1a1a : 0xe8c020));
  const shellMesh = new THREE.Mesh(mergeGeos([shell, curbL, curbR]), featMat);
  grp.add(shellMesh);
  // luminárias de sódio no teto + luzes de emergência nas paredes
  const lb = new Builder();
  for (let z = -6; z > -L; z -= 10) {
    for (const s of [-1, 1]) {
      lb.box(0.5, 0.12, 3.2, 0xffc46a, s * 5, 9.32, z, 0, 0, s * 0.45, { glow: true });
      if (Math.abs(z) % 30 < 10) lb.box(0.08, 0.3, 0.3, 0x40ff80, s * (TW - 0.05), 1.6, z, 0, 0, 0, { glow: true });
    }
  }
  const lights = new THREE.Mesh(lb.geometry('glow'), glowMat);
  grp.add(lights);

  // portais (entrada e saída) + montanha por cima
  const pb = new Builder();
  const portal = (z, dir) => {
    // moldura de concreto em volta da boca
    const shape = new THREE.Shape();
    shape.moveTo(-19, -0.5);
    shape.lineTo(19, -0.5);
    shape.lineTo(19, 15);
    shape.lineTo(-19, 15);
    shape.lineTo(-19, -0.5);
    const hole = new THREE.Path();
    const hp = prof.map(([x, y]) => [x * 1.02, y * 1.0 + (y > 0 ? 0.15 : 0)]);
    hole.moveTo(hp[0][0], hp[0][1]);
    for (let i = 1; i < hp.length; i++) hole.lineTo(hp[i][0], hp[i][1]);
    hole.lineTo(hp[0][0], hp[0][1]);
    shape.holes.push(hole);
    const sg = new THREE.ShapeGeometry(shape, 6);
    pb.add(sg, 0x8c8880, 0, 0, z, 0, dir < 0 ? Math.PI : 0, 0);
    // listras de atenção em volta do arco
    for (let i = 0; i < 12; i++) {
      const a = Math.PI - (i / 11) * Math.PI;
      pb.box(1.1, 0.5, 0.4, i % 2 ? 0x1a1a1a : 0xf0c020, Math.cos(a) * (TW + 0.7), TH + Math.sin(a) * (TA + 0.6), z + dir * 0.25, 0, 0, a - Math.PI / 2);
    }
    // cornija
    pb.box(40, 1.2, 2.2, 0x6c6860, 0, 15, z - dir * 0.6);
  };
  portal(0, 1);
  portal(-L, -1);
  const portalMesh = new THREE.Mesh(pb.geometry('lit'), featMat);
  grp.add(portalMesh);

  // montanha: rochas grandes facetadas por cima e dos lados do túnel (nunca invadem a passagem)
  const rb = new Builder();
  const greys = [0xffffff, 0xe4e4e4, 0xcfcfcf, 0xbababa];
  const g4 = () => greys[Math.floor(Math.random() * 4)];
  for (let z = -10; z > -L + 8; z -= 16) {
    const k = Math.sin((Math.abs(z) / L) * Math.PI); // mais alta no meio
    const rt = rand(13, 17);
    rb.ico(rt, g4(), rand(-4, 4), TH + TA + 1 + rt * 0.7 + k * 9, z + rand(-5, 5), { sx: rand(1.3, 1.7), sy: 0.7, ry: rand(0, 6) }, 1);
    for (const s of [-1, 1]) {
      const r1 = rand(12, 16);
      rb.ico(r1, g4(), s * (TW + 1.5 + r1), rand(2, 6) + k * 7, z + rand(-6, 6), { sy: rand(0.9, 1.3), ry: rand(0, 6) }, 1);
      const r2 = rand(16, 24);
      rb.ico(r2, g4(), s * rand(48, 64), rand(-2, 4) + k * 6, z + rand(-8, 8), { sy: rand(0.6, 1.1), ry: rand(0, 6) }, 1);
    }
  }
  // ombros da montanha ao lado das bocas (pra não parecer uma caixa)
  for (const z of [-4, -L + 4]) {
    for (const s of [-1, 1]) {
      rb.ico(15, 0xd8d8d8, s * 33, 6, z, { sy: 1.2, ry: rand(0, 6) }, 1);
      rb.ico(18, 0xcccccc, s * 52, 3, z - 6, { sy: 0.9, ry: rand(0, 6) }, 1);
    }
    rb.ico(14, 0xe0e0e0, 0, 19.5, z - 9, { sx: 1.9, sy: 0.55, ry: rand(0, 6) }, 1);
  }
  const rockMat = curveMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  const rocks = new THREE.Mesh(rb.geometry('lit'), rockMat);
  grp.add(rocks);

  // placa na entrada
  const sign = signMesh(signTex('TÚNEL 66', 'ACENDA O FAROL • NÃO ULTRAPASSE', '#f0c020', '#1a1a1a'), 9, 2.8);
  sign.position.set(0, 12.2, 0.9);
  grp.add(sign);
  grp.traverse((o) => (o.frustumCulled = false));
  grp.visible = false;
  return { grp, rockMat, L };
}

// ------------------------------------------------------------------ PONTE ALTA (arco de aço tipo New River Gorge)
const DEPTH = 80;
function buildBridge() {
  const L = FEAT_LEN.bridge;
  const grp = new THREE.Group();
  const RUST = 0xa2441e;
  const DRUST = 0x6a2a14;
  const parts = [];
  // tabuleiro: viga-caixão sob a estrada
  parts.push(tube([[-9.7, -0.05], [9.7, -0.05], [9.7, -1.7], [-9.7, -1.7]], true, 4, -L - 4, 5, (k, j) => (j === 0 ? 0x5a5a5a : j === 2 ? 0x3a3a3a : k % 2 ? 0x7a7a74 : 0x707068)));
  // treliça lateral (vigas longitudinais de baixo)
  for (const s of [-1, 1]) parts.push(tube([[s * 9.2, -5.6], [s * 9.2, -5.0], [s * 8.4, -5.0], [s * 8.4, -5.6]], true, 0, -L, 6, () => RUST));
  // guarda-corpo baixo (dá medo de propósito): tubo no topo
  for (const s of [-1, 1]) parts.push(tube([[s * 9.55, 1.0], [s * 9.55, 1.12], [s * 9.4, 1.12], [s * 9.4, 1.0]], true, 4, -L - 4, 5, () => RUST));
  for (const s of [-1, 1]) parts.push(tube([[s * 9.55, 0.5], [s * 9.55, 0.58], [s * 9.42, 0.58], [s * 9.42, 0.5]], true, 4, -L - 4, 5, () => DRUST));
  const b = new Builder();
  for (let z = 2; z > -L - 4; z -= 2.5) for (const s of [-1, 1]) b.box(0.12, 1.1, 0.12, RUST, s * 9.48, 0.55, z);
  // treliça em X entre o tabuleiro e a viga de baixo
  for (let z = 0; z > -L; z -= 8) {
    for (const s of [-1, 1]) {
      b.bar([s * 8.9, -1.7, z], [s * 8.9, -5.0, z - 8], 0.35, RUST);
      b.bar([s * 8.9, -5.0, z], [s * 8.9, -1.7, z - 8], 0.35, RUST);
      b.bar([s * 8.9, -1.7, z], [s * 8.9, -5.3, z], 0.4, RUST);
    }
    b.bar([-8.9, -5.3, z], [8.9, -5.3, z], 0.3, DRUST);
  }
  // os dois arcos parabólicos
  const za = -22;
  const zb = -L + 22;
  const top = -9;
  const archY = (z) => {
    const t = (z - za) / (zb - za);
    return -DEPTH + (top + DEPTH) * (1 - (2 * t - 1) * (2 * t - 1));
  };
  const NA = 26;
  for (const s of [-1, 1]) {
    for (let i = 0; i < NA; i++) {
      const z0 = za + ((zb - za) * i) / NA;
      const z1 = za + ((zb - za) * (i + 1)) / NA;
      b.bar([s * 7, archY(z0), z0], [s * 7, archY(z1), z1], 1.7, RUST);
    }
  }
  // colunas do arco até o tabuleiro + travessas entre os arcos
  for (let i = 1; i < NA; i++) {
    const z = za + ((zb - za) * i) / NA;
    const y = archY(z);
    if (y < -6) for (const s of [-1, 1]) b.bar([s * 7, y, z], [s * 7, -5.2, z], 0.7, RUST);
    if (i % 2 === 0) b.bar([-7, y, z], [7, y, z], 0.6, DRUST);
  }
  // pilares de concreto nas cabeceiras (descem até o fundo do vale)
  for (const z of [-8, -L + 8]) {
    for (const s of [-1, 1]) b.box(2.4, 40, 2.4, 0x8a867e, s * 7, -22, z);
  }
  for (const z of [za, zb]) b.box(18, 6, 6, 0x8a867e, 0, -DEPTH + 2, z);
  // luzes de aviso no alto do arco
  b.sph(0.35, 0xff2020, -7, top + 1.2, (za + zb) / 2, { glow: true }, 6, 4);
  b.sph(0.35, 0xff2020, 7, top + 1.2, (za + zb) / 2, { glow: true }, 6, 4);
  parts.push(b.geometry('lit'));
  grp.add(new THREE.Mesh(mergeGeos(parts), featMat));
  grp.add(new THREE.Mesh(b.geometry('glow'), glowMat));
  const sign = signMesh(signTex('PONTE DO DESFILADEIRO', 'ALTURA 80 m • VENTO FORTE', '#1a5a2a', '#ffffff'), 6.5, 2);
  sign.position.set(11.4, 3.2, 6);
  sign.rotation.y = -0.35;
  grp.add(sign);
  const post = new Builder();
  post.box(0.15, 3, 0.15, 0x777777, 11.4 - 2.4, 1.5, 6.2);
  post.box(0.15, 3, 0.15, 0x777777, 11.4 + 2.4, 1.5, 6.2 + 1.6);
  grp.add(new THREE.Mesh(post.geometry('lit'), featMat));
  grp.traverse((o) => (o.frustumCulled = false));
  grp.visible = false;
  return { grp, L };
}

// ------------------------------------------------------------------ RAMPA (pra voar)
const RAMP_L = 8;
const RAMP_H = 1.9;
function buildRampGeo(w) {
  const b = new Builder();
  const a = Math.atan2(RAMP_H, RAMP_L);
  const seg = Math.hypot(RAMP_H, RAMP_L) / 8;
  for (let i = 0; i < 8; i++) {
    const zc = -(i + 0.5) * (RAMP_L / 8);
    const yc = (i + 0.5) * (RAMP_H / 8);
    b.box(w, 0.14, seg + 0.02, i % 2 ? 0x1a1a1a : 0xffc820, 0, yc - 0.06, zc, a, 0, 0);
  }
  // laterais e pernas de aço
  for (const s of [-1, 1]) {
    b.bar([s * (w / 2 + 0.08), 0.02, 0], [s * (w / 2 + 0.08), RAMP_H + 0.05, -RAMP_L], 0.16, 0xff5a1a, false, { glow: true });
    for (const z of [-3, -5.5, -7.8]) b.box(0.18, (RAMP_H * -z) / RAMP_L, 0.18, 0x666a70, s * (w / 2 - 0.2), (RAMP_H * -z) / RAMP_L / 2, z);
  }
  b.box(w, RAMP_H, 0.16, 0x55585e, 0, RAMP_H / 2, -RAMP_L - 0.08);
  b.box(w + 0.3, 0.12, 0.3, 0xffffff, 0, RAMP_H + 0.02, -RAMP_L + 0.1, 0, 0, 0, { glow: true });
  return { lit: b.geometry('lit'), glow: b.geometry('glow') };
}

// cor da rocha da montanha em cada fase
const ROCK = { arizona: 0xb06a40, canyon: 0xa8502a, deathvalley: 0xb8a080, redwood: 0x6a6a58, goldengate: 0x7a7a70, iowa: 0x7a8a50, chicago: 0x8a8a8a, dc: 0x8a8a84 };

export class Features {
  constructor(scene) {
    this.tunnel = buildTunnel();
    this.bridge = buildBridge();
    scene.add(this.tunnel.grp, this.bridge.grp);
    this.gustT = 3;
    this.scene = scene;
    this.rampGeo = { narrow: buildRampGeo(6.5), wide: buildRampGeo(18) };
    this.ramps = new Map(); // trecho -> malha
    this.curRamp = null;
    this.rock = new THREE.Color(ROCK.arizona);
    this.tunnel.rockMat.color.copy(this.rock);
  }

  setTheme(id, instant) {
    this.rockTarget = new THREE.Color(ROCK[id] || 0x9a8a7a);
    if (instant) this.tunnel.rockMat.color.copy(this.rockTarget);
  }

  place(it, dist) {
    // escolhe a aparição desse tipo que está mais perto da vista
    let best = null;
    for (const f of TRACK.features) {
      if (f.kind !== it.kind) continue;
      if (f.s0 - dist > 380 || f.s1 - dist < -60) continue;
      if (!best || f.s0 < best.s0) best = f;
    }
    it.obj.grp.visible = !!best;
    if (best) it.obj.grp.position.set(0, 0, -(best.s0 - dist));
  }

  updateRamps(dist) {
    const P = G.player;
    for (const f of TRACK.features) {
      if (f.kind !== 'ramp') continue;
      const d = f.s0 - dist;
      let m = this.ramps.get(f);
      if (!m && d < 400 && d > -30) {
        const g = f.w > 10 ? this.rampGeo.wide : this.rampGeo.narrow;
        m = new THREE.Group();
        m.add(new THREE.Mesh(g.lit, MAT.lit), new THREE.Mesh(g.glow, MAT.glow));
        m.traverse((o) => (o.frustumCulled = false));
        this.scene.add(m);
        this.ramps.set(f, m);
      }
      if (m) m.position.set(f.x, 0, -d);
    }
    for (const [f, m] of this.ramps) {
      if (f.s1 < dist - 40 || !TRACK.features.includes(f)) {
        this.scene.remove(m);
        this.ramps.delete(f);
      }
    }
    // a moto sobe a rampa e decola no topo
    const f = TRACK.rampAt(dist);
    if (f && Math.abs(P.x - f.x) < f.w / 2 + 0.3 && !P.air) {
      P.onRamp((RAMP_H * (dist - f.s0)) / RAMP_L);
      this.curRamp = f;
    } else if (this.curRamp) {
      if (dist > this.curRamp.s1 && !P.air) P.launch(this.curRamp.w > 10 ? 1.2 : 1);
      this.curRamp = null;
    }
  }

  update(dt, dist) {
    this.place({ kind: 'tunnel', obj: this.tunnel }, dist);
    this.place({ kind: 'bridge', obj: this.bridge }, dist);
    this.updateRamps(dist);
    if (this.rockTarget) this.tunnel.rockMat.color.lerp(this.rockTarget, 1 - Math.exp(-0.5 * dt));
    const P = G.player;
    // vento cruzado na ponte: rajadas que empurram a moto (e o motor ecoa dentro do túnel)
    const br = TRACK_STATE.bridge;
    if (br > 0.5 && G.state !== 'title' && G.state !== 'dead') {
      this.gustT -= dt;
      if (this.gustT <= 0) {
        this.gustT = rand(1.8, 3.6);
        const s = chance(0.5) ? -1 : 1;
        this.gust = { s, t: 0.9 };
        G.audio.play('gust');
        P.pulseAll(0.25, 160);
      }
    }
    if (this.gust) {
      this.gust.t -= dt;
      P.push(this.gust.s * 2.6 * dt * 6);
      if (this.gust.t <= 0) this.gust = null;
    }
    if (G.audio.ctx) G.audio.setEnv(TRACK_STATE.tunnel, br);
  }
}
