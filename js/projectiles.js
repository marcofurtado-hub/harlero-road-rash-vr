// Projéteis: balas inimigas (visíveis, dá pra desviar), molotovs, foguetes e granadas do jogador
import * as THREE from 'three';
import { G, rand, clamp } from './ctx.js';
import { Builder } from './builder.js';
import { toWorld, fromWorld, groundHeight } from './curve.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
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

  clear() {
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

  rayHits(o, d, max, out) {
    for (const t of this.things) {
      if (t.kind === 'grenade' || t.dead) continue;
      const tt = raySphere(o, d, t.mesh.position, t.r + 0.1);
      if (tt >= 0 && tt < max) out.push({ t: tt, obj: this.wrap(t), part: 'proj' });
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
    } else if (t.kind === 'rocket') {
      G.explode(p, 3.5, shot ? 60 : 0, { hurtPlayer: !shot, playerDmg: t.dmg });
      if (shot) G.fx.text('BOOM!', _v.copy(p).add(_w.set(0, 0.6, 0)), '#ffd21e', 0.45);
    } else if (t.kind === 'grenade') {
      G.explode(p, t.splash, t.dmg, { player: true });
    }
  }

  blast(p, r) {
    for (const t of this.things) {
      if (t.dead || t.kind === 'grenade') continue;
      if (t.mesh.position.distanceTo(p) < r * 0.8) this.burst(t, true);
    }
  }

  update(dt) {
    const P = G.player;
    const speed = G.speed;
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
        if (t.kind === 'molotov') {
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
        } else if (t.kind === 'grenade') {
          if (!t.straight) t.vel.y -= GRAV * 0.55 * dt;
          p.addScaledVector(t.vel, dt);
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
