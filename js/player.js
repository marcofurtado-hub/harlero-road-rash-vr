import * as THREE from 'three';
import { G, clamp, damp, rand } from './ctx.js';
import * as Models from './models.js';
import { Gun } from './weapons.js';
import { ROAD_HALF } from './world.js';
import { TRACK_STATE } from './curve.js';

const HEAD = new THREE.Vector3(0, 1.36, 0.02);
const UP = new THREE.Vector3(0, 1, 0);
const GRIP_L = new THREE.Vector3(-0.44, 0.06, 0.27); // manopla esquerda (no grupo do guidão)
// sensibilidade da direção (valores que dão esterço total)
const TWIST_FULL = 0.3; // giro do controle esquerdo (rad, ~17°)
const SLIDE_FULL = 0.14; // mão esquerda pro lado / frente-trás (m)
const LEAN_FULL = 0.14; // cabeça inclinada pro lado (m)
const ROLL_FULL = 0.3; // cabeça tombada (rad, ~17°)
// velocidades (m/s): cruzeiro, acelerador no talo, freio
const V_CRUISE = 34;
const V_MAX = 84; // gatilho esquerdo no talo: ~300 km/h
const V_BRAKE = 16;
const GRAV = 24; // gravidade dos pulos (alta = arcade, pousa rápido)
const dz = (v, z) => (Math.abs(v) < z ? 0 : v - Math.sign(v) * z);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
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
    // guarda as armas que não estão na mão (invisíveis)
    this.stash = new THREE.Group();
    this.stash.visible = false;
    this.rig.add(this.stash);
    // luva fixa na manopla esquerda quando a mão esquerda segura o guidão
    this.barGlove = Models.freeGlove();
    this.barGlove.position.copy(GRIP_L).add(new THREE.Vector3(0, 0.035, 0));
    this.barGlove.rotation.set(0, 0, -Math.PI / 2);
    this.barGlove.scale.x = -1;
    this.barGlove.visible = false;
    this.bike.bars.add(this.barGlove);
    this.barAngle = 0;
    this.headNeutral = 0;
    this.guns = [];
    this.cur = -1;
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
    const hand = { i, controller, grip, glove, src: null, gp: null, side: '', held: null, trig: false, trigPressed: false, btnPrev: [], bar: false, p0: new THREE.Vector3(), q0: new THREE.Quaternion(), hapT: 0 };
    controller.addEventListener('connected', (e) => {
      hand.src = e.data;
      hand.gp = e.data.gamepad || null;
      hand.side = e.data.handedness;
      glove.scale.x = hand.side === 'left' ? -1 : 1;
      glove.visible = true;
      if (hand.side === 'right' && G.xr) this.equipCurrent();
    });
    controller.addEventListener('disconnected', () => {
      this.releaseBar(hand);
      if (hand.held) this.unequip(hand);
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
    controller.addEventListener('squeezestart', () => {
      G.audio.init();
      if (hand.side === 'left') this.grabBar(hand);
    });
    controller.addEventListener('squeezeend', () => this.releaseBar(hand));
    return hand;
  }

  get gunHand() {
    if (!G.xr) return this.desk.hand;
    return this.hands.find((h) => h.side === 'right' && h.src) || null;
  }

  reset() {
    this.x = 0;
    this.vx = 0;
    this.pushV = 0;
    this.speed = 18;
    this.thr = 0;
    this.stats = { maxHp: 100, armor: 0, critMul: 2 };
    this.barThr = 0;
    this.slipT = 0;
    this.boostT = 0;
    this.jumpY = 0;
    this.vy = 0;
    this.air = false;
    this.rampY = 0;
    this.hp = this.stats.maxHp;
    this.hurtFlash = 0;
    this.invulnT = 0;
    this.crashT = 0;
    for (const h of this.allHands()) h.held = null;
    for (const g of this.guns) g.dispose();
    this.guns = [];
    this.cur = -1;
    this.giveWeapon('sawedoff', true);
  }

  allHands() {
    return [...this.hands, this.desk.hand];
  }
  allGuns() {
    return this.guns;
  }
  ownedIds() {
    return this.guns.map((g) => g.id);
  }

  // ------------------------------------------------------------ armas (sempre na mão direita)
  giveWeapon(id, silent = false) {
    let gun = this.guns.find((g) => g.id === id);
    if (gun) {
      gun.level++;
    } else {
      gun = new Gun(id);
      this.guns.push(gun);
      this.stash.add(gun.root);
    }
    this.select(this.guns.indexOf(gun), silent);
    return gun;
  }

  levelUpAll() {
    for (const g of this.guns) g.level = Math.min(g.level + 1, 9);
  }

  select(i, silent = false) {
    if (!this.guns.length) return;
    i = ((i % this.guns.length) + this.guns.length) % this.guns.length;
    const hand = this.gunHand;
    if (hand && hand.held) this.unequip(hand);
    this.cur = i;
    if (hand) this.equip(hand, this.guns[i], silent);
  }
  cycle(dir) {
    if (this.guns.length < 2) return;
    this.select(this.cur + dir);
    const g = this.guns[this.cur];
    const hand = this.gunHand;
    if (G.xr && hand) {
      hand.controller.getWorldPosition(_v);
      _v.y += 0.22;
      G.fx.text(`${g.def.icon} ${g.def.name}`, _v, '#8dff4a', 0.12, 0.9);
    }
  }
  equipCurrent() {
    if (this.cur >= 0) this.select(this.cur, true);
  }

  equip(hand, gun, silent = false) {
    gun.holder = hand;
    hand.held = gun;
    gun.glove.visible = true;
    if (hand.desktop) {
      gun.attachTo(this.camera, DESK_POS, deskQuat(), 0.12);
    } else {
      gun.glove.scale.x = hand.side === 'left' ? -1 : 1;
      hand.controller.add(gun.root);
      gun.root.position.set(0, -0.025, 0.07);
      gun.root.quaternion.identity();
      gun.lerpT = 1;
      hand.glove.visible = false;
      this.pulse(hand, 0.5, 50);
    }
    gun.pop = 0;
    if (!silent) G.audio.play('grab');
  }

  unequip(hand) {
    const gun = hand.held;
    if (!gun) return;
    gun.stopBeam();
    gun.held = false;
    hand.held = null;
    gun.holder = null;
    gun.glove.visible = false;
    this.stash.add(gun.root);
    gun.lerpT = 1;
    if (!hand.desktop) hand.glove.visible = !!hand.src && !hand.bar;
  }

  deskEquip(i) {
    if (i < this.guns.length) this.select(i);
  }
  deskCycle(dir) {
    this.cycle(dir);
  }

  enterXR() {
    const h = this.desk.hand;
    if (h.held) this.unequip(h);
    this.calibrateT = 0.5;
    this.equipCurrent();
  }
  exitXR() {
    for (const h of this.hands) {
      this.releaseBar(h);
      if (h.held) this.unequip(h);
    }
    this.xrOrigin.position.set(0, 0, 0);
    this.xrOrigin.rotation.set(0, 0, 0);
    this.camera.position.copy(HEAD);
    this.camera.quaternion.identity();
    this.equipCurrent();
  }

  // ------------------------------------------------------------ guidão (mão esquerda: GRIP em qualquer lugar)
  handLocal(hand, out) {
    hand.grip.getWorldPosition(out);
    return this.rig.worldToLocal(out);
  }
  handTwist(hand) {
    hand.controller.getWorldQuaternion(_qa);
    _qb.copy(hand.q0).invert();
    _qa.multiply(_qb);
    return wrapA(2 * Math.atan2(_qa.y, _qa.w));
  }
  grabBar(hand) {
    if (hand.held || hand.bar) return;
    hand.bar = true;
    this.handLocal(hand, hand.p0);
    hand.controller.getWorldQuaternion(hand.q0);
    hand.glove.visible = false;
    this.barGlove.visible = true;
    this.pulse(hand, 0.5, 40);
    G.audio.play('grab');
  }
  releaseBar(hand) {
    if (!hand.bar) return;
    hand.bar = false;
    this.barGlove.visible = false;
    hand.glove.visible = !!hand.src && !hand.held;
  }
  barSteer(realDt) {
    const h = this.hands.find((x) => x.bar);
    if (!h) return null;
    const p = this.handLocal(h, _v);
    // girar o controle, mover a mão pro lado ou empurrar/puxar a manopla: tudo vira
    const s = -this.handTwist(h) / TWIST_FULL + (p.x - h.p0.x) / SLIDE_FULL - (p.z - h.p0.z) / SLIDE_FULL;
    h.hapT -= realDt;
    if (h.hapT <= 0) {
      h.hapT = 0.12;
      this.pulse(h, 0.04 + (this.speed / 45) * 0.07, 70);
    }
    return clamp(s, -1, 1);
  }
  // inclinar a cabeça / o corpo pro lado também pilota
  headSteer(realDt) {
    // mede no pescoço (atrás dos olhos) pra que só virar a cabeça pra olhar não esterce
    const neck = this.camera.localToWorld(_a.set(0, -0.06, 0.1));
    const lx = neck.x - this.x - HEAD.x;
    this.headNeutral = damp(this.headNeutral, lx, 0.05, realDt);
    const e = _e.setFromQuaternion(this.camera.getWorldQuaternion(_qa), 'YXZ');
    // olhando pro lado, o deslocamento lateral conta bem menos (evita esterçar ao olhar um punk)
    const facing = Math.max(0, Math.cos(e.y)) ** 2;
    const lean = (dz(lx - this.headNeutral, 0.035) / LEAN_FULL) * facing;
    const roll = dz(-e.z, 0.07) / ROLL_FULL;
    return clamp(lean + roll, -1, 1);
  }

  calibrate() {
    const cam = this.camera;
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    const yaw = e.y;
    this.xrOrigin.rotation.set(0, -yaw, 0);
    const p = cam.position.clone().applyAxisAngle(UP, -yaw);
    this.xrOrigin.position.set(HEAD.x - p.x, HEAD.y - p.y, HEAD.z - p.z);
    this.headNeutral = 0;
  }

  pulse(hand, v, ms) {
    if (!hand || hand.desktop) return;
    const gp = hand.gp;
    try {
      const h = gp && gp.hapticActuators && gp.hapticActuators[0];
      if (h && h.pulse) {
        const pr = h.pulse(clamp(v, 0, 1), ms);
        if (pr && pr.catch) pr.catch(() => {});
      } else if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: v, weakMagnitude: v });
    } catch (e) {
      /* sem vibração */
    }
  }
  pulseAll(v, ms) {
    for (const h of this.hands) this.pulse(h, v, ms);
  }

  // ------------------------------------------------------------ dano
  hitSegment(a, b, r) {
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
    this.invulnT = 0.25; // uma rajada não derruba de uma vez
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
  // mancha de óleo: a moto perde a aderência e desliza de lado
  slip(fromX) {
    if (G.state === 'title' || G.state === 'dead') return;
    if (this.slipT <= 0) {
      this.slipDir = this.x >= fromX ? 1 : -1;
      if (Math.random() < 0.35) this.slipDir *= -1;
      G.audio.play('squeal');
      G.fx.text('ÓLEO!', _v.set(this.x, 2, -3.2), '#c0c0c0', 0.4, 0.6);
    }
    this.slipT = 1.1;
  }
  // rampa: a moto sobe a rampa (y) e no topo decola
  onRamp(y) {
    if (this.air) return;
    this.rampY = Math.max(this.rampY, y);
    this.wasOnRamp = true;
  }
  launch(extra = 1) {
    if (this.air) return;
    this.air = true;
    this.airT = 0;
    this.jumpY = this.rampY;
    this.rampY = 0;
    this.vy = clamp(this.speed * 0.26 * extra, 9, 22);
    G.audio.play('boost');
    this.pulseAll(0.7, 160);
    G.fx.text('DECOLOU!', _v.set(this.x, 2.6 + this.jumpY, -4), '#ffd21e', 0.55, 0.8);
  }
  updateJump(dt) {
    // a pista embaixo também sobe/desce: numa descida a moto fica mais tempo no ar
    const h = TRACK_STATE.h || 0;
    const dh = this.lastH === undefined ? 0 : h - this.lastH;
    this.lastH = h;
    if (!this.air) {
      if (!this.wasOnRamp) this.rampY = damp(this.rampY, 0, 20, dt);
      this.wasOnRamp = false;
      return;
    }
    this.airT += dt;
    this.vy -= GRAV * dt;
    this.jumpY += this.vy * dt - dh;
    if (this.jumpY <= 0) {
      // pouso
      this.jumpY = 0;
      this.air = false;
      const t = this.airT;
      this.speed *= 0.94;
      this.pulseAll(Math.min(1, 0.4 + t * 0.3), 200);
      G.audio.play('crash');
      G.fx.spark(_v.set(this.x, 0.1, -0.6), 26);
      G.fx.dust(_v.set(this.x, 0.1, 0.3), 12);
      if (t > 0.8 && G.state !== 'title') {
        const pts = Math.round(t * 250);
        G.score += pts;
        G.fx.text(t > 2.5 ? `VOO ÉPICO! +${pts}` : `POUSOU! +${pts}`, _v.set(this.x, 2.2, -4), '#40e8ff', 0.5, 1);
      }
    }
  }
  // faixa de turbo: empurrão de velocidade por uns segundos
  boost() {
    this.boostT = 2.6;
    G.audio.play('boost');
    this.pulseAll(0.8, 220);
    G.fx.text('TURBO!', _v.set(this.x, 2.1, -3.4), '#40e8ff', 0.5, 0.8);
  }
  crash() {
    this.speed *= 0.55;
    this.crashT = 0.6;
    this.pulseAll(1, 250);
  }

  aimRays() {
    const rays = [];
    if (G.xr) {
      const h = this.gunHand;
      if (h && h.held) rays.push({ o: h.held.muzzleWorld(new THREE.Vector3()), d: h.held.dirWorld(new THREE.Vector3()) });
    } else rays.push({ o: this.deskAim.o.clone(), d: this.deskAim.d.clone() });
    return rays;
  }

  // ------------------------------------------------------------ loop
  update(dt, realDt) {
    let steer = 0;
    let thr = 0;
    let bar = null;
    let gas = 0;
    if (G.xr) {
      bar = this.barSteer(realDt);
      this.barThr = 0;
      for (const h of this.hands) {
        const gp = h.gp;
        if (!gp) continue;
        const ax = gp.axes;
        const sx = ax.length >= 4 ? ax[2] : ax[0] || 0;
        const sy = ax.length >= 4 ? ax[3] : ax[1] || 0;
        if (Math.abs(sx) > 0.15) steer += sx;
        if (Math.abs(sy) > 0.25) thr = clamp(thr - sy, -1, 1);
        const b = gp.buttons;
        const press = (k) => !!(b[k] && b[k].pressed);
        const edge = (k) => press(k) && !h.btnPrev[k];
        // gatilho lido direto do gamepad todo frame (mais responsivo)
        const t = press(0);
        if (t && !h.btnPrev[0]) h.trigPressed = true;
        h.trig = t;
        // gatilho esquerdo = acelerador analógico
        if (h.side === 'left' && b[0]) gas = Math.max(gas, b[0].value || 0);
        if (h.side === 'right') {
          if (edge(4)) this.cycle(1); // A: próxima arma
          if (edge(5)) this.cycle(-1); // B: arma anterior
        } else {
          if (edge(4)) G.audio.play('horn'); // X: buzina
          if (edge(3)) G.audio.toggleMusic(); // clique no analógico: música
          if (press(5)) {
            // Y segurado: recentraliza
            this.recenterT += realDt;
            if (this.recenterT > 0.5 && this.recenterT - realDt <= 0.5) {
              this.calibrate();
              G.audio.play('grab');
              G.hud.announce('RECENTRALIZADO', '', '#40e8ff', 1.2);
            }
          } else this.recenterT = 0;
        }
        for (const k of [0, 3, 4, 5]) h.btnPrev[k] = press(k);
      }
      if (this.calibrateT > 0) {
        this.calibrateT -= realDt;
        if (this.calibrateT <= 0) {
          if (this.camera.position.lengthSq() > 0.01) this.calibrate();
          else this.calibrateT = 0.2;
        }
      }
      if (bar !== null) steer += bar;
      thr = clamp(thr + gas, -1, 1);
      if (G.state !== 'title') steer += this.headSteer(realDt);
    } else {
      const k = this.desk.keys;
      if (k.KeyA || k.ArrowLeft) steer -= 1;
      if (k.KeyD || k.ArrowRight) steer += 1;
      if (k.KeyW || k.ArrowUp || k.ShiftLeft) thr += 1;
      if (k.KeyS || k.ArrowDown) thr -= 1;
    }
    steer = clamp(steer, -1, 1);
    if (G.state === 'dead') {
      steer = 0;
      thr = -1;
    }
    this.thr = thr;
    // no óleo quase não tem aderência: a moto escorrega pro lado e o guidão responde pouco
    const slip = this.slipT > 0 ? Math.min(1, this.slipT / 0.5) : 0;
    if (this.slipT > 0) {
      this.slipT -= dt;
      this.pushV += this.slipDir * 9 * slip * dt;
      if (Math.random() < 0.5) G.fx.burst('smoke', _v.set(this.x, 0.1, 0.9), 1, { speed: 0.5, size: 0.3, sizeEnd: 0.8, life: 0.6, anchor: 1, alpha: 0.5 });
      if (Math.random() < 0.3) this.pulseAll(0.3, 40);
    }
    this.vx = damp(this.vx, steer * 11, 10 - 8.6 * slip, dt) + this.pushV;
    this.pushV = 0;
    this.x += this.vx * dt;
    if (Math.abs(this.x) > ROAD_HALF) {
      this.x = Math.sign(this.x) * ROAD_HALF;
      this.vx = 0;
    }
    const offroad = Math.abs(this.x) > 7.7;
    let target = G.state === 'title' ? 16 : G.state === 'dead' ? 4 : thr >= 0 ? V_CRUISE + thr * (V_MAX - V_CRUISE) : V_CRUISE + thr * (V_CRUISE - V_BRAKE);
    // ladeira abaixo embala MUITO, ladeira acima segura
    if (G.state !== 'dead') target += clamp(-TRACK_STATE.slope * 70, -8, 30);
    // turbo da faixa
    if (this.boostT > 0) {
      this.boostT -= dt;
      target += 24 * Math.min(1, this.boostT / 1.2);
    }
    target = Math.min(target, 105); // teto ~380 km/h
    if (offroad) target = Math.min(target, 24);
    if (this.crashT > 0) this.crashT -= dt;
    const k = this.crashT > 0 ? 0.5 : this.boostT > 0 ? 3.5 : target > this.speed ? (thr > 0.2 ? 1.6 : 0.9) : this.air ? 0.2 : 2.4;
    this.speed = damp(this.speed, target, k, dt);
    G.speed = this.speed;
    if (offroad && Math.random() < 0.3) this.pulseAll(0.15, 20);
    // vento passando: quanto mais rápido, mais riscos de ar
    const fast = (this.speed - 36) / 14;
    if (fast > 0 && G.state !== 'title') {
      const n = fast * 2.2 + Math.random();
      for (let i = 0; i < n; i++) {
        const sx = Math.random() < 0.5 ? -1 : 1;
        G.fx.burst('wind', _v.set(this.x + sx * rand(1.2, 5), rand(0.4, 3.2), rand(-30, -8)), 1, { speed: 0, size: 0.035, sizeEnd: 0.02, life: 0.5, anchor: 1.6, alpha: 0.7 });
      }
    }
    if (!G.xr) {
      const fov = 75 + clamp(fast, 0, 1) * 9;
      if (Math.abs(this.camera.fov - fov) > 0.05) {
        this.camera.fov = damp(this.camera.fov, fov, 3, realDt);
        this.camera.updateProjectionMatrix();
      }
    }

    this.updateJump(dt);
    this.rig.position.set(this.x, this.jumpY + this.rampY, 0);
    this.barAngle = damp(this.barAngle, -steer * 0.35, 14, dt);
    this.bike.bars.rotation.y = this.barAngle;
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

    // arma
    const gh = this.gunHand;
    if (G.xr) {
      for (const h of this.hands) {
        if (h.held && h === gh) h.held.handleTrigger(dt, h.trig, h.trigPressed);
        h.trigPressed = false;
      }
    } else {
      const h = this.desk.hand;
      if (h.held) h.held.handleTrigger(dt, h.trig, h.trigPressed, this.deskAim.o.clone(), this.deskAim.d.clone());
      h.trigPressed = false;
    }
    for (const g of this.guns) if (g.holder) g.update(dt);

    // efeitos de vida
    if (this.invulnT > 0) this.invulnT -= dt;
    this.hurtFlash = damp(this.hurtFlash, 0, 3, realDt);
    const low = this.hp / this.stats.maxHp < 0.3 && G.state !== 'title' && G.state !== 'dead' ? 0.35 + Math.sin(G.time * 6) * 0.15 : 0;
    const fury = G.furyT > 0 ? 0.25 : 0;
    const slow = G.pow && G.pow.slow > 0 ? 0.3 : 0;
    const vi = Math.max(this.hurtFlash, low);
    const u = this.vig.material.uniforms;
    u.uI.value = Math.max(vi, fury, slow);
    if (vi >= Math.max(fury, slow)) u.uC.value.setRGB(0.75, 0, 0);
    else if (slow > fury) u.uC.value.setRGB(0.2, 0.45, 1);
    else u.uC.value.setRGB(1, 0.35, 0);
    this.vig.visible = this.vig.material.uniforms.uI.value > 0.01;
  }
}

const _e = new THREE.Euler();
const DESK_POS = new THREE.Vector3(0.2, -0.2, -0.55);
function deskQuat() {
  const to = new THREE.Vector3(0, 0, -25).sub(DESK_POS).normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), to);
}
