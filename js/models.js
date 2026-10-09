// Todos os modelos 3D são procedurais (low-poly, cor por vértice). Frente = -Z.
import * as THREE from 'three';
import { Builder, MAT } from './builder.js';
import { pick, rand } from './ctx.js';
import { curveMaterial } from './curve.js';
import { canvasTex, FW, FB, fitFont, strokeText } from './text.js';

const PI = Math.PI;

export const C = {
  chrome: 0xb4bac4,
  dchrome: 0x7d838c,
  black: 0x1a1a1c,
  tire: 0x121212,
  leather: 0x3a2618,
  dleather: 0x1f140d,
  denim: 0x34507a,
  white: 0xeeeeee,
  red: 0xb0121b,
  gold: 0xe3b23c,
  wood: 0x7a4a22,
  olive: 0x4f5a2a,
  steel: 0x4a4f57,
  rust: 0x8a4a26,
};
export const SKINS = [0xf2c9a0, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbb5];
export const NEON = [0xff2fa0, 0x39ff14, 0x00e5ff, 0xffea00, 0xff5a00, 0xb84dff];
export const GANG = [0xb3202a, 0x1f6fb3, 0x3a8a2a, 0x7a2ab3, 0xd17a12, 0x2a2a2a, 0x0f8f8f, 0xd4c21a];
export const JACKETS = [0x1a1a1c, 0x2b1d14, 0x3a2618, 0x22303f, 0x3b3b3b];
export const PANTS = [0x34507a, 0x1c1c22, 0x2a3a5a, 0x4a3a2a];

// ---------------------------------------------------------------- rodas
const wheelCache = new Map();
export function wheelGeo(r, w) {
  const key = r + '_' + w;
  if (wheelCache.has(key)) return wheelCache.get(key);
  const b = new Builder();
  b.cyl(r, r, w, 16, C.tire, 0, 0, 0, 0, 0, PI / 2);
  b.cyl(r * 0.66, r * 0.66, w + 0.01, 12, C.dchrome, 0, 0, 0, 0, 0, PI / 2);
  b.cyl(r * 0.2, r * 0.2, w + 0.05, 8, C.chrome, 0, 0, 0, 0, 0, PI / 2);
  for (let i = 0; i < 3; i++) b.box(w * 0.5, r * 1.25, 0.03, C.chrome, 0, 0, 0, i * PI / 3, 0, 0);
  const g = b.geometry();
  wheelCache.set(key, g);
  return g;
}
export function wheelMesh(r, w) {
  const m = new THREE.Mesh(wheelGeo(r, w), MAT.lit);
  m.userData.baseMat = MAT.lit;
  return m;
}

// ---------------------------------------------------------------- moto inimiga
// autogiro punk: voa por cima da estrada jogando bombas
function gyroBody(color) {
  const b = new Builder();
  b.sph(0.42, color, 0, 0.55, -0.15, { sx: 0.85, sy: 0.7, sz: 1.5 }, 10, 8);
  b.box(0.5, 0.08, 0.5, C.black, 0, 0.78, 0.15);
  b.bar([0, 0.75, 0.45], [0, 0.95, 1.9], 0.09, C.black);
  b.box(0.06, 0.55, 0.45, color, 0, 1.15, 1.85);
  b.box(0.9, 0.05, 0.3, color, 0, 0.95, 1.85);
  b.bar([0, 0.85, 0.05], [0, 1.85, 0.05], 0.08, C.chrome, true);
  b.cyl(0.18, 0.2, 0.28, 10, C.dchrome, 0, 0.75, 0.62, PI / 2, 0, 0);
  for (let i = 0; i < 3; i++) b.box(0.06, 0.6, 0.03, 0x222222, 0, 0.75, 0.8, 0, 0, (i * PI) / 3);
  for (const s of [-1, 1]) {
    b.bar([s * 0.38, 0.05, -0.7], [s * 0.38, 0.05, 0.6], 0.05, C.chrome, true);
    b.bar([s * 0.38, 0.05, -0.3], [s * 0.2, 0.4, -0.25], 0.04, C.chrome, true);
    b.bar([s * 0.38, 0.05, 0.3], [s * 0.2, 0.4, 0.25], 0.04, C.chrome, true);
  }
  b.box(0.12, 0.05, 0.03, 0xff2020, 0, 1.0, 2.1, 0, 0, 0, { glow: true });
  b.sph(0.06, 0xff3030, 0, 1.45, 1.9, { glow: true }, 5, 4);
  const rb = new Builder();
  rb.box(5.0, 0.03, 0.22, 0x2a2a2a, 0, 0, 0);
  rb.box(0.22, 0.03, 5.0, 0x2a2a2a, 0, 0, 0);
  rb.cyl(0.12, 0.12, 0.12, 8, C.chrome, 0, 0, 0);
  const rotor = rb.build();
  rotor.position.set(0, 1.9, 0.05);
  return { body: b.build(), fz: -0.6, rz: 0.6, wr: 0.3, rotor, noWheels: true };
}

// muscle car conversível com chamas no capô: motorista + atirador em pé no banco
function muscleBody(color) {
  const b = new Builder();
  b.box(2.0, 0.55, 4.7, color, 0, 0.62, 0);
  b.box(1.96, 0.25, 1.6, color, 0, 0.98, -1.45);
  b.box(1.96, 0.22, 1.2, color, 0, 0.98, 1.7);
  b.box(0.7, 0.28, 0.9, C.dchrome, 0, 1.2, -1.5); // tomada de ar
  for (let i = 0; i < 5; i++) b.box(0.1 + i * 0.03, 0.02, 0.5 - i * 0.07, i % 2 ? 0xffd21e : 0xff5a00, (i - 2) * 0.32, 1.115, -1.95 + i * 0.05, 0, (i - 2) * 0.2, 0);
  b.box(1.7, 0.5, 0.06, 0x203040, 0, 1.32, -0.62, -0.45, 0, 0); // para-brisa
  b.box(1.8, 0.08, 0.08, C.chrome, 0, 1.56, -0.5);
  b.box(1.5, 0.35, 0.6, C.black, 0, 1.05, 0.55); // banco de trás
  b.box(2.1, 0.22, 0.25, C.chrome, 0, 0.48, -2.4);
  b.box(2.1, 0.22, 0.25, C.chrome, 0, 0.48, 2.4);
  b.box(1.4, 0.3, 0.05, 0x333333, 0, 0.72, -2.37);
  for (const s of [-1, 1]) {
    b.cyl(0.07, 0.09, 1.6, 8, C.chrome, s * 1.06, 0.38, 0.3, PI / 2, 0, 0);
    b.box(0.32, 0.14, 0.05, 0xfff2b0, s * 0.7, 0.75, -2.36, 0, 0, 0, { glow: true });
    b.box(0.32, 0.12, 0.05, 0xff2020, s * 0.7, 0.8, 2.36, 0, 0, 0, { glow: true });
    for (const z of [-1.45, 1.45]) {
      b.cyl(z > 0 ? 0.46 : 0.4, z > 0 ? 0.46 : 0.4, z > 0 ? 0.42 : 0.32, 12, C.tire, s * 0.98, z > 0 ? 0.46 : 0.4, z, 0, 0, PI / 2);
      b.cyl(0.2, 0.2, 0.36, 8, C.chrome, s * 0.98, z > 0 ? 0.46 : 0.4, z, 0, 0, PI / 2);
    }
  }
  return { body: b.build(), fz: -1.45, rz: 1.45, wr: 0.4, noWheels: true };
}

export function enemyBike(kind, color) {
  if (kind === 'gyro') return gyroBody(color);
  if (kind === 'muscle') return muscleBody(color);
  const b = new Builder();
  const ch = kind === 'chopper';
  const dirt = kind === 'dirt';
  const fz = ch ? -1.2 : -0.82;
  const rz = 0.75;
  const wr = ch ? 0.37 : dirt ? 0.35 : 0.34;
  // quadro
  b.bar([0, wr, rz], [0, 0.76, 0.1], 0.06, C.black);
  b.bar([0, 0.76, 0.1], [0, 0.98, -0.58], 0.07, C.black);
  b.bar([0, 0.42, 0.15], [0, 0.98, -0.58], 0.06, C.black);
  // motor V-twin
  b.box(0.3, 0.26, 0.38, C.dchrome, 0, 0.45, -0.1);
  b.cyl(0.08, 0.09, 0.3, 8, C.chrome, 0, 0.66, -0.24, -0.5, 0, 0);
  b.cyl(0.08, 0.09, 0.3, 8, C.chrome, 0, 0.66, 0.04, 0.5, 0, 0);
  // tanque
  b.sph(0.2, color, 0, 0.86, -0.3, { sx: dirt ? 0.7 : 0.85, sy: 0.6, sz: 1.4 });
  b.box(0.04, 0.02, 0.5, C.chrome, 0, 0.98, -0.3);
  // banco
  b.box(0.3, 0.08, 0.52, C.black, 0, 0.8, 0.22);
  // para-lamas
  b.box(0.2, 0.05, 0.55, color, 0, wr + 0.36, rz + 0.05, -0.25, 0, 0);
  b.box(0.16, 0.04, 0.42, color, 0, wr + (dirt ? 0.45 : 0.34), fz, 0.15, 0, 0);
  // garfo
  const fzTop = ch ? -0.68 : -0.62;
  for (const sx of [-0.09, 0.09]) b.bar([sx, 1.0, fzTop], [sx, wr, fz], 0.035, C.chrome, true);
  // guidão
  if (ch) {
    for (const s of [-1, 1]) b.bar([s * 0.1, 1.02, -0.64], [s * 0.32, 1.42, -0.58], 0.03, C.chrome, true);
    b.box(0.68, 0.03, 0.03, C.chrome, 0, 1.42, -0.58);
  } else {
    b.box(0.76, 0.035, 0.035, C.chrome, 0, 1.08, -0.6);
  }
  // farol
  b.cyl(0.09, 0.07, 0.1, 10, C.chrome, 0, 0.98, -0.74, PI / 2, 0, 0);
  b.cyl(0.075, 0.075, 0.02, 10, 0xfff2b0, 0, 0.98, -0.795, PI / 2, 0, 0, { glow: true });
  // escapamentos
  for (const s of [-1, 1]) b.cyl(0.04, 0.05, 1.0, 8, C.chrome, s * 0.2, 0.32, 0.38, PI / 2 - 0.08, 0, 0);
  // lanterna traseira
  b.box(0.12, 0.05, 0.03, 0xff2020, 0, 0.8, 1.04, 0, 0, 0, { glow: true });
  if (dirt) b.box(0.22, 0.18, 0.02, 0xeeeeee, 0, 1.02, -0.7, -0.2, 0, 0); // placa de número
  if (kind === 'sidecar') {
    b.sph(0.36, color, 0.88, 0.56, -0.05, { sx: 0.9, sy: 0.55, sz: 1.7 });
    b.box(0.5, 0.06, 0.7, C.black, 0.88, 0.72, 0.05);
    b.bar([0, 0.5, 0.3], [0.85, 0.42, 0.3], 0.05, C.chrome, true);
    b.bar([0, 0.5, -0.4], [0.85, 0.42, -0.4], 0.05, C.chrome, true);
    b.cyl(0.3, 0.3, 0.14, 12, C.tire, 1.12, 0.3, 0.1, 0, 0, PI / 2);
    b.box(0.08, 0.06, 0.03, 0xff2020, 0.88, 0.7, 0.62, 0, 0, 0, { glow: true });
  }
  return { body: b.build(), fz, rz, wr };
}

