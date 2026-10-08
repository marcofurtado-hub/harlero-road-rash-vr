// Evento entre ondas: caminhão desgovernado derruba um baú; a arma nova voa direto pra sua mão
import * as THREE from 'three';
import { G, rand, clamp, damp } from './ctx.js';
import * as Models from './models.js';
import { WEAPONS } from './weapons.js';
import { toWorld } from './curve.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function glowSprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
}

export class TruckEvent {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
  }

  // reward: id da arma ou 'turbo' (turbina todas as armas)
  start(reward, onDone) {
    this.clear();
    this.active = true;
    this.reward = reward;
    this.onDone = onDone;
    this.phase = 'chase';
    this.flaps = null;
    this.t = 0;
    const P = G.player;
    const m = Models.runawayTruck();
    this.truck = new THREE.Group();
    this.truck.add(m.body, m.front, m.rear);
    this.wheels = [m.front, m.rear];
    this.baseX = P.x > 0 ? -4.5 : 4.5;
    this.x = this.baseX;
    this.z = 48;
    this.truck.position.set(this.x, 0, this.z);
    this.scene.add(this.truck);
    this.hornT = 0;
    G.hud.announce('CAMINHÃO DESGOVERNADO!', 'ele tá perdendo a carga...', '#ffd21e', 2.6);
    G.audio.play('horn');
  }

  clear() {
    for (const k of ['truck', 'chest', 'gun', 'glow']) {
      if (this[k]) {
        this.scene.remove(this[k]);
        this[k].traverse((o) => o.isMesh && !o.userData.shared && o.geometry.dispose());
        this[k] = null;
      }
    }
    this.active = false;
  }

  update(dt) {
    if (!this.active) return;
    const P = G.player;
    const speed = G.speed;
    this.t += dt;

    // ---- caminhão
    if (this.truck) {
      const tr = this.truck;
      if (this.phase === 'chase') {
        this.z -= 15 * dt; // ultrapassa
        this.x = this.baseX + Math.sin(this.t * 2.6) * 1.8;
        tr.rotation.y = -Math.cos(this.t * 2.6) * 0.22;
        tr.rotation.z = Math.sin(this.t * 2.6) * 0.05;
        if (this.z < -17) this.dropChest();
      } else {
        // sai da pista pro deserto e explode longe
        this.z -= 12 * dt;
        this.x += Math.sign(this.baseX || 1) * 7 * dt;
        tr.rotation.y = damp(tr.rotation.y, -Math.sign(this.baseX || 1) * 0.6, 2, dt);
        tr.rotation.z = damp(tr.rotation.z, Math.sign(this.baseX || 1) * 0.25, 2, dt);
        if (!this.boomed && Math.abs(this.x) > 15) {
          this.boomed = true;
          G.explode(toWorld(_v.set(this.x, 2, this.z)), 8, 0, {});
          tr.visible = false;
        }
      }
      for (const w of this.wheels) w.rotation.x -= ((speed + 15) * dt) / 0.5;
      tr.position.set(this.x, 0, this.z);
      this.hornT -= dt;
      if (this.hornT <= 0 && this.phase === 'chase') {
        this.hornT = rand(0.5, 1.1);
        G.audio.play('horn');
      }
      if (Math.random() < 0.5) G.fx.smoke(toWorld(_v.set(this.x + rand(-1, 1), 0.2, this.z + 2.6)), 1, 0.6);
      if (this.boomed && this.t > this.boomT + 3) {
        this.scene.remove(tr);
        this.truck = null;
      }
    }

    // ---- baú caindo
    if (this.chest) {
      const c = this.chest;
      const u = c.userData;
      if (!u.landed) {
        u.vel.y -= 14 * dt;
        c.position.addScaledVector(u.vel, dt);
        c.rotation.x += u.spin * dt;
        if (c.position.y <= 0) {
          c.position.y = 0;
          u.landed = true;
          c.rotation.set(0, rand(-0.4, 0.4), 0);
          this.burstChest();
        }
      } else {
        c.position.z += speed * dt;
        // abas abrindo / tampa voando
        if (this.flaps) for (const fl of this.flaps) {
          fl.v -= 12 * dt;
          fl.f.position.y += fl.v * dt;
          fl.f.position.x += fl.s * 1.2 * dt;
          fl.f.rotation.z += fl.s * 6 * dt;
          if (fl.f.position.y < 0) fl.f.visible = false;
        }
        if (c.position.z > 30) {
          this.scene.remove(c);
          this.chest = null;
        }
      }
    }

    // ---- arma voando pra mão
    if (this.gun) {
      const g = this.gun;
      const u = g.userData;
      u.t += dt;
      g.rotation.y += dt * 9;
      if (u.t < 0.45) {
        // sobe girando
        g.position.y += dt * 2.2;
        g.position.z += speed * dt * 0.3;
        u.p0 = g.position.clone();
      } else {
        const k = clamp((u.t - 0.45) / 0.55, 0, 1);
        const e = k * k * (3 - 2 * k);
        const target = this.handTarget(_w);
        const mid = _v.copy(u.p0).lerp(target, 0.5);
        mid.y += 1.2;
        // bezier quadrática até a mão
        g.position.set(
          (1 - e) * (1 - e) * u.p0.x + 2 * (1 - e) * e * mid.x + e * e * target.x,
          (1 - e) * (1 - e) * u.p0.y + 2 * (1 - e) * e * mid.y + e * e * target.y,
          (1 - e) * (1 - e) * u.p0.z + 2 * (1 - e) * e * mid.z + e * e * target.z
        );
        g.scale.setScalar(1.6 - e * 0.6);
        if (k >= 1) this.catchGun();
      }
      if (this.glow) {
        this.glow.position.copy(g.position);
        this.glow.scale.setScalar(0.9 + Math.sin(this.t * 20) * 0.15);
      }
      if (Math.random() < 0.6) G.fx.burst('spark', toWorld(_v.copy(g.position)), 1, { speed: 1, size: 0.07, life: 0.4, anchor: 0 });
    }
    if (this.phase === 'done' && !this.truck && !this.chest) this.active = false;
  }

  handTarget(out) {
    const P = G.player;
    const h = P.gunHand;
    if (G.xr && h && h.controller) return h.controller.getWorldPosition(out);
    return P.camera.localToWorld(out.set(0.2, -0.2, -0.55));
  }

  dropChest() {
    this.phase = 'drop';
    this.boomT = this.t;
    const c = Models.parcel();
    c.position.set(this.x, 1.6, this.z + 3.5);
    const P = G.player;
    Object.assign(c.userData, { vel: new THREE.Vector3((P.x - this.x) * 0.9, 4.5, 9), spin: rand(4, 7), landed: false });
    this.scene.add(c);
    this.chest = c;
    G.audio.play('crash', c.position);
    G.fx.text('CAIU UMA ENCOMENDA!', toWorld(_v.copy(c.position).add(_w.set(0, 1.5, 0))), '#ffd21e', 0.6);
  }

  burstChest() {
    const c = this.chest;
    const flatP = c.position.clone().add(_w.set(0, 0.4, 0));
    const p = toWorld(_v.copy(flatP));
    G.audio.play('crash', p);
    G.audio.play('pickup');
    // a caixa estoura: abas/tampa voam e sobe papelão/lasca de madeira
    const wood = c.userData.wood;
    G.fx.burst(wood ? 'wood' : 'cardboard', p, 34, { speed: 6, size: 0.16, sizeEnd: 0.12, life: 1.1, grav: 12, up: 3.5, anchor: 0.7, drag: 0.5 });
    G.fx.burst('paper', p, 18, { speed: 3, size: 0.1, sizeEnd: 0.08, life: 1.4, grav: 2, up: 3, anchor: 0.7, drag: 1.5 });
    G.fx.burst('spark', p, 16, { speed: 4, size: 0.07, life: 0.5, up: 2, anchor: 0.5 });
    G.fx.dust(p, 10);
    this.flaps = c.userData.flaps.map((f) => ({ f, s: f.userData.side || (Math.random() < 0.5 ? -1 : 1), v: rand(4, 6) }));
    // a arma (ou turbo) salta do baú
    let model;
    if (this.reward === 'turbo') {
      model = Models.furyPick();
      model.scale.setScalar(0.6);
    } else {
      model = Models.gunModel(this.reward).model;
    }
    const g = new THREE.Group();
    g.add(model);
    g.position.copy(flatP);
    g.scale.setScalar(1.6);
    g.userData = { t: 0, p0: flatP.clone() };
    this.scene.add(g);
    this.gun = g;
    this.glow = glowSprite(this.reward === 'turbo' ? 'rgba(255,60,60,0.9)' : 'rgba(255,210,60,0.9)');
    this.glow.scale.setScalar(1);
    this.scene.add(this.glow);
    G.slowmoT = 0.7;
  }

  catchGun() {
    const P = G.player;
    if (this.reward === 'turbo') {
      P.levelUpAll();
      G.hud.announce('ARMAS TURBINADAS!', '+dano +cadência em todas', '#ff4040', 2.6);
    } else {
      P.giveWeapon(this.reward);
      const d = WEAPONS[this.reward];
      G.hud.announce('NOVA ARMA!', `${d.icon} ${d.name.toUpperCase()}`, '#60ff80', 2.6);
    }
    G.audio.play('select');
    P.pulseAll(0.8, 180);
    G.fx.burst('spark', this.handTarget(_v), 25, { speed: 3, size: 0.05, life: 0.4, anchor: 0 });
    this.scene.remove(this.gun);
    this.scene.remove(this.glow);
    this.gun = null;
    this.glow = null;
    this.phase = 'done';
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  }
}
