import * as THREE from 'three';
import { G, rand, clamp, damp } from './ctx.js';
import * as Models from './models.js';
import { groundY } from './curve.js';

// dmg = por projétil (beam: por segundo); rate = tiros/s
export const WEAPONS = {
  sawedoff: { name: 'Escopeta Cano Duplo', tier: 1, icon: '💥', dmg: 14, pellets: 10, rate: 2.6, mag: 2, reload: 1, spread: 0.075, range: 50, sfx: 'shotgun', recoil: 0.9, haptic: 1, tracer: 0xffc060, desc: 'Dois canos serrados. Resolve tudo de perto.' },
  magnum: { name: 'Magnum .50', tier: 2, icon: '🌟', dmg: 110, rate: 2.8, mag: 6, reload: 1, spread: 0.003, range: 220, pierce: 2, sfx: 'magnum', recoil: 1.1, haptic: 1, tracer: 0xffd040, desc: 'Banhada a ouro. Atravessa 3 punks.' },
  tommy: { name: 'Metralhadora', tier: 3, icon: '🔫', dmg: 20, rate: 14, auto: true, mag: 50, reload: 1, spread: 0.028, range: 140, sfx: 'tommy', recoil: 0.16, haptic: 0.35, tracer: 0xffe080, desc: 'Segura o gatilho e varre a estrada.' },
  bazooka: { name: 'Bazuca', tier: 4, icon: '🚀', dmg: 230, splash: 6, rate: 1.6, mag: 1, reload: 1, spread: 0.004, projectile: true, straight: true, pspeed: 40, range: 220, sfx: 'bazooka', recoil: 1.3, haptic: 1, tracer: 0xffa040, desc: 'Foguete em linha reta. Explode grupos inteiros.' },
  autoshotgun: { name: 'Escopeta Automática', tier: 5, icon: '💣', dmg: 16, pellets: 8, rate: 5.5, auto: true, mag: 12, reload: 1, spread: 0.065, range: 55, sfx: 'shotgun', recoil: 0.55, haptic: 0.8, tracer: 0xffc060, desc: 'Chumbo grosso em rajada.' },
  gatling: { name: 'Mini-Gatling', tier: 5, icon: '⚙️', dmg: 16, rate: 26, auto: true, mag: 180, reload: 1, spread: 0.04, range: 130, spinup: 0.25, sfx: 'gatling', recoil: 0.07, haptic: 0.22, tracer: 0xfff0a0, desc: '24 tiros por segundo. Gira e destrói.' },
  flyingv: { name: 'Flying V Laser', tier: 6, icon: '🎸', dmg: 240, beam: true, rate: 1, auto: true, mag: 100, reload: 1, spread: 0, range: 170, pierce: 99, sfx: 'laser', recoil: 0, haptic: 0.35, tracer: 0x40f0ff, desc: 'Um solo de guitarra que derrete tudo.' },
};
// armas ganhas automaticamente ao limpar cada onda
export const PROGRESSION = { 1: 'magnum', 2: 'tommy', 3: 'bazooka' };
export const INFINITE_AMMO = true;
export const WEAPON_ORDER = Object.keys(WEAPONS);
const BASE_STATS = { dmgMul: 1, rateMul: 1, spreadMul: 1, magMul: 1, reloadMul: 1, pierce: 0 };

