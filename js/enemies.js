import * as THREE from 'three';
import { G, rand, pick, clamp, damp, lerp, chance } from './ctx.js';
import * as Models from './models.js';
import { MAT } from './builder.js';
import { toWorld, curveMaterial } from './curve.js';
import { ROAD_HALF } from './world.js';
import { raySphere } from './projectiles.js';

const V = THREE.Vector3;
const _v = new V();
const _l = new V();
const _t = new V();
const _b = new THREE.Vector2();
const _q = new THREE.Quaternion();

export const TYPES = {
  punk: {
    name: 'Punk', hp: 55, score: 100, cost: 1, minWave: 1, w: 6, lat: 5, ai: 'shooter', range: [-26, -7],
    look: { bike: 'dirt', hair: ['mohawk', 'spikes', 'mohawk'], weapon: 'pistol' },
    fire: { every: [1.8, 2.8], burst: 1, gap: 0, speed: 32, dmg: 6, spread: 1.1, sfx: 'enemy' },
  },
  rammer: {
    name: 'Correntão', hp: 85, score: 150, cost: 2, minWave: 2, w: 4, lat: 6.5, ai: 'rammer',
    look: { bike: 'standard', hair: ['bald', 'bandana'], weapon: 'bat', bulk: 1.15, beard: true, spikes: true },
    melee: { dmg: 9, every: 1.3 },
  },
  torch: {
    name: 'Tocha', hp: 65, score: 175, cost: 2, minWave: 3, w: 3, lat: 4, ai: 'thrower', range: [-34, -20],
    look: { bike: 'dirt', hair: ['bandana', 'mohawk'], weapon: 'molotov' },
    throwEvery: [2.8, 4.2],
  },
  kamikaze: {
    name: 'Dinamite', hp: 40, score: 200, cost: 1.5, minWave: 4, w: 2.2, lat: 5.5, ai: 'kamikaze',
    look: { bike: 'dirt', hair: ['helmet'], weapon: 'dynamite' },
  },
  sidecar: {
    name: 'Dupla Sidecar', hp: 190, score: 320, cost: 3, minWave: 5, w: 2.5, lat: 3.5, ai: 'shooter', range: [-20, -7],
    look: { bike: 'sidecar', hair: ['mohawk', 'bandana', 'cowboy'], weapon: 'smg', gunner: true },
    fire: { every: [2.3, 3.3], burst: 5, gap: 0.09, speed: 40, dmg: 5, spread: 1.3, sfx: 'enemy' },
  },
  hog: {
    name: 'Brutamontes', hp: 420, score: 650, cost: 5, minWave: 6, w: 1.6, lat: 3, ai: 'shooter', armor: 0.5, range: [-14, -6],
    look: { bike: 'chopper', hair: ['cowboy', 'helmet', 'bald'], weapon: 'shotgun', bulk: 1.45, beard: true, spikes: true },
    fire: { every: [2.4, 3.4], burst: 1, gap: 0, pellets: 7, speed: 32, dmg: 5, spread: 2.2, sfx: 'enemyShotgun' },
  },
  sniper: {
    name: 'Caveira', hp: 75, score: 350, cost: 3, minWave: 7, w: 1.8, lat: 3, ai: 'sniper', range: [-46, -30],
    look: { bike: 'standard', hair: ['skull'], weapon: 'rifle' },
  },
};

export const BOSS_NAMES = ['BIG MAMA E SUA PICAPE', 'O REI DA ROTA 66', 'CAMINHÃO DO CAPETA', 'O XERIFE CORRUPTO'];

// aponta o -Z do objeto pro alvo (no espaço do pai)
function aimAt(obj, target, maxYaw = Math.PI, maxPitch = 1.2) {
  const parent = obj.parent;
  _l.copy(target);
  parent.worldToLocal(_l);
  _l.sub(obj.position);
  const yaw = clamp(Math.atan2(-_l.x, -_l.z), -maxYaw, maxYaw);
  const pitch = clamp(Math.atan2(_l.y, Math.hypot(_l.x, _l.z)), -maxPitch, maxPitch);
  obj.rotation.set(pitch, yaw, 0, 'YXZ');
}

// coordenada plana do jogo -> posição aparente no tambor
const apparent = toWorld;

function collectMeshes(root) {
  const list = [];
  root.traverse((o) => {
    if (o.isMesh && o.userData.baseMat) list.push(o);
  });
  return list;
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.isMesh && !o.userData.shared) o.geometry.dispose();
  });
}

function makeHpBar(w) {
  const g = new THREE.PlaneGeometry(w, 0.07);
  g.translate(w / 2, 0, 0);
  const bar = new THREE.Mesh(g, curveMaterial(new THREE.MeshBasicMaterial({ color: 0xff3030, depthTest: false, transparent: true, fog: false })));
  bar.position.x = -w / 2;
  const holder = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.04, 0.11), curveMaterial(new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, transparent: true, opacity: 0.6, fog: false })));
  holder.add(bg);
  holder.add(bar);
  bar.renderOrder = 6;
  bg.renderOrder = 5;
  holder.visible = false;
  holder.userData.bar = bar;
  return holder;
}

