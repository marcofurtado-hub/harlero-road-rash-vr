import * as THREE from 'three';
import { G, rand, clamp, damp } from './ctx.js';
import * as Models from './models.js';
import { groundY } from './curve.js';

// dmg = por projétil (beam: por segundo); rate = tiros/s
// proc = chance dos efeitos de impacto (fogo, choque, ricochete...) dispararem por acerto
//        (armas de muitos chumbos ou muito rápidas disparam menos, como no Chicken Rancher)
// bspeed/blife = balas visíveis (como os ovos do Chicken Rancher): velocidade (m/s) e vida (s)
// kick = coice estilo rancho (vai a 1 e volta linear em ~0.1 s); spread = espalhamento "cúbico" do rancho
export const WEAPONS = {
  sawedoff: { name: 'Escopeta Cano Duplo', tier: 1, icon: '💥', dmg: 18, pellets: 10, rate: 2.5, spread: 0.2, bspeed: 62, blife: 0.75, bsize: 0.85, sfx: 'shotgun', kick: 1.25, haptic: [0.95, 130], tracer: 0xffe860, proc: 0.3, desc: 'Dois canos serrados. Resolve tudo de perto.' },
  magnum: { name: 'Magnum .50', tier: 2, icon: '🌟', dmg: 110, rate: 2.8, spread: 0.006, bspeed: 120, blife: 1.6, bsize: 1.3, pierce: 2, sfx: 'magnum', kick: 1.3, haptic: [0.8, 70], tracer: 0xffd040, proc: 1, desc: 'Banhada a ouro. Atravessa 3 punks.' },
  tommy: { name: 'Metralhadora', tier: 3, icon: '🔫', dmg: 20, rate: 14, auto: true, spread: 0.035, bspeed: 75, blife: 1.4, bsize: 0.95, sfx: 'tommy', kick: 0.45, haptic: [0.35, 30], tracer: 0xff9a40, proc: 0.45, desc: 'Segura o gatilho e varre a estrada.' },
  bazooka: { name: 'Bazuca', tier: 4, icon: '🚀', dmg: 230, splash: 6, rate: 1.6, spread: 0.004, projectile: true, straight: true, pspeed: 40, range: 220, sfx: 'bazooka', kick: 1.4, haptic: [1, 120], tracer: 0xffa040, proc: 1, desc: 'Foguete em linha reta. Explode grupos inteiros.' },
  autoshotgun: { name: 'Escopeta Automática', tier: 5, icon: '💣', dmg: 16, pellets: 8, rate: 5, auto: true, spread: 0.18, bspeed: 62, blife: 0.75, bsize: 0.85, sfx: 'shotgun', kick: 0.9, haptic: [0.85, 90], tracer: 0xffe860, proc: 0.22, desc: 'Chumbo grosso em rajada.' },
  gatling: { name: 'Mini-Gatling', tier: 6, icon: '⚙️', dmg: 18, rate: 20, auto: true, spread: 0.03, bspeed: 80, blife: 1.3, bsize: 0.95, spinner: true, sfx: 'gatling', kick: 0, haptic: [0.35, 30], tracer: 0xff8030, proc: 0.22, desc: '20 tiros por segundo. Os 6 canos giram.' },
  homing: { name: 'Foguetes Teleguiados', tier: 7, icon: '🎯', dmg: 95, splash: 3.6, rate: 1.15, homing: true, burst: 3, spread: 0, range: 200, sfx: 'homing', kick: 1, haptic: [0.9, 90], tracer: 0xffa040, proc: 1, desc: 'Rajada de 3 mísseis que perseguem os punks.' },
  flyingv: { name: 'Flying V Laser', tier: 8, icon: '🎸', dmg: 240, beam: true, rate: 1, auto: true, spread: 0, range: 170, pierce: 99, sfx: 'laser', kick: 0, haptic: [0.35, 30], tracer: 0x40f0ff, proc: 0.35, desc: 'Um solo de guitarra que derrete tudo.' },
  tesla: { name: 'Bobina Tesla', tier: 9, icon: '🌩️', dmg: 130, rate: 3.6, auto: true, tesla: true, spread: 0, range: 85, sfx: 'tesla', kick: 0.8, haptic: [0.6, 60], tracer: 0x80e0ff, proc: 1, desc: 'Raio que salta de punk em punk.' },
};
export const WEAPON_ORDER = Object.keys(WEAPONS);