// ---------------------------------------------------------------- piloto inimigo
const PY = 1.1;
const PZ = 0.1;

function hair(b, type, col) {
  switch (type) {
    case 'mohawk':
      for (let i = -3; i <= 3; i++) b.box(0.035, 0.16 - Math.abs(i) * 0.018, 0.045, col, 0, 0.33, i * 0.04, 0, 0, 0, { glow: true });
      break;
    case 'spikes':
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2;
        b.cone(0.03, 0.12, 4, col, Math.cos(a) * 0.07, 0.31, Math.sin(a) * 0.07, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5, { glow: true });
      }
      break;
    case 'bandana':
      b.box(0.245, 0.07, 0.255, col, 0, 0.25, 0);
      b.box(0.06, 0.1, 0.05, col, 0, 0.18, 0.15, 0.4, 0, 0);
      break;
    case 'helmet':
      b.sph(0.16, 0x222222, 0, 0.22, 0, { sy: 0.8 }, 10, 6);
      b.cone(0.03, 0.12, 5, C.chrome, 0, 0.37, 0);
      b.box(0.24, 0.03, 0.02, col, 0, 0.21, -0.14, 0, 0, 0, { glow: true });
      break;
    case 'cowboy':
      b.cyl(0.26, 0.26, 0.02, 12, 0x5a3a1c, 0, 0.29, 0);
      b.cyl(0.11, 0.135, 0.13, 10, 0x5a3a1c, 0, 0.36, 0);
      b.box(0.24, 0.025, 0.24, col, 0, 0.31, 0);
      break;
    case 'skull':
      b.box(0.24, 0.27, 0.26, 0xf0ead8, 0, 0.15, 0);
      b.box(0.07, 0.06, 0.02, 0x000000, -0.055, 0.17, -0.132);
      b.box(0.07, 0.06, 0.02, 0x000000, 0.055, 0.17, -0.132);
      b.box(0.12, 0.03, 0.02, 0x000000, 0, 0.07, -0.132);
      b.box(0.24, 0.05, 0.255, 0x111111, 0, 0.29, 0);
      break;
    default:
      break;
  }
}

function headGeo(o) {
  const b = new Builder();
  const k = o.bulk || 1;
  b.cyl(0.06 * k, 0.07 * k, 0.1, 6, o.skin, 0, 0.0, 0);
  if (o.hair !== 'skull') {
    b.box(0.23, 0.26, 0.25, o.skin, 0, 0.15, 0);
    b.box(0.24, 0.055, 0.04, 0x050505, 0, 0.17, -0.125, 0, 0, 0); // óculos escuros
    b.box(0.04, 0.05, 0.04, o.skin, 0, 0.11, -0.135);
    if (o.beard) b.box(0.22, 0.12, 0.08, o.beardColor || 0x3a2a1a, 0, 0.06, -0.1);
  }
  hair(b, o.hair, o.hairColor);
  const g = b.build();
  return g;
}

function armWeapon(b, weapon) {
  // braço aponta para -Z a partir do ombro
  let muzzle = new THREE.Vector3(0, 0.02, -0.7);
  switch (weapon) {
    case 'pistol':
      b.box(0.04, 0.06, 0.17, C.chrome, 0, 0.03, -0.62);
      b.box(0.035, 0.08, 0.04, 0x3a2010, 0, -0.03, -0.55);
      muzzle.set(0, 0.04, -0.71);
      break;
    case 'smg':
      b.box(0.05, 0.08, 0.3, 0x2a2a2a, 0, 0.02, -0.68);
      b.box(0.02, 0.02, 0.3, C.chrome, 0, 0.065, -0.68);
      b.box(0.03, 0.14, 0.04, C.chrome, 0, -0.07, -0.64);
      muzzle.set(0, 0.03, -0.85);
      break;
    case 'shotgun':
      b.cyl(0.022, 0.022, 0.55, 6, C.steel, -0.02, 0.03, -0.82, PI / 2, 0, 0);
      b.cyl(0.022, 0.022, 0.55, 6, C.steel, 0.02, 0.03, -0.82, PI / 2, 0, 0);
      b.box(0.05, 0.06, 0.25, C.wood, 0, 0.0, -0.6);
      muzzle.set(0, 0.03, -1.1);
      break;
    case 'rifle':
      b.cyl(0.016, 0.016, 0.85, 6, C.steel, 0, 0.03, -0.95, PI / 2, 0, 0);
      b.box(0.05, 0.07, 0.35, C.wood, 0, 0.0, -0.62);
      b.cyl(0.025, 0.025, 0.2, 8, 0x111111, 0, 0.09, -0.7, PI / 2, 0, 0);
      b.box(0.03, 0.03, 0.02, 0xff2020, 0, 0.09, -0.81, 0, 0, 0, { glow: true });
      muzzle.set(0, 0.03, -1.38);
      break;
    case 'bat':
      b.cyl(0.05, 0.025, 0.8, 7, C.wood, 0, 0.36, -0.6, 0.3, 0, 0);
      for (let i = 0; i < 6; i++) b.box(0.012, 0.012, 0.12, C.chrome, 0, 0.5 + i * 0.05, -0.65 + (i % 2) * 0.03, 0.3, i, 0);
      muzzle.set(0, 0.7, -0.5);
      break;
    case 'molotov':
      b.cyl(0.035, 0.04, 0.18, 7, 0x2f6f2a, 0, 0.06, -0.56);
      b.cyl(0.015, 0.02, 0.07, 5, 0x2f6f2a, 0, 0.18, -0.56);
      b.cone(0.04, 0.12, 5, 0xffa020, 0, 0.27, -0.56, 0, 0, 0, { glow: true });
      muzzle.set(0, 0.2, -0.56);
      break;
    case 'dynamite':
      for (let i = -1; i <= 1; i++) b.cyl(0.025, 0.025, 0.22, 6, 0xd02020, i * 0.05, 0.06, -0.56);
      b.box(0.17, 0.03, 0.06, 0x222222, 0, 0.06, -0.56);
      b.bar([0, 0.17, -0.56], [0.03, 0.26, -0.56], 0.012, 0x222222);
      b.sph(0.03, 0xffee66, 0.03, 0.27, -0.56, { glow: true }, 5, 4);
      muzzle.set(0.03, 0.27, -0.56);
      break;
    case 'gatling':
      b.box(0.14, 0.14, 0.3, 0x222222, 0, 0.02, -0.6);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        b.cyl(0.016, 0.016, 0.7, 5, C.steel, Math.cos(a) * 0.045, 0.02 + Math.sin(a) * 0.045, -1.0, PI / 2, 0, 0);
      }
      b.box(0.08, 0.2, 0.12, C.olive, 0.12, -0.08, -0.55);
      muzzle.set(0, 0.02, -1.36);
      break;
    default:
      break;
  }
  return muzzle;
}

// Cria piloto: grupo com pivô no centro do corpo; cabeça e braço de arma são peças separadas
export function rider(o) {
  const k = o.bulk || 1;
  const dy = (o.seatY ?? 0.8) - 0.8;
  const grp = new THREE.Group();
  grp.position.set(o.x || 0, PY + dy, PZ);
  const b = new Builder();
  const P = (x, y, z) => [x, y - PY, z - PZ];
  // quadril + pernas
  b.box(0.36 * k, 0.18, 0.3, o.pants, 0, 0.9 - PY, 0.22 - PZ);
  if (o.pose !== 'sit') {
    for (const s of [-1, 1]) {
      b.bar(P(s * 0.13 * k, 0.9, 0.15), P(s * 0.21 * k, 0.83, -0.25), 0.14 * k, o.pants);
      b.bar(P(s * 0.21 * k, 0.83, -0.25), P(s * 0.23 * k, 0.43, -0.3), 0.12 * k, o.pants);
      b.box(0.13, 0.1, 0.26, C.black, s * 0.23 * k, 0.4 - PY, -0.36 - PZ);
    }
  }
  // tronco inclinado pra frente + emblema da gangue nas costas
  b.box(0.46 * k, 0.55, 0.28 * k, o.jacket, 0, 1.22 - PY, 0.16 - PZ, -0.25, 0, 0);
  b.box(0.3 * k, 0.3, 0.02, o.patch, 0, 1.255 - PY, 0.16 + 0.138 * k - PZ, -0.25, 0, 0);
  b.cyl(0.07, 0.07, 0.025, 8, 0xf0ead8, 0, 1.27 - PY, 0.16 + 0.15 * k - PZ, PI / 2 - 0.25, 0, 0);
  // ombreiras com spikes pros brutos
  if (o.spikes) for (const s of [-1, 1]) b.cone(0.04, 0.1, 4, C.chrome, s * 0.25 * k, 1.5 - PY, 0.08 - PZ, 0, 0, -s * 0.8);
  // ombros bem marcados
  for (const sd of [-1, 1]) b.sph(0.1 * k, o.jacket, sd * 0.26 * k, 1.44 - PY, 0.08 - PZ, null, 6, 5);
  // braço(s) no guidão: manga + antebraço de pele + munhequeira + luva
  const barArm = (sd) => {
    const sh = P(sd * 0.27 * k, 1.42, 0.06);
    const hand = o.pose === 'sit' ? P(sd * 0.22, 1.02, -0.25) : P(sd * 0.36, o.barY ?? 1.08, -0.57);
    const el = [(sh[0] + hand[0]) / 2 + sd * 0.1, (sh[1] + hand[1]) / 2 - 0.06, (sh[2] + hand[2]) / 2];
    b.bar(sh, el, 0.13 * k, o.jacket);
    b.bar(el, hand, 0.1 * k, o.skin);
    b.bar(el, [el[0] + (hand[0] - el[0]) * 0.25, el[1] + (hand[1] - el[1]) * 0.25, el[2] + (hand[2] - el[2]) * 0.25], 0.115 * k, o.jacket);
    b.box(0.12, 0.12, 0.13, C.dleather, hand[0], hand[1], hand[2]);
    b.box(0.13, 0.04, 0.06, C.chrome, hand[0] * 0.9 + el[0] * 0.1, hand[1] * 0.9 + el[1] * 0.1 + 0.02, hand[2] * 0.9 + el[2] * 0.1 + 0.04);
  };
  barArm(-1);
  if (!o.weapon) barArm(1);
  if (o.shield) {
    // escudo de choque no braço esquerdo: bala no peito faz "tink"
    b.box(0.56, 0.78, 0.05, 0x7a8a9a, -0.08, 1.2 - PY, -0.36 - PZ, -0.15, 0.15, 0);
    b.box(0.5, 0.1, 0.06, 0x1a1a1a, -0.08, 1.38 - PY, -0.39 - PZ, -0.15, 0.15, 0);
    b.box(0.4, 0.05, 0.06, 0xff3030, -0.08, 0.98 - PY, -0.33 - PZ, -0.15, 0.15, 0, { glow: true });
  }
  const body = b.build();
  grp.add(body);

  // cabeça
  const head = headGeo(o);
  head.position.set(...P(0, 1.52, 0.06));
  grp.add(head);

  // braço armado
  let arm = null;
  let muzzle = null;
  if (o.weapon) {
    const ab = new Builder();
    ab.bar([0, 0, 0], [0, -0.03, -0.25], 0.13 * k, o.jacket);
    ab.bar([0, -0.03, -0.25], [0, -0.02, -0.47], 0.1 * k, o.skin);
    ab.box(0.12, 0.05, 0.05, C.chrome, 0, -0.02, -0.44);
    ab.box(0.12, 0.12, 0.13, C.dleather, 0, -0.02, -0.53);
    // arma 1.7x maior, escalada a partir da mão, pra ler bem de longe
    const wb = new Builder();
    const mz = armWeapon(wb, o.weapon);
    const hp = new THREE.Vector3(0, -0.02, -0.52);
    const sm = new THREE.Matrix4().makeTranslation(hp.x, hp.y, hp.z).multiply(new THREE.Matrix4().makeScale(1.7, 1.7, 1.7)).multiply(new THREE.Matrix4().makeTranslation(-hp.x, -hp.y, -hp.z));
    for (const g of wb.lit) ab.lit.push(g.applyMatrix4(sm));
    for (const g of wb.glow) ab.glow.push(g.applyMatrix4(sm));
    mz.applyMatrix4(sm);
    arm = ab.build();
    arm.position.set(...P(0.25 * k, 1.42, 0.06));
    grp.add(arm);
    muzzle = new THREE.Object3D();
    muzzle.position.copy(mz);
    arm.add(muzzle);
  }
  return { group: grp, body, head, arm, muzzle };
}