class Base {
  setFlash(on) {
    const ice = this.slowT > 0;
    this.tinted = ice;
    for (const m of this.meshes) m.material = on ? MAT.flash : ice && m.userData.baseMat === MAT.lit ? MAT.ice : m.userData.baseMat;
  }
  // fogo e gelo (habilidades) + câmera lenta (power-up); devolve o multiplicador de tempo
  tickStatus(dt) {
    let k = 1;
    if (this.slowT > 0) {
      this.slowT -= dt;
      k = this.slowMul || 0.6;
      if (Math.random() < 0.15) G.fx.burst('ice', this.sw[1], 1, { speed: 1, size: 0.12, life: 0.5, grav: 3, anchor: 1 });
    }
    if ((this.slowT > 0) !== !!this.tinted && !(this.flashT > 0)) this.setFlash(false);
    if (this.burnT > 0) {
      this.burnT -= dt;
      if (Math.random() < 0.6) G.fx.fire(this.sw[1], 1, 0.3, 0.7);
      this.burnTick = (this.burnTick || 0.5) - dt;
      if (this.burnTick <= 0) {
        this.burnTick = 0.5;
        this.takeHit(this.burnDps * 0.5, 'burn', this.sw[1].clone(), null);
      }
      if (this.burnT <= 0) this.burnDps = 0;
    }
    return k * (G.pow.slow > 0 ? 0.35 : 1);
  }
  updateSpheres() {
    for (let i = 0; i < this.spheres.length; i++) {
      const s = this.spheres[i];
      const w = this.sw[i].copy(s.local);
      s.obj.localToWorld(w);
      apparent(w);
    }
  }
  rayHits(o, d, max, out) {
    if (this.dying) return;
    let best = Infinity;
    let bi = -1;
    let headT = Infinity;
    let headI = -1;
    for (let i = 0; i < this.spheres.length; i++) {
      const s = this.spheres[i];
      if (s.off) continue;
      const t = raySphere(o, d, this.sw[i], s.r);
      if (t < 0) continue;
      if (t < best) {
        best = t;
        bi = i;
      }
      if (s.part === 'head' && t < headT) {
        headT = t;
        headI = i;
      }
    }
    if (headI >= 0 && headT - best < 0.3) {
      best = headT;
      bi = headI;
    }
    if (bi >= 0 && best < max) out.push({ t: best, obj: this, part: this.spheres[bi].part, si: bi });
  }
  center(out) {
    return out.set(this.x, 1.1, this.z);
  }
  billboardBar(y) {
    const bar = this.hpBar;
    if (this.hp < this.maxHp && !this.dying) {
      bar.visible = true;
      bar.userData.bar.scale.x = Math.max(0.001, this.hp / this.maxHp);
      bar.position.set(0, y, 0);
      this.root.getWorldQuaternion(_q).invert();
      bar.quaternion.copy(_q).multiply(G.camera.getWorldQuaternion(new THREE.Quaternion()));
    } else bar.visible = false;
  }
  destroy() {
    G.scene.remove(this.root);
    disposeTree(this.root);
    if (this.riders) for (const r of this.riders) if (r.group.parent) {
      r.group.parent.remove(r.group);
      disposeTree(r.group);
    }
    if (this.laserBeam) G.scene.remove(this.laserBeam);
  }
}

// ======================================================================= MOTOQUEIRO
export class Enemy extends Base {
  constructor(type, opts = {}) {
    super();
    const T = (this.T = TYPES[type]);
    this.type = type;
    const w = Math.max(1, G.wave);
    this.maxHp = this.hp = T.hp * (1 + 0.14 * (w - 1));
    this.dmgMul = 1 + 0.07 * (w - 1);
    this.acc = Math.max(0.45, 1 - 0.035 * (w - 1));
    this.smart = chance(0.7);
    this.build();
    const P = G.player;
    const behind = opts.from === 'behind';
    this.x = opts.x ?? clamp(P.x + rand(-6, 6), -7, 7);
    this.z = opts.z ?? (behind ? rand(32, 42) : rand(-170, -140));
    this.side = this.x >= P.x ? 1 : -1;
    this.entering = true;
    this.vx = 0;
    this.vz = 0;
    this.pickTarget();
    this.fireT = rand(1.2, 2.6);
    this.burstLeft = 0;
    this.burstT = 0;
    this.throwT = rand(1.5, 3);
    this.windT = 0;
    this.meleeT = 0.5;
    this.swingT = 0;
    this.ramT = 0;
    this.ramCD = rand(2, 4);
    this.bumpT = 0;
    this.beepT = 0;
    this.snState = 'idle';
    this.snT = rand(1.5, 2.5);
    this.age = 0;
    this.flashT = 0;
    this.dying = false;
    this.remove = false;
    this.root.position.set(this.x, 0, this.z);
    G.scene.add(this.root);
  }

