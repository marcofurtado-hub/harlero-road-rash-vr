// Construtor de modelos low-poly: junta várias primitivas numa única geometria com cor por vértice.
// Resultado: 1 draw call por peça rígida (essencial pra performance no Quest 2).
import * as THREE from 'three';
import { curveMaterial } from './curve.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export const MAT = {
  lit: curveMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })),
  glow: curveMaterial(new THREE.MeshBasicMaterial({ vertexColors: true })),
  flash: curveMaterial(new THREE.MeshBasicMaterial({ color: 0xffffff })),
  // carro queimado depois de explodir
  burnt: curveMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: 0x2a2420 })),
  // punk congelado (Bala Congelante)
  ice: curveMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: 0x9ad8ff, emissive: 0x123a5a })),
  far: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
  // sem enrolar no tambor (pra coisas que já estão no espaço aparente, ex.: projéteis)
  litFlat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  glowFlat: new THREE.MeshBasicMaterial({ vertexColors: true }),
};

export function mergeGeos(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

export class Builder {
  constructor() {
    this.lit = [];
    this.glow = [];
  }

  addM(geo, color, matrix, o) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (g.attributes.uv) g.deleteAttribute('uv');
    g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (o && o.glow ? this.glow : this.lit).push(g);
    return this;
  }

  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, o = null) {
    _e.set(rx, ry, rz, (o && o.order) || 'XYZ');
    _q.setFromEuler(_e);
    _s.set(o?.sx ?? 1, o?.sy ?? 1, o?.sz ?? 1);
    _m.compose(_p.set(x, y, z), _q, _s);
    return this.addM(geo, color, _m, o);
  }

  box(w, h, d, color, x, y, z, rx, ry, rz, o) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz, o);
  }
  cyl(rt, rb, h, seg, color, x, y, z, rx, ry, rz, o) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, rx, ry, rz, o);
  }
  cone(r, h, seg, color, x, y, z, rx, ry, rz, o) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y, z, rx, ry, rz, o);
  }
  sph(r, color, x, y, z, o, ws = 8, hs = 6) {
    return this.add(new THREE.SphereGeometry(r, ws, hs), color, x, y, z, 0, 0, 0, o);
  }
  ico(r, color, x, y, z, o, detail = 0) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, x, y, z, o?.rx || 0, o?.ry || 0, o?.rz || 0, o);
  }
  // Barra (caixa ou cilindro) de um ponto a outro — ótimo pra membros e tubos
  bar(a, b, t, color, round = false, o = null) {
    _a.set(a[0], a[1], a[2]);
    _b.set(b[0], b[1], b[2]);
    const dir = _b.clone().sub(_a);
    const len = dir.length();
    dir.normalize();
    _q.setFromUnitVectors(UP, dir);
    _p.copy(_a).add(_b).multiplyScalar(0.5);
    _m.compose(_p, _q, _s.set(1, 1, 1));
    const geo = round ? new THREE.CylinderGeometry(t / 2, t / 2, len, 6) : new THREE.BoxGeometry(t, len, t);
    return this.addM(geo, color, _m, o);
  }

  geometry(which = 'lit') {
    return mergeGeos(this[which]);
  }

  build(flat = false) {
    const grp = new THREE.Group();
    grp.userData.meshes = [];
    if (this.lit.length) {
      const mat = flat ? MAT.litFlat : MAT.lit;
      const m = new THREE.Mesh(mergeGeos(this.lit), mat);
      m.userData.baseMat = mat;
      grp.add(m);
      grp.userData.meshes.push(m);
    }
    if (this.glow.length) {
      const mat = flat ? MAT.glowFlat : MAT.glow;
      const m = new THREE.Mesh(mergeGeos(this.glow), mat);
      m.userData.baseMat = mat;
      grp.add(m);
      grp.userData.meshes.push(m);
    }
    return grp;
  }

  mesh() {
    const m = new THREE.Mesh(mergeGeos(this.lit), MAT.lit);
    m.userData.baseMat = MAT.lit;
    return m;
  }
}