const HOLD_POS = new THREE.Vector3(0, -0.025, 0.07);
const ZERO = new THREE.Vector3();
const IDQ = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _hits = [];

const flashTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,220,1)');
  gr.addColorStop(0.3, 'rgba(255,200,80,0.9)');
  gr.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

// interseção do raio com o chão da pista (marcha ao longo do raio; o chão sobe/desce com os morros)
export function groundT(o, d) {
  if (o.y - groundY(o.z) <= 0) return 0;
  let prev = 0;
  for (let t = 2; t <= 240; t += t < 40 ? 2 : 6) {
    const y = o.y + d.y * t;
    const z = o.z + d.z * t;
    if (y < groundY(z)) {
      let a = prev;
      let b = t;
      for (let k = 0; k < 6; k++) {
        const m = (a + b) / 2;
        if (o.y + d.y * m < groundY(o.z + d.z * m)) b = m;
        else a = m;
      }
      return b;
    }
    prev = t;
  }
  return Infinity;
}

// espalhamento igual ao do rancho (soma um ruído em cada eixo e normaliza). Sem mira assistida.
function spreadDir(dir, s, out) {
  out.copy(dir);
  if (s <= 0) return out;
  out.x += (Math.random() - 0.5) * s;
  out.y += (Math.random() - 0.5) * s;
  out.z += (Math.random() - 0.5) * s;
  return out.normalize();
}

// extra = engorda os alvos (só a tesla usa um pouco, como a "mira generosa" do rancho)
export function collectHits(o, d, max, out, extra = 0) {
  out.length = 0;
  G.enemies.rayHits(o, d, max, out, extra);
  G.hazards.rayHits(o, d, max, out);
  G.proj.rayHits(o, d, max, out);
  G.cards.rayHits(o, d, max, out);
  out.sort((a, b) => a.t - b.t);
  return out;
}

// ------------------------------------------------------------------ dano central
// fx = true só no tiro direto do jogador (efeitos secundários, como o choque da tesla, passam false)
const _up = new THREE.Vector3(0, 0.55, 0);
export function dealDamage(h, dmg, pt, dir, proc = 1, fx = true) {
  const res = h.obj.takeHit(dmg, h.part, pt, dir) || {};
  if (!res.enemy) return res;
  G.hitMark = 0.12;
  // power-up Bala Explosiva: acerto direto vira mini-explosão
  if (fx && G.pow.boom > 0 && Math.random() < proc) G.explode(pt.clone(), 2.4, dmg * 0.5 + 22, { small: true });
  return res;
}

export function enemyPos(e, out) {
  return out.copy(e.sw[1] || e.sw[0]);
}

function nearestEnemies(p, r, skip, n) {
  const c = [];
  for (const o of G.enemies.list) {
    if (o.dying || skip.has(o)) continue;
    const d = enemyPos(o, _v2).distanceTo(p);
    if (d < r) c.push({ o, d });
  }
  c.sort((a, b) => a.d - b.d);
  return c.slice(0, n);
}

// cascata do raio tesla: salta pros 3 vizinhos mais próximos, até 3 gerações (55% / 30% / 17%)
function teslaCascade(first, pt, base) {
  const hit = new Set([first]);
  let frontier = [pt.clone()];
  let dmg = base;
  let total = 0;
  const gens = 3;
  for (let gen = 0; gen < gens && frontier.length && total < 10; gen++) {
    dmg *= 0.55;
    const next = [];
    for (const from of frontier) {
      for (const c of nearestEnemies(from, 9, hit, 3)) {
        if (total >= 10) break;
        hit.add(c.o);
        total++;
        const cp = enemyPos(c.o, new THREE.Vector3());
        G.fx.bolt(from, cp, 0x80e0ff, 0.22, 0.12, 0.045);
        dealDamage({ obj: c.o, part: 'zap' }, dmg, cp, null, 0, false);
        next.push(cp);
      }
    }
    frontier = next;
  }
  if (total >= 2) G.fx.text(`CHOQUE x${total + 1}!`, _v.copy(pt).add(_up), '#80e0ff', 0.4, 0.7);
}