  build() {
    const L = this.T.look;
    const color = pick(Models.GANG);
    this.root = new THREE.Group();
    const bike = Models.enemyBike(L.bike, color);
    this.bikeBody = bike.body;
    this.root.add(bike.body);
    this.wr = bike.wr;
    this.fw = Models.wheelMesh(bike.wr, 0.14);
    this.fw.userData.shared = true;
    this.fw.position.set(0, bike.wr, bike.fz);
    this.rw = Models.wheelMesh(bike.wr, L.bike === 'chopper' ? 0.26 : 0.17);
    this.rw.userData.shared = true;
    this.rw.position.set(0, bike.wr, bike.rz);
    this.root.add(this.fw, this.rw);
    const k = L.bulk || 1;
    const common = {
      skin: pick(Models.SKINS), jacket: pick(Models.JACKETS), pants: pick(Models.PANTS), patch: color,
      hairColor: pick(Models.NEON), bulk: k, beard: L.beard, spikes: L.spikes,
      barY: L.bike === 'chopper' ? 1.42 : 1.08, beardColor: pick([0x3a2a1a, 0x6a4a2a, 0xaaaaaa, 0x1a1a1a]),
    };
    this.rider = Models.rider({ ...common, hair: pick(L.hair), weapon: L.gunner ? null : L.weapon });
    this.root.add(this.rider.group);
    this.riders = [this.rider];
    if (L.gunner) {
      this.gunner = Models.rider({ ...common, skin: pick(Models.SKINS), hair: pick(L.hair), hairColor: pick(Models.NEON), weapon: L.weapon, x: 0.88, seatY: 0.62, pose: 'sit', bulk: 1, beard: false, spikes: false });
      this.root.add(this.gunner.group);
      this.riders.push(this.gunner);
    }
    this.shooter = this.gunner || this.rider;
    this.spheres = [
      { obj: this.rider.head, local: new V(0, 0.15, 0), r: 0.17 * k, part: 'head' },
      { obj: this.rider.group, local: new V(0, 0.12, 0.06), r: 0.32 * k, part: 'body' },
      { obj: this.root, local: new V(0, 0.55, -0.35), r: 0.5, part: 'bike' },
      { obj: this.root, local: new V(0, 0.55, 0.4), r: 0.5, part: 'bike' },
    ];
    if (this.gunner) {
      this.spheres.push({ obj: this.gunner.head, local: new V(0, 0.15, 0), r: 0.17, part: 'head' });
      this.spheres.push({ obj: this.gunner.group, local: new V(0, 0.12, 0.06), r: 0.3, part: 'body' });
      this.spheres.push({ obj: this.root, local: new V(0.88, 0.55, -0.05), r: 0.45, part: 'bike' });
    }
    this.sw = this.spheres.map(() => new V());
    this.meshes = collectMeshes(this.root);
    this.hpBar = makeHpBar(0.8);
    this.root.add(this.hpBar);
    if (this.T.ai === 'sniper') {
      const g = new THREE.BoxGeometry(0.012, 0.012, 1);
      g.translate(0, 0, 0.5);
      this.laserBeam = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff1010, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      this.laserBeam.visible = false;
      this.laserBeam.frustumCulled = false;
      G.scene.add(this.laserBeam);
      this.aimPt = new V();
    }
  }

  pickTarget() {
    const T = this.T;
    this.retarget = rand(2.5, 5);
    const r = T.range || [-20, -8];
    this.offZ = rand(r[0], r[1]);
    if (this.type === 'punk' && chance(0.15)) this.offZ = rand(4, 9); // alguns vêm por trás
    this.offX = (chance(0.5) ? -1 : 1) * rand(2.5, 6.5);
  }

