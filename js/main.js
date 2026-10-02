import * as THREE from 'three';
import { G, rand, pick, clamp, damp, chance } from './ctx.js';
import { loadFonts } from './text.js';
import { AudioSys } from './audio.js';
import { FX, PX } from './fx.js';
import { World, HORIZON } from './world.js';
import { Player } from './player.js';
import { Hud } from './hud.js';
import { Hazards } from './hazards.js';
import { Projectiles } from './projectiles.js';
import { Enemies } from './enemies.js';
import { Waves } from './waves.js';
import { Cards, makeOptions, drawUpgrade, drawTarget, drawInfo, drawTitle } from './upgrades.js';
import { PROGRESSION, WEAPONS } from './weapons.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem('harlero_best') || '{"score":0,"wave":0}');
  } catch (e) {
    return { score: 0, wave: 0 };
  }
}
function saveBest(b) {
  try {
    localStorage.setItem('harlero_best', JSON.stringify(b));
  } catch (e) {
    /* ok */
  }
}

class Game {
  constructor() {
    this.timer = 0;
    this.after = null;
    this.best = loadBest();
  }

  later(t, fn) {
    this.timer = t;
    this.after = fn;
  }

  resetWorld() {
    G.enemies.clear();
    G.hazards.clear();
    G.proj.clear();
    G.waves.active = false;
  }

  toTitle() {
    G.state = 'title';
    this.after = null;
    this.resetWorld();
    G.player.reset();
    G.furyT = 0;
    G.combo = 0;
    if (G.audio.music) G.audio.music.setMode('menu');
    this.showTitleCards();
  }

  showTitleCards() {
    const vr = G.xr;
    const how = vr
      ? ['#PILOTAR', 'Segure a manopla do guidão com GRIP e gire o controle (ou analógico)', '#ARMA', 'Mão direita no coldre da coxa + GRIP', '#ATIRAR', 'GATILHO • munição infinita', '#EXTRAS', '↑↓ acelera/freia • A/X buzina • B/Y recentraliza']
      : ['#MIRAR / ATIRAR', 'Mouse + clique', '#PILOTAR', 'A / D  •  W acelera  S freia', '#ARMAS', '1 2 3 4 ou rodinha', '#BUZINA', 'Espaço'];
    G.cards.show([
      { ghost: true, w: 4.2, h: 1.65, cw: 1024, ch: 400, y: 3.05, z: -4.8, draw: drawTitle, face: false },
      { x: -1.6, y: 1.25, z: -3.4, draw: (g, w, h) => drawInfo(g, w, h, 'COMO JOGAR', how) },
      { x: 0, y: 1.25, z: -3.6, draw: (g, w, h) => drawTarget(g, w, h, 'ACELERAR!', vr ? 'pegue a arma e atire aqui' : 'atire aqui pra começar'), onPick: () => this.start() },
      {
        x: 1.6, y: 1.25, z: -3.4,
        draw: (g, w, h) => drawInfo(g, w, h, 'RECORDE', [`#PONTOS`, `${this.best.score}`, '#MAIOR ONDA', `${this.best.wave}`, '', 'Dica: tiro na cabeça dá crítico. Atire nos barris vermelhos perto dos punks!']),
      },
    ]);
  }

  start() {
    G.score = 0;
    G.wave = 0;
    G.kills = 0;
    G.combo = 0;
    G.furyT = 0;
    this.resetWorld();
    const hp = G.player.stats.maxHp;
    G.player.hp = hp;
    this.nextWave();
  }

  nextWave() {
    G.wave++;
    G.state = 'wave';
    G.waves.start(G.wave);
    G.audio.music && G.audio.music.setMode(G.wave % 5 === 0 ? 'boss' : 'combat');
    G.audio.play('wave');
  }

  waveCleared() {
    if (G.state !== 'wave') return;
    G.state = 'cleared';
    const bonus = 250 * G.wave;
    G.score += bonus;
    const gift = PROGRESSION[G.wave];
    if (gift && !G.player.ownedIds().includes(gift)) {
      G.player.giveWeapon(gift);
      G.hud.announce('NOVA ARMA!', `${WEAPONS[gift].name.toUpperCase()} NO COLDRE`, '#60ff80', 3);
      G.player.pulseAll(0.6, 200);
    } else G.hud.announce('ONDA LIMPA!', `BÔNUS +${bonus}`, '#60ff80', 2.4);
    G.audio.play('clear');
    G.audio.music && G.audio.music.setMode('calm');
    this.later(2.4, () => this.showUpgrades());
  }

