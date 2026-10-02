// Obstáculos e itens na pista: barris explosivos, carros destruídos, cones, fogo, vida e fúria
import * as THREE from 'three';
import { G, rand, pick, chance, clamp, weightedPick } from './ctx.js';
import * as Models from './models.js';
import { toDrum, fromDrum } from './curve.js';
import { raySphere } from './projectiles.js';

const _v = new THREE.Vector3();
const LANES = [-6, -2, 2, 6];

const ringGeo = new THREE.RingGeometry(0.5, 0.65, 20).rotateX(-Math.PI / 2);

export class Hazards {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.spawnT = 4;
    this.fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a10, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.fireMat2 = new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  clear() {
    for (const h of this.list) this.kill(h);
    this.list.length = 0;
  }

  kill(h) {
    this.scene.remove(h.obj);
    h.obj.traverse((o) => o.isMesh && !o.userData.shared && o.geometry !== ringGeo && o.geometry.dispose());
  }

  spawn(kind, x, z, o = {}) {
    let obj;
    let hw = 0.5;
    switch (kind) {
      case 'barrel':
        obj = Models.barrel();
        hw = 0.4;
        break;
      case 'wreck':
        obj = Models.wreck();
        hw = 1.05;
        break;
      case 'cone':
        obj = Models.cone();
        hw = 0.3;
        break;
      case 'health':
        obj = new THREE.Group();
        obj.add(Models.healthCrate());
        hw = 0.7;
        break;
      case 'fury':
        obj = new THREE.Group();
        obj.add(Models.furyPick());
        hw = 0.7;
        break;
      case 'fire': {
        obj = new THREE.Group();
        for (let i = 0; i < 6; i++) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(rand(0.25, 0.45), rand(0.8, 1.6), 5), i % 2 ? this.fireMat : this.fireMat2);
          c.position.set(rand(-1.1, 1.1), 0.4, rand(-1.1, 1.1));
          c.userData.ph = rand(0, 6);
          obj.add(c);
        }
        hw = 1.4;
        break;
      }
      default:
        return null;
    }
    if (kind === 'health' || kind === 'fury') {
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: kind === 'health' ? 0x40ff60 : 0xff3030, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.y = -0.55;
      obj.add(ring);
    }
    obj.position.set(x, 0, z);
    this.scene.add(obj);
    const h = { kind, obj, x, z, hw, hp: 1, dead: false, t: 0, hitP: false, burned: new Set(), vel: null };
    this.list.push(h);
    return h;
  }

  fire(x, z) {
    this.spawn('fire', x, z);
  }

  drop(kind, x, z) {
    const h = this.spawn(kind, clamp(x, -7.5, 7.5), z);
    if (h) h.drop = true;
  }

  rayHits(o, d, max, out) {
    for (const h of this.list) {
      if (h.dead || h.kind !== 'barrel') continue;
      toDrum(_v.set(h.x, 0.5, h.z));
      const t = raySphere(o, d, _v, 0.45);
      if (t >= 0 && t < max) out.push({ t, obj: this.wrap(h), part: 'barrel' });
    }
  }
  wrap(h) {
    return {
      takeHit: () => {
        this.explodeBarrel(h, true);
        return { solid: true };
      },
    };
  }

  explodeBarrel(h, shot) {
    if (h.dead) return;
    h.dead = true;
    const p = toDrum(new THREE.Vector3(h.x, 0.6, h.z));
    G.explode(p, 5.5, 170, { hurtPlayer: true, playerDmg: 22 });
    if (shot) G.fx.text('KABUM!', toDrum(new THREE.Vector3(h.x, 2, h.z)), '#ff8a20', 0.6);
  }

  blast(pa, r) {
    const p = fromDrum(pa.clone()); // explosão vem em coordenada aparente
    for (const h of this.list) {
      if (h.dead || h.kind !== 'barrel') continue;
      if (Math.hypot(h.x - p.x, h.z - p.z) < r * 0.8) {
        h.chainT = 0.12;
      }
    }
  }

  // retorna x alvo pra desviar ou null
  avoid(e) {
    for (const h of this.list) {
      if (h.dead || h.kind === 'cone' || h.kind === 'health' || h.kind === 'fury') continue;
      if (h.z < e.z && e.z - h.z < 24 && Math.abs(h.x - e.x) < h.hw + 1.3) {
        return h.x + (e.x >= h.x ? 1 : -1) * (h.hw + 2.2);
      }
    }
    return null;
  }

  update(dt) {
    const P = G.player;
    const speed = G.speed;
    // geração
    if (G.state === 'wave' || G.state === 'cleared' || G.state === 'upgrade') {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        const busy = G.state === 'wave';
        this.spawnT = busy ? rand(2.5, 5.5) / (1 + G.wave * 0.04) : rand(4, 7);
        this.spawnPattern();
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      h.t += dt;
      if (h.chainT > 0) {
        h.chainT -= dt;
        if (h.chainT <= 0) this.explodeBarrel(h, false);
      }
      if (h.vel) {
        h.vel.y -= 14 * dt;
        h.vel.z += speed * 1.2 * dt;
        h.obj.position.addScaledVector(h.vel, dt);
        h.obj.rotation.x += dt * 8;
        h.obj.rotation.z += dt * 5;
        h.z = h.obj.position.z;
        if (h.obj.position.y < 0) {
          h.obj.position.y = 0;
          h.vel.y *= -0.3;
        }
      } else {
        h.z += speed * dt;
        h.obj.position.z = h.z;
      }
      // animação
      if (h.kind === 'health' || h.kind === 'fury') {
        h.obj.position.y = 0.75 + Math.sin(h.t * 3) * 0.12;
        h.obj.children[0].rotation.y += dt * 2.2;
      } else if (h.kind === 'fire') {
        for (const c of h.obj.children) c.scale.set(1, 0.7 + 0.4 * Math.abs(Math.sin(h.t * 9 + c.userData.ph)), 1);
        if (Math.random() < 0.5) G.fx.fire(toDrum(_v.set(h.x + rand(-1, 1), 0.3, h.z + rand(-1, 1))), 1, 0.5, 1);
      }
      // colisão com o jogador
      if (!h.dead && !h.hitP && !h.vel && h.z > -1.1 && h.z < 1.1 && Math.abs(h.x - P.x) < h.hw + 0.35) {
        h.hitP = true;
        this.onPlayer(h);
      }
      // colisão com inimigos
      if (!h.dead && (h.kind === 'barrel' || h.kind === 'wreck' || h.kind === 'fire')) {
        for (const e of G.enemies.list) {
          if (e.dying || e.isBoss) continue;
          if (Math.abs(e.z - h.z) < 1.3 && Math.abs(e.x - h.x) < h.hw + 0.45) {
            if (h.kind === 'barrel') this.explodeBarrel(h, false);
            else if (h.kind === 'wreck') {
              G.fx.spark(toDrum(_v.set(e.x, 0.8, e.z)), 20);
              G.fx.text('ACIDENTE!', toDrum(_v.set(e.x, 2.2, e.z)), '#ffd21e', 0.5);
              e.die({ crash: true });
            } else if (!h.burned.has(e)) {
              h.burned.add(e);
              e.takeHit(45, 'blast', _v.set(e.x, 1, e.z), null);
            }
          }
        }
      }
      if (h.dead || h.z > 35 || h.obj.position.y < -5) {
        this.kill(h);
        this.list.splice(i, 1);
      }
    }
  }

  onPlayer(h) {
    const P = G.player;
    switch (h.kind) {
      case 'barrel':
        this.explodeBarrel(h, false);
        break;
      case 'wreck':
        P.hurt(20, h.obj.position);
        P.crash();
        G.audio.play('crash');
        G.fx.spark(_v.set(P.x, 0.7, -0.8), 30);
        G.fx.text('BATEU!', _v.set(P.x, 2.2, -4), '#ff4040', 0.5);
        break;
      case 'cone':
        h.vel = new THREE.Vector3(rand(-3, 3), 4, -speedRel());
        G.audio.play('whoosh');
        break;
      case 'health':
        P.heal(30);
        h.dead = true;
        G.audio.play('pickup');
        G.fx.burst('green', _v.set(P.x, 1, -1), 20, { speed: 3, size: 0.1, life: 0.6 });
        G.fx.text('+30 VIDA', _v.set(P.x, 2, -3.5), '#60ff80', 0.45);
        break;
      case 'fury':
        G.furyT = 10;
        h.dead = true;
        G.audio.play('pickup');
        G.audio.play('select');
        G.fx.text('FÚRIA DO ROCK!', _v.set(P.x, 2.1, -3.5), '#ff3030', 0.55);
        if (G.audio.music) G.audio.music.lead = true;
        break;
      case 'fire':
        P.hurt(14, h.obj.position);
        G.fx.fire(_v.set(P.x, 0.8, 0), 20, 0.5, 1);
        G.fx.text('QUEIMOU!', _v.set(P.x, 2, -3.5), '#ff8020', 0.45);
        break;
      default:
        break;
    }
  }

  spawnPattern() {
    const z = -130;
    const kind = weightedPick(['barrel', 'barrels', 'wreck', 'cones', 'health', 'fury'], (k) => ({ barrel: 3, barrels: 1.5, wreck: 2.2, cones: 1.6, health: 0, fury: 0.25 })[k]);
    const lane = pick(LANES) + rand(-0.8, 0.8);
    if (kind === 'barrel') this.spawn('barrel', lane, z);
    else if (kind === 'barrels') {
      const n = chance(0.5) ? 2 : 3;
      for (let i = 0; i < n; i++) this.spawn('barrel', clamp(lane + (i - 1) * 0.95, -7.6, 7.6), z - i * 0.6);
    } else if (kind === 'wreck') this.spawn('wreck', clamp(lane, -6.5, 6.5), z);
    else if (kind === 'cones') {
      const dir = chance(0.5) ? 1 : -1;
      for (let i = 0; i < 5; i++) this.spawn('cone', clamp(lane + dir * i * 0.7, -7.6, 7.6), z - i * 3);
    } else this.spawn(kind, lane, z);
  }
}

function speedRel() {
  return G.speed * 0.6;
}