  update(dt) {
    if (this.dying) {
      this.updateDeath(dt);
      return;
    }
    dt *= this.tickStatus(dt);
    if (this.dying) return;
    const P = G.player;
    const T = this.T;
    this.age += dt;
    this.retarget -= dt;
    this.bumpT -= dt;
    if (this.retarget <= 0) this.pickTarget();
    let tx = P.x + this.offX;
    let tz = this.offZ;
    let maxRel = 9;
    if (T.ai === 'rammer') {
      this.ramT -= dt;
      tx = P.x + this.side * (this.ramT > 0 ? 0.9 : 1.85);
      tz = -0.3;
      maxRel = 11;
    } else if (T.ai === 'kamikaze') {
      tx = P.x;
      tz = 3;
      maxRel = 21;
    }
    if (this.fleeing) {
      tz = -240;
      maxRel = 25;
    }
    if (this.entering && !this.fleeing) maxRel = Math.max(maxRel, 15);
    for (const o of G.enemies.list) {
      if (o === this || o.dying || o.isBoss) continue;
      const dx = this.x - o.x;
      const dz = this.z - o.z;
      if (Math.abs(dz) < 3.6 && Math.abs(dx) < 1.8) tx += (dx >= 0 ? 1 : -1) * 2.4;
    }
    if (T.ai !== 'rammer' && T.ai !== 'kamikaze' && Math.abs(this.z) < 5 && Math.abs(this.x - P.x) < 2.3) tx = P.x + (this.x >= P.x ? 3.2 : -3.2);
    if (this.smart && T.ai !== 'kamikaze') {
      const ax = G.hazards.avoid(this);
      if (ax !== null) tx = ax;
    }
    tx = clamp(tx, -ROAD_HALF + 0.5, ROAD_HALF - 0.5);
    const desVx = clamp((tx - this.x) * 1.8, -T.lat, T.lat);
    this.vx = damp(this.vx, desVx, 3.5, dt);
    this.x = clamp(this.x + this.vx * dt, -ROAD_HALF, ROAD_HALF);
    const desVz = clamp((tz - this.z) * 0.9, -maxRel, maxRel);
    this.vz = damp(this.vz, desVz, 1.8, dt);
    this.z += this.vz * dt;
    if (this.entering && Math.abs(this.z - tz) < 8) this.entering = false;
    if (this.fleeing && this.z < -220) this.remove = true;

    // contato com o jogador
    const dxp = this.x - P.x;
    if (Math.abs(this.z) < 1.5 && Math.abs(dxp) < 1.05 && this.bumpT <= 0) {
      this.bumpT = 0.8;
      const s = dxp >= 0 ? 1 : -1;
      this.vx = s * 6;
      P.push(-s * (T.ai === 'rammer' ? 7 : 4));
      P.hurt(T.ai === 'rammer' ? 9 * this.dmgMul : 4, this.root.position);
      G.audio.play('crash', this.root.position);
      G.fx.spark(_v.set((this.x + P.x) / 2, 0.7, 0), 16);
    }

    // visual
    const absSpeed = G.speed - this.vz;
    this.fw.rotation.x -= (absSpeed * dt) / this.wr;
    this.rw.rotation.x = this.fw.rotation.x;
    this.root.position.set(this.x, Math.sin(this.age * 23) * 0.008, this.z);
    this.root.rotation.set(0, -this.vx * 0.04, -this.vx * 0.05);
    if (Math.random() < 0.12) G.fx.dust(apparent(_v.set(this.x, 0.1, this.z + 0.9)), 1);
    this.root.updateMatrixWorld(true);
    this.look();
    this.updateSpheres();
    if (!this.fleeing) this['ai_' + T.ai](dt);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.setFlash(this.flashT > 0);
    }
    this.billboardBar(2.1 * (this.T.look.bulk || 1));
  }

  look() {
    const P = G.player;
    _t.copy(P.headW);
    const sh = this.shooter;
    aimAt(sh.head, _t, 2.2, 0.5);
    if (this.rider !== sh) aimAt(this.rider.head, _t, 1.4, 0.4);
    if (sh.arm && this.T.ai === 'shooter') {
      // só mira no jogador logo antes de atirar (aviso pra desviar); no resto do tempo sacode a arma pro alto
      const aiming = this.burstLeft > 0 || this.fireT < 0.55;
      this.aimK = damp(this.aimK || 0, aiming ? 1 : 0, 10, 1 / 60);
      if (this.aimK > 0.5) {
        _t.y -= 0.3;
        aimAt(sh.arm, _t, Math.PI, 1.3);
      } else {
        const w = Math.sin(this.age * 7 + this.root.id) * 0.25;
        sh.arm.rotation.set(1.05 + w, -0.85 + w * 0.5, 0.3, 'YXZ');
      }
    }
  }

  muzzleWorld(out) {
    this.shooter.muzzle.getWorldPosition(out);
    return apparent(out);
  }

  // ---------------------------------------------------------- comportamentos
  ai_shooter(dt) {
    const F = this.T.fire;
    this.fireT -= dt;
    if (this.burstLeft <= 0 && this.fireT <= 0 && !this.entering && this.z < 12 && this.z > -55) {
      this.burstLeft = F.burst;
      this.burstT = 0;
      this.fireT = rand(F.every[0], F.every[1]) / G.aggro;
    }
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.shoot(F);
        this.burstLeft--;
        this.burstT = F.gap;
      }
    }
  }

  shoot(F) {
    const P = G.player;
    const from = this.muzzleWorld(new V());
    const tgt = new V().copy(P.headW);
    tgt.y -= 0.3;
    const tFlight = from.distanceTo(tgt) / F.speed;
    tgt.x += P.vx * tFlight * 0.6;
    const n = F.pellets || 1;
    const sp = F.spread * this.acc;
    for (let i = 0; i < n; i++) {
      const t2 = tgt.clone();
      t2.x += rand(-1, 1) * sp;
      t2.y += rand(-0.6, 0.6) * sp;
      const vel = t2.sub(from).normalize().multiplyScalar(F.speed * rand(0.95, 1.05));
      G.proj.enemyBullet(from, vel, F.dmg * this.dmgMul, n > 1 ? 0.75 : 1);
    }
    G.fx.muzzle(from, _v.copy(tgt).sub(from).normalize());
    G.audio.gun(F.sfx, from);
  }

  ai_rammer(dt) {
    const P = G.player;
    const arm = this.shooter.arm;
    this.meleeT -= dt;
    this.ramCD -= dt;
    const close = Math.abs(this.z) < 2.3 && Math.abs(this.x - P.x) < 2.7;
    _t.copy(P.headW);
    _t.y -= 0.4;
    aimAt(arm, _t, Math.PI, 1.3);
    if (this.swingT > 0) {
      this.swingT -= dt;
      const k = 1 - this.swingT / 0.4;
      arm.rotation.x += lerp(1.3, -0.8, k);
      if (!this.swingHit && k > 0.5) {
        this.swingHit = true;
        if (close) {
          P.hurt(this.T.melee.dmg * this.dmgMul, this.root.position);
          G.fx.spark(_v.copy(P.headW).add(_l.set(this.side * 0.3, -0.5, 0)), 14);
          G.audio.play('metal', this.root.position);
        }
      }
    } else arm.rotation.x += 0.9 + Math.sin(this.age * 6) * 0.15;
    if (close && this.meleeT <= 0 && this.swingT <= 0) {
      this.swingT = 0.4;
      this.swingHit = false;
      this.meleeT = this.T.melee.every / G.aggro;
      G.audio.play('whoosh', this.root.position);
    }
    if (this.ramCD <= 0 && close) {
      this.ramT = 0.6;
      this.ramCD = rand(3, 5);
    }
  }

  ai_thrower(dt) {
    const P = G.player;
    const arm = this.shooter.arm;
    this.throwT -= dt;
    _t.copy(P.headW);
    aimAt(arm, _t, Math.PI, 0.5);
    if (this.windT > 0) {
      this.windT -= dt;
      const k = 1 - this.windT / 0.5;
      arm.rotation.x += lerp(0.4, 2.4, k);
      if (this.windT <= 0) {
        const from = this.muzzleWorld(new V());
        const land = new V(clamp(P.x + rand(-1.2, 1.2) + P.vx * 0.4, -7.5, 7.5), 0, -rand(14, 22));
        G.proj.molotov(from, land, 1.1);
      }
    } else arm.rotation.x += 0.3;
    if (this.throwT <= 0 && this.windT <= 0 && !this.entering && this.z < -8 && this.z > -45) {
      this.windT = 0.5;
      this.throwT = rand(this.T.throwEvery[0], this.T.throwEvery[1]) / G.aggro;
    }
  }

  ai_kamikaze(dt) {
    const P = G.player;
    const arm = this.shooter.arm;
    arm.rotation.set(1.4 + Math.sin(this.age * 12) * 0.2, 0, 0);
    this.shooter.muzzle.getWorldPosition(_v);
    G.fx.burst('spark', apparent(_v), 1, { speed: 2, size: 0.06, life: 0.25, anchor: 0.2 });
    const d = Math.hypot(this.x - P.x, this.z);
    this.beepT -= dt;
    if (this.beepT <= 0) {
      this.beepT = clamp(d / 45, 0.08, 0.7);
      G.audio.play('beep', this.root.position);
    }
    if (d < 2.4 || this.z > 4) this.detonate(false);
  }

  ai_sniper(dt) {
    const P = G.player;
    const L = this.laserBeam;
    this.snT -= dt;
    _t.copy(P.headW);
    const arm = this.shooter.arm;
    if (this.snState === 'idle' || this.z < -60) {
      L.visible = false;
      _t.y -= 0.3;
      aimAt(arm, _t, Math.PI, 1.3);
      if (this.snT <= 0 && !this.entering && this.z < -10) {
        this.snState = 'aim';
        this.snT = 1.7;
        this.aimPt.copy(P.headW).add(_l.set(rand(-2, 2), rand(-1, 1), 0));
      }
      return;
    }
    if (this.snState === 'aim') this.aimPt.lerp(P.headW, 1 - Math.exp(-3.5 * dt));
    aimAt(arm, this.aimPt, Math.PI, 1.3);
    const from = this.muzzleWorld(new V());
    L.visible = true;
    L.position.copy(from);
    L.lookAt(this.aimPt);
    L.scale.set(1, 1, from.distanceTo(this.aimPt) + 4);
    if (this.snState === 'aim') {
      L.material.opacity = 0.25;
      if (this.snT <= 0) {
        this.snState = 'lock';
        this.snT = 0.45;
        G.audio.play('charge', this.root.position);
      }
    } else if (this.snState === 'lock') {
      L.material.opacity = Math.sin(G.time * 50) > 0 ? 0.95 : 0.5;
      L.scale.x = L.scale.y = 2;
      if (this.snT <= 0) {
        const vel = new V().copy(this.aimPt).sub(from).normalize().multiplyScalar(140);
        G.proj.enemyBullet(from, vel, 20 * this.dmgMul, 1.3);
        G.audio.gun('sniper', from);
        G.fx.muzzle(from, vel.clone().normalize());
        this.snState = 'idle';
        this.snT = rand(2.5, 4) / G.aggro;
        L.visible = false;
      }
    }
  }

  // ---------------------------------------------------------- dano e morte
  takeHit(dmg, part, pt, dir) {
    if (this.dying) return { solid: false };
    let mult = 1;
    if (part === 'head') mult = G.player.stats.critMul;
    else if (part === 'bike') mult = 0.7;
    else if (part === 'body' && this.T.armor) mult = this.T.armor;
    this.hp -= dmg * mult;
    this.flashT = 0.06;
    this.setFlash(true);
    if (part === 'bike' || (part === 'body' && this.T.armor)) {
      G.fx.spark(pt, 6);
      G.audio.play('metal', pt);
    } else if (part === 'zap') G.fx.burst('cyan', pt, 5, { speed: 3, size: 0.08, life: 0.25, anchor: 0.5 });
    else if (part !== 'blast' && part !== 'burn') G.fx.blood(pt, part === 'head' ? 14 : 7);
    if (dir) this.vx += dir.x * 0.6;
    if (this.hp <= 0) this.die({ headshot: part === 'head', blast: part === 'blast', zap: part === 'zap', burn: part === 'burn' });
    return { solid: true, enemy: true, head: part === 'head', kill: this.dying };
  }

  die(info = {}) {
    if (this.dying) return;
    this.dying = true;
    this.deathT = 0;
    this.boomAt = rand(0.35, 0.7);
    this.boomed = false;
    this.setFlash(false);
    this.hpBar.visible = false;
    if (this.laserBeam) this.laserBeam.visible = false;
    G.onKill(this, info);
    if (this.T.ai === 'kamikaze') {
      this.detonate(true);
      return;
    }
    for (const r of this.riders) {
      const g = r.group;
      G.scene.attach(g);
      g.userData.vel = new V(rand(-2, 2) + this.vx * 0.4, rand(2.5, 5), rand(-1, 3));
      g.userData.av = new V(rand(-6, 6), rand(-3, 3), rand(-6, 6));
      g.userData.ground = false;
    }
    this.av = rand(2, 5) * (chance(0.5) ? -1 : 1);
    G.audio.play('crash', this.root.position);
  }

  detonate(killed) {
    const p = apparent(new V(this.x, 0.9, this.z));
    this.dying = true;
    this.boomed = true;
    this.deathT = 99;
    this.remove = true;
    G.explode(p, killed ? 5 : 4.5, killed ? 140 : 110, { hurtPlayer: true, playerDmg: killed ? 16 : 24 * this.dmgMul });
  }

  updateDeath(dt) {
    this.deathT += dt;
    this.vz = damp(this.vz, G.speed, 1.5, dt);
    this.z += this.vz * dt;
    this.x += this.vx * dt;
    this.vx = damp(this.vx, 0, 1, dt);
    this.root.rotation.z = clamp(this.root.rotation.z + this.av * dt, -1.45, 1.45);
    this.root.position.set(this.x, 0, this.z);
    if (!this.boomed && this.deathT > this.boomAt) {
      this.boomed = true;
      G.explode(apparent(new V(this.x, 0.7, this.z)), 3.2, 55, { hurtPlayer: true, playerDmg: 8 });
      this.bikeBody.visible = false;
      this.fw.visible = this.rw.visible = false;
    }
    if (this.boomed && Math.random() < 0.3) G.fx.smoke(apparent(_v.set(this.x, 0.4, this.z)), 1, 0.7);
    let allGone = true;
    for (const r of this.riders) {
      const g = r.group;
      const u = g.userData;
      if (!u.vel) continue;
      if (!u.ground) {
        u.vel.y -= 14 * dt;
        g.position.addScaledVector(u.vel, dt);
        g.rotation.x += u.av.x * dt;
        g.rotation.y += u.av.y * dt;
        g.rotation.z += u.av.z * dt;
        if (g.position.y < 0.3) {
          g.position.y = 0.3;
          u.vel.y = Math.abs(u.vel.y) * 0.3;
          u.av.multiplyScalar(0.5);
          G.fx.dust(apparent(_v.copy(g.position)), 5);
          if (u.vel.y < 1.2) u.ground = true;
        }
      } else {
        u.vel.z = damp(u.vel.z, G.speed, 3, dt);
        u.vel.x = damp(u.vel.x, 0, 2, dt);
        g.position.addScaledVector(u.vel, dt);
        g.rotation.x = damp(g.rotation.x, Math.PI / 2, 4, dt);
        g.rotation.z = damp(g.rotation.z, 0, 4, dt);
        g.position.y = 0.25;
      }
      if (g.position.z < 45) allGone = false;
    }
    if (this.deathT > 6 || (this.z > 45 && allGone)) this.remove = true;
  }
}