  showUpgrades() {
    G.state = 'upgrade';
    const opts = makeOptions();
    const xs = [-1.55, 0, 1.55];
    G.cards.show(
      opts.map((o, i) => ({
        x: xs[i], y: 1.35, z: -3.6,
        draw: (g, w, h) => drawUpgrade(g, w, h, o),
        onPick: () => {
          o.apply();
          G.hud.announce(o.title.toUpperCase(), 'PREPARE-SE...', '#40e8ff', 2);
          this.later(2.2, () => this.nextWave());
        },
      }))
    );
    G.hud.announce('ESCOLHA UM UPGRADE', 'atire na carta', '#ffd21e', 2.5);
  }

  gameOver() {
    if (G.state === 'dead' || G.state === 'title') return;
    G.state = 'dead';
    G.slowmoT = 1.5;
    G.waves.active = false;
    G.enemies.flee();
    G.cards.hide();
    const newBest = G.score > this.best.score;
    this.best = { score: Math.max(this.best.score, Math.floor(G.score)), wave: Math.max(this.best.wave, G.wave) };
    saveBest(this.best);
    G.audio.play('gameover');
    G.audio.music && G.audio.music.setMode('menu');
    G.hud.announce('FIM DA LINHA', newBest ? 'NOVO RECORDE!' : `ONDA ${G.wave}`, '#ff3030', 3.2);
    G.player.pulseAll(1, 400);
    this.later(3, () => {
      G.cards.show([
        {
          x: -0.85, y: 1.3, z: -3.5,
          draw: (g, w, h) => drawInfo(g, w, h, newBest ? 'NOVO RECORDE!' : 'RESULTADO', ['#PONTOS', `${Math.floor(G.score)}`, '#ONDA', `${G.wave}`, '#ABATES', `${G.kills}`, '#RECORDE', `${this.best.score}`], newBest ? '#60ff80' : '#ffd21e'),
        },
        {
          x: 0.85, y: 1.3, z: -3.5,
          draw: (g, w, h) => drawTarget(g, w, h, 'DE NOVO!', 'atire pra voltar pra estrada', '#ff8a20'),
          onPick: () => this.restart(),
        },
      ]);
    });
  }

  restart() {
    this.resetWorld();
    G.player.reset();
    this.start();
  }

  update(dt) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0 && this.after) {
        const f = this.after;
        this.after = null;
        f();
      }
    }
    if (G.comboT > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) G.combo = 0;
    }
    if (G.furyT > 0) {
      G.furyT -= dt;
      if (G.furyT <= 0 && G.audio.music) G.audio.music.lead = false;
    }
  }
}

// ---------------------------------------------------------------- eventos globais
G.onKill = (e, info) => {
  G.kills++;
  G.combo++;
  G.comboT = 3.5;
  const mult = 1 + 0.1 * (G.combo - 1);
  let pts = e.T.score * mult * (info.headshot ? 1.5 : 1);
  G.score += pts;
  const P = G.player;
  if (P.stats.lifesteal) P.heal(P.stats.lifesteal);
  e.center(_v);
  _v.y += 1.2;
  let label = `+${Math.round(pts)}`;
  let color = '#ffd21e';
  if (info.boss) {
    label = 'CHEFÃO DERRUBADO!';
    color = '#ff3030';
    G.hud.announce('CHEFÃO DERRUBADO!', `+${Math.round(pts)}`, '#ff3030', 3);
  } else if (info.headshot) {
    label = 'HEADSHOT!';
    color = '#ff4040';
    if (P.stats.bulletTime) G.slowmoT = 0.9;
  } else if (info.crash) {
    label = 'ACIDENTE!';
  } else if (info.blast) {
    label = 'PELOS ARES!';
    color = '#ff8a20';
  }
  G.fx.text(label, _v, color, info.boss ? 1 : 0.5);
  if (G.combo >= 3 && G.combo % 3 === 0) G.fx.text(`COMBO x${G.combo}!`, _v.clone().add(new THREE.Vector3(0, 0.7, 0)), '#ff4fd0', 0.55);
  G.audio.play('kill', _v);
  P.pulseAll(0.4, 60);
  // drops
  if (!info.boss) {
    if (chance(0.11)) G.hazards.drop('health', e.x, e.z);
    else if (chance(0.035)) G.hazards.drop('fury', e.x, e.z);
  } else G.hazards.drop('health', e.x, e.z - 5);
};