const HOLD_POS = new THREE.Vector3(0, -0.025, 0.07);
const ZERO = new THREE.Vector3();
const IDQ = new THREE.Quaternion();
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
function groundT(o, d) {
  if (o.y - groundY(o.z) <= 0) return 0;
  let prev = 0;
  for (let t = 2; t <= 240; t += t < 40 ? 2 : 6) {
    const y = o.y + d.y * t;
    const z = o.z + d.z * t;
    if (y < groundY(z)) {
      // refina
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

function spreadDir(dir, s, out) {
  out.copy(dir);
  if (s <= 0) return out;
  // vetores perpendiculares
  const ax = Math.abs(dir.y) < 0.9 ? _v2.set(0, 1, 0) : _v2.set(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, ax).normalize();
  const w = new THREE.Vector3().crossVectors(dir, u);
  const r = s * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  out.addScaledVector(u, Math.cos(a) * r).addScaledVector(w, Math.sin(a) * r).normalize();
  return out;
}

// mira assistida: puxa o tiro pro punk mais próximo da linha de mira (como o "ímã" do Chicken Rancher)
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
    // barra de munição
    this.ammoBar = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.09), new THREE.MeshBasicMaterial({ color: 0x40ff60 }));
    this.ammoBar.position.copy(m.ammo);
    this.ammoBar.visible = !INFINITE_AMMO;
    this.kick.add(this.ammoBar);
    // mira laser
    const lg = new THREE.BoxGeometry(0.004, 0.004, 1);
    lg.translate(0, 0, -0.5);
    this.laser = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.laser.scale.z = 18;
    this.laser.visible = false;
    this.muzzle.add(this.laser);
    if (this.def.beam) {
      const bg = new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true);
      bg.rotateX(Math.PI / 2);
      bg.translate(0, 0, -0.5);
      this.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0x40f0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.beam.visible = false;
      this.muzzle.add(this.beam);
      this.beamCore = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      this.beamCore.scale.set(0.35, 0.35, 1);
      this.beam.add(this.beamCore);
    }
    this.ammo = this.stats.mag;
    this.reloadT = 0;
    this.reloadDur = 1;
    this.cool = 0;
    this.buffer = 0;
    this.spin = 0;
    this.spinAngle = 0;
    this.recoil = 0;
    this.holder = null;
    this.slot = -1;
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
    const P = G.player ? G.player.stats : BASE_STATS;
    const L = this.level - 1;
    const fury = G.furyT > 0;
    return {
      dmg: d.dmg * (1 + 0.25 * L) * P.dmgMul * (fury ? 1.75 : 1),
      rate: d.rate * (1 + 0.12 * L) * P.rateMul * (fury ? 1.35 : 1),
      spread: d.spread * Math.pow(0.85, L) * P.spreadMul,
      mag: Math.max(1, Math.round(d.mag * (1 + 0.2 * L) * P.magMul)),
      reload: d.reload * Math.pow(0.9, L) * P.reloadMul,
      pierce: (d.pierce || 0) + P.pierce,
      pellets: d.pellets || 1,
      range: d.range || 120,
      auto: !!d.auto,
      splash: d.splash ? d.splash * (1 + 0.08 * L) : 0,
      pspeed: d.pspeed || 46,
      straight: !!d.straight,
    };
  }

  get score() {
    return this.def.tier * 10 + this.level;
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

  refill() {
    this.ammo = this.stats.mag;
    this.reloadT = 0;
  }

  startReload(silent = false) {
    if (this.reloadT > 0) return;
    if (this.ammo >= this.stats.mag) return;
    this.reloadDur = this.reloadT = this.stats.reload;
    this.stopBeam();
    if (!silent) G.audio.play('reload');
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
    if (this.reloadT > 0) return;
    if (this.def.beam) {
      if (down && this.ammo > 0) this.fireBeam(dt, S, aimO, aimD);
      else this.stopBeam();
      return;
    }
    const want = S.auto ? down : this.buffer > 0;
    if (!want) return;
    if (this.ammo <= 0) {
      if (pressed) G.audio.play('empty');
      this.startReload();
      return;
    }
    if (this.def.spinup && this.spin < 0.95) return;
    if (this.cool > 0) return;
    this.cool = 1 / S.rate;
    this.buffer = 0;
    this.fire(S, aimO, aimD);
    if (!INFINITE_AMMO) {
      this.ammo--;
      if (this.ammo <= 0) this.startReload();
    }
  }

  muzzleWorld(out) {
    return this.muzzle.getWorldPosition(out);
  }
  dirWorld(out) {
    this.muzzle.getWorldQuaternion(_q);
    return out.set(0, 0, -1).applyQuaternion(_q);
  }

  fire(S, aimO, aimD) {
    const from = this.muzzleWorld(new THREE.Vector3());
    const dir = aimD ? aimD.clone() : this.dirWorld(new THREE.Vector3());
    const origin = aimO ? aimO.clone() : from.clone();
    assistAim(origin, dir, S.range, aimD ? 0.25 : 0.5, aimD ? 0.03 : 0.065);
    const d = new THREE.Vector3();
    for (let p = 0; p < S.pellets; p++) {
      spreadDir(dir, S.spread, d);
      if (this.def.projectile) {
        G.proj.grenade(from, d, S);
        continue;
      }
      this.ray(origin, d, S, from);
    }
    G.fx.muzzle(from, dir, 'fire');
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * 6.28;
    this.flash.scale.setScalar((this.def.pellets ? 0.42 : 0.28) + Math.random() * 0.08);
    this.flashT = 0.05;
    G.audio.gun(this.def.sfx, from);
    this.recoil = Math.min(1.4, this.recoil + this.def.recoil);
    if (this.holder) G.player.pulse(this.holder, Math.max(0.45, this.def.haptic), this.def.auto ? 35 : 90);
  }

  ray(o, d, S, from) {
    const hits = collectHits(o, d, S.range, _hits);
    const tg = groundT(o, d);
    let pierce = S.pierce;
    let endT = Math.min(S.range, tg);
    for (const h of hits) {
      if (h.t > tg) break;
      const pt = new THREE.Vector3().copy(o).addScaledVector(d, h.t);
      const res = h.obj.takeHit(S.dmg, h.part, pt, d, this) || {};
      this.hitFeedback(res, pt);
      if (res.solid !== false) {
        if (pierce <= 0) {
          endT = h.t;
          break;
        }
        pierce--;
      }
    }
    const end = new THREE.Vector3().copy(o).addScaledVector(d, endT);
    if (endT === tg && tg < S.range) G.fx.dust(end, 3);
    G.fx.tracer(from, end, this.def.tracer, 0.07, this.def.pellets ? 1.1 : 1.8);
  }

  hitFeedback(res, pt) {
    if (!res.enemy) return;
    if (res.head) G.audio.play('headshot');
    else G.audio.play('hit');
    const P = G.player.stats;
    if (P.explosive > 0 && Math.random() < Math.min(1, 0.3 * P.explosive) / (this.def.pellets ? 3 : 1)) {
      G.explode(pt, 1.6 + 0.4 * P.explosive, 18 * P.explosive * P.dmgMul, { small: true });
    }
  }

  fireBeam(dt, S, aimO, aimD) {
    if (!this.firing) {
      this.firing = true;
      G.audio.laserStart();
    }
    if (!INFINITE_AMMO) this.ammo -= 30 * dt;
    if (this.ammo <= 0) {
      this.ammo = 0;
      this.startReload();
      return;
    }
    const from = this.muzzleWorld(new THREE.Vector3());
    const dir = aimD ? aimD.clone() : this.dirWorld(new THREE.Vector3());
    const o = aimO ? aimO.clone() : from.clone();
    assistAim(o, dir, S.range, aimD ? 0.2 : 0.4, aimD ? 0.02 : 0.05);
    const hits = collectHits(o, dir, S.range, _hits);
    const tg = groundT(o, dir);
    let endT = Math.min(S.range, tg);
    this.beamTick = (this.beamTick || 0) - dt;
    const tick = this.beamTick <= 0;
    if (tick) this.beamTick = 0.06;
    for (const h of hits) {
      if (h.t > tg) break;
      const pt = new THREE.Vector3().copy(o).addScaledVector(dir, h.t);
      if (tick) {
        const res = h.obj.takeHit(S.dmg * 0.06, h.part, pt, dir, this) || {};
        if (res.enemy) G.fx.burst('cyan', pt, 4, { speed: 3, size: 0.1, life: 0.3, anchor: 0.5 });
        if (res.enemy && res.head) G.audio.play('hit');
      }
      if (h.obj.isCard) {
        endT = h.t;
        break;
      }
    }
    const end = new THREE.Vector3().copy(o).addScaledVector(dir, endT);
    if (endT === tg) G.fx.burst('cyan', end, 2, { speed: 2, size: 0.15, life: 0.3, anchor: 1 });
    const len = from.distanceTo(end);
    this.beam.visible = true;
    this.beam.scale.set(1 + Math.sin(G.time * 60) * 0.25, 1 + Math.sin(G.time * 60) * 0.25, len);
    // alinha o feixe do cano até o ponto final (no desktop a mira vem da câmera)
    this.muzzle.updateWorldMatrix(true, false);
    const local = this.muzzle.worldToLocal(end.clone()).normalize();
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), local);
    if (this.holder) G.player.pulse(this.holder, 0.35, 30);
  }
  stopBeam() {
    if (this.firing) {
      this.firing = false;
      G.audio.laserStop();
    }
    if (this.beam) this.beam.visible = false;
  }

  update(dt) {
    if (this.lerpT < 1) {
      this.lerpT = Math.min(1, this.lerpT + dt / this.lerpDur);
      const k = 1 - Math.pow(1 - this.lerpT, 3);
      this.root.position.lerpVectors(this.fromP, this.toP, k);
      this.root.quaternion.slerpQuaternions(this.fromQ, this.toQ, k);
    }
    this.cool -= dt;
    const S = this.stats;
    if (!this.holder && this.ammo < S.mag && this.reloadT <= 0) this.startReload(true);
    let spinX = 0;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      const k = 1 - Math.max(0, this.reloadT) / this.reloadDur;
      spinX = -k * Math.PI * 2; // giro estilo velho oeste
      if (this.reloadT <= 0) {
        this.ammo = S.mag;
        if (this.holder) {
          G.audio.play('reload');
          G.player.pulse(this.holder, 0.3, 40);
        }
      }
    }
    if (this.holder !== null && this.holder.desktop) spinX *= 0.5;
    this.recoil = damp(this.recoil, 0, 14, dt);
    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt / 0.15);
      this.root.scale.setScalar(0.4 + 0.6 * (1 - Math.pow(1 - this.pop, 3)));
    }
    this.kick.position.set(0, this.recoil * 0.015, this.recoil * 0.08);
    this.kick.rotation.set(this.recoil * 0.6 + spinX, 0, 0);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }
    if (this.spinner) {
      this.spinAngle += this.spin * dt * 40;
      this.spinner.rotation.z = this.spinAngle;
    }
    const frac = clamp(this.ammo / S.mag, 0, 1);
    this.ammoBar.scale.z = Math.max(0.02, frac);
    this.ammoBar.position.z = this.ammoBar.userData.z0 ?? (this.ammoBar.userData.z0 = this.ammoBar.position.z);
    this.ammoBar.material.color.setRGB(1 - frac, 0.3 + frac * 0.7, 0.2);
    if (this.reloadT > 0) this.ammoBar.material.color.setRGB(1, 0.8, 0);
    this.laser.visible = !!this.holder && G.xr && this.reloadT <= 0 && !this.firing;
  }

  dispose() {
    this.stopBeam();
    this.root.parent?.remove(this.root);
    this.root.traverse((o) => {
      if (o.isMesh && !o.userData.shared) o.geometry.dispose();
    });
  }
}