// ======================================================================= CHEFÃO
export class Boss extends Base {
  constructor(idx) {
    super();
    this.isBoss = true;
    this.idx = idx;
    this.T = { name: 'CHEFÃO', score: 5000 + idx * 2500 };
    this.name = BOSS_NAMES[idx % BOSS_NAMES.length];
    this.maxHp = this.hp = 2600 * (1 + 0.6 * idx) * (1 + 0.04 * G.wave);
    this.dmgMul = 1 + 0.07 * (G.wave - 1);
    const color = pick([0x7a1010, 0x22252a, 0x4a2a7a, 0x2a5a2a]);
    const m = Models.bossTruck(color);
    this.root = new THREE.Group();
    this.root.add(m.body, m.front, m.rear);
    this.front = m.front;
    this.rear = m.rear;
    this.tanks = m.tanks.map((t) => {
      this.root.add(t);
      return { mesh: t, hp: 260 * (1 + 0.4 * idx), alive: true };
    });
    this.gunner = Models.rider({
      skin: pick(Models.SKINS), jacket: 0x1a1a1a, pants: 0x222222, patch: color, hair: pick(['skull', 'helmet', 'mohawk']),
      hairColor: pick(Models.NEON), weapon: 'gatling', pose: 'sit', seatY: 1.42, bulk: 1.3, beard: true, spikes: true,
    });
    this.gunner.group.position.z += 1.35;
    this.gunner.group.rotation.y = Math.PI;
    this.root.add(this.gunner.group);
    this.shooter = this.gunner;
    this.riders = [];
    this.spheres = [
      { obj: this.gunner.head, local: new V(0, 0.15, 0), r: 0.22, part: 'head' },
      { obj: this.gunner.group, local: new V(0, 0.12, 0.06), r: 0.42, part: 'body' },
      { obj: this.root, local: new V(0, 1.9, -0.5), r: 1.15, part: 'body' },
      { obj: this.root, local: new V(0, 1.4, -2.2), r: 1.0, part: 'body' },
      { obj: this.root, local: new V(-0.6, 1.4, 1.9), r: 0.8, part: 'body' },
      { obj: this.root, local: new V(0.6, 1.4, 1.9), r: 0.8, part: 'body' },
      { obj: this.tanks[0].mesh, local: new V(0, 0, 0), r: 0.45, part: 'tank0' },
      { obj: this.tanks[1].mesh, local: new V(0, 0, 0), r: 0.45, part: 'tank1' },
    ];
    this.sw = this.spheres.map(() => new V());
    this.meshes = collectMeshes(this.root);
    this.hpBar = makeHpBar(2.2);
    this.root.add(this.hpBar);
    this.x = G.player.x > 0 ? -5 : 5;
    this.z = 48;
    this.vx = 0;
    this.vz = 0;
    this.entering = true;
    this.age = 0;
    this.atk = null;
    this.atkT = 3;
    this.flashT = 0;
    this.dying = false;
    this.remove = false;
    this.root.position.set(this.x, 0, this.z);
    G.scene.add(this.root);
  }

