import * as THREE from 'three';
import { G, rand, clamp, damp } from './ctx.js';
import * as Models from './models.js';
import { groundY } from './curve.js';

// dmg = por projétil (beam: por segundo); rate = tiros/s
// proc = chance dos efeitos de impacto (fogo, choque, ricochete...) dispararem por acerto
//        (armas de muitos chumbos ou muito rápidas disparam menos, como no Chicken Rancher)
export const WEAPONS = {
  sawedoff: { name: 'Escopeta Cano Duplo', tier: 1, icon: '💥', dmg: 14, pellets: 10, rate: 2.6, spread: 0.075, range: 50, sfx: 'shotgun', recoil: 0.9, haptic: 1, tracer: 0xffc060, proc: 0.3, desc: 'Dois canos serrados. Resolve tudo de perto.' },
  magnum: { name: 'Magnum .50', tier: 2, icon: '🌟', dmg: 110, rate: 2.8, spread: 0.003, range: 220, pierce: 2, sfx: 'magnum', recoil: 1.1, haptic: 1, tracer: 0xffd040, proc: 1, desc: 'Banhada a ouro. Atravessa 3 punks.' },
  tommy: { name: 'Metralhadora', tier: 3, icon: '🔫', dmg: 20, rate: 14, auto: true, spread: 0.028, range: 140, sfx: 'tommy', recoil: 0.16, haptic: 0.35, tracer: 0xffe080, proc: 0.45, desc: 'Segura o gatilho e varre a estrada.' },
  bazooka: { name: 'Bazuca', tier: 4, icon: '🚀', dmg: 230, splash: 6, rate: 1.6, spread: 0.004, projectile: true, straight: true, pspeed: 40, range: 220, sfx: 'bazooka', recoil: 1.3, haptic: 1, tracer: 0xffa040, proc: 1, desc: 'Foguete em linha reta. Explode grupos inteiros.' },
  autoshotgun: { name: 'Escopeta Automática', tier: 5, icon: '💣', dmg: 16, pellets: 8, rate: 5.5, auto: true, spread: 0.065, range: 55, sfx: 'shotgun', recoil: 0.55, haptic: 0.8, tracer: 0xffc060, proc: 0.22, desc: 'Chumbo grosso em rajada.' },
  gatling: { name: 'Mini-Gatling', tier: 6, icon: '⚙️', dmg: 16, rate: 26, auto: true, spread: 0.04, range: 130, spinup: 0.25, sfx: 'gatling', recoil: 0.07, haptic: 0.22, tracer: 0xfff0a0, proc: 0.22, desc: '26 tiros por segundo. Gira e destrói.' },
  homing: { name: 'Foguetes Teleguiados', tier: 7, icon: '🎯', dmg: 95, splash: 3.6, rate: 1.15, homing: true, burst: 3, spread: 0, range: 200, sfx: 'homing', recoil: 0.8, haptic: 0.9, tracer: 0xffa040, proc: 1, desc: 'Rajada de 3 mísseis que perseguem os punks.' },
  flyingv: { name: 'Flying V Laser', tier: 8, icon: '🎸', dmg: 240, beam: true, rate: 1, auto: true, spread: 0, range: 170, pierce: 99, sfx: 'laser', recoil: 0, haptic: 0.35, tracer: 0x40f0ff, proc: 0.35, desc: 'Um solo de guitarra que derrete tudo.' },
  tesla: { name: 'Bobina Tesla', tier: 9, icon: '🌩️', dmg: 130, rate: 3.6, auto: true, tesla: true, spread: 0.004, range: 85, sfx: 'tesla', recoil: 0.35, haptic: 0.6, tracer: 0x80e0ff, proc: 1, desc: 'Raio que salta de punk em punk.' },
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

const _su = new THREE.Vector3();
const _sw = new THREE.Vector3();
function spreadDir(dir, s, out) {
  out.copy(dir);
  if (s <= 0) return out;
  const ax = Math.abs(dir.y) < 0.9 ? _v2.set(0, 1, 0) : _v2.set(1, 0, 0);
  _su.crossVectors(dir, ax).normalize();
  _sw.crossVectors(dir, _su);
  const r = s * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  out.addScaledVector(_su, Math.cos(a) * r).addScaledVector(_sw, Math.sin(a) * r).normalize();
  return out;
}

// mira assistida: puxa o tiro pro punk mais próximo da linha de mira (o "ímã" do Chicken Rancher)
const _to = new THREE.Vector3();
export function assistAim(o, dir, range, base, perM) {
  let best = null;
  let bestScore = Infinity;
  for (const e of G.enemies.list) {
    if (e.dying) continue;
    for (let i = 0; i < e.spheres.length; i++) {
      const s = e.spheres[i];
      if (s.off || s.part === 'bike') continue;
      _to.copy(e.sw[i]).sub(o);
      const along = _to.dot(dir);
      if (along <= 0.5 || along > range) continue;
      const perp = Math.sqrt(Math.max(0, _to.lengthSq() - along * along));
      const lim = base + along * perM;
      if (perp > lim) continue;
      const score = perp / lim - (s.part === 'head' ? 0.15 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = e.sw[i];
      }
    }
  }
  if (best) dir.copy(best).sub(o).normalize();
  return dir;
}

export function collectHits(o, d, max, out) {
  out.length = 0;
  G.enemies.rayHits(o, d, max, out);
  G.hazards.rayHits(o, d, max, out);
  G.proj.rayHits(o, d, max, out);
  G.cards.rayHits(o, d, max, out);
  out.sort((a, b) => a.t - b.t);
  return out;
}

// ------------------------------------------------------------------ multi-tiro universal
// Bala Dupla = cópias paralelas (16 cm); Leque = +2 cópias em diagonal por nível (±14°, ±28°)
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
export function volleyDirs(dir) {
  const P = G.player;
  const out = [];
  _r.crossVectors(dir, UP);
  if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0);
  _r.normalize();
  _u.crossVectors(_r, dir).normalize();
  const n = 1 + P.lvl('double');
  for (let k = 0; k < n; k++) out.push({ d: dir.clone(), off: _r.clone().multiplyScalar((k - (n - 1) / 2) * 0.16) });
  for (let k = 1; k <= P.lvl('fan'); k++) for (const s of [-1, 1]) out.push({ d: dir.clone().applyAxisAngle(_u, s * k * 0.24), off: new THREE.Vector3() });
  return out;
}