export class Gun {
  constructor(id, level = 1) {
    this.id = id;
    this.def = WEAPONS[id];
    this.level = level;
    this.root = new THREE.Group();
    this.kick = new THREE.Group();
    this.root.add(this.kick);
    const m = Models.gunModel(id);
    this.kick.add(m.model);
    this.glove = m.glove;
    this.glove.visible = false;
    this.kick.add(this.glove);
    this.spinner = m.spinner;
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.copy(m.muzzle);
    this.kick.add(this.muzzle);
    // clarão do cano
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.setScalar(0.18);
    this.flash.visible = false;
    this.muzzle.add(this.flash);
    this.flashT = 0;
    // mira laser
    const lg = new THREE.BoxGeometry(0.004, 0.004, 1);
    lg.translate(0, 0, -0.5);
    this.laser = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.laser.scale.z = 18;
    this.laser.material.opacity = 0.28;
    this.laser.visible = false;
    this.muzzle.add(this.laser);
    // pontinho vermelho onde o tiro vai bater (no VR, já que não tem mira assistida)
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.9, depthTest: false, fog: false }));
    this.dot.renderOrder = 40;
    this.dot.visible = false;
    this.dot.frustumCulled = false;
    this.kickV = 0;
    if (this.def.beam) {
      // até 3 feixes (Bala Dupla / Leque dão um feixe por direção)
      const bg = new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true);
      bg.rotateX(Math.PI / 2);
      bg.translate(0, 0, -0.5);
      const outer = new THREE.MeshBasicMaterial({ color: 0x40f0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const inner = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      this.beams = [0, 1, 2].map(() => {
        const b = new THREE.Mesh(bg, outer);
        b.visible = false;
        b.frustumCulled = false;
        const core = new THREE.Mesh(bg, inner);
        core.scale.set(0.35, 0.35, 1);
        b.add(core);
        this.muzzle.add(b);
        return b;
      });
    }
    this.cool = 0;
    this.buffer = 0;
    this.spin = 0;
    this.spinAngle = 0;
    this.holder = null;
    this.lerpT = 1;
    this.fromP = new THREE.Vector3();
    this.fromQ = new THREE.Quaternion();
    this.toP = new THREE.Vector3();
    this.toQ = new THREE.Quaternion();
    this.firing = false;
    this.pop = 1;
  }

  get stats() {
    const d = this.def;
    const P = G.player;
    const L = this.level - 1;
    const fury = G.furyT > 0;
    const gold = G.pow && G.pow.gold > 0;
    return {
      dmg: d.dmg * (1 + 0.25 * L) * (fury ? 1.75 : 1) * (gold ? 3 : 1),
      rate: d.rate * (1 + 0.12 * L) * (fury ? 1.35 : 1),
      spread: d.spread * Math.pow(0.85, L),
      pierce: d.pierce || 0,
      pellets: d.pellets || 1,
      range: d.range || 120,
      auto: !!d.auto,
      splash: d.splash ? d.splash * (1 + 0.08 * L) : 0,
      pspeed: d.pspeed || 46,
      straight: !!d.straight,
    };
  }

  attachTo(parent, pos = ZERO, quat = IDQ, dur = 0.14) {
    parent.updateWorldMatrix(true, false);
    this.root.updateWorldMatrix(true, false);
    parent.attach(this.root);
    this.fromP.copy(this.root.position);
    this.fromQ.copy(this.root.quaternion);
    this.toP.copy(pos);
    this.toQ.copy(quat);
    this.lerpT = 0;
    this.lerpDur = dur;
  }
  holdIn(parent, quat = IDQ, pos = HOLD_POS) {
    this.attachTo(parent, pos, quat, 0.1);
  }

  // chamado todo frame para a arma empunhada
  handleTrigger(dt, down, pressed, aimO, aimD) {
    const S = this.stats;
    if (pressed) this.buffer = 0.14;
    this.buffer -= dt;
    this.held = down;
    if (this.def.beam) {
      if (down) this.fireBeam(dt, S, aimO, aimD);
      else this.stopBeam();
      return;
    }
    const want = S.auto ? down : this.buffer > 0;
    if (!want || this.cool > 0) return;
    // segurando, a cadência fica exata (sem perder frações de frame)
    this.cool = (this.cool < -0.05 ? 0 : this.cool) + 1 / S.rate;
    this.buffer = 0;
    this.fire(S, aimO, aimD);
  }

  muzzleWorld(out) {
    return this.muzzle.getWorldPosition(out);
  }
  dirWorld(out) {
    this.muzzle.getWorldQuaternion(_q);
    return out.set(0, 0, -1).applyQuaternion(_q);
  }

  // sem mira assistida: no VR o tiro sai pra onde o cano aponta; no PC sai do cano e converge
  // pro ponto que está sob a mira (o pcAim do rancho), senão passaria do lado
  aim(S, aimO, aimD) {
    const from = this.muzzleWorld(new THREE.Vector3());
    if (!aimD) return { from, dir: this.dirWorld(new THREE.Vector3()), origin: from.clone() };
    const hits = collectHits(aimO, aimD, 160, _hits);
    const tg = groundT(aimO, aimD);
    const t = Math.min(hits.length ? hits[0].t : 60, tg, 160);
    const target = aimO.clone().addScaledVector(aimD, Math.max(t, 4));
    return { from, dir: target.sub(from).normalize(), origin: from.clone() };
  }

  fire(S, aimO, aimD) {
    const d = this.def;
    const { from, dir, origin } = this.aim(S, aimO, aimD);
    if (d.homing) G.proj.missiles(from, dir, S, d.burst);
    else if (d.tesla) this.fireTesla(origin, dir, S, from);
    else {
      // balas de verdade, como os ovos do rancho
      const dd = new THREE.Vector3();
      const gold = G.pow.gold > 0;
      for (let p = 0; p < S.pellets; p++) {
        spreadDir(dir, S.spread, dd);
        if (d.projectile) G.proj.grenade(from, dd, S);
        else
          G.proj.bullet(from, dd.clone().multiplyScalar(d.bspeed * (S.pellets > 1 ? 0.92 + Math.random() * 0.16 : 1)), {
            dmg: S.dmg, pierce: S.pierce, life: d.blife, size: d.bsize * (gold ? 1.3 : 1), color: gold ? 0xffd030 : d.tracer, proc: d.proc,
          });
      }
    }
    G.fx.muzzle(from, dir, d.tesla ? 'cyan' : G.pow.gold > 0 ? 'gold' : 'fire');
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * 6.28;
    this.flash.scale.setScalar((d.pellets ? 0.42 : 0.28) + Math.random() * 0.08);
    this.flashT = 0.05;
    G.audio.gun(d.sfx, from);
    if (d.kick) this.kickV = d.kick;
    if (this.holder) G.player.pulse(this.holder, d.haptic[0], d.haptic[1]);
  }

  fireTesla(o, d, S, from) {
    const hits = collectHits(o, d, S.range, _hits, 0.35);
    const tg = groundT(o, d);
    let end = null;
    for (const h of hits) {
      if (h.t > tg) break;
      const pt = new THREE.Vector3().copy(o).addScaledVector(d, h.t);
      const res = dealDamage(h, S.dmg, pt, d, 1);
      end = pt;
      if (res.enemy) {
        teslaCascade(h.obj, pt, S.dmg);
        G.audio.play('hit');
      }
      break;
    }
    if (!end) {
      end = new THREE.Vector3().copy(o).addScaledVector(d, Math.min(S.range * 0.6, tg));
      if (tg < S.range) G.fx.burst('cyan', end, 6, { speed: 3, size: 0.12, life: 0.3, anchor: 1 });
    }
    G.fx.bolt(from, end, 0x80e0ff, 0.15, 0.11, 0.07);
    G.fx.burst('cyan', end, 8, { speed: 4, size: 0.1, life: 0.25, anchor: 0.6 });
  }

  fireBeam(dt, S, aimO, aimD) {
    if (!this.firing) {
      this.firing = true;
      G.audio.laserStart();
    }
    const { from, dir, origin } = this.aim(S, aimO, aimD);
    const vol = [{ d: dir, off: new THREE.Vector3() }];
    this.beamTick = (this.beamTick || 0) - dt;
    const tick = this.beamTick <= 0;
    if (tick) this.beamTick = 0.06;
    for (let i = 0; i < 3; i++) {
      const beam = this.beams[i];
      if (i >= vol.length) {
        beam.visible = false;
        continue;
      }
      const o = _v.copy(origin).add(vol[i].off);
      const bd = vol[i].d;
      const hits = collectHits(o, bd, S.range, _hits);
      const tg = groundT(o, bd);
      let endT = Math.min(S.range, tg);
      for (const h of hits) {
        if (h.t > tg) break;
        const pt = new THREE.Vector3().copy(o).addScaledVector(bd, h.t);
        if (tick) {
          const res = dealDamage(h, S.dmg * 0.06, pt, bd, this.def.proc);
          if (res.enemy) G.fx.burst('cyan', pt, 4, { speed: 3, size: 0.1, life: 0.3, anchor: 0.5 });
          if (res.enemy && res.head) G.audio.play('hit');
        }
        if (h.obj.isCard) {
          endT = h.t;
          break;
        }
      }
      const end = new THREE.Vector3().copy(o).addScaledVector(bd, endT);
      if (endT === tg && i === 0) G.fx.burst('cyan', end, 2, { speed: 2, size: 0.15, life: 0.3, anchor: 1 });
      const len = from.distanceTo(end);
      beam.visible = true;
      const wob = 1 + Math.sin(G.time * 60 + i) * 0.25;
      beam.scale.set(wob, wob, len);
      // alinha o feixe do cano até o ponto final (no desktop a mira vem da câmera)
      this.muzzle.updateWorldMatrix(true, false);
      const local = this.muzzle.worldToLocal(end.clone()).normalize();
      beam.quaternion.setFromUnitVectors(_v2.set(0, 0, -1), local);
    }
    if (this.holder) G.player.pulse(this.holder, 0.35, 30);
  }
  stopBeam() {
    if (this.firing) {
      this.firing = false;
      G.audio.laserStop();
    }
    if (this.beams) for (const b of this.beams) b.visible = false;
  }

  update(dt) {
    if (this.lerpT < 1) {
      this.lerpT = Math.min(1, this.lerpT + dt / this.lerpDur);
      const k = 1 - Math.pow(1 - this.lerpT, 3);
      this.root.position.lerpVectors(this.fromP, this.toP, k);
      this.root.quaternion.slerpQuaternions(this.fromQ, this.toQ, k);
    }
    this.cool -= dt;
    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt / 0.15);
      this.root.scale.setScalar(0.4 + 0.6 * (1 - Math.pow(1 - this.pop, 3)));
    }
    // coice do rancho: sobe na hora e volta linear (9/s)
    this.kickV = Math.max(0, this.kickV - dt * 9);
    this.kick.rotation.set(this.kickV * 0.25, 0, 0);
    this.kick.position.set(0, 0, this.kickV * 0.04);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }
    if (this.spinner) {
      // gatling: os canos aceleram até 30 rad/s enquanto segura (sem esperar pra atirar)
      if (this.def.tesla) this.spinAngle += dt * 6;
      else {
        this.spin += ((this.held ? 30 : 0) - this.spin) * Math.min(1, dt * 6);
        this.spinAngle += this.spin * dt;
      }
      this.spinner.rotation.z = this.spinAngle;
    }
    const sight = !!this.holder && G.xr && !this.firing;
    this.laser.visible = sight;
    if (sight) {
      const o = this.muzzleWorld(_v);
      const d = this.dirWorld(_v2);
      const hits = collectHits(o, d, 120, _hits);
      const t = Math.min(hits.length ? hits[0].t : 120, groundT(o, d), 120);
      this.laser.scale.z = t;
      if (!this.dot.parent) G.scene.add(this.dot);
      this.dot.visible = t < 120;
      this.dot.position.copy(o).addScaledVector(d, t);
      this.dot.scale.setScalar(0.5 + t * 0.03);
    } else this.dot.visible = false;
  }

  dispose() {
    this.stopBeam();
    if (this.dot.parent) this.dot.parent.remove(this.dot);
    this.root.parent?.remove(this.root);
    this.root.traverse((o) => {
      if (o.isMesh && !o.userData.shared) o.geometry.dispose();
    });
  }
}
