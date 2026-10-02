// Modelos procedurais das fases (inspiradas na viagem pelos EUA estilo arcade)
import * as THREE from 'three';
import { Builder, MAT } from './builder.js';
import { pick, rand } from './ctx.js';

const PI = Math.PI;

// ---------------------------------------------------------------- Grand Canyon
export function canyonWallGeo() {
  // bloco de rocha estratificada, face voltada pra estrada em -X
  const b = new Builder();
  const cols = [0xb04a28, 0xc8643a, 0x9a3e22, 0xd27a48, 0xa85232, 0xe09060];
  let y = 0;
  let w = 14;
  while (y < 40) {
    const hh = rand(3, 7);
    b.box(rand(9, 13), hh, w, pick(cols), rand(0, 2), y + hh / 2, rand(-1, 1));
    y += hh;
    w *= rand(0.88, 0.98);
  }
  b.box(8, 2, w, 0x8a3a20, 2, y + 1, 0);
  return b.geometry();
}

// ---------------------------------------------------------------- Redwood
export function redwoodGeo() {
  const b = new Builder();
  b.cyl(0.9, 1.5, 34, 8, 0x7a3a22, 0, 17, 0);
  b.cyl(1.6, 2.1, 2.5, 8, 0x5a2a18, 0, 1.2, 0);
  const greens = [0x1f4a22, 0x2a5a2a, 0x1a3a1c];
  for (let i = 0; i < 4; i++) b.cone(5.5 - i * 1.1, 9, 8, pick(greens), 0, 17 + i * 6, 0);
  return b.geometry();
}
export function fernGeo() {
  const b = new Builder();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2;
    b.cone(0.12, 1.2, 4, i % 2 ? 0x3a7a2a : 0x2a6a22, Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
  }
  return b.geometry();
}

// ---------------------------------------------------------------- Golden Gate
const ORANGE = 0xc0362c;
export function bridgeTowerGeo() {
  const b = new Builder();
  for (const s of [-1, 1]) {
    b.box(2.6, 98, 3.4, ORANGE, s * 11.5, 19, 0);
    for (let y = -26; y < 66; y += 9) b.box(2.9, 0.6, 3.7, 0x9a2a22, s * 11.5, y, 0);
  }
  for (const y of [22, 40, 56, 66]) b.box(22, 2.2, 2.6, ORANGE, 0, y, 0);
  b.box(28, 3, 4, 0x8a8a8a, 0, -28, 0);
  return b.geometry();
}
export function cableGeo() {
  const b = new Builder();
  b.box(0.7, 0.7, 6.1, ORANGE, 0, 0, 0);
  return b.geometry();
}
export function suspenderGeo() {
  const b = new Builder();
  b.box(0.12, 1, 0.12, ORANGE, 0, 0.5, 0);
  return b.geometry();
}
export function railGeo() {
  const b = new Builder();
  b.box(0.25, 0.15, 4.05, ORANGE, 0, 1.1, 0);
  b.box(0.15, 0.1, 4.05, ORANGE, 0, 0.6, 0);
  b.box(0.2, 1.2, 0.2, ORANGE, 0, 0.6, 0);
  return b.geometry();
}
export function deckGeo() {
  const b = new Builder();
  b.box(21, 1.2, 8.05, 0x6a6a6a, 0, -0.65, 0);
  b.box(21, 4, 8.05, 0x8a2a22, 0, -3.2, 0);
  for (const x of [-10, -5, 0, 5, 10]) b.box(0.5, 4.2, 8.06, 0x6a1a14, x, -3.2, 0);
  return b.geometry();
}