// ------------------------------------------------------------------ dano central + efeitos de impacto
// fx = true só no tiro direto do jogador; efeitos secundários (choque, ricochete, queimadura) passam
// fx = false e assim nunca geram outro efeito (sem recursão infinita)
const _up = new THREE.Vector3(0, 0.55, 0);
let critTextT = 0;
export function dealDamage(h, dmg, pt, dir, proc = 1, fx = true) {
  const P = G.player;
  const obj = h.obj;
  const isE = !!obj.spheres;
  let crit = false;
  if (isE && fx && P.lvl('crit') && Math.random() < 0.15 * P.lvl('crit')) {
    dmg *= 2;
    crit = true;
  }
  const res = obj.takeHit(dmg, h.part, pt, dir) || {};
  if (!res.enemy) return res;
  G.hitMark = 0.12;
  if (crit && G.time - critTextT > 0.22) {
    critTextT = G.time;
    G.fx.text('CRÍTICO!', _v.copy(pt).add(_up), '#ff5050', 0.32, 0.6);
    G.audio.play('crit');
  }
  if (fx) impactFx(obj, dmg, pt, proc);
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

function impactFx(e, dmg, pt, proc) {
  const P = G.player;
  if (!e.dying) {
    const fire = P.lvl('fire');
    if (fire) {
      if (!(e.burnT > 0)) G.audio.play('burn', pt);
      e.burnT = 3;
      e.burnDps = Math.max(e.burnDps || 0, dmg * 0.2 * fire);
    }
    const ice = P.lvl('ice');
    if (ice) {
      if (!(e.slowT > 0)) G.audio.play('freeze', pt);
      e.slowT = 2.5;
      e.slowMul = ice >= 2 ? 0.4 : 0.6;
    }
  }
  const boom = P.lvl('boom');
  if ((G.pow.boom > 0 && Math.random() < proc) || (boom && Math.random() < 0.25 * boom * proc)) {
    G.explode(pt.clone(), 2.2 + 0.3 * boom, dmg * 0.5 + 22, { small: true });
  }
  const shock = P.lvl('shock');
  if (shock && Math.random() < proc && G.time - (e.shockCD || -9) > 0.3) {
    e.shockCD = G.time;
    const skip = new Set([e]);
    for (const c of nearestEnemies(pt, 8, skip, shock >= 2 ? 3 : 2)) {
      const cp = enemyPos(c.o, new THREE.Vector3());
      G.fx.bolt(pt, cp, 0xa0d0ff, 0.25, 0.1, 0.035);
      dealDamage({ obj: c.o, part: 'zap' }, dmg * 0.35, cp, null, 0, false);
    }
    G.audio.play('zap', pt);
  }
  const ric = P.lvl('ricochet');
  if (ric && Math.random() < proc) {
    const skip = new Set([e]);
    let from = pt.clone();
    for (let i = 0; i < ric; i++) {
      const c = nearestEnemies(from, 14, skip, 1)[0];
      if (!c) break;
      skip.add(c.o);
      const cp = enemyPos(c.o, new THREE.Vector3());
      G.fx.tracer(from, cp, 0xffd040, 0.1, 1.4);
      dealDamage({ obj: c.o, part: 'body' }, dmg * 0.7, cp, null, 0, false);
      from = cp;
    }
  }
}

// cascata do raio tesla: salta pros 3 vizinhos mais próximos, até 3 gerações (55% / 30% / 17%)
function teslaCascade(first, pt, base) {
  const hit = new Set([first]);
  let frontier = [pt.clone()];
  let dmg = base;
  let total = 0;
  const gens = 3 + G.player.lvl('ricochet');
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
    this.laser.visible = false;
    this.muzzle.add(this.laser);
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
    this.recoil = 0;
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
      dmg: d.dmg * (1 + 0.25 * L) * (P ? P.dmgMul() : 1) * (fury ? 1.75 : 1) * (gold ? 3 : 1),
      rate: d.rate * (1 + 0.12 * L) * (P ? P.rateMul() : 1) * (fury ? 1.35 : 1),
      spread: d.spread * Math.pow(0.85, L),
      pierce: (d.pierce || 0) + (P ? P.lvl('pierce') : 0),
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
    if (this.def.spinup) {
      const before = this.spin;
      this.spin = clamp(this.spin + (down ? dt / this.def.spinup : -dt / 0.8), 0, 1);
      if (down && before < 0.05 && this.spin >= 0.05) G.audio.play('charge');
    }
    if (this.def.beam) {
      if (down) this.fireBeam(dt, S, aimO, aimD);
      else this.stopBeam();
      return;
    }
    const want = S.auto ? down : this.buffer > 0;
    if (!want) return;
    if (this.def.spinup && this.spin < 0.95) return;
    if (this.cool > 0) return;
    this.cool = 1 / S.rate;
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

  aim(S, aimO, aimD, k = 1) {
    const from = this.muzzleWorld(new THREE.Vector3());
    const dir = aimD ? aimD.clone() : this.dirWorld(new THREE.Vector3());
    const origin = aimO ? aimO.clone() : from.clone();
    const mag = (1 + 0.35 * G.player.lvl('magnet')) * k;
    assistAim(origin, dir, S.range, (aimD ? 0.25 : 0.5) * mag, (aimD ? 0.03 : 0.065) * mag);
    return { from, dir, origin };
  }

  fire(S, aimO, aimD) {
    const d = this.def;
    const { from, dir, origin } = this.aim(S, aimO, aimD, d.tesla ? 1.6 : 1);
    const vol = volleyDirs(dir);
    if (d.homing) {
      // só o 1º míssil da rajada é replicado pelas habilidades
      G.proj.missiles(from, dir, S, d.burst + vol.length - 1);
    } else if (d.tesla) {
      const n = Math.min(vol.length, 3);
      for (let i = 0; i < n; i++) this.fireTesla(_v.copy(origin).add(vol[i].off), vol[i].d, S, from);
    } else {
      const per = S.pellets > 1 ? Math.max(2, Math.round(S.pellets / Math.sqrt(vol.length))) : 1;
      const dd = new THREE.Vector3();
      for (const v of vol) {
        const o = origin.clone().add(v.off);
        const f = from.clone().add(v.off);
        for (let p = 0; p < per; p++) {
          spreadDir(v.d, S.spread, dd);
          if (d.projectile) G.proj.grenade(f, dd, S);
          else this.ray(o, dd, S, f);
        }
      }
    }
    G.fx.muzzle(from, dir, d.tesla ? 'cyan' : G.pow.gold > 0 ? 'gold' : 'fire');
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * 6.28;
    this.flash.scale.setScalar((d.pellets ? 0.42 : 0.28) + Math.random() * 0.08);
    this.flashT = 0.05;
    G.audio.gun(d.sfx, from);
    this.recoil = Math.min(1.4, this.recoil + d.recoil);
    if (this.holder) G.player.pulse(this.holder, Math.max(0.45, d.haptic), d.auto ? 35 : 90);
  }

  ray(o, d, S, from) {
    const hits = collectHits(o, d, S.range, _hits);
    const tg = groundT(o, d);
    let pierce = S.pierce;
    let endT = Math.min(S.range, tg);
    let anyE = false;
    for (const h of hits) {
      if (h.t > tg) break;
      const pt = new THREE.Vector3().copy(o).addScaledVector(d, h.t);
      const res = dealDamage(h, S.dmg, pt, d, this.def.proc);
      if (res.enemy) {
        anyE = true;
        if (res.head) G.audio.play('headshot');
      }
      if (res.solid !== false) {
        if (pierce <= 0) {
          endT = h.t;
          break;
        }
        pierce--;
      }
    }
    if (anyE) G.audio.play('hit');
    const end = new THREE.Vector3().copy(o).addScaledVector(d, endT);
    if (endT === tg && tg < S.range) G.fx.dust(end, 3);
    const gold = G.pow.gold > 0;
    G.fx.tracer(from, end, gold ? 0xffd030 : this.def.tracer, 0.07, (this.def.pellets ? 1.1 : 1.8) * (gold ? 1.5 : 1));
  }

  fireTesla(o, d, S, from) {
    const hits = collectHits(o, d, S.range, _hits);
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
    const { from, dir, origin } = this.aim(S, aimO, aimD, 0.8);
    const vol = volleyDirs(dir).slice(0, 3);
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
    this.recoil = damp(this.recoil, 0, 14, dt);
    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt / 0.15);
      this.root.scale.setScalar(0.4 + 0.6 * (1 - Math.pow(1 - this.pop, 3)));
    }
    this.kick.position.set(0, this.recoil * 0.015, this.recoil * 0.08);
    this.kick.rotation.set(this.recoil * 0.6, 0, 0);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }
    if (this.spinner) {
      this.spinAngle += (this.def.tesla ? 1 : this.spin) * dt * (this.def.tesla ? 6 : 40);
      this.spinner.rotation.z = this.spinAngle;
    }
    this.laser.visible = !!this.holder && G.xr && !this.firing;
  }

  dispose() {
    this.stopBeam();
    this.root.parent?.remove(this.root);
    this.root.traverse((o) => {
      if (o.isMesh && !o.userData.shared) o.geometry.dispose();
    });
  }
}