  center(out) {
    return out.set(this.x, 1.6, this.z);
  }

  update(dt) {
    const P = G.player;
    this.age += dt;
    if (this.dying) {
      this.updateDeath(dt);
      return;
    }
    dt *= this.tickStatus(dt);
    if (this.dying) return;
    let tx = P.x + Math.sin(this.age * 0.45) * 4;
    let tz = -22 + Math.sin(this.age * 0.3) * 5;
    if (this.entering) {
      tx = P.x + (this.x >= P.x ? 4.8 : -4.8);
      if (this.z < -10) this.entering = false;
    }
    if (Math.abs(this.z) < 7 && Math.abs(this.x - P.x) < 3.5) tx = P.x + (this.x >= P.x ? 4.8 : -4.8);
    if (this.fleeing) {
      tz = -240;
      if (this.z < -220) this.remove = true;
    }
    tx = clamp(tx, -6.5, 6.5);
    this.vx = damp(this.vx, clamp((tx - this.x) * 1.2, -4, 4), 2, dt);
    this.x += this.vx * dt;
    this.vz = damp(this.vz, clamp((tz - this.z) * 0.6, -10, 10), 1.2, dt);
    this.z += this.vz * dt;
    const absSpeed = G.speed - this.vz;
    this.front.rotation.x -= (absSpeed * dt) / 0.66;
    this.rear.rotation.x = this.front.rotation.x;
    this.root.position.set(this.x, Math.sin(this.age * 9) * 0.03, this.z);
    this.root.rotation.set(0, -this.vx * 0.03, -this.vx * 0.012);
    this.root.updateMatrixWorld(true);
    _t.copy(P.headW);
    aimAt(this.gunner.head, _t, 2.2, 0.6);
    _t.y -= 0.3;
    if (this.atk !== 'gatling') aimAt(this.gunner.arm, _t, Math.PI, 1.3);
    this.updateSpheres();
    if (this.hp < this.maxHp * 0.35 && Math.random() < 0.4) {
      G.fx.smoke(apparent(_v.set(this.x, 2.2, this.z - 2)), 1, 0.8);
      if (Math.random() < 0.5) G.fx.fire(apparent(_v.set(this.x + rand(-0.5, 0.5), 2.0, this.z - 2.2)), 2, 0.4, 0.6);
    }
    if (Math.random() < 0.3) G.fx.dust(apparent(_v.set(this.x + rand(-1.2, 1.2), 0.1, this.z + 1.8)), 1);
    this.attacks(dt);
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.setFlash(this.flashT > 0);
    }
    this.billboardBar(3.4);
  }

  attacks(dt) {
    const P = G.player;
    if (this.entering || this.fleeing) return;
    if (!this.atk) {
      this.atkT -= dt;
      if (this.atkT <= 0) {
        const opts = ['gatling', 'gatling', 'rockets', 'barrels'];
        if (G.enemies.aliveCount() < 5) opts.push('summon');
        this.atk = pick(opts);
        this.atkTime = 0;
        this.fired = 0;
        if (this.atk === 'gatling') G.audio.play('charge', this.root.position);
      }
      return;
    }
    this.atkTime += dt;
    const t = this.atkTime;
    if (this.atk === 'gatling') {
      if (t > 0.5) {
        const n = Math.floor((t - 0.5) * 11);
        _t.copy(P.headW);
        _t.y -= 0.35;
        _t.x += Math.sin(t * 2.6) * 2.2;
        aimAt(this.gunner.arm, _t, Math.PI, 1.3);
        while (this.fired < n) {
          this.fired++;
          this.root.updateMatrixWorld(true);
          const from = this.gunner.muzzle.getWorldPosition(new V());
          apparent(from);
          const vel = _t.clone().add(_l.set(rand(-0.4, 0.4), rand(-0.3, 0.3), 0)).sub(from).normalize().multiplyScalar(42);
          G.proj.enemyBullet(from, vel, 4 * this.dmgMul, 0.9);
          G.fx.muzzle(from, vel.clone().normalize());
          G.audio.gun('gatling', from);
        }
      }
      if (t > 2.9) this.endAttack();
    } else if (this.atk === 'rockets') {
      const n = Math.min(4, Math.floor(t / 0.35));
      while (this.fired < n) {
        this.fired++;
        const s = this.fired % 2 ? -1 : 1;
        const from = apparent(new V(this.x + s * 0.7, 2.4, this.z + 2.0));
        G.proj.rocket(from, new V(s * 0.4, 0.9, 0.5).normalize(), 13 * this.dmgMul);
        G.audio.play('whoosh', from);
        G.fx.smoke(from, 4, 0.5);
      }
      if (t > 1.8) this.endAttack();
    } else if (this.atk === 'barrels') {
      const n = Math.min(3, Math.floor(t / 0.45) + 1);
      while (this.fired < n) {
        this.fired++;
        G.hazards.spawn('barrel', clamp(this.x + rand(-1.6, 1.6), -7.5, 7.5), this.z + 3.4);
        G.audio.play('crash', this.root.position);
      }
      if (t > 1.6) this.endAttack();
    } else if (this.atk === 'summon') {
      G.enemies.spawn('punk', { from: 'behind' });
      G.enemies.spawn(pick(['punk', 'rammer', 'kamikaze']), { from: 'behind' });
      G.fx.text('REFORÇOS!', apparent(_v.set(this.x, 3.5, this.z)), '#ff4040', 0.8);
      this.endAttack();
    }
  }
  endAttack() {
    this.atk = null;
    this.atkT = rand(1.4, 2.6) / G.aggro;
  }

  takeHit(dmg, part, pt, dir) {
    if (this.dying) return { solid: false };
    let mult = 1;
    if (part === 'head') mult = G.player.stats.critMul;
    if (part === 'tank0' || part === 'tank1') {
      const tk = this.tanks[part === 'tank0' ? 0 : 1];
      if (tk.alive) {
        tk.hp -= dmg;
        G.fx.spark(pt, 5);
        if (tk.hp <= 0) {
          tk.alive = false;
          tk.mesh.visible = false;
          this.spheres[part === 'tank0' ? 6 : 7].off = true;
          tk.mesh.getWorldPosition(_v);
          G.explode(apparent(_v.clone()), 4, 0, {});
          this.hp -= this.maxHp * 0.12;
          G.fx.text('TANQUE EXPLODIU!', _v.add(_l.set(0, 1, 0)), '#ffa020', 0.7);
        }
      }
      mult = 0.5;
    }
    this.hp -= dmg * mult;
    this.flashT = 0.05;
    this.setFlash(true);
    if (part === 'zap') G.fx.burst('cyan', pt, 6, { speed: 3, size: 0.1, life: 0.25, anchor: 0.5 });
    if (part === 'head') G.fx.blood(pt, 12);
    else if (part !== 'burn') G.fx.spark(pt, 4);
    if (part !== 'head' && Math.random() < 0.3) G.audio.play('metal', pt);
    if (this.hp <= 0) this.die({ headshot: part === 'head' });
    return { solid: true, enemy: true, head: part === 'head', kill: this.dying };
  }

  die(info = {}) {
    if (this.dying) return;
    this.dying = true;
    this.deathT = 0;
    this.booms = 0;
    this.setFlash(false);
    this.hpBar.visible = false;
    G.slowmoT = 1.6;
    G.onKill(this, { ...info, boss: true });
  }

  updateDeath(dt) {
    this.deathT += dt;
    this.vz = damp(this.vz, G.speed * 0.8, 0.8, dt);
    this.z += this.vz * dt;
    const n = Math.floor(this.deathT / 0.3);
    while (this.booms < Math.min(n, 6)) {
      this.booms++;
      const p = apparent(new V(this.x + rand(-1.2, 1.2), rand(1, 2.5), this.z + rand(-2.5, 2.5)));
      G.explode(p, this.booms === 6 ? 7 : 3.5, 0, {});
    }
    if (this.booms >= 6) {
      this.root.rotation.x = damp(this.root.rotation.x, -1.2, 2, dt);
      this.root.position.y = damp(this.root.position.y, 1.2, 2, dt);
    }
    this.root.position.x = this.x;
    this.root.position.z = this.z;
    if (Math.random() < 0.5) G.fx.smoke(apparent(_v.set(this.x, 2, this.z)), 2, 1.2);
    if (this.deathT > 5 || this.z > 60) this.remove = true;
  }
}

