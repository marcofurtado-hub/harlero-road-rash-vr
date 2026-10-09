// Projéteis: balas inimigas (visíveis, dá pra desviar), molotovs, foguetes e granadas do jogador
import * as THREE from 'three';
import { G, rand, clamp } from './ctx.js';
import { Builder } from './builder.js';
import { toWorld, fromWorld, groundHeight } from './curve.js';
import { collectHits, dealDamage } from './weapons.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _fz = new THREE.Vector3(0, 0, 1);
const _pbHits = [];
const GRAV = 9.8;

function raySphere(o, d, c, r) {
  const lx = c.x - o.x;
  const ly = c.y - o.y;
  const lz = c.z - o.z;
  const tca = lx * d.x + ly * d.y + lz * d.z;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  return tca - Math.sqrt(r * r - d2);
}
export { raySphere };

function simpleMesh(build) {
  const b = new Builder();
  build(b);
  return b.build(true); // projéteis já voam no espaço aparente
}

export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.bullets = [];
    this.things = []; // molotovs, foguetes, granadas
    const bg = new THREE.BoxGeometry(0.07, 0.07, 0.8);
    this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xff9020, fog: false });
    this.bulletCore = new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false });
    // balas do jogador: visíveis como os ovos do Chicken Rancher, colisão por segmento varrido
    // (testa o trecho posição anterior -> atual, então bala rápida não atravessa ninguém)
    const MAXPB = 320;
    const pg = new THREE.BoxGeometry(1, 1, 1);
    pg.translate(0, 0, 0.5);
    this.pbMesh = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), MAXPB);
    this.pbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pbMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXPB * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.pbMesh.frustumCulled = false;
    this.pbMesh.count = 0;
    scene.add(this.pbMesh);
    this.pb = [];
    this.pbMax = MAXPB;
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(bg, this.bulletMat);
      const core = new THREE.Mesh(bg, this.bulletCore);
      core.scale.set(0.5, 0.5, 0.9);
      m.add(core);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.bullets.push({ m, on: false, vel: new THREE.Vector3(), prev: new THREE.Vector3(), dmg: 0, age: 0 });
    }
  }

  // bala do jogador (vel em m/s no espaço aparente)
  bullet(from, vel, o) {
    if (this.pb.length >= this.pbMax) this.pb.shift();
    this.pb.push({ p: from.clone(), prev: from.clone(), vel, dmg: o.dmg, pierce: o.pierce || 0, life: o.life || 1.2, size: o.size || 1, color: new THREE.Color(o.color || 0xffc060), proc: o.proc ?? 1, extra: o.extra || 0, hit: null });
  }

  updatePlayerBullets(dt) {
    let anyHit = false;
    let head = false;
    for (let i = this.pb.length - 1; i >= 0; i--) {
      const b = this.pb[i];
      b.life -= dt;
      b.prev.copy(b.p);
      b.p.addScaledVector(b.vel, dt);
      _v.subVectors(b.p, b.prev);
      const len = _v.length();
      let dead = b.life <= 0;
      if (!dead && len > 0) {
        _v.divideScalar(len);
        const hits = collectHits(b.prev, _v, len, _pbHits, b.extra);
        for (const h of hits) {
          const key = h.id || h.obj;
          if (b.hit && b.hit.has(key)) continue;
          const pt = new THREE.Vector3().copy(b.prev).addScaledVector(_v, h.t);
          const res = dealDamage(h, b.dmg, pt, _v, b.proc);
          if (res.enemy) {
            anyHit = true;
            if (res.head) head = true;
          }
          if (res.solid === false) continue;
          if (b.pierce > 0) {
            b.pierce--;
            (b.hit ||= new Set()).add(key);
            continue;
          }
          b.p.copy(pt);
          dead = true;
          break;
        }
        if (!dead && groundHeight(b.p) < 0) {
          G.fx.dust(b.p, 2);
          dead = true;
        }
      }
      if (dead) this.pb.splice(i, 1);
    }
    if (anyHit) {
      G.audio.play(head ? 'headshot' : 'hit');
      const h = G.player.gunHand;
      if (h) G.player.pulse(h, 0.25, 18);
    }
    // desenho: um risco brilhante por bala, alinhado com a velocidade
    const M = this.pbMesh;
    M.count = this.pb.length;
    for (let i = 0; i < this.pb.length; i++) {
      const b = this.pb[i];
      const sp = b.vel.length();
      _q.setFromUnitVectors(_fz, _v.copy(b.vel).divideScalar(-sp || 1));
      const w = 0.045 * b.size;
      _m.compose(b.p, _q, _s.set(w, w, Math.min(1.1, sp * 0.011) * b.size));
      M.setMatrixAt(i, _m);
      M.setColorAt(i, b.color);
    }
    M.instanceMatrix.needsUpdate = true;
    if (M.instanceColor) M.instanceColor.needsUpdate = true;
  }

  clear() {
    this.pb.length = 0;
    this.pbMesh.count = 0;
    for (const b of this.bullets) {
      b.on = false;
      b.m.visible = false;
    }
    for (const t of this.things) this.scene.remove(t.mesh);
    this.things.length = 0;
  }

  enemyBullet(from, vel, dmg, size = 1) {
    const b = this.bullets.find((x) => !x.on);
    if (!b) return;
    b.on = true;
    b.m.visible = true;
    b.m.position.copy(from);
    b.prev.copy(from);
    b.vel.copy(vel);
    b.dmg = dmg;
    b.age = 0;
    b.m.scale.setScalar(size);
    b.m.lookAt(_v.copy(from).add(vel));
  }

  // target em coordenadas planas do jogo (ponto na pista)
  molotov(from, target, T = 1.1) {
    target = toWorld(target.clone());
    const mesh = simpleMesh((b) => {
      b.cyl(0.05, 0.055, 0.22, 7, 0x2f6f2a, 0, 0, 0);
      b.cyl(0.02, 0.025, 0.08, 5, 0x2f6f2a, 0, 0.15, 0);
      b.cone(0.05, 0.14, 5, 0xffa020, 0, 0.24, 0, 0, 0, 0, { glow: true });
    });
    mesh.position.copy(from);
    this.scene.add(mesh);
    const vel = new THREE.Vector3(
      (target.x - from.x) / T,
      (target.y - from.y) / T + 0.5 * GRAV * T,
      (target.z - from.z) / T
    );
    this.things.push({ kind: 'molotov', mesh, vel, age: 0, r: 0.3, spin: new THREE.Vector3(rand(-8, 8), rand(-4, 4), rand(-8, 8)) });
    G.audio.play('whoosh', from);
  }

  // bomba do autogiro: cai em arco e explode no chão (dá pra estourar no ar)
  bomb(from, target, T = 1.05) {
    target = toWorld(target.clone());
    const mesh = simpleMesh((b) => {
      b.sph(0.16, 0x1a1a1a, 0, 0, 0, null, 8, 6);
      b.box(0.05, 0.08, 0.05, 0x444444, 0, 0.17, 0);
      b.sph(0.05, 0xff4020, 0, 0.23, 0, { glow: true }, 5, 4);
    });
    mesh.position.copy(from);
    this.scene.add(mesh);
    const vel = new THREE.Vector3((target.x - from.x) / T, (target.y - from.y) / T + 0.5 * GRAV * T, (target.z - from.z) / T);
    this.things.push({ kind: 'bomb', mesh, vel, age: 0, r: 0.35, spin: new THREE.Vector3(rand(-5, 5), 0, rand(-5, 5)) });
    G.audio.play('whoosh', from);
  }

  rocket(from, dir, dmg) {
    const mesh = simpleMesh((b) => {
      b.cyl(0.07, 0.07, 0.6, 8, 0x5a5f4a, 0, 0, 0, Math.PI / 2, 0, 0);
      b.cone(0.07, 0.18, 8, 0xc02020, 0, 0, -0.39, -Math.PI / 2, 0, 0);
      for (let i = 0; i < 4; i++) b.box(0.01, 0.14, 0.12, 0x333333, 0, 0, 0.25, 0, 0, (i * Math.PI) / 2);
      b.sph(0.08, 0xffc040, 0, 0, 0.34, { glow: true }, 6, 4);
    });
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.things.push({ kind: 'rocket', mesh, vel: dir.clone().multiplyScalar(14), age: 0, r: 0.42, dmg });
  }

  grenade(from, dir, S) {
    const mesh = S.straight
      ? simpleMesh((b) => {
          b.cyl(0.045, 0.045, 0.4, 8, 0x4f5a2a, 0, 0, 0, Math.PI / 2, 0, 0);
          b.cone(0.045, 0.14, 8, 0xc02020, 0, 0, -0.27, -Math.PI / 2, 0, 0);
          b.sph(0.06, 0xffc040, 0, 0, 0.22, { glow: true }, 6, 4);
        })
      : simpleMesh((b) => {
          b.sph(0.045, 0x4f5a2a, 0, 0, 0, { sz: 1.4 }, 8, 6);
          b.sph(0.03, 0xffd040, 0, 0, 0.05, { glow: true }, 5, 4);
        });
    mesh.position.copy(from);
    if (S.straight) mesh.lookAt(_v.copy(from).sub(dir));
    this.scene.add(mesh);
    this.things.push({ kind: 'grenade', mesh, vel: dir.clone().multiplyScalar(S.pspeed), age: 0, r: S.straight ? 0.35 : 0.2, dmg: S.dmg, splash: S.splash, straight: S.straight });
  }

  // rajada de mísseis teleguiados do jogador: saem abertos e depois perseguem os punks
  missiles(from, dir, S, n) {
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const taken = new Set();
    for (let i = 0; i < n; i++) {
      const mesh = simpleMesh((b) => {
        b.cyl(0.035, 0.035, 0.32, 6, 0xd8d8d0, 0, 0, 0, Math.PI / 2, 0, 0);
        b.cone(0.035, 0.1, 6, 0xd02020, 0, 0, -0.21, -Math.PI / 2, 0, 0);
        for (let k = 0; k < 4; k++) b.box(0.006, 0.08, 0.07, 0x333333, 0, 0, 0.13, 0, 0, (k * Math.PI) / 2);
        b.sph(0.045, 0xffc040, 0, 0, 0.18, { glow: true }, 5, 4);
      });
      mesh.position.copy(from);
      this.scene.add(mesh);
      const a = n > 1 ? (i / (n - 1) - 0.5) * 2 : 0;
      const vel = dir.clone().multiplyScalar(13).addScaledVector(side, a * 5).add(new THREE.Vector3(0, 2 + Math.random() * 1.5, 0));
      let target = G.enemies.acquire(from, dir, taken);
      if (target) taken.add(target);
      else target = G.enemies.acquire(from, dir);
      this.things.push({ kind: 'missile', mesh, vel, age: 0, r: 0.35, dmg: S.dmg, splash: S.splash, target });
    }
  }

  rayHits(o, d, max, out) {
    for (const t of this.things) {
      if (t.kind === 'grenade' || t.kind === 'missile' || t.dead) continue;
      const tt = raySphere(o, d, t.mesh.position, t.r + 0.1);
      if (tt >= 0 && tt < max) out.push({ t: tt, obj: this.wrap(t), part: 'proj', id: t });
    }
  }

  wrap(t) {
    return {
      takeHit: () => {
        if (t.dead) return { solid: true };
        this.burst(t, true);
        return { solid: true };
      },
    };
  }

  burst(t, shot) {
    t.dead = true;
    const p = t.mesh.position;
    if (t.kind === 'molotov') {
      G.audio.play('glass', p);
      G.fx.fire(p, 30, 0.6, 0.6);
      G.fx.burst('fire', p, 25, { speed: 4, size: 0.4, life: 0.6, up: 1, anchor: 0.5 });
      if (shot) {
        G.fx.text('MOLOTOV DE VOLTA!', _v.copy(p).add(_w.set(0, 0.6, 0)), '#ff8a20', 0.45);
        G.explode(p, 4, 70, { fire: true, quiet: true });
      } else if (groundHeight(p) < 0.4) {
        const fl = fromWorld(p.clone());
        G.hazards.fire(fl.x, fl.z);
      }
    } else if (t.kind === 'bomb') {
      G.explode(p, 4, 60, { hurtPlayer: true, playerDmg: shot ? 8 : 20 });
      if (shot) G.fx.text('BOMBA ABATIDA!', _v.copy(p).add(_w.set(0, 0.6, 0)), '#ffd21e', 0.45);
    } else if (t.kind === 'rocket') {
      G.explode(p, 3.5, shot ? 60 : 0, { hurtPlayer: !shot, playerDmg: t.dmg });
      if (shot) G.fx.text('BOOM!', _v.copy(p).add(_w.set(0, 0.6, 0)), '#ffd21e', 0.45);
    } else if (t.kind === 'grenade' || t.kind === 'missile') {
      G.explode(p, t.splash, t.dmg, { player: true });
    }
  }

  blast(p, r) {
    for (const t of this.things) {
      if (t.dead || t.kind === 'grenade' || t.kind === 'missile') continue;
      if (t.mesh.position.distanceTo(p) < r * 0.8) this.burst(t, true);
    }
  }

  update(rdt) {
    this.updatePlayerBullets(rdt);
    const P = G.player;
    // câmera lenta (power-up) segura os tiros inimigos no ar
    const dt = rdt * (G.pow.slow > 0 ? 0.35 : 1);
    for (const b of this.bullets) {
      if (!b.on) continue;
      b.age += dt;
      b.prev.copy(b.m.position);
      b.m.position.addScaledVector(b.vel, dt);
      const p = b.m.position;
      if (P.hitSegment(b.prev, p, 0.06 * b.m.scale.x)) {
        P.hurt(b.dmg, b.prev);
        b.on = false;
        b.m.visible = false;
        continue;
      }
      if (groundHeight(p) < 0.02) {
        G.fx.dust(p, 2);
        b.on = false;
        b.m.visible = false;
      } else if (p.z > 8 || b.age > 3) {
        b.on = false;
        b.m.visible = false;
      }
    }
    for (let i = this.things.length - 1; i >= 0; i--) {
      const t = this.things[i];
      if (!t.dead) {
        t.age += dt;
        const p = t.mesh.position;
        _w.copy(p);
        if (t.kind === 'bomb') {
          t.vel.y -= GRAV * dt;
          p.addScaledVector(t.vel, dt);
          t.mesh.rotation.x += t.spin.x * dt;
          t.mesh.rotation.z += t.spin.z * dt;
          if (Math.random() < 0.5) G.fx.burst('spark', p, 1, { speed: 0.5, size: 0.06, life: 0.2, anchor: 0.3 });
          if (P.hitSegment(_w, p, 0.3)) this.burst(t, false);
          else if (groundHeight(p) <= 0.15) this.burst(t, false);
        } else if (t.kind === 'molotov') {
          t.vel.y -= GRAV * dt;
          p.addScaledVector(t.vel, dt);
          t.mesh.rotation.x += t.spin.x * dt;
          t.mesh.rotation.z += t.spin.z * dt;
          if (Math.random() < 0.6) G.fx.fire(p, 1, 0.2, 0.3);
          if (P.hitSegment(_w, p, 0.25)) {
            P.hurt(16, p);
            this.burst(t, false);
          } else if (groundHeight(p) <= 0.05) this.burst(t, false);
        } else if (t.kind === 'rocket') {
          // teleguiado de leve
          const target = _v.copy(P.headW).setY(P.headW.y - 0.3);
          const want = target.sub(p).normalize().multiplyScalar(16 + t.age * 3);
          t.vel.lerp(want, clamp(dt * 1.4, 0, 1));
          p.addScaledVector(t.vel, dt);
          t.mesh.lookAt(_v.copy(p).sub(t.vel));
          G.fx.smoke(_v.copy(p), 1, 0.25);
          if (Math.random() < 0.7) G.fx.fire(p, 1, 0.2, 0.2);
          if (P.hitSegment(_w, p, 0.35)) this.burst(t, false);
          else if (groundHeight(p) <= 0.1 || t.age > 7 || p.z > 10) this.burst(t, false);
        } else if (t.kind === 'missile') {
          t.age += rdt - dt; // mísseis do jogador não sofrem a câmera lenta
          const e = t.target;
          if (!e || e.dying || e.remove) t.target = t.age > 0.1 ? G.enemies.acquire(p, _v.copy(t.vel).normalize()) : e;
          const sp = Math.min(36, 13 + t.age * 45);
          if (t.target && t.age > 0.14) {
            const want = _v.copy(t.target.sw[1] || t.target.sw[0]).sub(p).normalize().multiplyScalar(sp);
            t.vel.lerp(want, clamp(rdt * (4 + t.age * 10), 0, 1));
          } else t.vel.y -= 4 * rdt;
          p.addScaledVector(t.vel, rdt);
          t.mesh.lookAt(_v.copy(p).sub(t.vel));
          G.fx.smoke(p, 1, 0.16);
          if (Math.random() < 0.7) G.fx.fire(p, 1, 0.14, 0.2);
          if (G.enemies.proximity(p, t.r) || groundHeight(p) <= 0.05 || t.age > 4) this.burst(t, false);
        } else if (t.kind === 'grenade') {
          t.age += rdt - dt;
          if (!t.straight) t.vel.y -= GRAV * 0.55 * rdt;
          p.addScaledVector(t.vel, rdt);
          if (t.straight) {
            G.fx.smoke(_v.copy(p), 1, 0.25);
            G.fx.fire(p, 1, 0.18, 0.3);
          } else if (Math.random() < 0.8) G.fx.burst('spark', p, 1, { speed: 0.5, size: 0.06, life: 0.25, anchor: 0.2 });
          const hit = G.enemies.proximity(p, t.r);
          if (hit || groundHeight(p) <= 0.05 || t.age > 3.5) {
            this.burst(t, false);
          }
        }
      }
      if (t.dead) {
        this.scene.remove(t.mesh);
        t.mesh.traverse((o) => o.isMesh && o.geometry.dispose());
        this.things.splice(i, 1);
      }
    }
  }
}