// ---------------------------------------------------------------- caminhão chefão
export function bossTruck(color) {
  const b = new Builder();
  // chassi
  b.box(2.3, 0.45, 5.6, C.black, 0, 0.95, 0);
  // capô e cabine
  b.box(2.15, 0.65, 1.6, color, 0, 1.5, -2.0);
  b.box(2.1, 1.05, 1.7, color, 0, 1.85, -0.5);
  b.box(1.9, 0.5, 0.05, 0x101820, 0, 2.05, -1.36, 0.35, 0, 0); // para-brisa
  b.box(1.9, 0.45, 0.05, 0x101820, 0, 2.05, 0.36);
  // grade com caveira
  b.box(1.6, 0.5, 0.1, C.chrome, 0, 1.45, -2.82);
  b.box(0.5, 0.5, 0.12, 0xf0ead8, 0, 1.55, -2.86);
  b.box(0.13, 0.12, 0.05, 0x000000, -0.11, 1.6, -2.93);
  b.box(0.13, 0.12, 0.05, 0x000000, 0.11, 1.6, -2.93);
  // para-choque com espinhos
  b.box(2.5, 0.25, 0.25, C.dchrome, 0, 0.95, -2.95);
  for (let i = -4; i <= 4; i++) b.cone(0.06, 0.35, 4, C.chrome, i * 0.28, 0.95, -3.2, -PI / 2, 0, 0);
  // caçamba
  b.box(2.2, 0.12, 2.6, C.steel, 0, 1.25, 1.5);
  b.box(0.1, 0.55, 2.6, color, -1.08, 1.55, 1.5);
  b.box(0.1, 0.55, 2.6, color, 1.08, 1.55, 1.5);
  b.box(2.2, 0.55, 0.1, color, 0, 1.55, 2.78);
  // placa
  b.box(0.6, 0.25, 0.03, 0xf2e6a0, 0, 1.15, 2.84);
  // santo antônio
  b.bar([-1.0, 1.8, 0.4], [-1.0, 2.7, 0.4], 0.08, C.chrome, true);
  b.bar([1.0, 1.8, 0.4], [1.0, 2.7, 0.4], 0.08, C.chrome, true);
  b.bar([-1.0, 2.7, 0.4], [1.0, 2.7, 0.4], 0.08, C.chrome, true);
  for (let i = -1; i <= 1; i += 2) b.cyl(0.12, 0.12, 0.1, 10, 0xfff2b0, i * 0.5, 2.75, 0.32, PI / 2, 0, 0, { glow: true });
  // escapamentos verticais com fogo
  for (const s of [-1, 1]) {
    b.cyl(0.09, 0.09, 1.6, 8, C.chrome, s * 1.15, 2.2, -0.4);
    b.cone(0.1, 0.35, 6, 0xff6a10, s * 1.15, 3.15, -0.4, 0, 0, 0, { glow: true });
  }
  // faróis traseiros
  b.box(0.3, 0.15, 0.05, 0xff2020, -0.85, 1.55, 2.84, 0, 0, 0, { glow: true });
  b.box(0.3, 0.15, 0.05, 0xff2020, 0.85, 1.55, 2.84, 0, 0, 0, { glow: true });
  const body = b.build();

  const axle = (z) => {
    const ab = new Builder();
    for (const s of [-1, 1]) {
      ab.cyl(0.66, 0.66, 0.55, 14, C.tire, s * 1.2, 0, 0, 0, 0, PI / 2);
      ab.cyl(0.4, 0.4, 0.57, 10, C.chrome, s * 1.2, 0, 0, 0, 0, PI / 2);
      for (let i = 0; i < 4; i++) ab.box(0.6, 0.12, 0.12, 0x111111, s * 1.2, Math.cos((i * PI) / 2) * 0.6, Math.sin((i * PI) / 2) * 0.6);
    }
    const m = ab.mesh();
    m.position.set(0, 0.66, z);
    return m;
  };
  // tanques de combustível (pontos fracos)
  const tank = (x) => {
    const tb = new Builder();
    tb.cyl(0.32, 0.32, 0.9, 10, 0xc42020, 0, 0, 0);
    tb.cyl(0.33, 0.33, 0.08, 10, 0xffd200, 0, 0.2, 0);
    tb.cyl(0.33, 0.33, 0.08, 10, 0xffd200, 0, -0.2, 0);
    const g = tb.build();
    g.position.set(x, 1.8, 2.2);
    return g;
  };
  return { body, front: axle(-1.9), rear: axle(1.75), tanks: [tank(-0.6), tank(0.6)] };
}

// ---------------------------------------------------------------- caminhão desgovernado + baú de armas
// chefão 2: helicóptero da gangue (voa na frente, metralha e faz bombardeio rasante)
export function bossHeli(color) {
  const b = new Builder();
  b.sph(1.25, color, 0, 0, -0.4, { sx: 1.0, sy: 0.95, sz: 2.1 }, 12, 9);
  b.sph(0.95, 0x20303c, 0, 0.25, -2.1, { sx: 0.95, sy: 0.75, sz: 0.8 }, 10, 8); // cabine de vidro
  b.box(2.0, 0.08, 0.6, 0xffd21e, 0, 0.55, 0.6); // faixa
  b.bar([0, 0.35, 1.4], [0, 0.8, 5.6], 0.5, color);
  b.box(0.12, 1.5, 0.9, color, 0, 1.4, 5.5);
  b.box(1.8, 0.1, 0.5, color, 0, 0.85, 5.3);
  b.box(0.9, 0.5, 1.2, C.dchrome, 0, 1.25, -0.2); // motor
  b.cyl(0.12, 0.12, 0.7, 8, C.chrome, 0, 1.75, -0.2);
  for (const s2 of [-1, 1]) {
    b.bar([s2 * 0.9, -1.3, -2], [s2 * 0.9, -1.3, 1.4], 0.1, C.black, true);
    b.bar([s2 * 0.9, -1.3, -1.2], [s2 * 0.6, -0.8, -1.1], 0.08, C.black, true);
    b.bar([s2 * 0.9, -1.3, 0.8], [s2 * 0.6, -0.8, 0.7], 0.08, C.black, true);
    // casulos de foguete
    b.box(0.25, 0.25, 1.2, C.olive, s2 * 1.65, -0.3, -0.6);
    for (const dy of [-0.06, 0.06]) for (const dx of [-0.06, 0.06]) b.cyl(0.04, 0.04, 0.05, 6, 0xd02020, s2 * 1.65 + dx, -0.3 + dy, -1.22, PI / 2, 0, 0, { glow: true });
    b.bar([s2 * 0.9, -0.2, -0.6], [s2 * 1.6, -0.3, -0.6], 0.12, C.black);
  }
  // caveira pintada no nariz
  b.box(0.7, 0.6, 0.06, 0xf0ead8, 0, -0.35, -2.9, 0.3, 0, 0);
  b.box(0.18, 0.16, 0.07, 0x000000, -0.16, -0.27, -2.93, 0.3, 0, 0);
  b.box(0.18, 0.16, 0.07, 0x000000, 0.16, -0.27, -2.93, 0.3, 0, 0);
  b.sph(0.12, 0xff2020, 0, -1.1, 0.3, { glow: true }, 6, 4);
  b.sph(0.1, 0xff2020, 0, 2.2, 5.6, { glow: true }, 6, 4);
  const body = b.build();
  const rb = new Builder();
  for (let i = 0; i < 4; i++) rb.box(9, 0.06, 0.4, 0x222222, 0, 0, 0, 0, (i * PI) / 4, 0);
  rb.cyl(0.25, 0.25, 0.2, 10, C.chrome, 0, 0, 0);
  const rotor = rb.build();
  rotor.position.set(0, 2.15, -0.2);
  const tb = new Builder();
  tb.box(0.05, 1.8, 0.2, 0x222222, 0, 0, 0);
  tb.box(0.05, 0.2, 1.8, 0x222222, 0, 0, 0);
  const tail = tb.build();
  tail.position.set(0.15, 1.4, 5.8);
  const pod = (x) => {
    const pb = new Builder();
    pb.cyl(0.4, 0.4, 1.3, 10, 0xc42020, 0, 0, 0, PI / 2, 0, 0);
    pb.cyl(0.42, 0.42, 0.1, 10, 0xffd200, 0, 0, 0.3, PI / 2, 0, 0);
    pb.cyl(0.42, 0.42, 0.1, 10, 0xffd200, 0, 0, -0.3, PI / 2, 0, 0);
    pb.cyl(0.3, 0.2, 0.3, 10, 0x333333, 0, 0, 0.75, PI / 2, 0, 0);
    const g = pb.build();
    g.position.set(x, 1.0, 0.4);
    return g;
  };
  return { body, front: rotor, rear: tail, tanks: [pod(-1.05), pod(1.05)] };
}

