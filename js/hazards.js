// Obstáculos e itens na pista: barris explosivos, carros destruídos, cones, fogo, vida e fúria
import * as THREE from 'three';
import { G, rand, pick, chance, clamp, weightedPick } from './ctx.js';
import * as Models from './models.js';
import { trafficCar } from './scenery.js';
import { toWorld, fromWorld } from './curve.js';
import { raySphere } from './projectiles.js';
import { MAT } from './builder.js';
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
  crow: { icon: '🐦', color: 0x2a2a34, ring: 0xc070ff, name: 'CORVO DE ALUGUEL!', sub: 'um corvo ajuda por 8 s' },
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

// manchas na pista: óleo (escorrega) e faixa de turbo (acelera)
const decalTex = {};
function oilTex() {
  return (decalTex.oil ||= canvasTex(256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = w / 2 + (Math.random() - 0.5) * w * 0.5;
      const y = h * 0.12 + Math.random() * h * 0.76;
      const r = 40 + Math.random() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(8,8,12,0.95)');
      gr.addColorStop(0.75, 'rgba(14,12,20,0.9)');
      gr.addColorStop(1, 'rgba(14,12,20,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, r, r * (1.2 + Math.random()), Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // brilho arco-íris do óleo
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `hsla(${Math.random() * 360},90%,60%,0.35)`;
      g.lineWidth = 3 + Math.random() * 5;
      g.beginPath();
      g.ellipse(w / 2 + (Math.random() - 0.5) * 80, h * (0.2 + Math.random() * 0.6), 20 + Math.random() * 50, 30 + Math.random() * 60, Math.random() * 3, 0, Math.PI * 1.3);
      g.stroke();
    }
  }));
}
function boostTex() {
  if (decalTex.boost) return decalTex.boost;
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = 'rgba(0,30,60,0.55)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffe040';
    g.lineWidth = 10;
    g.strokeRect(5, 5, w - 10, h - 10);
    // setas apontando pra frente da estrada
    for (let k = 0; k < 2; k++) {
      const y0 = k * (h / 2) + h * 0.38;
      g.beginPath();
      g.moveTo(w * 0.12, y0 + 40);
      g.lineTo(w / 2, y0 - 40);
      g.lineTo(w * 0.88, y0 + 40);
      g.lineTo(w * 0.88, y0 + 80);
      g.lineTo(w / 2, y0);
      g.lineTo(w * 0.12, y0 + 80);
      g.closePath();
      g.fillStyle = k ? '#40e8ff' : '#ffffff';
      g.fill();
    }
  });
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 2);
  return (decalTex.boost = t);
}
const decalMats = {};
const decalMat = (k) =>
  (decalMats[k] ||= curveMaterial(
    new THREE.MeshBasicMaterial({
      map: k === 'oil' ? oilTex() : boostTex(), transparent: true, depthWrite: false, fog: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      blending: k === 'boost' ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
  ));
const DECAL = { oil: { w: 3.4, l: 10 }, boost: { w: 3.2, l: 7 } };
const decalGeo = {};
const geoFor = (k) => {
  if (!decalGeo[k]) {
    const g = new THREE.PlaneGeometry(DECAL[k].w, DECAL[k].l, 1, 6);
    g.rotateX(-Math.PI / 2);
    decalGeo[k] = g;
  }
  return decalGeo[k];
};
// carros: vida até explodir (alguns tiros)
const CAR_HP = { car: 240, wreck: 180 };
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
      case 'oil':
      case 'boost': {
        obj = new THREE.Group();
        const m = new THREE.Mesh(geoFor(kind), decalMat(kind));
        m.position.y = 0.03;
        m.frustumCulled = false;
        m.userData.shared = true;
        obj.add(m);
        hw = DECAL[kind].w / 2;
        break;
      }
      case 'health':
      case 'fury':
      case 'gold':
      case 'boom':
      case 'slow':
      case 'crow': {
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
    const h = { kind, obj, x, z, hw, hp: CAR_HP[kind] || 1, dead: false, t: 0, hitP: false, burned: new Set(), vel: null, cs: o.cs || 0, decal: !!DECAL[kind] };
    if (h.decal) h.hl = DECAL[kind].l / 2;
    h.maxHp = h.hp;
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
        if (t >= 0 && t < max) out.push({ t, obj: this.wrap(h), part: 'barrel', id: h });
      } else if (POW[h.kind]) {
        toWorld(_v.set(h.x, h.obj.position.y + 0.2, h.z));
        const t = raySphere(o, d, _v, 0.9);
        if (t >= 0 && t < max) out.push({ t, obj: this.wrap(h), part: 'pow', id: h });
      } else if ((h.kind === 'car' || h.kind === 'wreck') && !h.vel) {
        let best = Infinity;
        for (const dz of [-1.5, 0, 1.5]) {
          toWorld(_v.set(h.x, h.obj.position.y + 0.85, h.z + dz));
          const t = raySphere(o, d, _v, 1.05);
          if (t >= 0 && t < best) best = t;
        }
        if (best < max) out.push({ t: best, obj: this.wrap(h), part: 'car', id: h });
      }
    }
  }
  wrap(h) {
    return {
      takeHit: (dmg, part, pt) => {
        if (POW[h.kind]) this.collect(h);
        else if (h.kind === 'car' || h.kind === 'wreck') this.damageCar(h, dmg || 20, pt);
        else this.explodeBarrel(h, true);
        return { solid: true };
      },
    };
  }

  damageCar(h, dmg, pt) {
    if (h.dead || h.vel) return;
    h.hp -= dmg;
    if (pt) G.fx.spark(pt, 5);
    if (G.time - (h.clankT || 0) > 0.07) {
      h.clankT = G.time;
      G.audio.play('carhit', pt);
    }
    if (h.hp <= 0) this.explodeCar(h);
  }
  explodeCar(h) {
    const p = toWorld(new THREE.Vector3(h.x, 1, h.z));
    G.explode(p, 6.5, 190, { hurtPlayer: true, playerDmg: 20, fire: true });
    G.fx.text('CARRO EXPLODIU!', toWorld(new THREE.Vector3(h.x, 3, h.z)), '#ff8a20', 0.6);
    G.score += 150;
    G.player.pulseAll(0.7, 140);
    // voa girando e cai pegando fogo
    h.vel = new THREE.Vector3(rand(-3, 3), rand(8, 11), rand(-5, -2));
    h.burning = true;
    h.obj.traverse((o) => {
      if (o.isMesh && o.material === MAT.lit) o.material = MAT.burnt;
    });
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
    } else if (h.kind === 'crow') G.crows.summon();
    else G.pow[h.kind] = h.kind === 'slow' ? 7 : 10;
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
      if (h.dead) continue;
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (h.kind === 'barrel' && d < r * 0.8) h.chainT = 0.12;
      // explosão perto de carro machuca o carro (reação em cadeia no frame seguinte)
      else if ((h.kind === 'car' || h.kind === 'wreck') && !h.vel && d < r + 1.5) h.pendDmg = (h.pendDmg || 0) + 150 * (1 - d / (r + 1.5));
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
    if (G.state === 'wave' || G.state === 'cleared') {
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
      if (h.pendDmg) {
        const d = h.pendDmg;
        h.pendDmg = 0;
        this.damageCar(h, d, null);
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
          if (h.burning && Math.abs(h.vel.y) < 1.5) {
            // vira um destroço em chamas parado na pista
            h.vel = null;
            h.obj.rotation.set(0, h.obj.rotation.y + rand(-0.4, 0.4), rand(-0.1, 0.1));
            h.kind = 'wreck';
            h.hp = h.maxHp = 1e9;
            h.cs = 0;
            h.hitP = false;
          }
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
        if (h.fall) h.fall = Math.max(0, h.fall - dt * 6); // caindo do caminhão
        h.obj.position.y = 0.9 + Math.sin(h.t * 3) * 0.12 + (h.fall || 0);
        h.obj.children[0].rotation.y += dt * 2.2;
      } else if ((h.kind === 'car' || h.kind === 'wreck') && (h.hp < h.maxHp * 0.6 || h.burning)) {
        const k = h.burning ? 1 : 1 - h.hp / h.maxHp;
        if (Math.random() < k * 0.6) G.fx.smoke(toWorld(_v.set(h.x, h.obj.position.y + 1.3, h.z - 1.2)), 1, 0.5);
        if ((h.burning || h.hp < h.maxHp * 0.3) && Math.random() < 0.5) G.fx.fire(toWorld(_v.set(h.x + rand(-0.6, 0.6), h.obj.position.y + 1.1, h.z - 1.4)), 1, 0.45, 1);
      } else if (h.kind === 'boost') {
        h.obj.children[0].material.map.offset.y -= dt * 1.6;
      } else if (h.kind === 'fire') {
        for (const c of h.obj.children) c.scale.set(1, 0.7 + 0.4 * Math.abs(Math.sin(h.t * 9 + c.userData.ph)), 1);
        if (Math.random() < 0.5) G.fx.fire(toWorld(_v.set(h.x + rand(-1, 1), 0.3, h.z + rand(-1, 1))), 1, 0.5, 1);
      }
      // manchas: óleo escorrega enquanto você passa por cima; turbo dispara uma vez
      if (h.decal) {
        if (!P.air && Math.abs(h.z) < h.hl && Math.abs(h.x - P.x) < h.hw + 0.2) {
          if (h.kind === 'oil') P.slip(h.x);
          else if (!h.used) {
            h.used = true;
            P.boost();
          }
        }
        if (h.kind === 'oil') {
          for (const e of G.enemies.list) {
            if (e.dying || e.isBoss || e.T.alt || h.burned.has(e)) continue;
            if (Math.abs(e.z - h.z) < h.hl && Math.abs(e.x - h.x) < h.hw) {
              h.burned.add(e);
              if (chance(0.45)) {
                G.fx.text('ESCORREGOU!', toWorld(_v.set(e.x, 2.2, e.z)), '#ffd21e', 0.5);
                e.die({ crash: true });
              } else e.vx += (chance(0.5) ? -1 : 1) * 6;
            }
          }
        }
      }
      // colisão com o jogador
      else if (!h.dead && !h.hitP && !h.vel && P.jumpY + P.rampY < (POW[h.kind] ? 2.2 : 0.9) && h.z > -1.1 && h.z < 1.1 && Math.abs(h.x - P.x) < h.hw + 0.35) {
        h.hitP = true;
        this.onPlayer(h);
      }
      // colisão com inimigos
      if (!h.dead && (h.kind === 'barrel' || h.kind === 'wreck' || h.kind === 'car' || h.kind === 'fire')) {
        for (const e of G.enemies.list) {
          if (e.dying || e.isBoss || e.T.alt) continue;
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
      if (h.dead || h.z > 45 + (h.hl || 0) || h.z < -330 || h.obj.position.y < -5) {
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
      case 'crow':
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
    const kind = weightedPick(['barrel', 'barrels', 'wreck', 'cones', 'traffic', 'overtake', 'oil', 'boost', 'boostRow'], (k) => ({ barrel: 2.4, barrels: 1.2, wreck: 1.1, cones: 1.2, traffic: 3.2, overtake: 1, oil: 1.3, boost: 1.4, boostRow: 0.5 })[k]);
    const lane = pick(LANES) + rand(-0.8, 0.8);
    if (kind === 'traffic') {
      // carro mais lento na sua frente (às vezes dois lado a lado)
      this.spawn('car', clamp(pick(LANES), -6.5, 6.5), z, { cs: rand(15, 22) });
      if (chance(0.3)) this.spawn('car', clamp(pick(LANES), -6.5, 6.5), z - 14, { cs: rand(15, 22) });
    } else if (kind === 'overtake') this.spawn('car', clamp(pick(LANES), -6.5, 6.5), 40, { cs: rand(38, 44) });
    else if (kind === 'oil') {
      this.spawn('oil', clamp(lane, -6.5, 6.5), z);
      if (chance(0.35)) this.spawn('oil', clamp(-lane, -6.5, 6.5), z - 18);
    } else if (kind === 'boost') this.spawn('boost', clamp(lane, -6.5, 6.5), z);
    else if (kind === 'boostRow') for (const x of [-5.4, 0, 5.4]) this.spawn('boost', x, z);
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