// ======================================================================= GERENCIADOR
export class Enemies {
  constructor() {
    this.list = [];
    this.bossCount = 0;
  }
  spawn(type, opts = {}) {
    const e = type === 'BOSS' ? new Boss(this.bossCount++) : new Enemy(type, opts);
    this.list.push(e);
    return e;
  }
  aliveCount() {
    let n = 0;
    for (const e of this.list) if (!e.dying) n++;
    return n;
  }
  boss() {
    return this.list.find((e) => e.isBoss && !e.dying);
  }
  update(dt) {
    let nearest = Infinity;
    let pan = 0;
    let rel = 0;
    const P = G.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.update(dt);
      if (e.remove) {
        e.destroy();
        this.list.splice(i, 1);
        continue;
      }
      if (!e.dying) {
        const d = Math.hypot(e.x - P.x, e.z);
        if (d < nearest) {
          nearest = d;
          pan = (e.x - P.x) / (d + 1);
          rel = e.vz;
        }
      }
    }
    G.audio.setEnemyEngine(nearest, pan, rel);
  }
  rayHits(o, d, max, out) {
    for (const e of this.list) e.rayHits(o, d, max, out);
  }
  // alvo preferido dentro do cone de mira; se não houver, o mais perto à frente
  acquire(o, dir, skip = null) {
    let best = null;
    let bestS = Infinity;
    let near = null;
    let nearD = Infinity;
    for (const e of this.list) {
      if (e.dying || (skip && skip.has(e))) continue;
      _v.copy(e.sw[1] || e.sw[0]).sub(o);
      const d = _v.length();
      if (d > 160) continue;
      const c = _v.dot(dir) / (d || 1);
      if (c > 0.75 && (1 - c) * 40 + d * 0.02 < bestS) {
        bestS = (1 - c) * 40 + d * 0.02;
        best = e;
      }
      if (c > -0.2 && d < nearD) {
        nearD = d;
        near = e;
      }
    }
    return best || near;
  }
  blast(p, r, dmg) {
    if (dmg <= 0) return;
    for (const e of this.list) {
      if (e.dying) continue;
      e.center(_v);
      apparent(_v);
      const d = _v.distanceTo(p);
      const rr = r + (e.isBoss ? 1.5 : 0.3);
      if (d < rr) e.takeHit(dmg * (1 - 0.6 * (d / rr)), 'blast', _v.clone(), null);
    }
  }
  proximity(p, r) {
    for (const e of this.list) {
      if (e.dying) continue;
      for (let i = 0; i < e.spheres.length; i++) {
        if (e.spheres[i].off) continue;
        if (e.sw[i].distanceTo(p) < e.spheres[i].r + r) return e;
      }
    }
    return null;
  }
  flee() {
    for (const e of this.list) e.fleeing = true;
  }
  clear() {
    for (const e of this.list) e.destroy();
    this.list.length = 0;
    this.bossCount = 0;
  }
}