// chefão 3: caminhão-tanque com lança-chamas na traseira
export function bossTanker(color) {
  const b = new Builder();
  b.box(2.4, 0.5, 9.4, C.black, 0, 0.95, 0.3);
  // cavalo mecânico
  b.box(2.4, 1.9, 2.2, color, 0, 2.1, -3.6);
  b.box(2.3, 0.9, 1.2, color, 0, 1.6, -5.1);
  b.box(2.1, 0.6, 0.05, 0x101820, 0, 2.55, -4.72, 0.25, 0, 0);
  b.box(2.0, 0.8, 0.12, C.chrome, 0, 1.4, -5.75);
  for (let i = -3; i <= 3; i++) b.cone(0.07, 0.4, 4, C.chrome, i * 0.3, 1.0, -5.95, -PI / 2, 0, 0);
  for (const s2 of [-1, 1]) {
    b.cyl(0.12, 0.12, 2.6, 8, C.chrome, s2 * 1.25, 2.6, -2.6);
    b.cone(0.13, 0.4, 6, 0xff6a10, s2 * 1.25, 4.1, -2.6, 0, 0, 0, { glow: true });
    b.box(0.35, 0.18, 0.05, 0xfff2b0, s2 * 0.8, 1.6, -5.72, 0, 0, 0, { glow: true });
  }
  // tanque prateado com faixas "INFLAMÁVEL"
  b.cyl(1.3, 1.3, 6.6, 16, 0xc8ccd2, 0, 2.3, 1.6, PI / 2, 0, 0);
  for (const z of [-1.0, 1.6, 4.2]) b.cyl(1.33, 1.33, 0.35, 16, 0xd02020, 0, 2.3, z, PI / 2, 0, 0);
  b.box(0.6, 0.15, 6, 0x777777, 0, 3.62, 1.6);
  for (let z = -1.2; z < 4.6; z += 0.9) b.box(0.08, 0.5, 0.08, 0x777777, 0.6, 3.85, z);
  b.box(1.4, 0.06, 6, 0x777777, 0, 4.1, 1.6);
  // lança-chamas na traseira
  for (const s2 of [-1, 1]) {
    b.cyl(0.14, 0.18, 0.9, 8, C.dchrome, s2 * 0.9, 1.2, 5.3, PI / 2, 0, 0);
    b.cyl(0.1, 0.1, 0.05, 8, 0xff8020, s2 * 0.9, 1.2, 5.76, PI / 2, 0, 0, { glow: true });
    b.box(0.3, 0.15, 0.05, 0xff2020, s2 * 0.95, 1.0, 5.1, 0, 0, 0, { glow: true });
  }
  const body = b.build();
  const axle = (z) => {
    const ab = new Builder();
    for (const s2 of [-1, 1]) {
      ab.cyl(0.6, 0.6, 0.6, 14, C.tire, s2 * 1.15, 0, 0, 0, 0, PI / 2);
      ab.cyl(0.36, 0.36, 0.62, 10, C.chrome, s2 * 1.15, 0, 0, 0, 0, PI / 2);
    }
    const m = ab.mesh();
    m.position.set(0, 0.6, z);
    return m;
  };
  // válvulas do tanque (pontos fracos)
  const valve = (x) => {
    const vb = new Builder();
    vb.cyl(0.3, 0.3, 0.5, 10, 0xc42020, 0, 0, 0, PI / 2, 0, 0);
    vb.cyl(0.32, 0.32, 0.08, 10, 0xffd200, 0, 0, 0.12, PI / 2, 0, 0);
    vb.box(0.5, 0.08, 0.08, 0xffd200, 0, 0, 0.28);
    const g = vb.build();
    g.position.set(x, 2.5, 5.0);
    return g;
  };
  return { body, front: axle(-4.4), rear: axle(3.6), tanks: [valve(-0.6), valve(0.6)] };
}

export function runawayTruck() {
  const b = new Builder();
  const col = pick([0x2a6ab0, 0xb0302a, 0xe0b020, 0x3a8a4a]);
  b.box(2.2, 0.4, 7.2, C.black, 0, 0.75, 0);
  b.box(2.2, 1.5, 2.0, col, 0, 1.75, -2.6);
  b.box(2.0, 0.6, 0.05, 0x101820, 0, 2.15, -3.61, 0.25, 0, 0);
  b.box(2.3, 0.3, 0.3, C.chrome, 0, 0.85, -3.7);
  for (const s of [-0.75, 0.75]) b.box(0.35, 0.2, 0.05, 0xfff2b0, s, 1.2, -3.62, 0, 0, 0, { glow: true });
  // baú de carga
  b.box(2.4, 2.4, 4.8, 0xe8e0d0, 0, 2.2, 0.9);
  b.box(2.42, 0.35, 4.82, 0xc41e2a, 0, 1.6, 0.9);
  b.box(2.42, 0.2, 4.82, col, 0, 3.3, 0.9);
  b.box(2.2, 2.2, 0.05, 0x8a8070, 0, 2.2, 3.31);
  for (const s of [-0.7, 0.7]) b.box(0.3, 0.15, 0.05, 0xff2020, s, 1.0, 3.33, 0, 0, 0, { glow: true });
  for (const s of [-1, 1]) b.cyl(0.08, 0.08, 1.4, 6, C.chrome, s * 1.0, 2.9, -1.5);
  const body = b.build();
  // pintura da transportadora nas laterais e na porta de trás
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.0, 4, 1), livery('side'));
    side.rotation.y = s * PI / 2;
    side.position.set(s * 1.215, 2.25, 0.9);
    side.frustumCulled = false;
    body.add(side);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.0), livery('back'));
  back.position.set(0, 2.2, 3.34);
  back.frustumCulled = false;
  body.add(back);
  const axle = (z) => {
    const ab = new Builder();
    for (const s of [-1, 1]) {
      ab.cyl(0.5, 0.5, 0.4, 12, C.tire, s * 1.05, 0, 0, 0, 0, PI / 2);
      ab.cyl(0.28, 0.28, 0.42, 8, C.chrome, s * 1.05, 0, 0, 0, 0, PI / 2);
    }
    const m = ab.mesh();
    m.position.set(0, 0.5, z);
    return m;
  };
  return { body, front: axle(-2.6), rear: axle(2.2) };
}

// corvo de jaqueta e bandana que voa do seu lado e atira sozinho (companheiro)
export function crowModel() {
  const body = new Builder();
  body.sph(0.075, 0x15151c, 0, 0, 0, { sx: 0.9, sy: 0.85, sz: 1.35 }, 8, 6);
  body.sph(0.05, 0x1a1a22, 0, 0.06, -0.08, null, 8, 6);
  body.cone(0.02, 0.07, 5, 0x3a3a3a, 0, 0.055, -0.145, -PI / 2, 0, 0);
  body.box(0.07, 0.02, 0.09, 0x111116, 0, -0.01, 0.12, 0.3, 0, 0);
  body.box(0.11, 0.025, 0.06, 0xc01020, 0, 0.09, -0.07); // bandana
  body.box(0.03, 0.04, 0.03, 0xc01020, 0, 0.08, -0.02, 0.4, 0, 0);
  for (const s of [-1, 1]) body.sph(0.012, 0xff3020, s * 0.03, 0.075, -0.115, { glow: true }, 5, 4);
  // mini metralhadora presa na barriga
  body.box(0.02, 0.02, 0.1, 0x333333, 0, -0.07, -0.05);
  const grp = body.build(true);
  const wings = [-1, 1].map((s) => {
    const wb = new Builder();
    wb.box(0.16, 0.012, 0.09, 0x101016, s * 0.08, 0, 0.0, 0, 0, 0);
    wb.box(0.1, 0.01, 0.06, 0x202028, s * 0.2, 0, 0.02, 0, 0, 0);
    const w = wb.build(true);
    w.position.set(s * 0.04, 0.02, 0);
    grp.add(w);
    return w;
  });
  return { grp, wings };
}

// caixa de power-up: atire nela (ou passe por cima) pra pegar
export function powCrate(color) {
  const b = new Builder();
  b.box(0.7, 0.7, 0.7, color, 0, 0, 0);
  for (const y of [-0.33, 0.33]) b.box(0.74, 0.08, 0.74, 0x222222, 0, y, 0);
  for (const x of [-0.33, 0.33]) b.box(0.08, 0.74, 0.74, 0x222222, x, 0, 0);
  b.box(0.3, 0.3, 0.76, 0xffffff, 0, 0, 0, 0, 0, 0, { glow: true });
  return b.build();
}

// ---------------------------------------------------------------- transportadora fictícia "66 EXPRESS"
const texCache = {};
function livery(kind) {
  if (texCache['l' + kind]) return texCache['l' + kind];
  const tex = canvasTex(kind === 'side' ? 1024 : 512, 448, (g, w, h) => {
    g.fillStyle = '#f4f0e8';
    g.fillRect(0, 0, w, h);
    // faixa diagonal vermelha e amarela
    g.fillStyle = '#c41e2a';
    g.beginPath();
    g.moveTo(0, h * 0.68);
    g.lineTo(w, h * 0.42);
    g.lineTo(w, h * 0.62);
    g.lineTo(0, h * 0.88);
    g.fill();
    g.fillStyle = '#f2b51c';
    g.beginPath();
    g.moveTo(0, h * 0.88);
    g.lineTo(w, h * 0.62);
    g.lineTo(w, h * 0.7);
    g.lineTo(0, h * 0.96);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, '66 EXPRESS', w * 0.86, kind === 'side' ? 170 : 96, FB);
    strokeText(g, '66 EXPRESS', w / 2, h * 0.27, '#1a2a5a', '#ffffff', 10);
    const sub = kind === 'side' ? 'ENTREGA EM QUALQUER BURACO DA ROTA 66' : 'MANTENHA DISTÂNCIA';
    fitFont(g, sub, w * 0.86, 40, FB);
    g.fillStyle = '#1a2a5a';
    g.fillText(sub, w / 2, h * 0.5);
  });
  return (texCache['l' + kind] = curveMaterial(new THREE.MeshLambertMaterial({ map: tex })));
}

