// Obstáculos e itens na pista: barris explosivos, carros destruídos, cones, fogo, vida e fúria
import * as THREE from 'three';
import { G, rand, pick, chance, clamp, weightedPick } from './ctx.js';
import * as Models from './models.js';
import { trafficCar } from './scenery.js';
import { toWorld, fromWorld } from './curve.js';
import { raySphere } from './projectiles.js';
import { canvasTex } from './text.js';
import { curveMaterial } from './curve.js';

const _v = new THREE.Vector3();
const LANES = [-6, -2, 2, 6];

// power-ups (caem dos punks): atire na caixa ou passe por cima
export const POW = {
  gold: { icon: '⭐', color: 0xffc020, ring: 0xffd040, name: 'BALA DE OURO!', sub: 'dano x3 por 10 s' },
  boom: { icon: '💣', color: 0xe04a10, ring: 0xff6020, name: 'BALA EXPLOSIVA!', sub: 'todo tiro explode por 10 s' },
  slow: { icon: '⏳', color: 0x3a70ff, ring: 0x60a0ff, name: 'CÂMERA LENTA!', sub: 'punks e balas a 35% por 7 s' },
  health: { icon: '❤️', color: 0x2aa84a, ring: 0x40ff60, name: '+35 VIDA', sub: '' },
  fury: { icon: '🎸', color: 0xb01020, ring: 0xff3030, name: 'FÚRIA DO ROCK!', sub: 'dano e cadência turbinados' },
};
const EMOJI = '"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
const iconMats = {};
function iconMat(kind) {
  if (!iconMats[kind]) {
    const tex = canvasTex(128, 128, (g, w, h) => {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `100px ${EMOJI}`;
      g.fillText(POW[kind].icon, w / 2, h / 2 + 6);
    });
    iconMats[kind] = curveMaterial(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, depthWrite: false }));
  }
  return iconMats[kind];
}
const iconGeo = new THREE.PlaneGeometry(0.75, 0.75);
const ringMats = {};
const ringMat = (kind) =>
  (ringMats[kind] ||= curveMaterial(new THREE.MeshBasicMaterial({ color: POW[kind].ring, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));

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
      case 'car':
        obj = trafficCar();
        hw = 1.0;
        break;
      case 'cone':
        obj = Models.cone();
        hw = 0.3;
        break;
      case 'health':
      case 'fury':
      case 'gold':
      case 'boom':
      case 'slow': {
        obj = new THREE.Group();
        const crate = Models.powCrate(POW[kind].color);
        crate.scale.setScalar(0.8);
        obj.add(crate);
        const ic = new THREE.Mesh(iconGeo, iconMat(kind));
        ic.position.set(0, 0.75, 0);
        ic.frustumCulled = false;
        ic.userData.shared = true;
        obj.add(ic);
        hw = 0.8;
        break;
      }
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
    if (POW[kind]) {
      const ring = new THREE.Mesh(ringGeo, ringMat(kind));
      ring.position.y = -0.7;
      ring.userData.shared = true;
      obj.add(ring);
    }
    obj.position.set(x, 0, z);
    this.scene.add(obj);
    const h = { kind, obj, x, z, hw, hp: 1, dead: false, t: 0, hitP: false, burned: new Set(), vel: null, cs: o.cs || 0 };
    this.list.push(h);
    return h;
  }

  fire(x, z) {
    this.spawn('fire', x, z);
  }

  drop(kind, x, z) {
    if (this.list.filter((h) => POW[h.kind] && !h.dead).length >= 2) return;
    const h = this.spawn(kind, clamp(x, -7.5, 7.5), Math.min(z, -6));
    if (h) h.drop = true;
  }

  rayHits(o, d, max, out) {
    for (const h of this.list) {
      if (h.dead) continue;
      if (h.kind === 'barrel') {
        toWorld(_v.set(h.x, 0.5, h.z));
        const t = raySphere(o, d, _v, 0.45);
        if (t >= 0 && t < max) out.push({ t, obj: this.wrap(h), part: 'barrel' });
      } else if (POW[h.kind]) {
        toWorld(_v.set(h.x, h.obj.position.y + 0.2, h.z));
        const t = raySphere(o, d, _v, 0.9);
        if (t >= 0 && t < max) out.push({ t, obj: this.wrap(h), part: 'pow' });
      }
    }
  }
  wrap(h) {
    return {
      takeHit: () => {
        if (POW[h.kind]) this.collect(h);
        else this.explodeBarrel(h, true);
        return { solid: true };
      },
    };
  }

  collect(h) {
    if (h.dead) return;
    h.dead = true;
    const P = G.player;
    const def = POW[h.kind];
    const p = toWorld(new THREE.Vector3(h.x, h.obj.position.y, h.z));
    G.audio.play('powerup');
    G.fx.burst(h.kind === 'slow' ? 'cyan' : h.kind === 'health' ? 'green' : h.kind === 'gold' ? 'gold' : 'fire', p, 36, { speed: 5, size: 0.14, life: 0.7, anchor: 0.8 });
    if (h.kind === 'health') P.heal(35);
    else if (h.kind === 'fury') {
      G.furyT = 10;
      if (G.audio.music) G.audio.music.lead = true;
    } else G.pow[h.kind] = h.kind === 'slow' ? 7 : 10;
    G.hud.announce(def.name, def.sub, '#' + def.ring.toString(16).padStart(6, '0'), 1.8);
    P.pulseAll(0.6, 120);
  }

  explodeBarrel(h, shot) {
    if (h.dead) return;
    h.dead = true;
    const p = toWorld(new THREE.Vector3(h.x, 0.6, h.z));
    G.explode(p, 5.5, 170, { hurtPlayer: true, playerDmg: 22 });
    if (shot) G.fx.text('KABUM!', toWorld(new THREE.Vector3(h.x, 2, h.z)), '#ff8a20', 0.6);
  }

  blast(pa, r) {
    const p = fromWorld(pa.clone()); // explosão vem em coordenada aparente
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
      if (h.dead || h.kind === 'cone' || POW[h.kind]) continue;
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
    if ((G.state === 'wave' || G.state === 'cleared') && !G.gates.active) {
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
        // carros do trânsito andam (cs = velocidade própria); o resto fica parado na pista
        h.z += (speed - h.cs) * dt;
        h.obj.position.z = h.z;
        if (h.kind === 'car') {
          h.obj.position.y = Math.sin(h.t * 18) * 0.015;
          if (!h.honked && Math.abs(h.z) < (h.cs > 30 ? 24 : 9) && Math.abs(h.x - P.x) < 3.5) {
            h.honked = true;
            G.audio.play('horn', h.obj.position);
          }
        }
      }
      // animação
      if (POW[h.kind]) {
        h.obj.position.y = 0.9 + Math.sin(h.t * 3) * 0.12;
        h.obj.children[0].rotation.y += dt * 2.2;
      } else if (h.kind === 'fire') {
        for (const c of h.obj.children) c.scale.set(1, 0.7 + 0.4 * Math.abs(Math.sin(h.t * 9 + c.userData.ph)), 1);
        if (Math.random() < 0.5) G.fx.fire(toWorld(_v.set(h.x + rand(-1, 1), 0.3, h.z + rand(-1, 1))), 1, 0.5, 1);
      }
      // colisão com o jogador
      if (!h.dead && !h.hitP && !h.vel && h.z > -1.1 && h.z < 1.1 && Math.abs(h.x - P.x) < h.hw + 0.35) {
        h.hitP = true;
        this.onPlayer(h);
      }
      // colisão com inimigos
      if (!h.dead && (h.kind === 'barrel' || h.kind === 'wreck' || h.kind === 'car' || h.kind === 'fire')) {
        for (const e of G.enemies.list) {
          if (e.dying || e.isBoss) continue;
          if (Math.abs(e.z - h.z) < 1.3 && Math.abs(e.x - h.x) < h.hw + 0.45) {
            if (h.kind === 'barrel') this.explodeBarrel(h, false);
            else if (h.kind === 'wreck' || h.kind === 'car') {
              G.fx.spark(toWorld(_v.set(e.x, 0.8, e.z)), 20);
              G.fx.text('ACIDENTE!', toWorld(_v.set(e.x, 2.2, e.z)), '#ffd21e', 0.5);
              e.die({ crash: true });
            } else if (!h.burned.has(e)) {
              h.burned.add(e);
              e.takeHit(45, 'blast', _v.set(e.x, 1, e.z), null);
            }
          }
        }
      }
      if (h.dead || h.z > 45 || h.z < -330 || h.obj.position.y < -5) {
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
      case 'car':
        P.hurt(16, h.obj.position);
        P.crash();
        G.audio.play('crash');
        G.audio.play('horn');
        G.fx.spark(_v.set(P.x, 0.7, -0.8), 30);
        G.fx.text('BATEU NO CARRO!', _v.set(P.x, 2.2, -4), '#ff4040', 0.5);
        h.vel = new THREE.Vector3(rand(-4, 4), 5, -12);
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
      case 'fury':
      case 'gold':
      case 'boom':
      case 'slow':
        this.collect(h);
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
    const z = -270;
    const kind = weightedPick(['barrel', 'barrels', 'wreck', 'cones', 'traffic', 'overtake'], (k) => ({ barrel: 2.6, barrels: 1.3, wreck: 1.2, cones: 1.4, traffic: 3.2, overtake: 1 })[k]);
    const lane = pick(LANES) + rand(-0.8, 0.8);
    if (kind === 'traffic') {
      // carro mais lento na sua frente (às vezes dois lado a lado)
      this.spawn('car', clamp(pick(LANES), -6.5, 6.5), z, { cs: rand(15, 22) });
      if (chance(0.3)) this.spawn('car', clamp(pick(LANES), -6.5, 6.5), z - 14, { cs: rand(15, 22) });
    } else if (kind === 'overtake') this.spawn('car', clamp(pick(LANES), -6.5, 6.5), 40, { cs: rand(38, 44) });
    else if (kind === 'barrel') this.spawn('barrel', lane, z);
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