// ---------------------------------------------------------------- Iowa
export function cornGeo() {
  const b = new Builder();
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) * 0.6 - 0.6 + rand(-0.1, 0.1);
    const z = Math.floor(i / 3) * 0.6 - 0.6 + rand(-0.1, 0.1);
    const h = rand(1.8, 2.4);
    b.box(0.08, h, 0.08, 0x6a8a2a, x, h / 2, z);
    b.box(0.5, 0.05, 0.12, 0x7aa83a, x, h * 0.55, z, 0, rand(0, 3), 0.4);
    b.box(0.5, 0.05, 0.12, 0x8ab84a, x, h * 0.75, z, 0, rand(0, 3), -0.4);
    b.box(0.1, 0.3, 0.1, 0xd8c060, x, h + 0.1, z);
  }
  return b.geometry();
}
export function barnGeo() {
  const b = new Builder();
  b.box(10, 6, 14, 0xb01e1e, 0, 3, 0);
  b.box(10.4, 0.5, 14.4, 0xffffff, 0, 6.1, 0);
  for (const s of [-1, 1]) b.box(6.2, 0.4, 14.6, 0x3a3a3a, s * 2.6, 7.8, 0, 0, 0, s * -0.62);
  b.box(4, 4.5, 0.2, 0xffffff, 0, 2.3, 7.05);
  b.box(3.6, 4.1, 0.25, 0x8a1414, 0, 2.3, 7.05);
  b.bar([-1.8, 0.2, 7.2], [1.8, 4.4, 7.2], 0.25, 0xffffff);
  b.bar([1.8, 0.2, 7.2], [-1.8, 4.4, 7.2], 0.25, 0xffffff);
  return b.geometry();
}
export function siloGeo() {
  const b = new Builder();
  b.cyl(2.6, 2.6, 16, 12, 0x9aa8b0, 0, 8, 0);
  for (let y = 2; y < 16; y += 3) b.cyl(2.65, 2.65, 0.25, 12, 0x6a7880, 0, y, 0);
  b.sph(2.6, 0xb8c4cc, 0, 16, 0, { sy: 0.6 }, 12, 6);
  return b.geometry();
}
export function windmillGeo() {
  const b = new Builder();
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.bar([x * 1.3, 0, z * 1.3], [x * 0.3, 12, z * 0.3], 0.15, 0x7a7a7a);
  for (let y = 3; y < 12; y += 3) b.box(2.2 - y * 0.12, 0.1, 2.2 - y * 0.12, 0x7a7a7a, 0, y, 0);
  b.box(0.5, 0.5, 1.2, 0x5a5a5a, 0, 12.3, 0);
  for (let i = 0; i < 12; i++) b.box(0.25, 2.4, 0.05, 0xd8d8d8, 0, 12.3, -0.65, 0, 0, (i / 12) * PI * 2, { order: 'XYZ' });
  b.box(0.05, 1.2, 2, 0xc02020, 0, 12.4, 1.6);
  return b.geometry();
}

// ---------------------------------------------------------------- Chicago
export function skyscraperGeo(variant = 0) {
  const b = new Builder();
  const W = 14;
  const H = 60;
  const body = [0x8a92a0, 0xa89a88, 0x6a7280][variant % 3];
  const glass = [0x2a4a6a, 0x3a5a7a, 0x1a3050][variant % 3];
  b.box(W, H, W, body, 0, H / 2, 0);
  for (let y = 2; y < H - 1; y += 3) b.box(W + 0.15, 1.6, W + 0.15, glass, 0, y, 0);
  if (variant === 1) {
    b.box(W * 0.7, 12, W * 0.7, body, 0, H + 6, 0);
    b.cyl(0.3, 0.3, 10, 4, 0xcccccc, 0, H + 17, 0);
  } else if (variant === 2) b.cone(W * 0.6, 10, 4, body, 0, H + 5, 0, 0, PI / 4, 0);
  return b.geometry();
}
export function streetlightGeo() {
  const b = new Builder();
  b.cyl(0.12, 0.16, 7, 6, 0x3a3a3a, 0, 3.5, 0);
  b.box(2.2, 0.15, 0.15, 0x3a3a3a, -1.1, 6.9, 0);
  b.box(0.7, 0.2, 0.4, 0x2a2a2a, -2.1, 6.8, 0);
  b.box(0.6, 0.06, 0.32, 0xfff2c0, -2.1, 6.68, 0, 0, 0, 0, { glow: true });
  return b.geometry();
}

// ---------------------------------------------------------------- Washington D.C.
export function whiteBuildingGeo() {
  const b = new Builder();
  b.box(30, 2, 16, 0xe8e4d8, 0, 1, 0);
  b.box(28, 10, 14, 0xf0ece0, 0, 7, 0);
  for (let i = -6; i <= 6; i++) b.cyl(0.6, 0.6, 10, 8, 0xffffff, i * 2.2, 7, -7.5);
  b.box(30, 1.2, 16, 0xe0dccc, 0, 12.6, 0);
  b.cone(16, 4, 4, 0xf0ece0, 0, 15, -1, 0, PI / 4, 0, { sz: 0.55 });
  return b.geometry();
}
export function cherryGeo() {
  const b = new Builder();
  b.cyl(0.25, 0.35, 3, 6, 0x4a3020, 0, 1.5, 0);
  const pinks = [0xffb0c8, 0xff98b8, 0xffc8d8];
  for (let i = 0; i < 6; i++) b.ico(rand(1.1, 1.6), pick(pinks), rand(-1, 1), rand(3.2, 4.4), rand(-1, 1));
  return b.geometry();
}
export function obeliskGeo() {
  const b = new Builder();
  b.box(6, 2, 6, 0xd8d4c8, 0, 1, 0);
  b.cyl(2.2, 3.4, 80, 4, 0xf4f0e6, 0, 42, 0, 0, PI / 4, 0);
  b.cone(2.4, 7, 4, 0xf4f0e6, 0, 85.5, 0, 0, PI / 4, 0);
  return b.geometry();
}
export function capitolGeo() {
  const b = new Builder();
  b.box(70, 14, 26, 0xf0ece0, 0, 7, 0);
  for (let i = -10; i <= 10; i++) b.cyl(0.7, 0.7, 12, 8, 0xffffff, i * 3, 8, -13.5);
  b.cyl(11, 11, 10, 20, 0xf4f0e6, 0, 19, 0);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * PI * 2;
    b.cyl(0.5, 0.5, 9, 6, 0xffffff, Math.cos(a) * 11.6, 19, Math.sin(a) * 11.6);
  }
  b.sph(11, 0xf8f4ea, 0, 24, 0, { sy: 1.05 }, 20, 10);
  b.cyl(2.2, 2.2, 5, 10, 0xf4f0e6, 0, 36, 0);
  b.sph(2.4, 0xf8f4ea, 0, 38.5, 0, null, 10, 6);
  return b.geometry();
}