function boxLabel(kind) {
  if (texCache['b' + kind]) return texCache['b' + kind];
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (kind === 'label') {
      // etiqueta de envio
      g.fillStyle = '#ffffff';
      g.fillRect(14, 30, w - 28, h - 60);
      g.fillStyle = '#c41e2a';
      g.fillRect(14, 30, w - 28, 44);
      fitFont(g, '66 EXPRESS', w - 50, 32, FB);
      g.fillStyle = '#ffffff';
      g.fillText('66 EXPRESS', w / 2, 53);
      g.fillStyle = '#111';
      for (let i = 0; i < 26; i++) g.fillRect(30 + i * 7.5, 92, i % 3 ? 3 : 5, 56); // código de barras
      g.font = 'bold 22px Arial';
      g.fillText('PARA: VOCÊ', w / 2, 172);
      g.font = 'bold 16px Arial';
      g.fillText('ROTA 66 • KM ???', w / 2, 200);
    } else if (kind === 'fragile') {
      g.strokeStyle = '#d01818';
      g.lineWidth = 9;
      g.strokeRect(18, 70, w - 36, 116);
      fitFont(g, 'FRÁGIL', w - 60, 70, FB);
      g.fillStyle = '#d01818';
      g.fillText('FRÁGIL', w / 2, 128);
      g.font = 'bold 54px Arial';
      g.fillText('↑↑', w / 2, 40);
      g.fillText('🍷', w / 2, 222);
    } else {
      // estêncil do engradado de madeira
      g.fillStyle = 'rgba(25,15,8,0.85)';
      fitFont(g, '66 EXPRESS', w - 30, 44, FB);
      g.fillText('66 EXPRESS', w / 2, 92);
      fitFont(g, 'CUIDADO • ARMAS', w - 30, 26, FB);
      g.fillText('CUIDADO • ARMAS', w / 2, 150);
      g.font = 'bold 60px Arial';
      g.fillText('↑↑', w / 2, 210);
    }
  });
  return (texCache['b' + kind] = curveMaterial(new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.1 })));
}

// encomenda que cai do caminhão: caixa de papelão com fita e etiquetas, ou engradado de madeira
export function parcel() {
  const wood = Math.random() < 0.4;
  const b = new Builder();
  const W = 1.0;
  const H = 0.72;
  const D = 0.8;
  const grp = new THREE.Group();
  const flaps = [];
  if (wood) {
    const plank = 0xc8985a;
    b.box(W, H, D, 0x8a6236, 0, H / 2, 0);
    for (let i = 0; i < 4; i++) {
      const y = 0.09 + i * 0.18;
      b.box(W + 0.02, 0.15, D + 0.02, i % 2 ? plank : 0xb8884c, 0, y, 0);
    }
    for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) b.box(0.08, H + 0.02, 0.08, 0x6a4626, x, H / 2, z);
    for (const s of [-1, 1]) b.bar([-W / 2, 0.05, s * (D / 2 + 0.012)], [W / 2, H - 0.05, s * (D / 2 + 0.012)], 0.07, 0x7a5430);
    grp.add(b.build());
    const lid = new Builder();
    for (let i = 0; i < 4; i++) lid.box(W + 0.04, 0.05, D / 4 - 0.01, i % 2 ? plank : 0xb8884c, 0, 0, -D * 0.375 + (i * D) / 4);
    const lm = lid.build();
    lm.position.y = H + 0.03;
    grp.add(lm);
    flaps.push(lm);
  } else {
    const card = 0xb8875a;
    b.box(W, H, D, card, 0, H / 2, 0);
    b.box(0.16, H + 0.012, D + 0.012, 0xd9c79c, 0, H / 2, 0); // fita
    for (const z of [-D / 2, D / 2]) b.box(W * 0.6, 0.02, 0.012, 0x9a6a40, 0, H * 0.35, z);
    grp.add(b.build());
    // abas de cima (abrem quando a caixa estoura)
    for (const s of [-1, 1]) {
      const fb = new Builder();
      fb.box(W / 2, 0.025, D, 0xc4946a, s * (W / 4), 0, 0);
      fb.box(0.08, 0.03, D, 0xd9c79c, s * 0.04, 0.003, 0);
      const f = fb.build();
      f.position.set(0, H + 0.01, 0);
      f.userData.side = s;
      grp.add(f);
      flaps.push(f);
    }
  }
  // etiquetas
  const lab = (kind, w, h, x, y, z, ry, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), boxLabel(kind));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0, 'YXZ');
    m.frustumCulled = false;
    grp.add(m);
  };
  if (wood) {
    lab('stencil', 0.62, 0.62, 0, H / 2, -D / 2 - 0.02, PI);
    lab('stencil', 0.62, 0.62, W / 2 + 0.02, H / 2, 0, PI / 2);
  } else {
    lab('label', 0.42, 0.42, 0.24, H / 2, -D / 2 - 0.008, PI);
    lab('fragile', 0.44, 0.44, -W / 2 - 0.008, H / 2, 0, -PI / 2);
    lab('fragile', 0.44, 0.44, W / 2 + 0.008, H / 2, 0, PI / 2);
    lab('label', 0.4, 0.4, -0.25, H + 0.04, 0.12, 0, -PI / 2);
  }
  grp.userData = { flaps, wood, H };
  return grp;
}

// ---------------------------------------------------------------- mão / luva
export function gloveBuilder(b, skin = 0xe0ac69) {
  b.box(0.088, 0.1, 0.09, C.dleather, 0, -0.045, 0.012);
  b.box(0.092, 0.03, 0.035, skin, 0, -0.008, -0.04);
  b.box(0.092, 0.07, 0.03, skin, 0, -0.06, -0.045);
  b.box(0.03, 0.03, 0.07, C.dleather, -0.045, 0.0, 0.0);
  b.box(0.08, 0.075, 0.1, C.dleather, 0, -0.06, 0.08);
  b.box(0.088, 0.085, 0.04, 0x3a2618, 0, -0.065, 0.14);
  return b;
}
export function freeGlove(skin) {
  const b = new Builder();
  gloveBuilder(b, skin);
  return b.mesh();
}

