import * as THREE from 'three';
import { G, rand, pick } from './ctx.js';
import { makeCanvas, FB, strokeText, fitFont } from './text.js';
import { DRUM_R, toDrum, fromDrum, drumAngle } from './curve.js';

const PVS = `
attribute float psize;
attribute float palpha;
attribute vec3 pcolor;
uniform float uPx;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = pcolor;
  vAlpha = palpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = psize * uPx * projectionMatrix[1][1] / max(-mv.z, 0.05);
}`;
const PFS = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(vColor, vAlpha * (1.0 - d));
}`;

export const PX = { value: 500 };

class Particles {
  constructor(scene, max, additive) {
    this.max = max;
    this.cur = 0;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3).fill(0);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -9999;
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.anchor = new Float32Array(max);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: PX },
      vertexShader: PVS,
      fragmentShader: PFS,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 11 : 10;
    scene.add(this.points);
    this.active = 0;
  }
  emit(x, y, z, vx, vy, vz, color, s0, s1, life, grav = 0, drag = 0, anchor = 0, alpha = 1) {
    const i = this.cur;
    this.cur = (this.cur + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.col[i3] = color.r;
    this.col[i3 + 1] = color.g;
    this.col[i3 + 2] = color.b;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.size[i] = s0;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.a0[i] = alpha;
    this.alpha[i] = alpha;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.anchor[i] = anchor;
    this.dirty = true;
  }
  update(dt) {
    const speed = G.speed;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      const i3 = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i3 + 1] = -9999;
        this.alpha[i] = 0;
        continue;
      }
      const k = 1 - this.life[i] / this.maxLife[i];
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt;
      this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += (this.vel[i3 + 2] + this.anchor[i] * speed) * dt;
      if (this.grav[i] > 0) {
        // quica na superfície do tambor
        const yy = this.pos[i3 + 1] + DRUM_R;
        const zz = this.pos[i3 + 2];
        const rr = Math.sqrt(yy * yy + zz * zz);
        if (rr < DRUM_R + 0.02) {
          const k2 = (DRUM_R + 0.02) / rr;
          this.pos[i3 + 1] = yy * k2 - DRUM_R;
          this.pos[i3 + 2] = zz * k2;
          this.vel[i3 + 1] *= -0.3;
          this.anchor[i] = 1;
        }
      }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      this.alpha[i] = this.a0[i] * (1 - k * k);
    }
    if (any || this.dirty) {
      const a = this.geo.attributes;
      a.position.needsUpdate = true;
      a.pcolor.needsUpdate = true;
      a.psize.needsUpdate = true;
      a.palpha.needsUpdate = true;
      this.dirty = false;
    }
  }
}

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const COLS = {
  fire: [0xffb030, 0xff7a10, 0xffd860, 0xff5000],
  spark: [0xffe9a0, 0xffc040, 0xffffff],
  blood: [0x8a0a0a, 0x6a0505, 0xa01010],
  smoke: [0x3a3330, 0x55504a, 0x2a2624],
  dust: [0xc8a070, 0xb08a5a, 0xd8b88a],
  debris: [0x222222, 0x444444, 0x6a4a2a],
  green: [0x60ff80, 0xa0ffb0],
  cyan: [0x40f0ff, 0xa0ffff, 0xffffff],
  red: [0xff3030, 0xff8080],
};

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.add = new Particles(scene, 1800, true);
    this.norm = new Particles(scene, 1100, false);
    // traçantes
    this.tracers = [];
    const tg = new THREE.BoxGeometry(0.02, 0.02, 1);
    tg.translate(0, 0, 0.5);
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      m.frustumCulled = false;
      m.userData.t = 0;
      scene.add(m);
      this.tracers.push(m);
    }
    this.tIdx = 0;
    // bolas de explosão
    this.balls = [];
    const bg = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      m.userData.t = 0;
      scene.add(m);
      this.balls.push(m);
    }
    this.bIdx = 0;
    // anéis de choque
    this.rings = [];
    const rg = new THREE.RingGeometry(0.85, 1, 24);
    rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      m.userData.t = 0;
      scene.add(m);
      this.rings.push(m);
    }
    this.rIdx = 0;
    // textos flutuantes
    this.texts = [];
    for (let i = 0; i < 12; i++) {
      const c = makeCanvas(512, 128);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
      sp.visible = false;
      sp.renderOrder = 20;
      sp.userData = { c, tex, t: 0, life: 1 };
      scene.add(sp);
      this.texts.push(sp);
    }
    this.txIdx = 0;
  }

  burst(kind, p, n, o = {}) {
    const sys = kind === 'smoke' || kind === 'blood' || kind === 'debris' || kind === 'dust' ? this.norm : this.add;
    const cols = COLS[kind] || COLS.spark;
    const sp = o.speed ?? 4;
    for (let i = 0; i < n; i++) {
      _c.setHex(pick(cols), THREE.LinearSRGBColorSpace); // shader escreve direto no framebuffer sRGB
      let vx = rand(-1, 1);
      let vy = rand(-1, 1);
      let vz = rand(-1, 1);
      const l = Math.sqrt(vx * vx + vy * vy + vz * vz) + 0.001;
      const s = sp * rand(0.3, 1);
      vx = (vx / l) * s + (o.vx || 0);
      vy = (vy / l) * s + (o.vy || 0) + (o.up || 0);
      vz = (vz / l) * s + (o.vz || 0);
      const sz = o.size ?? 0.15;
      sys.emit(
        p.x + rand(-1, 1) * (o.spread || 0),
        p.y + rand(-1, 1) * (o.spread || 0),
        p.z + rand(-1, 1) * (o.spread || 0),
        vx, vy, vz, _c,
        sz * rand(0.6, 1.2), (o.sizeEnd ?? sz * 0.3) * rand(0.6, 1.3),
        (o.life ?? 0.5) * rand(0.6, 1.2),
        o.grav ?? 0, o.drag ?? 1, o.anchor ?? 0.7, o.alpha ?? 1
      );
    }
  }

  spark(p, n = 8) {
    this.burst('spark', p, n, { speed: 6, size: 0.06, sizeEnd: 0.01, life: 0.3, grav: 9, drag: 2, anchor: 0.3 });
  }
  blood(p, n = 10) {
    this.burst('blood', p, n, { speed: 3, size: 0.12, sizeEnd: 0.05, life: 0.6, grav: 9, drag: 1.5, anchor: 0.6 });
  }
  dust(p, n = 6) {
    this.burst('dust', p, n, { speed: 1.5, size: 0.25, sizeEnd: 0.6, life: 0.7, up: 1, drag: 2, anchor: 1, alpha: 0.6 });
  }
  smoke(p, n = 6, size = 0.6) {
    this.burst('smoke', p, n, { speed: 1.2, size, sizeEnd: size * 3, life: 1.6, up: 1.5, drag: 1, anchor: 1, alpha: 0.6, spread: 0.3 });
  }
  fire(p, n = 6, size = 0.4, anchor = 1) {
    this.burst('fire', p, n, { speed: 1.5, size, sizeEnd: size * 0.2, life: 0.5, up: 2.5, drag: 1.5, anchor, spread: 0.2 });
  }
  muzzle(p, dir, color = 'fire') {
    this.burst(color, p, 5, { speed: 2, size: 0.07, sizeEnd: 0.02, life: 0.08, vx: dir.x * 6, vy: dir.y * 6, vz: dir.z * 6, anchor: 0 });
    this.burst('smoke', p, 1, { speed: 0.3, size: 0.06, sizeEnd: 0.3, life: 0.5, up: 0.4, anchor: 0.8, alpha: 0.35 });
  }

  explosion(p, r = 4) {
    const b = this.balls[this.bIdx++ % this.balls.length];
    b.position.copy(p);
    b.userData.t = 0;
    b.userData.r = r;
    b.visible = true;
    const rg = this.rings[this.rIdx++ % this.rings.length];
    // anel no chão, tangente ao tambor
    const fl = fromDrum(p.clone());
    rg.position.copy(toDrum(fl.setY(0.08)));
    rg.rotation.set(-drumAngle(rg.position), 0, 0);
    rg.userData.t = 0;
    rg.userData.r = r;
    rg.visible = true;
    this.burst('fire', p, 40, { speed: r * 2.2, size: r * 0.28, sizeEnd: r * 0.05, life: 0.65, up: 2, drag: 3, anchor: 0.6, spread: r * 0.12 });
    this.burst('spark', p, 30, { speed: r * 4, size: 0.08, sizeEnd: 0.02, life: 0.7, grav: 12, drag: 1, anchor: 0.5 });
    this.burst('smoke', p, 18, { speed: r * 0.8, size: r * 0.35, sizeEnd: r * 0.9, life: 2.2, up: 2.5, drag: 1.2, anchor: 1, alpha: 0.55, spread: r * 0.15 });
    this.burst('debris', p, 12, { speed: r * 2.2, size: 0.12, sizeEnd: 0.1, life: 1.2, grav: 14, drag: 0.3, anchor: 0.5, up: 4 });
  }

  tracer(a, b, color = 0xffe080, life = 0.06, width = 1) {
    const m = this.tracers[this.tIdx++ % this.tracers.length];
    m.position.copy(a);
    m.lookAt(b);
    const len = a.distanceTo(b);
    m.scale.set(width, width, len);
    m.material.color.set(color);
    m.material.opacity = 1;
    m.userData.t = life;
    m.userData.life = life;
    m.visible = true;
  }

  text(str, p, color = '#ffd21e', size = 0.5, life = 1.1) {
    const sp = this.texts[this.txIdx++ % this.texts.length];
    const { c, tex } = sp.userData;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, str, 490, 84, FB);
    strokeText(g, str, 256, 64, color, '#000', 12);
    tex.needsUpdate = true;
    sp.position.copy(p);
    sp.scale.set(size * 4, size, 1);
    sp.material.opacity = 1;
    sp.userData.t = 0;
    sp.userData.life = life;
    sp.userData.size = size;
    sp.visible = true;
  }

  update(dt) {
    this.add.update(dt);
    this.norm.update(dt);
    const speed = G.speed;
    for (const m of this.tracers) {
      if (!m.visible) continue;
      m.userData.t -= dt;
      if (m.userData.t <= 0) m.visible = false;
      else m.material.opacity = m.userData.t / m.userData.life;
    }
    for (const b of this.balls) {
      if (!b.visible) continue;
      const u = b.userData;
      u.t += dt;
      const k = u.t / 0.35;
      if (k >= 1) {
        b.visible = false;
        continue;
      }
      b.scale.setScalar(u.r * (0.3 + 0.7 * Math.sqrt(k)));
      b.material.opacity = 1 - k;
      b.material.color.setRGB(1, 0.7 - k * 0.5, 0.3 - k * 0.3);
      b.position.z += speed * 0.6 * dt;
    }
    for (const r of this.rings) {
      if (!r.visible) continue;
      const u = r.userData;
      u.t += dt;
      const k = u.t / 0.45;
      if (k >= 1) {
        r.visible = false;
        continue;
      }
      r.scale.setScalar(u.r * 2 * k + 0.1);
      r.material.opacity = (1 - k) * 0.8;
      r.position.z += speed * dt;
    }
    for (const sp of this.texts) {
      if (!sp.visible) continue;
      const u = sp.userData;
      u.t += dt;
      const k = u.t / u.life;
      if (k >= 1) {
        sp.visible = false;
        continue;
      }
      sp.position.y += dt * 0.8;
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.6 : 1.2 - Math.min(0.2, (k - 0.12) * 2);
      sp.scale.set(u.size * 4 * pop, u.size * pop, 1);
      sp.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    }
  }
}
