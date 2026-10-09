import * as THREE from 'three';
import { G, rand, pick, clamp, damp, chance, weightedPick } from './ctx.js';
import { loadFonts } from './text.js';
import { AudioSys } from './audio.js';
import { FX, PX } from './fx.js';
import { World, HORIZON } from './world.js';
import { Player } from './player.js';
import { Hud } from './hud.js';
import { Hazards } from './hazards.js';
import { Projectiles } from './projectiles.js';
import { Enemies } from './enemies.js';
import { Waves, isBossWave } from './waves.js';
import { Crows } from './buddy.js';
import { POW } from './hazards.js';
import { Cards, drawTarget, drawInfo, drawTitle, drawToggle } from './upgrades.js';
import { TruckEvent } from './truck.js';
import { toWorld, updateTrack, TRACK } from './curve.js';

// arma que o caminhão derruba ao fim de cada onda (depois disso: turbo em todas)
const REWARDS = ['magnum', 'tommy', 'bazooka', 'autoshotgun', 'gatling', 'homing', 'flyingv', 'tesla'];

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
    G.truck.clear();
    G.crows.clear();
    G.waves.active = false;
    G.pow.gold = G.pow.boom = G.pow.slow = 0;
    G.dropless = 0;
  }

  toTitle() {
    G.state = 'title';
    this.after = null;
    this.resetWorld();
    if (G.world.themeIdx !== 0) G.world.jumpTheme(0);
    G.player.reset();
    G.furyT = 0;
    G.combo = 0;
    if (G.audio.music) G.audio.music.setMode('menu');
    this.showTitleCards();
  }

  showTitleCards() {
    const vr = G.xr;
    const how = vr
      ? ['#PILOTAR', 'Mão esquerda: segure GRIP e gire o controle (ou incline a cabeça)', '#ACELERAR', 'GATILHO ESQUERDO: quanto mais aperta, mais rápido (até ~300 km/h)', '#ATIRAR', 'Mão direita: GATILHO • A / B troca arma', '#EXTRAS', 'X buzina • Y recentraliza • clique no analógico: música']
      : ['#MIRAR / ATIRAR', 'Mouse + clique', '#PILOTAR', 'A / D  •  W acelera  S freia', '#ARMAS', '1 a 9 ou rodinha', '#EXTRAS', 'Espaço buzina • M liga/desliga música'];
    G.cards.show([
      { ghost: true, w: 4.2, h: 1.65, cw: 1024, ch: 400, y: 3.35, z: -4.8, draw: drawTitle, face: false },
      { x: -1.6, y: 1.55, z: -3.4, draw: (g, w, h) => drawInfo(g, w, h, 'COMO JOGAR', how) },
      { x: 0, y: 1.55, z: -3.6, draw: (g, w, h) => drawTarget(g, w, h, 'ACELERAR!', 'atire aqui pra começar'), onPick: () => this.start() },
      {
        toggle: true, x: 0, y: 0.47, z: -3.4, w: 0.9, h: 0.38, cw: 420, ch: 180,
        draw: (g, w, h) => drawToggle(g, w, h, '🎸 MÚSICA', G.audio.musicOn),
        onToggle: () => G.audio.toggleMusic(),
      },
      {
        x: 1.6, y: 1.55, z: -3.4,
        draw: (g, w, h) => drawInfo(g, w, h, 'RECORDE', [`#PONTOS`, `${this.best.score}`, '#MAIOR ONDA', `${this.best.wave}`, '', 'Quanto mais rápido, mais pontos! Atire nas caixas pra pegar power-ups.']),
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
    G.cards.hide();
    const hp = G.player.stats.maxHp;
    G.player.hp = hp;
    this.nextWave();
  }

  nextWave() {
    G.wave++;
    G.state = 'wave';
    // cada onda é uma região nova da viagem pelos EUA
    const th = G.world.setTheme(G.wave - 1);
    G.waves.start(G.wave, G.wave > 8 ? `${th.name} • VOLTA ${Math.floor((G.wave - 1) / 8) + 1}` : th.name);
    G.audio.music && G.audio.music.setMode(isBossWave(G.wave) ? 'boss' : 'combat');
    G.audio.play('wave');
  }

  waveCleared() {
    if (G.state !== 'wave') return;
    G.state = 'cleared';
    const bonus = 250 * G.wave;
    G.score += bonus;
    const boss = isBossWave(G.wave);
    if (G.wave === 8) G.hud.announce('COAST TO COAST!', `Atravessou os EUA! BÔNUS +${bonus}`, '#60ff80', 3);
    else G.hud.announce('ONDA LIMPA!', `BÔNUS +${bonus}`, '#60ff80', 2);
    G.audio.play('clear');
    G.audio.music && G.audio.music.setMode('calm');
    const reward = REWARDS[G.wave - 1] || 'turbo';
    // caminhão derruba a arma nova (e mais umas caixas com vida e power-ups) -> próxima onda
    this.later(1.6, () => {
      if (G.state !== 'cleared') return;
      G.truck.start(reward, () => this.later(3, () => G.state === 'cleared' && this.nextWave()), boss ? 4 : 2);
    });
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
    for (const k of ['gold', 'boom', 'slow']) if (G.pow[k] > 0) G.pow[k] -= dt;
  }
}

// multiplicador de pontos pela velocidade (acelerar vale a pena!)
export const speedMult = () => 1 + Math.max(0, G.speed - 34) / 48;

// ---------------------------------------------------------------- eventos globais
G.onKill = (e, info) => {
  G.kills++;
  G.combo++;
  const P = G.player;
  G.comboT = 3.5;
  const mult = 1 + 0.1 * (G.combo - 1);
  const sm = speedMult();
  let pts = e.T.score * mult * (info.headshot ? 1.5 : 1) * sm;
  G.score += pts;
  // cada punk derrubado devolve um pouco de vida (+ Vampiro do Asfalto)
  if (!info.boss) P.heal(info.headshot ? 4 : 2);
  else P.heal(25);
  e.center(_v);
  _v.y += 1.2;
  toWorld(_v);
  let label = `+${Math.round(pts)}`;
  let color = '#ffd21e';
  if (info.boss) {
    label = 'CHEFÃO DERRUBADO!';
    color = '#ff3030';
    G.hud.announce('CHEFÃO DERRUBADO!', `+${Math.round(pts)}`, '#ff3030', 3);
  } else if (info.headshot) {
    label = 'HEADSHOT!';
    color = '#ff4040';
  } else if (info.crash) {
    label = 'ACIDENTE!';
  } else if (info.blast) {
    label = 'PELOS ARES!';
    color = '#ff8a20';
  } else if (info.zap) {
    label = 'ELETROCUTADO!';
    color = '#80e0ff';
  } else if (info.burn) {
    label = 'TORRADO!';
    color = '#ff8020';
  } else if (sm > 1.25) {
    label += ` x${sm.toFixed(1)}`;
    color = '#40e8ff';
  }
  G.fx.text(label, _v, color, info.boss ? 1 : 0.5);
  if (G.combo >= 3 && G.combo % 3 === 0) G.fx.text(`COMBO x${G.combo}!`, _v.clone().add(new THREE.Vector3(0, 0.7, 0)), '#ff4fd0', 0.55);
  G.audio.play('kill', _v);
  P.pulseAll(0.4, 60);
  // power-ups: chance do tipo x Sorte Grande, e um garantido a cada 16 abates sem nada
  if (!info.boss) {
    G.dropless = (G.dropless || 0) + 1;
    const base = { punk: 0.06, kamikaze: 0.05 }[e.type] ?? 0.11;
    if (G.dropless >= 16 || chance(base)) {
      G.dropless = 0;
      const low = P.hp / P.stats.maxHp;
      const kind = weightedPick(Object.keys(POW), (k) => ({ gold: 1, boom: 1, slow: 0.8, fury: 0.7, health: low < 0.35 ? 1.6 : low < 0.6 ? 0.8 : 0.25, crow: 0.6 })[k]);
      G.hazards.drop(kind, e.x, e.z);
    }
  } else G.hazards.drop('gold', e.x, e.z);
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
  const hemi = new THREE.HemisphereLight(0xffe0c0, 0x7a4a30, 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd0a0, 2.0);
  sun.position.set(-0.4, 1, 0.7);
  scene.add(sun);
  G.lights = { hemi, dir: sun };

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
  G.truck = new TruckEvent(scene);
  G.crows = new Crows(G.player.rig);
  G.game = new Game();
  G.furyT = 0;
  G.aggro = 1;
  G.game.toTitle();

  const resize = () => {
    if (!window.innerWidth || !window.innerHeight) return; // aba escondida
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (!G.xr) PX.value = renderer.domElement.height / 2;
  };
  window.addEventListener('resize', resize);
  resize();

  setupUI(renderer);

  // um passo de simulação (também usado pelos testes: G.step roda sem renderizar)
  const tick = (dt) => {
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
    G.truck.update(gdt);
    G.crows.update(gdt);
    G.cards.update(dt, G.player.aimRays());
    G.fx.update(gdt);
    G.hud.update(dt);
    G.game.update(gdt);
    if (G.hitMark > 0) {
      G.hitMark -= dt;
      hitCross(G.hitMark > 0);
    }
    if (G.audio.ctx) {
      G.audio.setEngine(G.player.speed, Math.max(0, G.player.thr));
      G.camera.getWorldDirection(_v);
      G.audio.setListener(G.player.headW, new THREE.Vector3(-_v.z, 0, _v.x).normalize());
    }
  };
  G.step = (n = 1, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) tick(dt);
  };

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
    if (!G.paused) tick(dt);
    renderer.render(scene, camera);
  });
}

let crossHit = false;
function hitCross(on) {
  if (on === crossHit) return;
  crossHit = on;
  $('cross').classList.toggle('hit', on);
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
  const btnMusic = $('btnMusic');
  G.onMusicChange = (on) => {
    btnMusic.textContent = on ? '🎵 Música: ligada' : '🔇 Música: desligada';
    G.cards.redrawToggles();
    G.hud.announce(on ? 'MÚSICA LIGADA' : 'MÚSICA DESLIGADA', '', on ? '#60ff80' : '#ff5050', 1.2);
  };
  btnMusic.textContent = G.audio.musicOn ? '🎵 Música: ligada' : '🔇 Música: desligada';
  btnMusic.addEventListener('click', () => {
    G.audio.init();
    G.audio.toggleMusic();
  });
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
    if (e.code === 'KeyQ') G.player.deskCycle(1);
    if (e.code === 'KeyM') G.audio.toggleMusic();
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