// ---------------------------------------------------------------- armas do jogador
// origem = ponto de empunhadura; cano em -Z
export function gunModel(id) {
  const b = new Builder();
  let muzzle = new THREE.Vector3(0, 0.04, -0.25);
  let spinner = null;
  const WOOD = 0x8a5426;
  const WOOD_D = 0x5e3416;
  const BLUED = 0x2c3038;
  const BRASS = 0xd4a540;
  const grip = (color, x = 0, y = -0.045, z = 0.04, rx = 0.32, h = 0.11) => {
    b.box(0.036, h, 0.048, color, x, y, z, rx, 0, 0);
    for (let i = 0; i < 4; i++) b.box(0.038, 0.006, 0.05, WOOD_D, x, y + 0.035 - i * 0.022, z + Math.sin(rx) * (0.035 - i * 0.022), rx, 0, 0);
  };
  const guard = (z = 0.0, y = -0.012) => {
    b.box(0.008, 0.008, 0.06, 0x222222, 0, y - 0.022, z);
    b.box(0.008, 0.03, 0.008, 0x222222, 0, y - 0.008, z - 0.03);
    b.box(0.006, 0.022, 0.006, C.chrome, 0, y - 0.006, z + 0.005, -0.3, 0, 0); // gatilho
  };
  switch (id) {
    case 'sawedoff': {
      // cano duplo serrado: canos azulados, coronha de madeira envernizada, báscula gravada
      for (const s2 of [-1, 1]) {
        b.cyl(0.019, 0.019, 0.32, 12, BLUED, s2 * 0.019, 0.05, -0.2, PI / 2, 0, 0);
        b.cyl(0.021, 0.021, 0.02, 12, C.chrome, s2 * 0.019, 0.05, -0.355, PI / 2, 0, 0);
        b.cyl(0.011, 0.011, 0.022, 8, 0x0a0a0a, s2 * 0.019, 0.05, -0.36, PI / 2, 0, 0);
      }
      b.box(0.012, 0.008, 0.3, 0x3a3e46, 0, 0.072, -0.2);
      b.sph(0.006, BRASS, 0, 0.078, -0.345, null, 6, 4);
      b.box(0.064, 0.036, 0.17, WOOD, 0, 0.02, -0.14);
      for (let i = 0; i < 5; i++) b.box(0.066, 0.002, 0.012, WOOD_D, 0, 0.002, -0.08 - i * 0.025);
      b.box(0.068, 0.066, 0.095, 0xa8aeb6, 0, 0.038, 0.0);
      for (const s2 of [-1, 1]) {
        b.box(0.002, 0.04, 0.07, BRASS, s2 * 0.035, 0.04, 0.0);
        b.sph(0.008, BRASS, s2 * 0.035, 0.04, 0.0, null, 6, 4);
      }
      b.box(0.014, 0.01, 0.045, C.chrome, 0.012, 0.074, 0.035, 0, 0.3, 0); // alavanca
      for (const s2 of [-1, 1]) b.box(0.01, 0.02, 0.016, C.dchrome, s2 * 0.014, 0.078, 0.05, 0.4, 0, 0); // cães
      guard(0.03, 0.006);
      grip(WOOD, 0, -0.04, 0.075, 0.5, 0.12);
      b.box(0.04, 0.02, 0.055, 0x222222, 0, -0.1, 0.105, 0.5, 0, 0);
      muzzle.set(0, 0.05, -0.37);
      break;
    }
    case 'magnum': {
      // revólver .50 banhado a ouro com cabo de jacarandá
      const GOLD = 0xe8b84a;
      b.box(0.034, 0.04, 0.2, GOLD, 0, 0.05, -0.13);
      b.box(0.014, 0.012, 0.2, 0xd4a030, 0, 0.074, -0.13);
      for (let i = 0; i < 5; i++) b.box(0.016, 0.006, 0.012, 0x6a4a10, 0, 0.081, -0.05 - i * 0.035);
      b.box(0.022, 0.022, 0.17, 0xc89a2a, 0, 0.022, -0.12);
      b.cyl(0.015, 0.015, 0.012, 10, C.chrome, 0, 0.05, -0.235, PI / 2, 0, 0);
      b.cyl(0.008, 0.008, 0.014, 8, 0x0a0a0a, 0, 0.05, -0.238, PI / 2, 0, 0);
      b.box(0.006, 0.014, 0.012, 0xff2020, 0, 0.088, -0.22, 0, 0, 0, { glow: true });
      b.cyl(0.033, 0.033, 0.06, 12, 0xc89a2a, 0, 0.036, -0.005, PI / 2, 0, 0);
      for (let i = 0; i < 6; i++) {
        const a2 = (i / 6) * PI * 2;
        b.box(0.008, 0.008, 0.062, 0x7a5a14, Math.cos(a2) * 0.031, 0.036 + Math.sin(a2) * 0.031, -0.005);
      }
      b.box(0.03, 0.07, 0.07, GOLD, 0, 0.03, 0.04);
      b.box(0.012, 0.024, 0.02, C.chrome, 0, 0.075, 0.075, -0.5, 0, 0); // cão
      guard(0.03, 0.0);
      grip(0x5a2a18, 0, -0.045, 0.07, 0.3, 0.11);
      for (const s2 of [-1, 1]) b.cyl(0.009, 0.009, 0.004, 8, GOLD, s2 * 0.019, -0.035, 0.068, 0, 0, PI / 2);
      muzzle.set(0, 0.05, -0.245);
      break;
    }
    case 'tommy': {
      // metralhadora Thompson: cano aletado, carregador de tambor, coronha e empunhadura de madeira
      b.cyl(0.013, 0.013, 0.26, 10, BLUED, 0, 0.045, -0.31, PI / 2, 0, 0);
      for (let i = 0; i < 9; i++) b.cyl(0.022, 0.022, 0.008, 10, 0x30343a, 0, 0.045, -0.22 - i * 0.022, PI / 2, 0, 0);
      b.box(0.03, 0.03, 0.04, 0x30343a, 0, 0.045, -0.45);
      for (let i = 0; i < 3; i++) b.box(0.032, 0.004, 0.006, 0x111111, 0, 0.06, -0.44 + i * 0.012);
      b.box(0.046, 0.056, 0.22, 0x2a2c30, 0, 0.045, -0.06);
      b.box(0.012, 0.012, 0.03, C.chrome, 0, 0.078, -0.06);
      b.box(0.014, 0.02, 0.012, 0x111111, 0, 0.082, 0.03);
      b.box(0.004, 0.016, 0.006, C.chrome, 0, 0.08, -0.17);
      b.box(0.036, 0.09, 0.042, WOOD, 0, -0.015, -0.2, 0.15, 0, 0);
      for (let i = 0; i < 3; i++) b.box(0.038, 0.008, 0.044, WOOD_D, 0, -0.0 - i * 0.025, -0.198, 0.15, 0, 0);
      b.cyl(0.066, 0.066, 0.045, 18, 0x1e1f22, 0, -0.035, -0.09, 0, 0, PI / 2);
      b.cyl(0.068, 0.068, 0.008, 18, C.dchrome, 0, -0.035, -0.09, 0, 0, PI / 2);
      b.cyl(0.018, 0.018, 0.05, 8, C.chrome, 0, -0.035, -0.09, 0, 0, PI / 2);
      guard(0.02, 0.012);
      grip(WOOD, 0, -0.04, 0.045, 0.3, 0.1);
      b.box(0.04, 0.055, 0.2, WOOD, 0, 0.012, 0.16, -0.12, 0, 0);
      b.box(0.042, 0.075, 0.02, 0x2a2c30, 0, -0.002, 0.26, -0.12, 0, 0);
      muzzle.set(0, 0.045, -0.47);
      break;
    }
    case 'bazooka': {
      b.cyl(0.05, 0.05, 0.9, 16, C.olive, 0, 0.07, -0.18, PI / 2, 0, 0);
      b.cyl(0.064, 0.05, 0.12, 16, 0x2a2f1a, 0, 0.07, -0.66, PI / 2, 0, 0);
      b.cyl(0.05, 0.068, 0.14, 16, 0x2a2f1a, 0, 0.07, 0.32, PI / 2, 0, 0);
      b.cyl(0.046, 0.046, 0.01, 16, 0x050505, 0, 0.07, -0.725, PI / 2, 0, 0);
      b.cone(0.036, 0.1, 10, 0xc02020, 0, 0.07, -0.69, -PI / 2, 0, 0);
      for (const z of [-0.5, -0.1, 0.18]) b.cyl(0.053, 0.053, 0.03, 16, 0xffd200, 0, 0.07, z, PI / 2, 0, 0);
      b.box(0.004, 0.06, 0.004, 0x222222, 0.03, 0.14, -0.45);
      b.box(0.004, 0.06, 0.004, 0x222222, -0.03, 0.14, -0.45);
      b.box(0.064, 0.004, 0.004, 0x222222, 0, 0.17, -0.45);
      b.box(0.05, 0.05, 0.07, 0x222222, 0.065, 0.11, -0.05);
      b.cyl(0.018, 0.018, 0.012, 8, 0x40e0ff, 0.065, 0.11, -0.09, PI / 2, 0, 0, { glow: true });
      b.box(0.06, 0.07, 0.16, 0x3a2a1a, 0, 0.0, 0.18);
      b.box(0.034, 0.08, 0.04, 0x222222, 0, -0.02, -0.26, 0.15, 0, 0);
      guard(0.02, 0.012);
      grip(0x222222, 0, -0.035, 0.045, 0.3, 0.1);
      b.box(0.04, 0.02, 0.05, 0xff3030, 0.055, 0.075, 0.25, 0, 0, 0, { glow: true });
      muzzle.set(0, 0.07, -0.78);
      break;
    }
    case 'autoshotgun': {
      // escopeta automática de tambor
      b.box(0.07, 0.085, 0.34, 0x3a4030, 0, 0.04, -0.08);
      b.box(0.03, 0.012, 0.3, 0x1a1a1a, 0, 0.09, -0.08);
      for (let i = 0; i < 10; i++) b.box(0.032, 0.006, 0.01, 0x333333, 0, 0.098, -0.21 + i * 0.028);
      b.cyl(0.018, 0.018, 0.14, 10, BLUED, 0, 0.055, -0.31, PI / 2, 0, 0);
      b.box(0.04, 0.04, 0.06, 0x2a2a2a, 0, 0.055, -0.39);
      for (const s2 of [-1, 1]) b.box(0.004, 0.026, 0.04, 0x111111, s2 * 0.021, 0.055, -0.39);
      b.cyl(0.08, 0.08, 0.06, 18, 0x2a2e26, 0, -0.06, -0.12, 0, 0, PI / 2);
      b.cyl(0.082, 0.082, 0.01, 18, 0x101010, 0, -0.06, -0.12, 0, 0, PI / 2);
      for (let i = 0; i < 6; i++) b.box(0.064, 0.012, 0.012, 0xc04020, 0, -0.06 + Math.sin((i * PI) / 3) * 0.06, -0.12 + Math.cos((i * PI) / 3) * 0.06);
      b.box(0.034, 0.075, 0.04, 0x1a1a1a, 0, -0.01, -0.22, 0.2, 0, 0);
      guard(0.03, 0.0);
      grip(0x1a1a1a, 0, -0.045, 0.06, 0.3, 0.1);
      b.box(0.05, 0.07, 0.1, 0x3a4030, 0, 0.03, 0.14);
      b.box(0.054, 0.09, 0.02, 0x111111, 0, 0.02, 0.2);
      muzzle.set(0, 0.055, -0.43);
      break;
    }
    case 'gatling': {
      // mini-gatling: 6 canos que giram, motor, alça de transporte e caixa de munição com fita
      b.cyl(0.06, 0.06, 0.16, 14, 0x1c1c1e, 0, 0.04, -0.02, PI / 2, 0, 0);
      b.box(0.09, 0.08, 0.14, C.olive, 0.075, 0.0, -0.02);
      b.box(0.08, 0.03, 0.12, 0x2a2a2a, 0.075, 0.05, -0.02);
      b.bar([0, 0.1, 0.06], [0, 0.135, 0.0], 0.016, 0x222222);
      b.bar([0, 0.135, 0.0], [0, 0.135, -0.12], 0.016, 0x222222);
      b.bar([0, 0.135, -0.12], [0, 0.1, -0.15], 0.016, 0x222222);
      b.box(0.11, 0.09, 0.12, 0x4a5228, -0.1, -0.02, 0.0);
      b.box(0.112, 0.014, 0.122, 0x2a2e16, -0.1, 0.03, 0.0);
      for (let i = 0; i < 6; i++) b.box(0.016, 0.02, 0.012, BRASS, -0.05 + i * 0.006, 0.0 - i * 0.008, -0.03 - i * 0.012, 0.4, 0, 0.6);
      b.box(0.036, 0.09, 0.045, 0x111111, 0, -0.06, -0.12, 0.2, 0, 0);
      guard(0.04, 0.0);
      grip(0x111111, 0, -0.05, 0.07, 0.3, 0.11);
      b.box(0.05, 0.06, 0.12, 0x202020, 0, 0.03, 0.12);
      const sb = new Builder();
      for (let i = 0; i < 6; i++) {
        const a2 = (i / 6) * PI * 2;
        sb.cyl(0.009, 0.009, 0.36, 8, i === 0 ? 0x8a8e96 : 0x3a3e46, Math.cos(a2) * 0.027, Math.sin(a2) * 0.027, 0, PI / 2, 0, 0);
        sb.cyl(0.011, 0.011, 0.016, 8, 0x0a0a0a, Math.cos(a2) * 0.027, Math.sin(a2) * 0.027, -0.18, PI / 2, 0, 0);
      }
      for (const z of [-0.14, 0.0, 0.12]) sb.cyl(0.042, 0.042, 0.016, 12, 0x222222, 0, 0, z, PI / 2, 0, 0);
      spinner = sb.build('gun');
      spinner.position.set(0, 0.04, -0.25);
      muzzle.set(0, 0.04, -0.44);
      break;
    }
    case 'homing': {
      // lançador de 4 tubos com radar
      b.box(0.13, 0.12, 0.34, 0x3a4030, 0, 0.08, -0.12);
      for (const [x, y] of [[-0.032, 0.05], [0.032, 0.05], [-0.032, 0.11], [0.032, 0.11]]) {
        b.cyl(0.026, 0.026, 0.37, 10, 0x22261c, x, y, -0.13, PI / 2, 0, 0);
        b.cone(0.02, 0.04, 8, 0xd02020, x, y, -0.32, -PI / 2, 0, 0, { glow: true });
      }
      b.box(0.135, 0.02, 0.02, 0xffd200, 0, 0.08, -0.29);
      b.box(0.135, 0.02, 0.02, 0xffd200, 0, 0.08, 0.04);
      b.cyl(0.04, 0.02, 0.02, 12, 0xc0c8d0, 0, 0.19, -0.05);
      b.box(0.004, 0.04, 0.004, 0x888888, 0, 0.17, -0.05);
      b.box(0.04, 0.04, 0.03, 0xff3030, 0.07, 0.15, -0.02, 0, 0, 0, { glow: true });
      guard(0.03, 0.02);
      grip(0x111111, 0, -0.04, 0.05, 0.3, 0.11);
      muzzle.set(0, 0.08, -0.34);
      break;
    }
    case 'tesla': {
      // bobina tesla: espiras de cobre girando, tubo de vidro e esfera de plasma
      b.box(0.05, 0.06, 0.2, 0x2a2a30, 0, 0.03, -0.02);
      for (const s2 of [-1, 1]) {
        b.box(0.022, 0.05, 0.12, 0x6a6a20, s2 * 0.036, 0.03, 0.03);
        b.box(0.024, 0.01, 0.02, 0x40e0ff, s2 * 0.036, 0.058, 0.0, 0, 0, 0, { glow: true });
      }
      guard(0.04, 0.0);
      grip(0x111111, 0, -0.045, 0.06, 0.3, 0.11);
      b.cyl(0.012, 0.012, 0.3, 6, C.chrome, 0, 0.05, -0.2, PI / 2, 0, 0);
      b.cyl(0.05, 0.05, 0.26, 14, 0x60c8e8, 0, 0.05, -0.2, PI / 2, 0, 0); // vidro
      b.box(0.08, 0.05, 0.05, 0x40e0ff, 0, 0.075, 0.07, 0, 0, 0, { glow: true });
      const sb = new Builder();
      for (let i = 0; i < 8; i++) sb.cyl(0.044 - i * 0.003, 0.044 - i * 0.003, 0.01, 12, i % 2 ? 0xb8662a : 0xe8a050, 0, 0, 0.1 - i * 0.03, PI / 2, 0, 0);
      sb.box(0.012, 0.09, 0.012, 0x40e0ff, 0, 0, 0, 0, 0, 0, { glow: true });
      spinner = sb.build('gun');
      spinner.position.set(0, 0.05, -0.22);
      b.sph(0.048, 0x9af4ff, 0, 0.05, -0.37, { glow: true }, 10, 8);
      b.sph(0.03, 0xffffff, 0, 0.05, -0.37, { glow: true }, 8, 6);
      for (let i = 0; i < 3; i++) b.box(0.006, 0.006, 0.05, 0xc0c0c0, Math.cos(i * 2.1) * 0.05, 0.05 + Math.sin(i * 2.1) * 0.05, -0.34);
      muzzle.set(0, 0.05, -0.38);
      break;
    }
    case 'flyingv': {
      // guitarra Flying V vermelha que dispara laser pelo braço
      b.box(0.042, 0.024, 0.5, 0x5a2a10, 0, 0.05, -0.28);
      for (let i = 0; i < 12; i++) b.box(0.044, 0.002, 0.004, 0xc0c0c0, 0, 0.063, -0.08 - i * 0.034);
      for (let i = 0; i < 4; i++) b.sph(0.004, 0xf0f0f0, 0, 0.064, -0.13 - i * 0.07, null, 4, 3);
      b.box(0.07, 0.02, 0.1, 0x111111, 0, 0.05, -0.56, 0, 0.3, 0);
      for (let i = 0; i < 6; i++) b.cyl(0.006, 0.006, 0.02, 6, C.chrome, (i - 2.5) * 0.011, 0.068, -0.54 - (i % 3) * 0.022);
      for (const s2 of [-1, 1]) {
        b.box(0.085, 0.036, 0.35, 0xc01020, s2 * 0.088, 0.045, 0.1, 0, s2 * 0.42, 0);
        b.box(0.088, 0.004, 0.352, 0xf0f0f0, s2 * 0.088, 0.064, 0.1, 0, s2 * 0.42, 0);
        b.cyl(0.012, 0.012, 0.01, 8, 0xd0d0d0, s2 * 0.05, 0.068, 0.12);
      }
      b.box(0.075, 0.016, 0.03, 0x111111, 0, 0.068, 0.0);
      b.box(0.075, 0.016, 0.03, 0x111111, 0, 0.068, 0.07);
      for (let i = 0; i < 6; i++) b.box(0.003, 0.003, 0.04, C.chrome, (i - 2.5) * 0.009, 0.08, 0.035);
      b.box(0.07, 0.012, 0.03, C.chrome, 0, 0.07, 0.13);
      grip(0x111111, 0, -0.045, 0.03, 0.3, 0.11);
      b.box(0.022, 0.003, 0.52, 0x40f0ff, 0, 0.066, -0.27, 0, 0, 0, { glow: true });
      b.sph(0.022, 0x40f0ff, 0, 0.05, -0.61, { glow: true }, 8, 6);
      muzzle.set(0, 0.05, -0.62);
      break;
    }
    default:
      break;
  }
  const model = b.build('gun');
  if (spinner) model.add(spinner);
  const gb = new Builder();
  gloveBuilder(gb);
  const glove = gb.mesh();
  return { model, glove, muzzle, spinner };
}