G.explode = (p, r, dmg, o = {}) => {
  G.fx.explosion(p, o.small ? r * 0.5 : r * 0.8);
  if (!o.quiet) G.audio.play('explosion', p);
  if (o.fire) G.fx.fire(p, 30, 0.6, 0.6);
  G.enemies.blast(p, r, dmg);
  G.hazards.blast(p, r);
  G.proj.blast(p, r);
  const P = G.player;
  const d = Math.hypot(P.x - p.x, p.z, P.headW.y - 0.5 - p.y);
  if (o.hurtPlayer && d < r * 0.9) P.hurt(o.playerDmg * (1 - (d / r) * 0.5), p);
  if (!o.small) {
    const k = clamp(1 - d / 40, 0, 1);
    if (k > 0) P.pulseAll(k * 0.8, 90);
  }
};

// ---------------------------------------------------------------- setup
async function boot() {
  await loadFonts();
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(1);
  const scale = parseFloat(new URLSearchParams(location.search).get('scale'));
  if (scale > 0) renderer.xr.setFramebufferScaleFactor(scale);
  $('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(HORIZON);
  scene.fog = new THREE.Fog(HORIZON, 70, 290);
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1600);
  scene.add(new THREE.HemisphereLight(0xffe0c0, 0x7a4a30, 2.0));
  const sun = new THREE.DirectionalLight(0xffd0a0, 2.0);
  sun.position.set(-0.4, 1, 0.7);
  scene.add(sun);

  G.renderer = renderer;
  G.scene = scene;
  G.camera = camera;
  G.audio = new AudioSys();
  G.fx = new FX(scene);
  G.world = new World(scene);
  G.player = new Player(scene, camera, renderer);
  G.hud = new Hud(G.player);
  G.hazards = new Hazards(scene);
  G.proj = new Projectiles(scene);
  G.enemies = new Enemies();
  G.waves = new Waves();
  G.cards = new Cards(G.player.rig);
  G.game = new Game();
  G.furyT = 0;
  G.aggro = 1;
  G.game.toTitle();

  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (!G.xr) PX.value = renderer.domElement.height / 2;
  };
  window.addEventListener('resize', resize);
  resize();

  setupUI(renderer);

  const clock = new THREE.Clock();
  let fpsAcc = 0;
  let fpsN = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    fpsAcc += dt;
    fpsN++;
    if (fpsAcc > 1) {
      G.fps = Math.round(fpsN / fpsAcc);
      fpsAcc = 0;
      fpsN = 0;
      if ($('fps')) $('fps').textContent = G.fps + ' fps';
    }
    if (!G.paused) {
      if (G.slowmoT > 0) {
        G.slowmoT -= dt;
        G.timeScale = damp(G.timeScale, 0.3, 12, dt);
      } else G.timeScale = damp(G.timeScale, 1, 4, dt);
      const gdt = dt * G.timeScale;
      G.time += gdt;
      G.player.update(gdt, dt);
      G.world.update(gdt);
      G.hazards.update(gdt);
      G.waves.update(gdt);
      G.enemies.update(gdt);
      G.proj.update(gdt);
      G.cards.update(dt, G.player.aimRays());
      G.fx.update(gdt);
      G.hud.update(dt);
      G.game.update(gdt);
      if (G.audio.ctx) {
        G.audio.setEngine(G.player.speed, Math.max(0, G.player.thr));
        G.camera.getWorldDirection(_v);
        G.audio.setListener(G.player.headW, new THREE.Vector3(-_v.z, 0, _v.x).normalize());
      }
    }
    renderer.render(scene, camera);
  });
}

// ---------------------------------------------------------------- UI / entrada
function lockPointer(canvas) {
  try {
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    /* sem pointer lock (iframe) */
  }
}

