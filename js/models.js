// Todos os modelos 3D são procedurais (low-poly, cor por vértice). Frente = -Z.
import * as THREE from 'three';
import { Builder, MAT } from './builder.js';
import { pick, rand } from './ctx.js';

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
export function enemyBike(kind, color) {
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

export function weaponChest() {
  const b = new Builder();
  b.box(0.9, 0.5, 0.55, 0x7a4a22, 0, 0.25, 0);
  for (const y of [0.08, 0.42]) b.box(0.92, 0.06, 0.57, 0xe3b23c, 0, y, 0);
  for (const x of [-0.42, 0.42]) b.box(0.06, 0.52, 0.57, 0xe3b23c, x, 0.26, 0);
  b.box(0.12, 0.14, 0.04, 0xe3b23c, 0, 0.3, -0.29);
  const lid = new Builder();
  lid.cyl(0.275, 0.275, 0.9, 10, 0x8a5a2a, 0, 0, 0, 0, 0, PI / 2, { sy: 1, sz: 1 });
  lid.box(0.92, 0.04, 0.57, 0xe3b23c, 0, 0.0, 0);
  const g = b.build();
  const lidMesh = lid.mesh();
  lidMesh.scale.set(1, 0.6, 1);
  lidMesh.position.set(0, 0.5, 0);
  g.add(lidMesh);
  g.userData.lid = lidMesh;
  return g;
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
  let ammo = new THREE.Vector3(0, 0.07, 0.02);
  let spinner = null;
  switch (id) {
    case 'revolver':
      b.box(0.03, 0.05, 0.11, C.dchrome, 0, 0.03, -0.03);
      b.cyl(0.028, 0.028, 0.055, 8, C.chrome, 0, 0.033, -0.035, PI / 2, 0, 0);
      b.cyl(0.011, 0.011, 0.17, 8, C.chrome, 0, 0.042, -0.165, PI / 2, 0, 0);
      b.box(0.012, 0.012, 0.17, C.dchrome, 0, 0.055, -0.165);
      b.box(0.006, 0.016, 0.01, C.chrome, 0, 0.066, -0.245);
      b.box(0.032, 0.1, 0.042, C.wood, 0, -0.035, 0.03, 0.35, 0, 0);
      b.box(0.012, 0.025, 0.02, C.dchrome, 0, 0.065, 0.025);
      muzzle.set(0, 0.042, -0.255);
      break;
    case 'sawedoff':
      b.cyl(0.018, 0.018, 0.3, 8, C.steel, -0.018, 0.045, -0.17, PI / 2, 0, 0);
      b.cyl(0.018, 0.018, 0.3, 8, C.steel, 0.018, 0.045, -0.17, PI / 2, 0, 0);
      b.box(0.07, 0.06, 0.1, C.dchrome, 0, 0.04, -0.0);
      b.box(0.06, 0.04, 0.16, C.wood, 0, 0.012, -0.12);
      b.box(0.036, 0.11, 0.05, C.wood, 0, -0.04, 0.04, 0.4, 0, 0);
      muzzle.set(0, 0.045, -0.33);
      break;
    case 'uzi':
      b.box(0.046, 0.065, 0.24, 0x1a1a1a, 0, 0.035, -0.07);
      b.cyl(0.01, 0.01, 0.05, 6, C.steel, 0, 0.04, -0.21, PI / 2, 0, 0);
      b.box(0.036, 0.17, 0.04, 0x111111, 0, -0.06, 0.0, 0.1, 0, 0);
      b.box(0.01, 0.025, 0.01, 0x111111, 0, 0.075, -0.17);
      b.box(0.02, 0.02, 0.03, 0x111111, 0, 0.075, 0.03);
      muzzle.set(0, 0.04, -0.24);
      break;
    case 'magnum':
      b.box(0.042, 0.052, 0.28, C.gold, 0, 0.045, -0.085);
      b.box(0.038, 0.03, 0.2, 0x222222, 0, 0.012, -0.06);
      b.box(0.04, 0.12, 0.052, 0x222222, 0, -0.045, 0.03, 0.25, 0, 0);
      b.box(0.008, 0.016, 0.012, C.gold, 0, 0.078, -0.21);
      b.box(0.03, 0.01, 0.2, 0xffe080, 0, 0.072, -0.08);
      muzzle.set(0, 0.045, -0.23);
      ammo.set(0, 0.085, 0.03);
      break;
    case 'tommy':
      b.box(0.045, 0.06, 0.22, 0x2a2a2a, 0, 0.035, -0.06);
      b.cyl(0.018, 0.018, 0.22, 8, 0x222222, 0, 0.04, -0.28, PI / 2, 0, 0);
      for (let i = 0; i < 6; i++) b.cyl(0.024, 0.024, 0.008, 8, 0x333333, 0, 0.04, -0.2 - i * 0.025, PI / 2, 0, 0);
      b.cyl(0.06, 0.06, 0.045, 14, 0x222222, 0, -0.035, -0.1, 0, 0, PI / 2);
      b.box(0.035, 0.09, 0.04, C.wood, 0, -0.025, -0.2);
      b.box(0.036, 0.11, 0.045, C.wood, 0, -0.045, 0.03, 0.3, 0, 0);
      muzzle.set(0, 0.04, -0.4);
      break;
    case 'autoshotgun':
      b.box(0.06, 0.08, 0.36, 0x1c1c1c, 0, 0.035, -0.1);
      b.cyl(0.017, 0.017, 0.12, 8, C.steel, 0, 0.05, -0.33, PI / 2, 0, 0);
      b.cyl(0.075, 0.075, 0.06, 14, 0x2a2a2a, 0, -0.05, -0.14, 0, 0, PI / 2);
      b.box(0.04, 0.11, 0.05, 0x111111, 0, -0.045, 0.03, 0.3, 0, 0);
      b.box(0.02, 0.025, 0.12, 0x111111, 0, 0.085, -0.1);
      muzzle.set(0, 0.05, -0.39);
      break;
    case 'launcher':
      b.cyl(0.058, 0.058, 0.12, 6, 0x3a3f2a, 0, 0.03, -0.06, PI / 2, 0, 0);
      b.cyl(0.032, 0.032, 0.25, 10, C.olive, 0, 0.035, -0.24, PI / 2, 0, 0);
      b.cyl(0.036, 0.036, 0.03, 10, 0x222222, 0, 0.035, -0.36, PI / 2, 0, 0);
      b.box(0.036, 0.09, 0.04, 0x222222, 0, -0.05, -0.22);
      b.box(0.04, 0.11, 0.05, 0x222222, 0, -0.045, 0.04, 0.3, 0, 0);
      b.box(0.02, 0.05, 0.02, 0x222222, 0, 0.09, -0.1);
      muzzle.set(0, 0.035, -0.38);
      ammo.set(0, 0.1, 0.02);
      break;
    case 'bazooka':
      b.cyl(0.05, 0.05, 0.9, 12, C.olive, 0, 0.07, -0.18, PI / 2, 0, 0);
      b.cyl(0.062, 0.05, 0.1, 12, 0x2a2f1a, 0, 0.07, -0.64, PI / 2, 0, 0);
      b.cyl(0.055, 0.062, 0.12, 12, 0x2a2f1a, 0, 0.07, 0.3, PI / 2, 0, 0);
      b.cone(0.04, 0.12, 8, 0xc02020, 0, 0.07, -0.72, -PI / 2, 0, 0);
      b.box(0.02, 0.06, 0.04, 0x222222, 0, 0.14, -0.4);
      b.box(0.05, 0.05, 0.05, 0x222222, 0.06, 0.12, -0.05);
      b.box(0.012, 0.02, 0.012, 0xffd200, 0, 0.13, -0.6);
      b.box(0.036, 0.1, 0.045, 0x222222, 0, -0.03, 0.03, 0.3, 0, 0);
      b.box(0.03, 0.08, 0.04, 0x222222, 0, -0.02, -0.25);
      for (const z of [-0.45, 0.1]) b.cyl(0.053, 0.053, 0.03, 12, 0xffd200, 0, 0.07, z, PI / 2, 0, 0);
      muzzle.set(0, 0.07, -0.78);
      ammo.set(0, 0.13, 0.1);
      break;
    case 'gatling': {
      b.cyl(0.055, 0.055, 0.14, 10, 0x1c1c1c, 0, 0.04, -0.02, PI / 2, 0, 0);
      b.box(0.04, 0.12, 0.05, 0x111111, 0, -0.05, 0.04, 0.3, 0, 0);
      b.box(0.06, 0.08, 0.12, C.olive, 0.07, 0.0, -0.02);
      b.bar([0, 0.1, 0.03], [0, 0.1, -0.1], 0.02, 0x222222);
      const sb = new Builder();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        sb.cyl(0.009, 0.009, 0.34, 6, C.steel, Math.cos(a) * 0.026, Math.sin(a) * 0.026, 0, PI / 2, 0, 0);
      }
      sb.cyl(0.04, 0.04, 0.015, 10, 0x222222, 0, 0, -0.12, PI / 2, 0, 0);
      sb.cyl(0.04, 0.04, 0.015, 10, 0x222222, 0, 0, 0.1, PI / 2, 0, 0);
      spinner = sb.mesh();
      spinner.position.set(0, 0.04, -0.25);
      muzzle.set(0, 0.04, -0.43);
      ammo.set(0, 0.11, 0.0);
      break;
    }
    case 'homing': {
      // lançador de 4 tubos com mira
      b.box(0.13, 0.12, 0.34, 0x3a4030, 0, 0.08, -0.12);
      for (const [x, y] of [[-0.032, 0.05], [0.032, 0.05], [-0.032, 0.11], [0.032, 0.11]]) {
        b.cyl(0.026, 0.026, 0.36, 8, 0x22261c, x, y, -0.13, PI / 2, 0, 0);
        b.cyl(0.018, 0.018, 0.02, 8, 0xd02020, x, y, -0.31, PI / 2, 0, 0, { glow: true });
      }
      b.box(0.04, 0.06, 0.08, 0x111111, 0, 0.17, -0.05);
      b.box(0.03, 0.03, 0.03, 0xff3030, 0, 0.21, -0.05, 0, 0, 0, { glow: true });
      b.box(0.04, 0.11, 0.05, 0x111111, 0, -0.045, 0.03, 0.3, 0, 0);
      b.box(0.11, 0.02, 0.2, 0xe0c020, 0, 0.146, -0.12);
      muzzle.set(0, 0.08, -0.33);
      break;
    }
    case 'tesla': {
      // bobina tesla: espiras de cobre girando + esfera de plasma
      b.box(0.05, 0.06, 0.2, 0x2a2a30, 0, 0.03, -0.02);
      b.box(0.04, 0.11, 0.05, 0x111111, 0, -0.045, 0.04, 0.3, 0, 0);
      b.cyl(0.012, 0.012, 0.3, 6, C.chrome, 0, 0.05, -0.2, PI / 2, 0, 0);
      b.box(0.08, 0.05, 0.05, 0x40e0ff, 0, 0.075, 0.05, 0, 0, 0, { glow: true });
      const sb = new Builder();
      for (let i = 0; i < 7; i++) sb.cyl(0.042 - i * 0.003, 0.042 - i * 0.003, 0.012, 10, i % 2 ? 0xc87533 : 0xe8a050, 0, 0, 0.09 - i * 0.032, PI / 2, 0, 0);
      sb.box(0.012, 0.09, 0.012, 0x40e0ff, 0, 0, 0, 0, 0, 0, { glow: true });
      spinner = sb.build();
      spinner.position.set(0, 0.05, -0.22);
      b.sph(0.045, 0x9af4ff, 0, 0.05, -0.37, { glow: true }, 8, 6);
      b.sph(0.03, 0xffffff, 0, 0.05, -0.37, { glow: true }, 6, 4);
      muzzle.set(0, 0.05, -0.38);
      break;
    }
    case 'flyingv':
      // Flying V: guitarra laser
      b.box(0.04, 0.022, 0.46, 0x5a2a10, 0, 0.05, -0.27);
      b.box(0.06, 0.02, 0.09, 0x111111, 0, 0.05, -0.54, 0, 0.3, 0);
      for (let i = 0; i < 6; i++) b.cyl(0.006, 0.006, 0.02, 4, C.chrome, (i - 2.5) * 0.009, 0.065, -0.52 - (i % 3) * 0.02);
      for (const s of [-1, 1]) {
        b.box(0.08, 0.035, 0.34, 0xc01020, s * 0.085, 0.045, 0.1, 0, s * 0.42, 0);
        b.box(0.084, 0.006, 0.3, 0xf0f0f0, s * 0.085, 0.064, 0.09, 0, s * 0.42, 0);
      }
      b.box(0.07, 0.02, 0.04, C.chrome, 0, 0.068, 0.02);
      b.box(0.07, 0.02, 0.04, C.chrome, 0, 0.068, 0.09);
      b.box(0.036, 0.11, 0.045, 0x111111, 0, -0.045, 0.03, 0.3, 0, 0);
      b.box(0.022, 0.004, 0.5, 0x40f0ff, 0, 0.063, -0.25, 0, 0, 0, { glow: true });
      b.sph(0.02, 0x40f0ff, 0, 0.05, -0.59, { glow: true }, 6, 4);
      muzzle.set(0, 0.05, -0.6);
      ammo.set(0, 0.1, 0.06);
      break;
    default:
      break;
  }
  const model = b.build();
  if (spinner) model.add(spinner);
  const gb = new Builder();
  gloveBuilder(gb);
  const glove = gb.mesh();
  return { model, glove, muzzle, ammo, spinner };
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