// ---------------------------------------------------------------- trânsito
export function trafficCar() {
  const b = new Builder();
  const col = pick([0xd02020, 0x2050c0, 0xf0c020, 0xffffff, 0x20a050, 0x101010, 0xff7a00, 0x8a30c0]);
  const kind = Math.random();
  if (kind < 0.25) {
    // pickup
    b.box(2.0, 0.9, 5.0, col, 0, 0.85, 0);
    b.box(1.9, 0.8, 1.8, col, 0, 1.7, -0.6);
    b.box(1.7, 0.55, 0.05, 0x203040, 0, 1.75, -1.52, 0.2, 0, 0);
    b.box(1.7, 0.55, 0.05, 0x203040, 0, 1.75, 0.31);
  } else {
    b.box(1.9, 0.75, 4.3, col, 0, 0.75, 0);
    b.box(1.7, 0.65, 2.2, col, 0, 1.45, 0.2);
    b.box(1.6, 0.5, 0.05, 0x203040, 0, 1.45, -0.92, 0.35, 0, 0);
    b.box(1.6, 0.45, 0.05, 0x203040, 0, 1.45, 1.32, -0.3, 0, 0);
    for (const s of [-1, 1]) b.box(0.05, 0.45, 1.8, 0x203040, s * 0.86, 1.45, 0.2);
  }
  b.box(2.0, 0.2, 0.2, 0xb0b4bc, 0, 0.45, -2.25);
  b.box(2.0, 0.2, 0.2, 0xb0b4bc, 0, 0.45, 2.25);
  for (const s of [-0.7, 0.7]) {
    b.box(0.35, 0.15, 0.05, 0xff2020, s, 0.85, 2.27, 0, 0, 0, { glow: true });
    b.box(0.35, 0.15, 0.05, 0xfff2c0, s, 0.85, -2.27, 0, 0, 0, { glow: true });
  }
  for (const x of [-0.85, 0.85]) for (const z of [-1.4, 1.4]) b.cyl(0.36, 0.36, 0.3, 10, 0x111111, x, 0.36, z, 0, 0, PI / 2);
  return b.build();
}

// ---------------------------------------------------------------- horizontes (sem fog, sem pista)
function farMat() {
  return new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 1, depthWrite: false });
}
export function hillsBackdrop() {
  const b = new Builder();
  const cols = [0x5a8a5a, 0x6a9a62, 0x4a7a52, 0x7aa070];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * PI * 2 + rand(-0.05, 0.05);
    const r = rand(650, 900);
    const w = rand(120, 260);
    b.sph(w, pick(cols), Math.sin(a) * r, -w * 0.62, -Math.cos(a) * r, { sy: rand(0.5, 0.75) }, 10, 6);
  }
  const m = new THREE.Mesh(b.geometry(), farMat());
  m.frustumCulled = false;
  return m;
}
export function cityBackdrop() {
  const b = new Builder();
  const cols = [0x7a8aa0, 0x8a98ac, 0x6a7890, 0x9aa6b8];
  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * PI * 2 + rand(-0.02, 0.02);
    const r = rand(650, 850);
    const w = rand(20, 50);
    const h = rand(30, 160) * (Math.random() < 0.15 ? 1.8 : 1);
    b.box(w, h, w, pick(cols), Math.sin(a) * r, h / 2 - 20, -Math.cos(a) * r, 0, a, 0);
  }
  const m = new THREE.Mesh(b.geometry(), farMat());
  m.frustumCulled = false;
  return m;
}
export function retintMesas(mesh) {
  mesh.material = farMat();
  return mesh;
}

export function cloudSprites(n = 16) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 40 + Math.random() * 176;
    const y = 50 + Math.random() * 40;
    const r = 22 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 }));
    const a = (i / n) * PI * 2 + rand(-0.15, 0.15);
    const r = rand(650, 900);
    s.position.set(Math.sin(a) * r, rand(110, 280), -Math.cos(a) * r);
    s.scale.set(rand(220, 380), rand(90, 140), 1);
    grp.add(s);
  }
  return grp;
}