function setupUI(renderer) {
  const overlay = $('overlay');
  const btnVR = $('btnVR');
  const btnPC = $('btnPC');
  const msg = $('vrmsg');
  const canvas = renderer.domElement;
  const dash = G.hud.canvas;
  dash.classList.add('dash2d');
  document.body.appendChild(dash);

  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
      if (ok) {
        btnVR.disabled = false;
        msg.textContent = 'Quest detectado. Bota o headset e bora!';
      } else msg.textContent = 'VR não disponível neste navegador — use o Quest Browser (via HTTPS).';
    });
  } else msg.textContent = window.isSecureContext ? 'WebXR não suportado aqui.' : 'WebXR precisa de HTTPS (ou localhost). Veja o README.';

  btnVR.addEventListener('click', async () => {
    G.audio.init();
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      session.addEventListener('end', () => {
        G.xr = false;
        G.player.exitXR();
        overlay.classList.remove('hidden');
        document.body.classList.remove('playing');
        PX.value = renderer.domElement.height / 2;
        if (G.state === 'title') G.game.showTitleCards();
      });
      session.addEventListener('visibilitychange', () => {
        G.paused = session.visibilityState !== 'visible';
      });
      await renderer.xr.setSession(session);
      G.xr = true;
      PX.value = 950;
      G.player.enterXR();
      overlay.classList.add('hidden');
      if (G.state === 'title') G.game.showTitleCards();
    } catch (e) {
      msg.textContent = 'Falhou ao entrar no VR: ' + e.message;
    }
  });

  btnPC.addEventListener('click', () => {
    G.audio.init();
    overlay.classList.add('hidden');
    document.body.classList.add('playing');
    G.paused = false;
    lockPointer(canvas);
    if (G.state === 'title') G.game.showTitleCards();
  });

  canvas.addEventListener('click', () => {
    if (!G.xr && document.body.classList.contains('playing') && document.pointerLockElement !== canvas) lockPointer(canvas);
  });
  document.addEventListener('pointerlockchange', () => {
    if (G.xr) return;
    if (document.pointerLockElement !== canvas && document.body.classList.contains('playing')) {
      G.paused = true;
      $('pause').classList.remove('hidden');
    } else {
      G.paused = false;
      $('pause').classList.add('hidden');
      cross.style.left = '50%';
      cross.style.top = '50%';
    }
  });
  $('pause').addEventListener('click', () => {
    lockPointer(canvas);
    G.paused = false;
    $('pause').classList.add('hidden');
  });

  const desk = G.player.desk;
  const cross = $('cross');
  // sem pointer lock: modo light-gun (a mira segue o cursor)
  const cursorAim = (e) => {
    const r = canvas.getBoundingClientRect();
    desk.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    cross.style.left = e.clientX + 'px';
    cross.style.top = e.clientY + 'px';
  };
  document.addEventListener('mousemove', (e) => {
    if (G.xr) return;
    if (document.pointerLockElement === canvas) {
      desk.yaw = clamp(desk.yaw - e.movementX * 0.0022, -1.7, 1.7);
      desk.pitch = clamp(desk.pitch - e.movementY * 0.0022, -1.1, 0.9);
      return;
    }
    cursorAim(e);
  });
  document.addEventListener('mousedown', (e) => {
    if (G.xr || e.button !== 0 || !document.body.classList.contains('playing')) return;
    if (document.pointerLockElement !== canvas) cursorAim(e);
    desk.hand.trig = true;
    desk.hand.trigPressed = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) desk.hand.trig = false;
  });
  document.addEventListener('wheel', (e) => {
    if (G.xr || !document.body.classList.contains('playing')) return;
    G.player.deskCycle(e.deltaY > 0 ? 1 : -1);
  });
  document.addEventListener('keydown', (e) => {
    desk.keys[e.code] = true;
    if (G.xr) return;
    if (e.code.startsWith('Digit')) G.player.deskEquip(parseInt(e.code.slice(5), 10) - 1);
    if (e.code === 'KeyR' && desk.hand.held) desk.hand.held.startReload();
    if (e.code === 'KeyQ') G.player.deskCycle(1);
    if (e.code === 'Space') {
      G.audio.play('horn');
      e.preventDefault();
    }
  });
  document.addEventListener('keyup', (e) => {
    desk.keys[e.code] = false;
  });
}

window.G = G; // útil pra debug no console
boot();