// ---------------------------------------------------------------- moto do jogador (1ª pessoa)

export function playerBike() {
  const grp = new THREE.Group();
  const b = new Builder();
  const tankCol = 0xa50f18;
  // banco
  b.box(0.36, 0.1, 0.52, 0x161210, 0, 0.72, 0.18);
  b.box(0.3, 0.16, 0.12, 0x161210, 0, 0.8, 0.44);
  // tanque
  b.sph(0.21, tankCol, 0, 0.83, -0.36, { sx: 0.95, sy: 0.6, sz: 1.45 }, 12, 8);
  b.box(0.045, 0.012, 0.52, C.chrome, 0, 0.955, -0.36);
  // chamas pintadas no tanque
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      b.box(0.01, 0.04, 0.16 - i * 0.025, i % 2 ? 0xffd21e : 0xff7a00, s * 0.185, 0.82 + (i - 1.5) * 0.04, -0.52 + i * 0.03, 0, s * 0.15, 0);
    }
  }
  // motor V-twin entre os joelhos
  b.box(0.3, 0.28, 0.36, C.dchrome, 0, 0.42, -0.25);
  b.cyl(0.09, 0.1, 0.32, 10, C.chrome, 0, 0.62, -0.4, -0.5, 0, 0);
  b.cyl(0.09, 0.1, 0.32, 10, C.chrome, 0, 0.62, -0.12, 0.5, 0, 0);
  for (let i = 0; i < 4; i++) {
    b.cyl(0.115, 0.115, 0.012, 10, C.dchrome, 0, 0.56 + i * 0.04, -0.43 + i * 0.015, -0.5, 0, 0);
    b.cyl(0.115, 0.115, 0.012, 10, C.dchrome, 0, 0.56 + i * 0.04, -0.09 - i * 0.015, 0.5, 0, 0);
  }
  b.cyl(0.12, 0.12, 0.05, 12, C.chrome, 0.18, 0.45, -0.25, 0, 0, PI / 2);
  // escapamentos
  b.bar([0.2, 0.5, -0.3], [0.28, 0.32, 0.1], 0.07, C.chrome, true);
  b.bar([0.28, 0.32, 0.1], [0.3, 0.36, 1.2], 0.08, C.chrome, true);
  // quadro / garfo
  b.bar([0, 0.6, -0.55], [0, 0.98, -0.66], 0.07, 0x111111);
  for (const s of [-1, 1]) b.bar([s * 0.11, 0.98, -0.68], [s * 0.11, 0.34, -1.08], 0.045, C.chrome, true);
  // farol (nacele)
  b.cyl(0.12, 0.09, 0.16, 14, C.dchrome, 0, 0.86, -0.82, PI / 2, 0, 0);
  b.cyl(0.1, 0.1, 0.02, 14, 0xfff6c0, 0, 0.86, -0.905, PI / 2, 0, 0, { glow: true });
  for (const s of [-1, 1]) b.sph(0.04, C.dchrome, s * 0.19, 0.8, -0.84, null, 8, 6);
  // para-lama dianteiro
  b.box(0.2, 0.04, 0.5, tankCol, 0, 0.72, -1.12, 0.2, 0, 0);
  b.box(0.2, 0.04, 0.3, tankCol, 0, 0.62, -1.38, 0.7, 0, 0);
  // pedaleiras
  for (const s of [-1, 1]) b.box(0.14, 0.03, 0.3, 0x222222, s * 0.3, 0.36, -0.42);
  // console de painel no tanque
  b.box(0.36, 0.24, 0.05, C.dchrome, 0, 0.955, -0.3, -0.83, 0, 0);
  // pernas do piloto (jeans + botas)
  for (const s of [-1, 1]) {
    b.bar([s * 0.13, 0.74, 0.08], [s * 0.22, 0.74, -0.34], 0.15, C.denim);
    b.bar([s * 0.22, 0.74, -0.34], [s * 0.27, 0.42, -0.42], 0.13, C.denim);
    b.box(0.13, 0.12, 0.28, 0x2a1a10, s * 0.28, 0.4, -0.48);
  }
  const body = b.build();
  grp.add(body);

  // guidão (gira levemente com a direção)
  const bars = new THREE.Group();
  bars.position.set(0, 0.98, -0.66);
  const hb = new Builder();
  for (const s of [-1, 1]) {
    hb.bar([s * 0.08, 0, 0], [s * 0.1, 0.06, 0.04], 0.04, C.chrome, true);
    hb.bar([s * 0.1, 0.06, 0.04], [s * 0.3, 0.08, 0.18], 0.03, C.chrome, true);
    hb.bar([s * 0.3, 0.08, 0.18], [s * 0.42, 0.06, 0.26], 0.03, C.chrome, true);
    hb.bar([s * 0.38, 0.065, 0.235], [s * 0.5, 0.055, 0.31], 0.04, 0x111111, true);
    hb.bar([s * 0.3, 0.08, 0.16], [s * 0.5, 0.2, 0.12], 0.012, C.chrome, true);
    hb.cyl(0.045, 0.045, 0.02, 10, C.dchrome, s * 0.52, 0.22, 0.12, PI / 2, 0, 0);
    hb.cyl(0.037, 0.037, 0.022, 10, 0x8fa4bf, s * 0.52, 0.22, 0.125, PI / 2, 0, 0);
    hb.bar([s * 0.33, 0.08, 0.2], [s * 0.44, 0.05, 0.22], 0.012, C.chrome);
  }
  hb.box(0.2, 0.04, 0.05, C.chrome, 0, 0.0, 0.0);
  bars.add(hb.mesh());
  grp.add(bars);

  const wheel = wheelMesh(0.34, 0.14);
  wheel.position.set(0, 0.34, -1.08);
  grp.add(wheel);
  return { group: grp, bars, wheel };
}

