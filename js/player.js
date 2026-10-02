import * as THREE from 'three';
import { G, clamp, damp } from './ctx.js';
import * as Models from './models.js';
import { Gun } from './weapons.js';
import { ROAD_HALF } from './world.js';

const HEAD = new THREE.Vector3(0, 1.36, 0.02);
const UP = new THREE.Vector3(0, 1, 0);
const GRAB_R = 0.25;
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const FWD = new THREE.Vector3(0, 0, -1);

function segSegDist2(p1, q1, p2, q2) {
  // distância² entre segmentos (Real-Time Collision Detection)
  const d1 = _sA.subVectors(q1, p1);
  const d2 = _sB.subVectors(q2, p2);
  const r = _sC.subVectors(p1, p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  let s;
  let t;
  if (a <= 1e-9 && e <= 1e-9) return r.dot(r);
  if (a <= 1e-9) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = d1.dot(r);
    if (e <= 1e-9) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = d1.dot(d2);
      const den = a * e - b * b;
      s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  const c1 = _sD.copy(p1).addScaledVector(d1, s);
  const c2 = _sE.copy(p2).addScaledVector(d2, t);
  return c1.distanceToSquared(c2);
}
const _sA = new THREE.Vector3();
const _sB = new THREE.Vector3();
const _sC = new THREE.Vector3();
const _sD = new THREE.Vector3();
const _sE = new THREE.Vector3();

function vignette() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uC: { value: new THREE.Color(0.8, 0, 0) } },
    vertexShader: `varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vV = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uI; uniform vec3 uC; varying vec3 vV;
      void main(){ vec3 n = normalize(vV); float a = length(n.xy); float k = smoothstep(0.3, 0.95, a) * uI; gl_FragColor = vec4(uC, k); }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), mat);
  m.renderOrder = 999;
  m.frustumCulled = false;
  return m;
}

export class Player {
  constructor(scene, camera, renderer) {
    this.renderer = renderer;
    this.camera = camera;
    this.head = HEAD;
    this.rig = new THREE.Group();
    scene.add(this.rig);
    this.bike = Models.playerBike();
    this.rig.add(this.bike.group);
    this.xrOrigin = new THREE.Group();
    this.rig.add(this.xrOrigin);
    this.xrOrigin.add(camera);
    camera.position.copy(HEAD);
    this.headW = new THREE.Vector3().copy(HEAD);
    this.vig = vignette();
    camera.add(this.vig);
    // coldres
    this.slots = Models.SLOT_DEFS.map((d, i) => {
      const a = new THREE.Object3D();
      a.position.fromArray(d.pos);
      a.rotation.fromArray(d.rot);
      this.bike.group.add(a);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.008, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xffd21e, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.position.set(0, 0.06, 0.0);
      ring.rotation.x = Math.PI / 2;
      a.add(ring);
      return { anchor: a, gun: null, ring, i, def: d };
    });
    this.hands = [0, 1].map((i) => this.makeHand(i));
    this.desk = { yaw: 0, pitch: 0, ndc: new THREE.Vector2(), keys: {}, hand: { desktop: true, held: null, trig: false, trigPressed: false } };
    this.deskAim = { o: new THREE.Vector3(), d: new THREE.Vector3(0, 0, -1) };
    this.recenterT = 0;
    this.reset();
  }

  makeHand(i) {
    const r = this.renderer;
    const controller = r.xr.getController(i);
    const grip = r.xr.getControllerGrip(i);
    this.xrOrigin.add(controller);
    this.xrOrigin.add(grip);
    const glove = Models.freeGlove();
    glove.visible = false;
    grip.add(glove);
    const hand = { i, controller, grip, glove, src: null, gp: null, side: '', held: null, trig: false, trigPressed: false, near: -1, aPrev: false, xPrev: false };
    controller.addEventListener('connected', (e) => {
      hand.src = e.data;
      hand.gp = e.data.gamepad || null;
      hand.side = e.data.handedness;
      glove.visible = !hand.held;
      glove.scale.x = hand.side === 'left' ? -1 : 1;
    });
    controller.addEventListener('disconnected', () => {
      hand.src = null;
      hand.gp = null;
      glove.visible = false;
    });
    controller.addEventListener('selectstart', () => {
      hand.trig = true;
      hand.trigPressed = true;
      G.audio.init();
    });
    controller.addEventListener('selectend', () => {
      hand.trig = false;
    });
    controller.addEventListener('squeezestart', () => this.onGrip(hand));
    return hand;
  }

  reset() {
    this.x = 0;
    this.vx = 0;
    this.pushV = 0;
    this.speed = 18;
    this.thr = 0;
    this.stats = {
      maxHp: 100, armor: 0, dmgMul: 1, rateMul: 1, reloadMul: 1, spreadMul: 1, critMul: 2, magMul: 1,
      pierce: 0, explosive: 0, lifesteal: 0, regen: 0, bulletTime: false,
    };
    this.perkCount = {};
    this.hp = this.stats.maxHp;
    this.hurtFlash = 0;
    this.invulnT = 0;
    this.crashT = 0;
    // armas iniciais
    for (const h of this.allHands()) if (h.held) h.held = null;
    for (const s of this.slots) {
      if (s.gun) s.gun.dispose();
      s.gun = null;
    }
    this.setSlotGun(0, new Gun('revolver'));
    this.setSlotGun(1, new Gun('sawedoff'));
    for (const h of this.hands) h.glove.visible = !!h.src;
    if (!G.xr) this.deskEquip(0);
    this.updateRings();
  }

  allHands() {
    return [...this.hands, this.desk.hand];
  }
  allGuns() {
    return this.slots.filter((s) => s.gun).map((s) => s.gun);
  }
  ownedIds() {
    return this.allGuns().map((g) => g.id);
  }

  setSlotGun(i, gun) {
    const s = this.slots[i];
    s.gun = gun;
    gun.slot = i;
    gun.holder = null;
    s.anchor.add(gun.root);
    gun.root.position.set(0, 0, 0);
    gun.root.quaternion.identity();
    gun.lerpT = 1;
  }

  slotFor(id) {
    const free = this.slots.find((s) => !s.gun);
    if (free) return { slot: free.i, replaces: null };
    let worst = null;
    for (const s of this.slots) if (!worst || s.gun.score < worst.gun.score) worst = s;
    return { slot: worst.i, replaces: worst.gun };
  }

  giveWeapon(id) {
    const { slot, replaces } = this.slotFor(id);
    const gun = new Gun(id);
    let holder = null;
    if (replaces) {
      holder = replaces.holder;
      if (holder) holder.held = null;
      replaces.dispose();
    }
    this.setSlotGun(slot, gun);
    if (holder) this.equip(holder, gun);
    else if (!G.xr && !this.desk.hand.held) this.deskEquip(slot);
    this.updateRings();
  }

  // ------------------------------------------------------------ empunhar
  onGrip(hand) {
    G.audio.init();
    hand.grip.getWorldPosition(_v);
    let best = -1;
    let bd = GRAB_R;
    for (const s of this.slots) {
      const can = (s.gun && !s.gun.holder) || (hand.held && hand.held.slot === s.i);
      if (!can) continue;
      s.anchor.getWorldPosition(_a);
      const d = _a.distanceTo(_v);
      if (d < bd) {
        bd = d;
        best = s.i;
      }
    }
    if (best < 0) return;
    const s = this.slots[best];
    if (hand.held && hand.held.slot === best) this.holster(hand);
    else {
      if (hand.held) this.holster(hand);
      this.equip(hand, s.gun);
    }
  }

  equip(hand, gun) {
    gun.holder = hand;
    hand.held = gun;
    gun.glove.visible = true;
    if (hand.desktop) {
      gun.glove.visible = true;
      gun.attachTo(this.camera, DESK_POS, deskQuat(), 0.15);
    } else {
      gun.glove.scale.x = hand.side === 'left' ? -1 : 1;
      gun.holdIn(hand.controller);
      hand.glove.visible = false;
      this.pulse(hand, 0.4, 40);
    }
    G.audio.play('grab');
    this.updateRings();
  }

  holster(hand) {
    const gun = hand.held;
    if (!gun) return;
    gun.stopBeam();
    hand.held = null;
    gun.holder = null;
    gun.glove.visible = false;
    gun.attachTo(this.slots[gun.slot].anchor);
    if (!hand.desktop) {
      hand.glove.visible = !!hand.src;
      this.pulse(hand, 0.25, 30);
    }
    G.audio.play('holster');
    this.updateRings();
  }

  deskEquip(i) {
    const s = this.slots[i];
    if (!s || !s.gun) return;
    const hand = this.desk.hand;
    if (hand.held === s.gun) return;
    if (hand.held) this.holster(hand);
    if (s.gun.holder) return;
    this.equip(hand, s.gun);
  }

  deskCycle(dir) {
    const guns = this.slots.filter((s) => s.gun);
    if (!guns.length) return;
    const cur = this.desk.hand.held ? guns.findIndex((s) => s.gun === this.desk.hand.held) : -1;
    const next = guns[(cur + dir + guns.length) % guns.length];
    this.deskEquip(next.i);
  }

  enterXR() {
    const h = this.desk.hand;
    if (h.held) this.holster(h);
    this.calibrateT = 0.5;
  }
  exitXR() {
    for (const h of this.hands) if (h.held) this.holster(h);
    this.xrOrigin.position.set(0, 0, 0);
    this.xrOrigin.rotation.set(0, 0, 0);
    this.camera.position.copy(HEAD);
    this.camera.quaternion.identity();
    this.deskEquip(0);
  }

  calibrate() {
    const cam = this.camera;
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    const yaw = e.y;
    this.xrOrigin.rotation.set(0, -yaw, 0);
    const p = cam.position.clone().applyAxisAngle(UP, -yaw);
    this.xrOrigin.position.set(HEAD.x - p.x, HEAD.y - p.y, HEAD.z - p.z);
  }

  pulse(hand, v, ms) {
    if (!hand || hand.desktop) return;
    const gp = hand.gp;
    try {
      const h = gp && gp.hapticActuators && gp.hapticActuators[0];
      if (h && h.pulse) {
        const pr = h.pulse(clamp(v, 0, 1), ms);
        if (pr && pr.catch) pr.catch(() => {});
      }
      else if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: v, weakMagnitude: v });
    } catch (e) {
      /* sem vibração */
    }
  }
  pulseAll(v, ms) {
    for (const h of this.hands) this.pulse(h, v, ms);
  }

  updateRings() {
    for (const s of this.slots) s.ring.visible = !!s.gun;
  }

  // ------------------------------------------------------------ dano
  hitSegment(a, b, r) {
    // cápsula do corpo: da cabeça até o peito
    const top = this.headW;
    const bot = _a.set(top.x, top.y - 0.55, top.z + 0.05);
    const rr = 0.27 + r;
    return segSegDist2(a, b, top, bot) < rr * rr;
  }

  hurt(dmg, from) {
    if (G.state === 'title' || G.state === 'dead') return;
    if (this.invulnT > 0 || dmg <= 0) return;
    const d = dmg * (1 - this.stats.armor);
    this.hp -= d;
    this.hurtFlash = Math.min(1, this.hurtFlash + 0.35 + d / 30);
    G.audio.play('hurt');
    this.pulseAll(0.9, 120);
    if (this.hp <= 0) {
      this.hp = 0;
      G.game.gameOver();
    }
  }
  heal(n) {
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
  }
  push(v) {
    this.pushV += v;
  }
  crash() {
    this.speed *= 0.55;
    this.crashT = 0.6;
    this.pulseAll(1, 250);
  }

  aimRays() {
    const rays = [];
    if (G.xr) {
      for (const h of this.hands) {
        if (!h.held) continue;
        rays.push({ o: h.held.muzzleWorld(new THREE.Vector3()), d: h.held.dirWorld(new THREE.Vector3()) });
      }
    } else {
      rays.push({ o: this.deskAim.o.clone(), d: this.deskAim.d.clone() });
    }
    return rays;
  }

  // ------------------------------------------------------------ loop
  update(dt, realDt) {
    let steer = 0;
    let thr = 0;
    if (G.xr) {
      for (const h of this.hands) {
        const gp = h.gp;
        if (!gp) continue;
        const ax = gp.axes;
        const sx = ax.length >= 4 ? ax[2] : ax[0] || 0;
        const sy = ax.length >= 4 ? ax[3] : ax[1] || 0;
        if (Math.abs(sx) > 0.15) steer += sx;
        if (Math.abs(sy) > 0.25) thr = clamp(thr - sy, -1, 1);
        const a = gp.buttons[4] && gp.buttons[4].pressed;
        if (a && !h.aPrev) G.audio.play('horn');
        h.aPrev = a;
        const b = gp.buttons[5] && gp.buttons[5].pressed;
        if (b) {
          this.recenterT += realDt / 2;
          if (this.recenterT > 0.5 && this.recenterT - realDt / 2 <= 0.5) {
            this.calibrate();
            G.audio.play('grab');
            G.hud.announce('RECENTRALIZADO', '', '#40e8ff', 1.2);
          }
        }
      }
      if (!this.hands.some((h) => h.gp && h.gp.buttons[5] && h.gp.buttons[5].pressed)) this.recenterT = 0;
      if (this.calibrateT > 0) {
        this.calibrateT -= realDt;
        if (this.calibrateT <= 0) {
          if (this.camera.position.lengthSq() > 0.01) this.calibrate();
          else this.calibrateT = 0.2;
        }
      }
    } else {
      const k = this.desk.keys;
      if (k.KeyA || k.ArrowLeft) steer -= 1;
      if (k.KeyD || k.ArrowRight) steer += 1;
      if (k.KeyW || k.ArrowUp) thr += 1;
      if (k.KeyS || k.ArrowDown) thr -= 1;
    }
    steer = clamp(steer, -1, 1);
    if (G.state === 'dead') {
      steer = 0;
      thr = -1;
    }
    this.thr = thr;
    this.vx = damp(this.vx, steer * 9.5, 6, dt) + this.pushV;
    this.pushV = 0;
    this.x += this.vx * dt;
    if (Math.abs(this.x) > ROAD_HALF) {
      this.x = Math.sign(this.x) * ROAD_HALF;
      this.vx = 0;
    }
    const offroad = Math.abs(this.x) > 7.7;
    let target = G.state === 'title' ? 16 : G.state === 'dead' ? 4 : 30 + thr * (thr > 0 ? 13 : 12);
    if (offroad) target = Math.min(target, 22);
    if (this.crashT > 0) this.crashT -= dt;
    this.speed = damp(this.speed, target, this.crashT > 0 ? 0.5 : 1.3, dt);
    G.speed = this.speed;
    if (offroad && Math.random() < 0.3) this.pulseAll(0.15, 20);

    this.rig.position.x = this.x;
    this.bike.bars.rotation.y = -this.vx * 0.022;
    this.bike.wheel.rotation.x -= (this.speed * dt) / 0.34;
    this.bike.group.position.y = Math.sin(G.time * 55) * 0.0012 * (this.speed / 30) + (offroad ? Math.sin(G.time * 31) * 0.006 : 0);
    if (Math.random() < 0.25) G.fx.dust(_v.set(this.x + 0.3, 0.05, 1.2), 1);

    const lightgun = !G.xr && !document.pointerLockElement;
    if (!G.xr) {
      const n = this.desk.ndc;
      if (lightgun) this.camera.rotation.set(n.y * 0.16, -n.x * 0.28, 0, 'YXZ');
      else this.camera.rotation.set(this.desk.pitch, this.desk.yaw, 0, 'YXZ');
    }
    this.rig.updateMatrixWorld(true);
    this.camera.getWorldPosition(this.headW);
    if (!G.xr) {
      // mira do desktop: centro da tela (pointer lock) ou cursor do mouse (modo light-gun)
      const aim = this.deskAim;
      if (lightgun) {
        _ray.setFromCamera(this.desk.ndc, this.camera);
        aim.o.copy(_ray.ray.origin);
        aim.d.copy(_ray.ray.direction);
      } else {
        this.camera.getWorldPosition(aim.o);
        this.camera.getWorldDirection(aim.d);
      }
      const g = this.desk.hand.held;
      if (g && g.lerpT >= 1) {
        const local = this.camera.worldToLocal(_v.copy(aim.o).addScaledVector(aim.d, 25));
        g.root.quaternion.setFromUnitVectors(FWD, local.sub(DESK_POS).normalize());
      }
    }

    // armas
    if (G.xr) {
      for (const h of this.hands) {
        if (h.held) {
          h.held.handleTrigger(dt, h.trig, h.trigPressed);
          h.near = -1;
        } else this.proximity(h);
        h.trigPressed = false;
      }
    } else {
      const h = this.desk.hand;
      if (h.held) h.held.handleTrigger(dt, h.trig, h.trigPressed, this.deskAim.o.clone(), this.deskAim.d.clone());
      h.trigPressed = false;
    }
    for (const s of this.slots) {
      if (!s.gun) continue;
      s.gun.update(dt);
      const near = this.hands.some((h) => h.near === s.i);
      s.ring.material.opacity = near ? 0.95 : s.gun.holder ? 0.08 : 0.3;
      s.ring.scale.setScalar(near ? 1.3 : 1);
    }

    // vida / efeitos
    if (this.stats.regen > 0 && G.state !== 'dead' && G.state !== 'title') this.heal(this.stats.regen * dt);
    if (this.invulnT > 0) this.invulnT -= dt;
    this.hurtFlash = damp(this.hurtFlash, 0, 3, realDt);
    const low = this.hp / this.stats.maxHp < 0.3 && G.state !== 'title' && G.state !== 'dead' ? 0.35 + Math.sin(G.time * 6) * 0.15 : 0;
    const fury = G.furyT > 0 ? 0.25 : 0;
    const vi = Math.max(this.hurtFlash, low);
    this.vig.material.uniforms.uI.value = Math.max(vi, fury);
    if (vi >= fury) this.vig.material.uniforms.uC.value.setRGB(0.75, 0, 0);
    else this.vig.material.uniforms.uC.value.setRGB(1, 0.35, 0);
    this.vig.visible = this.vig.material.uniforms.uI.value > 0.01;
  }

  proximity(h) {
    if (!h.src) return;
    h.grip.getWorldPosition(_v);
    let best = -1;
    let bd = GRAB_R;
    for (const s of this.slots) {
      if (!s.gun || s.gun.holder) continue;
      const d = s.anchor.getWorldPosition(_a).distanceTo(_v);
      if (d < bd) {
        bd = d;
        best = s.i;
      }
    }
    if (best !== h.near && best >= 0) this.pulse(h, 0.15, 15);
    h.near = best;
  }
}

const DESK_POS = new THREE.Vector3(0.2, -0.2, -0.55);
function deskQuat() {
  const to = new THREE.Vector3(0, 0, -25).sub(DESK_POS).normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), to);
}