// ---------------------------------------------------------------- cenário (geometrias p/ instancing)
export function cactusGeo() {
  const b = new Builder();
  const g = 0x3f7a3a;
  const g2 = 0x356a30;
  b.cyl(0.3, 0.36, 5, 8, g, 0, 2.5, 0);
  b.sph(0.3, g, 0, 5, 0, null, 8, 5);
  b.cyl(0.18, 0.18, 0.8, 6, g2, 0.6, 2.0, 0, 0, 0, PI / 2);
  b.cyl(0.18, 0.2, 1.4, 6, g2, 0.95, 2.65, 0);
  b.sph(0.18, g2, 0.95, 3.35, 0, null, 6, 4);
  b.cyl(0.16, 0.16, 0.6, 6, g2, -0.5, 2.8, 0, 0, 0, PI / 2);
  b.cyl(0.16, 0.18, 1.0, 6, g2, -0.75, 3.25, 0);
  b.sph(0.16, g2, -0.75, 3.75, 0, null, 6, 4);
  return b.geometry();
}
export function rockGeo() {
  const b = new Builder();
  b.ico(1, 0x9a5a3a, 0, 0.4, 0, { sx: 1.5, sy: 0.85, sz: 1.1 });
  b.ico(0.6, 0x8a4a30, 1.2, 0.2, 0.4, { sx: 1, sy: 0.7, sz: 1 });
  return b.geometry();
}
export function bushGeo() {
  const b = new Builder();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    b.cone(0.08, 0.9, 4, 0x8a7a40, Math.cos(a) * 0.15, 0.4, Math.sin(a) * 0.15, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
  }
  b.ico(0.35, 0x7a6a35, 0, 0.25, 0, { sy: 0.6 });
  return b.geometry();
}
export function poleGeo() {
  const b = new Builder();
  b.cyl(0.12, 0.15, 9, 6, 0x5a3e28, 0, 4.5, 0);
  b.box(2.4, 0.12, 0.12, 0x5a3e28, 0, 8.3, 0);
  b.box(1.6, 0.1, 0.1, 0x5a3e28, 0, 7.6, 0);
  for (const x of [-1.05, -0.4, 0.4, 1.05]) b.cyl(0.04, 0.05, 0.15, 5, 0xd8e0e8, x, 8.45, 0);
  return b.geometry();
}
export function postGeo() {
  const b = new Builder();
  b.cyl(0.05, 0.05, 2.4, 5, 0x8a8a8a, 0, 1.2, 0);
  return b.geometry();
}
export function mesaGeo() {
  const b = new Builder();
  b.cyl(14, 22, 10, 7, 0xa8583a, 0, 5, 0);
  b.box(26, 14, 22, 0xb8643f, 0, 16, 0);
  b.box(18, 6, 15, 0xc27048, 2, 26, -1);
  b.box(28, 1.5, 24, 0x9a4e33, 0, 9.5, 0);
  return b.geometry();
}
export function fencePostGeo() {
  const b = new Builder();
  b.box(0.12, 1.2, 0.12, 0x6a4e34, 0, 0.6, 0);
  b.box(0.04, 0.04, 6, 0x4a4a4a, 0, 0.9, 3);
  b.box(0.04, 0.04, 6, 0x4a4a4a, 0, 0.5, 3);
  return b.geometry();
}

export function backdrop() {
  // duas camadas de mesas distantes atrás da crista do tambor (sem fog e sem curvatura).
  // A base fica bem abaixo do horizonte; só os topos aparecem. Vão na frente pro sol.
  const b = new Builder();
  const layers = [
    { n: 34, r: [880, 980], top: [-30, 45], cols: [0xd9907c, 0xe09a82, 0xcf8676], w: [90, 200] },
    { n: 30, r: [600, 760], top: [-45, 25], cols: [0x9a5268, 0x8a4a62, 0xa25a6a], w: [60, 150] },
  ];
  for (const L of layers) {
    for (let i = 0; i < L.n; i++) {
      const a = (i / L.n) * PI * 2 + rand(-0.06, 0.06);
      const fa = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(fa) < 0.2) continue; // deixa o sol aparecer
      const r = rand(L.r[0], L.r[1]);
      const x = Math.sin(a) * r;
      const z = -Math.cos(a) * r;
      const w = rand(L.w[0], L.w[1]);
      const top = rand(L.top[0], L.top[1]);
      const base = -150;
      const H = top - base;
      const col = pick(L.cols);
      b.cyl(w * 0.45, w * 0.75, H, 6, col, x, base + H / 2, z, 0, a, 0);
      b.box(w * 0.95, 6, w * 0.6, col, x, top - 2, z, 0, a, 0);
      if (Math.random() < 0.45) b.box(w * 0.4, rand(8, 22), w * 0.35, col, x + rand(-15, 15), top + 5, z, 0, a, 0);
    }
  }
  const m = new THREE.Mesh(b.geometry(), MAT.far);
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- obstáculos e itens
export function barrel() {
  const b = new Builder();
  b.cyl(0.34, 0.34, 0.95, 10, 0xc41e1e, 0, 0.475, 0);
  b.cyl(0.35, 0.35, 0.06, 10, 0x222222, 0, 0.25, 0);
  b.cyl(0.35, 0.35, 0.06, 10, 0x222222, 0, 0.7, 0);
  b.box(0.3, 0.2, 0.02, 0xffd200, 0, 0.5, -0.34);
  b.box(0.3, 0.2, 0.02, 0xffd200, 0, 0.5, 0.34);
  return b.build();
}
export function wreck() {
  const b = new Builder();
  const col = pick([0x6a8a9a, 0x9a6a3a, 0x7a3a3a, 0x5a6a4a, 0xa89a70]);
  b.box(1.9, 0.6, 4.4, col, 0, 0.55, 0);
  b.box(1.7, 0.55, 2.2, col, 0, 1.12, 0.2);
  b.box(1.6, 0.4, 0.05, 0x22282e, 0, 1.15, -0.92, 0.4, 0, 0);
  b.box(2.0, 0.2, 0.2, C.rust, 0, 0.35, -2.25);
  b.box(2.0, 0.2, 0.2, C.rust, 0, 0.35, 2.25);
  for (const x of [-0.85, 0.85]) for (const z of [-1.4, 1.4]) b.cyl(0.33, 0.33, 0.25, 10, C.tire, x, 0.3, z, 0, 0, PI / 2);
  for (let i = 0; i < 6; i++) b.box(rand(0.2, 0.5), 0.02, rand(0.2, 0.5), C.rust, rand(-0.8, 0.8), 0.86, rand(-2, 2));
  const g = b.build();
  g.rotation.z = rand(-0.06, 0.06);
  g.rotation.y = rand(-0.3, 0.3);
  return g;
}
export function cone() {
  const b = new Builder();
  b.cone(0.18, 0.6, 8, 0xff6a00, 0, 0.32, 0);
  b.cyl(0.13, 0.15, 0.08, 8, 0xffffff, 0, 0.32, 0);
  b.box(0.45, 0.04, 0.45, 0xff6a00, 0, 0.02, 0);
  return b.build();
}
export function healthCrate() {
  const b = new Builder();
  b.box(0.5, 0.5, 0.5, 0x2f8f3a, 0, 0, 0);
  for (const s of [-1, 1]) {
    b.box(0.32, 0.1, 0.02, 0xffffff, 0, 0, s * 0.26, 0, 0, 0, { glow: true });
    b.box(0.1, 0.32, 0.02, 0xffffff, 0, 0, s * 0.26, 0, 0, 0, { glow: true });
    b.box(0.02, 0.1, 0.32, 0xffffff, s * 0.26, 0, 0, 0, 0, 0, { glow: true });
    b.box(0.02, 0.32, 0.1, 0xffffff, s * 0.26, 0, 0, 0, 0, 0, { glow: true });
  }
  return b.build();
}
export function furyPick() {
  // palheta de guitarra flamejante
  const b = new Builder();
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.32);
  sh.quadraticCurveTo(0.34, 0.05, 0.22, 0.24);
  sh.quadraticCurveTo(0, 0.36, -0.22, 0.24);
  sh.quadraticCurveTo(-0.34, 0.05, 0, -0.32);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false });
  geo.translate(0, 0, -0.03);
  b.add(geo, 0xff2a2a, 0, 0, 0, 0, 0, 0, { glow: true });
  b.add(new THREE.TorusGeometry(0.38, 0.02, 4, 16), 0xffd21e, 0, 0, 0, 0, 0, 0, { glow: true });
  return b.build();
}
export function tumbleweedGeo() {
  const b = new Builder();
  for (let i = 0; i < 9; i++) {
    b.add(new THREE.TorusGeometry(0.45, 0.02, 3, 8), 0x9a7a4a, 0, 0, 0, rand(0, PI), rand(0, PI), rand(0, PI));
  }
  return b.geometry();
}

export function billboardPosts() {
  const b = new Builder();
  for (const x of [-3.2, 3.2]) b.box(0.3, 7.5, 0.3, 0x5a3e28, x, 3.75, 0);
  b.box(9.4, 4.9, 0.25, 0x3a2a1c, 0, 5.2, 0);
  b.box(9, 0.15, 0.6, 0x4a4a4a, 0, 2.85, 0.3);
  for (const x of [-3, 0, 3]) b.bar([x, 7.6, 0.2], [x, 7.9, 0.8], 0.06, 0x333333);
  return b.mesh();
}

export function dinerBuilding() {
  const b = new Builder();
  b.box(14, 4.5, 8, 0xe8dcc0, 0, 2.25, 0);
  b.box(14.4, 0.4, 8.4, 0xc41e2a, 0, 4.6, 0);
  b.box(14.1, 0.6, 8.1, 0x2aa8a8, 0, 1.0, 0);
  for (let i = -2; i <= 2; i++) b.box(2, 1.6, 0.05, 0x20303a, i * 2.6, 2.6, 4.03);
  b.box(1.4, 2.6, 0.06, 0x5a3a20, 5.5, 1.3, 4.03);
  // bombas de gasolina
  for (const x of [-3, 3]) {
    b.box(0.8, 1.8, 0.6, 0xc41e2a, x, 0.9, 9);
    b.box(0.6, 0.4, 0.05, 0xffffff, x, 1.4, 9.31, 0, 0, 0, { glow: true });
  }
  b.box(10, 0.3, 4, 0xe8dcc0, 0, 4.2, 9);
  for (const x of [-4.5, 4.5]) b.cyl(0.12, 0.12, 4.2, 6, 0xe8dcc0, x, 2.1, 9);
  b.bar([7.5, 0, 6], [7.5, 9, 6], 0.25, 0x888888, true);
  return b.build();
}
