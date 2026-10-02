import * as THREE from 'three';
import { G, rand, pick, damp, chance, clamp } from './ctx.js';
import { curveMaterial, updateTrack, TRACK, TRACK_STATE } from './curve.js';
import { MAT } from './builder.js';
import * as Models from './models.js';
import * as SC from './scenery.js';
import { canvasTex, FW, FB, fitFont, strokeText } from './text.js';

export const ROAD_W = 18;
export const ROAD_HALF = 8.2; // limite jogável
const ROAD_LEN = 340;
const ROAD_Z0 = 40;
const TILE = 24;
const SPAN = 340; // faixa de reciclagem do cenário
const FAR = -305;
export const HORIZON = 0xf0a070;

// ------------------------------------------------------------------ fases (viagem pelos EUA)
// cores do céu em sRGB; sunY/sunS = altura/tamanho do sol; back = horizonte; groundY = chão rebaixado (ponte)
export const THEMES = [
  { id: 'arizona', name: 'ARIZONA • ROTA 66', top: 0x1a1446, mid: 0xc0406a, hor: 0xf0a070, ground: 0xc98d5a, groundY: 0, fog: [80, 300], sunY: 45, sunS: 1.1, clouds: 0.25, back: 'mesas', light: [0xffe0c0, 0x7a4a30, 0xffd0a0], curvy: 0.6, hilly: 0.6 },
  { id: 'canyon', name: 'GRAND CANYON', top: 0x1e4a9a, mid: 0x5a9ad8, hor: 0xf2c08a, ground: 0xb8643a, groundY: 0, fog: [90, 320], sunY: 260, sunS: 0.6, clouds: 0.8, back: 'mesas', light: [0xfff0dc, 0x8a4a2a, 0xffffff], curvy: 1.0, hilly: 0.9 },
  { id: 'deathvalley', name: 'DEATH VALLEY', top: 0x3a7ac8, mid: 0x9ac8f0, hor: 0xf8ecd8, ground: 0xe8dcc0, groundY: 0, fog: [70, 280], sunY: 330, sunS: 0.7, clouds: 0.2, back: 'mesas', light: [0xffffff, 0xa89070, 0xfff4e0], curvy: 0.3, hilly: 0.35 },
  { id: 'redwood', name: 'FLORESTA DE REDWOOD', top: 0x2a5a7a, mid: 0x7aaab8, hor: 0xbcd8cc, ground: 0x3a5a2a, groundY: 0, fog: [35, 190], sunY: 240, sunS: 0.5, clouds: 0.6, back: 'hills', light: [0xd8f0e0, 0x2a3a20, 0xfff8e0], curvy: 1.1, hilly: 0.8 },
  { id: 'goldengate', name: 'GOLDEN GATE • SAN FRANCISCO', top: 0x2a6ac8, mid: 0x78b4ec, hor: 0xd8ecf8, ground: 0x2a6a9a, groundY: -30, fog: [90, 340], sunY: 300, sunS: 0.6, clouds: 1, back: 'city', light: [0xffffff, 0x2a4a6a, 0xfff4e0], curvy: 0.15, hilly: 0.1 },
  { id: 'iowa', name: 'FAZENDAS DE IOWA', top: 0x2a6ad0, mid: 0x80b8f0, hor: 0xe0f0ff, ground: 0x7a9a3a, groundY: 0, fog: [90, 330], sunY: 320, sunS: 0.65, clouds: 1, back: 'hills', light: [0xffffff, 0x4a6a2a, 0xfff0d0], curvy: 0.4, hilly: 1.1 },
  { id: 'chicago', name: 'CHICAGO', top: 0x3a5a8a, mid: 0x8aa0c0, hor: 0xd0d8e0, ground: 0x6a6a6e, groundY: 0, fog: [80, 300], sunY: 220, sunS: 0.55, clouds: 0.9, back: 'city', light: [0xf0f4ff, 0x4a4a50, 0xfff0e0], curvy: 0.35, hilly: 0.15 },
  { id: 'dc', name: 'WASHINGTON D.C.', top: 0x2a5ab8, mid: 0x88b8ec, hor: 0xf0e8f0, ground: 0x5a8a3a, groundY: 0, fog: [90, 330], sunY: 280, sunS: 0.6, clouds: 0.8, back: 'city', light: [0xffffff, 0x4a6a3a, 0xfff4e8], curvy: 0.35, hilly: 0.25 },
];

function drawRoad(g, w, h) {
  g.fillStyle = '#3b3a3e';
  g.fillRect(0, 0, w, h);
  // ruído do asfalto
  for (let i = 0; i < 9000; i++) {
    const v = 40 + Math.random() * 40;
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  // remendos e rachaduras
  for (let i = 0; i < 6; i++) {
    g.fillStyle = 'rgba(20,20,22,0.35)';
    g.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 20 + Math.random() * 80);
  }
  g.strokeStyle = 'rgba(15,15,15,0.6)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    let x = Math.random() * w;
    let y = Math.random() * h;
    g.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 30;
      y += Math.random() * 25;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const m = w / ROAD_W;
  // acostamento
  g.fillStyle = '#6b5a48';
  g.fillRect(0, 0, 0.7 * m, h);
  g.fillRect(w - 0.7 * m, 0, 0.7 * m, h);
  // linhas de borda
  g.fillStyle = '#e8e8e0';
  g.fillRect(0.85 * m, 0, 0.18 * m, h);
  g.fillRect(w - 1.03 * m, 0, 0.18 * m, h);
  // faixa dupla amarela
  g.fillStyle = '#f0c020';
  g.fillRect(w / 2 - 0.3 * m, 0, 0.15 * m, h);
  g.fillRect(w / 2 + 0.15 * m, 0, 0.15 * m, h);
  // tracejadas
  g.fillStyle = '#e0e0d8';
  const dash = (3 / TILE) * h;
  for (const x of [-4.2, 4.2]) {
    for (let k = 0; k < 2; k++) g.fillRect(w / 2 + x * m - 0.08 * m, k * (h / 2) + h * 0.1, 0.16 * m, dash);
  }
}

function drawGround(g, w, h) {
  // textura neutra (clara) — a cor de cada fase tinge o chão
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) {
    const v = 190 + Math.random() * 65;
    g.fillStyle = `rgba(${v},${v},${v},0.7)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  for (let i = 0; i < 50; i++) {
    g.fillStyle = 'rgba(120,120,120,0.18)';
    g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, 4 + Math.random() * 16, 2 + Math.random() * 7, 0, 0, Math.PI * 2);
    g.fill();
  }
}

const BILLBOARDS = [
  ['ROUTE 66', 'MAIN STREET OF AMERICA', '#1a3a7a', '#fff'],
  ['MOTEL', '★ TV COLORIDA ★ VAGAS ★', '#b01a2a', '#ffe9a0'],
  ['CERVEJA GELADA', 'PRÓXIMA SAÍDA - 5 MI', '#f0c020', '#2a1a10'],
  ['DINER DA DOLORES', 'TORTA DE MAÇÃ & CAFÉ', '#2aa8a8', '#fff'],
  ['GASOLINA $0.29', 'ÚLTIMO POSTO EM 80 MI', '#d04010', '#fff'],
  ['PUNKS NÃO!', 'SÓ ROCK N ROLL', '#111', '#ff2fa0'],
  ['HARLERO', 'MOTOCICLETAS DESDE 1952', '#5a0a10', '#ffd21e'],
];

function billboardTex([title, sub, bg, fg]) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 10;
    g.strokeRect(12, 12, w - 24, h - 24);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, title, w - 60, 92, FW);
    strokeText(g, title, w / 2, h * 0.42, fg, 'rgba(0,0,0,0.5)', 6);
    fitFont(g, sub, w - 70, 34, FB);
    g.fillStyle = fg;
    g.fillText(sub, w / 2, h * 0.76);
    // desgaste
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
  });
}

function shieldTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(20, 30);
    g.quadraticCurveTo(w / 2, 0, w - 20, 30);
    g.lineTo(w - 26, 150);
    g.quadraticCurveTo(w - 40, 220, w / 2, 250);
    g.quadraticCurveTo(40, 220, 26, 150);
    g.closePath();
    g.fill();
    g.strokeStyle = '#111';
    g.lineWidth = 10;
    g.stroke();
    g.fillStyle = '#111';
    g.textAlign = 'center';
    g.font = `bold 34px ${FB}`;
    g.fillText('US', w / 2, 62);
    g.fillRect(30, 76, w - 60, 6);
    g.font = `bold 120px ${FB}`;
    g.fillText('66', w / 2, 190);
  });
}


class ThemePool {
  // pool instanciado; cada item só aparece se o tipo pertence à fase atual
  constructor(world, scene, geo, mat, count, o) {
    this.w = world;
    this.o = o;
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.items = [];
    for (let i = 0; i < count; i++) {
      const it = { x: 0, y: 0, z: 0, ry: 0, rx: 0, s: 1, sx: 1, sy: 1, i, on: false };
      this.place(it, true);
      this.items.push(it);
    }
    scene.add(this.mesh);
  }
  active() {
    return this.o.themes.includes(this.w.themeId);
  }
  place(it, init) {
    const o = this.o;
    if (o.spacing) it.z = init ? 35 - it.i * o.spacing : it.z - this.items.length * o.spacing;
    else it.z = init ? rand(FAR, 35) : it.z - SPAN;
    it.on = this.active() && (!o.chance || Math.random() < o.chance);
    o.set(it, this.w.dist - it.z);
  }
  update(dz) {
    const m = _m;
    let on = 0;
    for (const it of this.items) {
      it.z += dz;
      if (it.z > 40) this.place(it, false);
      if (it.on) on++;
    }
    // pool sem nenhum item da fase atual: não desenha (economiza GPU no Quest)
    this.mesh.visible = on > 0;
    if (!on) return;
    for (const it of this.items) {
      _e.set(it.rx, it.ry, 0, 'YXZ');
      _q.setFromEuler(_e);
      const k = it.on ? it.s : 0;
      m.compose(_p.set(it.x, it.y, it.z), _q, _sc.set(k * it.sx, k * it.sy, k));
      this.mesh.setMatrixAt(it.i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _sc = new THREE.Vector3();

const side = () => (Math.random() < 0.5 ? -1 : 1);
const T = (...ids) => ids;
const SPAN_BRIDGE = 220;
const cableY = (s) => {
  const u = (((s + 35) % SPAN_BRIDGE) + SPAN_BRIDGE) % SPAN_BRIDGE;
  return 7 + 58 * Math.pow(u / (SPAN_BRIDGE / 2) - 1, 2);
};
const cableSlope = (s) => {
  const u = (((s + 35) % SPAN_BRIDGE) + SPAN_BRIDGE) % SPAN_BRIDGE;
  return ((58 * 2 * (u / (SPAN_BRIDGE / 2) - 1)) / (SPAN_BRIDGE / 2));
};

export class World {
  constructor(scene) {
    this.scene = scene;
    this.dist = 0;
    this.themeIdx = 0;
    this.themeId = THEMES[0].id;
    this.cur = this.paramsOf(THEMES[0]);
    TRACK.reset();
    TRACK.curvy = THEMES[0].curvy;
    TRACK.hilly = THEMES[0].hilly;
    updateTrack(0);
    this.makeSky();
    this.makeGround();
    this.makeRoad();
    this.makeScenery();
    this.applyParams();
  }

  // ---------------------------------------------------------------- fase
  paramsOf(t) {
    const c = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace); // cores cruas (sRGB)
    return {
      top: c(t.top), mid: c(t.mid), hor: c(t.hor), ground: c(t.ground),
      hemiS: c(t.light[0]), hemiG: c(t.light[1]), dir: c(t.light[2]),
      groundY: t.groundY, fogN: t.fog[0], fogF: t.fog[1], sunY: t.sunY, sunS: t.sunS, clouds: t.clouds,
      mesas: t.back === 'mesas' ? 1 : 0, hills: t.back === 'hills' ? 1 : 0, city: t.back === 'city' ? 1 : 0,
    };
  }
  setTheme(i) {
    i = ((i % THEMES.length) + THEMES.length) % THEMES.length;
    this.themeIdx = i;
    const t = THEMES[i];
    this.themeId = t.id;
    this.target = this.paramsOf(t);
    TRACK.curvy = t.curvy;
    TRACK.hilly = t.hilly;
    return t;
  }
  // troca na hora (reinício do jogo / testes): recoloca todo o cenário
  jumpTheme(i) {
    const t = this.setTheme(i);
    this.cur = this.paramsOf(t);
    this.target = null;
    for (const p of this.pools) for (const it of p.items) p.place(it, true);
    for (const b of this.billboards) this.respawnBillboard(b, true, this.billboards.indexOf(b));
    this.diner.visible = ['arizona', 'iowa', 'deathvalley'].includes(this.themeId);
    for (const tw of this.tumbles) this.resetTumble(tw, true);
    this.applyParams();
    return t;
  }
  get theme() {
    return THEMES[this.themeIdx];
  }
  blendParams(dt) {
    if (!this.target) return;
    const k = 1 - Math.exp(-0.45 * dt);
    const a = this.cur;
    const b = this.target;
    for (const key of Object.keys(a)) {
      if (a[key].isColor) a[key].lerp(b[key], k);
      else a[key] += (b[key] - a[key]) * k;
    }
    this.applyParams();
  }
  applyParams() {
    const a = this.cur;
    const u = this.skyMat.uniforms;
    u.top.value.copy(a.top);
    u.mid.value.copy(a.mid);
    u.hor.value.copy(a.hor);
    const toSRGB = (c, out) => out.setRGB(c.r, c.g, c.b, THREE.SRGBColorSpace);
    if (this.scene.fog) {
      toSRGB(a.hor, this.scene.fog.color);
      this.scene.fog.near = a.fogN;
      this.scene.fog.far = a.fogF;
    }
    if (this.scene.background && this.scene.background.isColor) toSRGB(a.hor, this.scene.background);
    toSRGB(a.hor, this.horizonDisk.material.color);
    toSRGB(a.ground, this.groundMat.color);
    this.ground.position.y = a.groundY;
    this.sun.position.y = a.sunY;
    this.sun.scale.setScalar(a.sunS);
    for (const c of this.clouds.children) c.material.opacity = a.clouds * 0.9;
    this.clouds.visible = a.clouds > 0.02;
    for (const [mesh, v] of [[this.backMesas, a.mesas], [this.backHills, a.hills], [this.backCity, a.city]]) {
      mesh.material.opacity = v;
      mesh.visible = v > 0.02;
    }
    if (G.lights) {
      toSRGB(a.hemiS, G.lights.hemi.color);
      toSRGB(a.hemiG, G.lights.hemi.groundColor);
      toSRGB(a.dir, G.lights.dir.color);
    }
  }

  // ---------------------------------------------------------------- céu
  makeSky() {
    this.skyGroup = new THREE.Group();
    const geo = new THREE.SphereGeometry(1100, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color() },
        mid: { value: new THREE.Color() },
        hor: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 0.07, -1).normalize() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.25, h));
          c = mix(c, top, smoothstep(0.25, 0.8, h));
          float s = max(dot(vDir, sunDir), 0.0);
          c += vec3(1.0, 0.75, 0.45) * pow(s, 12.0) * 0.35;
          if (h < 0.0) c = hor;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(geo, this.skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.skyGroup.add(sky);
    const sunTex = canvasTex(256, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#fff8c0');
      gr.addColorStop(0.6, '#ffb04a');
      gr.addColorStop(1, '#ff5a6a');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 6; i++) g.fillRect(0, h * 0.58 + i * i * 2.6 + i * 9, w, 3 + i * 1.6);
    });
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(95, 32), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
    this.sun.position.set(0, 0, -1000);
    this.sun.renderOrder = -9;
    this.skyGroup.add(this.sun);
    this.clouds = SC.cloudSprites(18);
    this.skyGroup.add(this.clouds);
    this.backMesas = SC.retintMesas(Models.backdrop());
    this.backHills = SC.hillsBackdrop();
    this.backCity = SC.cityBackdrop();
    this.backMesas.position.y = 45;
    this.backHills.position.y = 8;
    for (const m of [this.backMesas, this.backHills, this.backCity]) {
      m.renderOrder = -8;
      this.skyGroup.add(m);
    }
    // "chão infinito" na cor do horizonte: esconde a base das montanhas e a parte de baixo do sol
    this.horizonDisk = new THREE.Mesh(new THREE.CircleGeometry(1050, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false }));
    this.horizonDisk.position.y = -1.5;
    this.horizonDisk.renderOrder = -7;
    this.skyGroup.add(this.horizonDisk);
    this.scene.add(this.skyGroup);
  }

  makeGround() {
    const tex = canvasTex(256, 256, drawGround);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 30);
    // faixa de chão que acompanha as curvas e morros da pista
    const geo = new THREE.PlaneGeometry(330, 380, 22, 152);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -0.03, 45 - 190);
    this.groundMat = curveMaterial(new THREE.MeshLambertMaterial({ map: tex }));
    this.ground = new THREE.Mesh(geo, this.groundMat);
    this.ground.frustumCulled = false;
    this.groundTex = tex;
    this.scene.add(this.ground);
  }

  makeRoad() {
    const tex = canvasTex(512, 1024, drawRoad);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, ROAD_LEN / TILE);
    tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(ROAD_W, ROAD_LEN, 1, 170);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.0, ROAD_Z0 - ROAD_LEN / 2);
    const mat = curveMaterial(new THREE.MeshLambertMaterial({ map: tex }));
    this.road = new THREE.Mesh(geo, mat);
    this.road.frustumCulled = false;
    this.roadTex = tex;
    this.scene.add(this.road);
  }

  // ---------------------------------------------------------------- cenário por fase
  makeScenery() {
    const s = this.scene;
    const L = MAT.lit;
    const P = (geo, count, o) => new ThemePool(this, s, geo, L, count, o);
    const DESERT = T('arizona', 'deathvalley', 'canyon');
    this.pools = [
      // deserto / Rota 66
      P(Models.cactusGeo(), 40, { themes: T('arizona', 'canyon'), set: (it) => { it.x = side() * rand(12, 75); it.ry = rand(0, 6.28); it.s = rand(0.7, 1.5); } }),
      P(Models.rockGeo(), 34, { themes: DESERT, set: (it) => { it.x = side() * rand(11, 95); it.ry = rand(0, 6.28); it.s = rand(0.5, 2.6); it.sy = rand(0.6, 1.4); } }),
      P(Models.bushGeo(), 40, { themes: T('arizona', 'deathvalley', 'canyon', 'iowa'), set: (it) => { it.x = side() * rand(10, 55); it.ry = rand(0, 6.28); it.s = rand(0.6, 1.4); } }),
      P(Models.poleGeo(), 9, { themes: T('arizona', 'deathvalley', 'iowa'), spacing: 40, set: (it) => { it.x = -12.5; it.ry = 0; } }),
      P(Models.fencePostGeo(), 50, { themes: T('arizona', 'iowa', 'deathvalley'), spacing: 6.8, set: (it) => { it.x = 15.5; } }),
      P(Models.mesaGeo(), 10, { themes: DESERT, set: (it) => { it.x = side() * rand(90, 170); it.ry = rand(0, 6.28); it.s = rand(0.6, 1.4); it.sy = rand(0.5, 1.3); } }),
      // Grand Canyon: paredões dos dois lados
      ...[-1, 1].map((sd) => P(SC.canyonWallGeo(), 29, { themes: T('canyon'), spacing: 12, set: (it) => { it.x = sd * rand(24, 32); it.ry = sd > 0 ? 0 : Math.PI; it.s = 1; it.sy = rand(0.8, 1.5); it.sx = rand(0.9, 1.3); } })),
      // Redwood
      P(SC.redwoodGeo(), 70, { themes: T('redwood'), set: (it) => { it.x = side() * rand(11, 70); it.ry = rand(0, 6.28); it.s = rand(0.8, 1.4); } }),
      P(SC.fernGeo(), 60, { themes: T('redwood'), set: (it) => { it.x = side() * rand(9.5, 30); it.ry = rand(0, 6.28); it.s = rand(0.8, 1.6); } }),
      // Golden Gate: ponte suspensa
      P(SC.bridgeTowerGeo(), 2, { themes: T('goldengate'), spacing: SPAN_BRIDGE, set: (it) => { it.x = 0; } }),
      ...[-1, 1].map((sd) => P(SC.cableGeo(), 58, { themes: T('goldengate'), spacing: 6, set: (it, sa) => { it.x = sd * 11.5; it.y = cableY(sa); it.rx = Math.atan(cableSlope(sa)); } })),
      ...[-1, 1].map((sd) => P(SC.suspenderGeo(), 58, { themes: T('goldengate'), spacing: 6, set: (it, sa) => { it.x = sd * 11.5; it.y = 1.1; it.sy = Math.max(0.1, cableY(sa) - 1.1); } })),
      ...[-1, 1].map((sd) => P(SC.railGeo(), 86, { themes: T('goldengate'), spacing: 4, set: (it) => { it.x = sd * 9.7; } })),
      P(SC.deckGeo(), 43, { themes: T('goldengate'), spacing: 8, set: (it) => { it.x = 0; } }),
      // Iowa
      P(SC.cornGeo(), 260, { themes: T('iowa'), set: (it) => { it.x = side() * rand(17, 60); it.ry = rand(0, 6.28); it.s = rand(0.9, 1.2); } }),
      P(SC.barnGeo(), 5, { themes: T('iowa'), set: (it) => { it.x = side() * rand(35, 80); it.ry = rand(-0.5, 0.5) + (Math.random() < 0.5 ? 0 : Math.PI / 2); } }),
      P(SC.siloGeo(), 6, { themes: T('iowa'), set: (it) => { it.x = side() * rand(30, 90); it.s = rand(0.8, 1.3); } }),
      P(SC.windmillGeo(), 5, { themes: T('iowa', 'deathvalley'), set: (it) => { it.x = side() * rand(25, 70); it.ry = rand(0, 6.28); } }),
      // Chicago
      ...[-1, 1].map((sd) => P(SC.skyscraperGeo(sd > 0 ? 0 : 2), 17, { themes: T('chicago'), spacing: 20, chance: 0.9, set: (it) => { it.x = sd * rand(20, 30); it.sy = rand(0.6, 2.1); it.sx = rand(0.8, 1.2); it.ry = 0; } })),
      ...[-1, 1].map((sd) => P(SC.skyscraperGeo(1), 10, { themes: T('chicago'), set: (it) => { it.x = sd * rand(45, 90); it.sy = rand(1, 2.6); } })),
      ...[-1, 1].map((sd) => P(SC.streetlightGeo(), 12, { themes: T('chicago', 'dc', 'goldengate'), spacing: 30, set: (it) => { it.x = sd * 9.6; it.ry = sd > 0 ? 0 : Math.PI; } })),
      // Washington D.C.
      P(SC.whiteBuildingGeo(), 8, { themes: T('dc'), set: (it) => { it.x = side() * rand(32, 70); it.ry = it.x > 0 ? Math.PI / 2 : -Math.PI / 2; } }),
      P(SC.cherryGeo(), 50, { themes: T('dc'), set: (it) => { it.x = side() * rand(11, 40); it.ry = rand(0, 6.28); it.s = rand(0.8, 1.3); } }),
      P(SC.obeliskGeo(), 1, { themes: T('dc'), set: (it) => { it.x = -55; } }),
      P(SC.capitolGeo(), 1, { themes: T('dc'), set: (it) => { it.x = 85; it.ry = Math.PI / 2; } }),
    ];
    // placas US 66
    const shieldMat = curveMaterial(new THREE.MeshLambertMaterial({ map: shieldTex(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    const shieldGeo = new THREE.PlaneGeometry(1.1, 1.1);
    shieldGeo.translate(0, 2.6, 0);
    const sign = { themes: T('arizona', 'deathvalley', 'canyon', 'iowa'), spacing: 170, set: (it) => { it.x = 10.3; it.ry = -0.25; } };
    this.pools.push(new ThemePool(this, s, shieldGeo, shieldMat, 2, sign));
    this.pools.push(P(Models.postGeo(), 2, sign));

    // outdoors
    this.billboards = [];
    const boardTex = BILLBOARDS.map(billboardTex);
    for (let i = 0; i < 3; i++) {
      const grp = new THREE.Group();
      grp.add(Models.billboardPosts());
      const mats = boardTex.map((t) => curveMaterial(new THREE.MeshLambertMaterial({ map: t })));
      const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), mats[0]);
      board.position.set(0, 5.2, 0.16);
      grp.add(board);
      grp.userData = { board, mats };
      this.respawnBillboard(grp, true, i);
      s.add(grp);
      this.billboards.push(grp);
    }
    // lanchonete / posto
    this.diner = Models.dinerBuilding();
    this.diner.position.set(-30, 0, -600);
    this.diner.rotation.y = Math.PI / 2;
    s.add(this.diner);
    const neon = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 2),
      new THREE.MeshBasicMaterial({
        map: canvasTex(512, 170, (g, w, h) => {
          g.fillStyle = '#1a0a14';
          g.fillRect(0, 0, w, h);
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.shadowColor = '#ff2fa0';
          g.shadowBlur = 20;
          fitFont(g, 'EAT  •  GAS', w - 40, 90, FW);
          g.fillStyle = '#ff6ad0';
          g.fillText('EAT  •  GAS', w / 2, h / 2);
        }),
      })
    );
    curveMaterial(neon.material);
    neon.position.set(6, 8.2, 7.5);
    this.diner.add(neon);
    // tumbleweeds
    this.tumbles = [];
    const tgeo = Models.tumbleweedGeo();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(tgeo, MAT.lit);
      m.userData = { vx: 0 };
      this.resetTumble(m, true);
      s.add(m);
      this.tumbles.push(m);
    }
  }

  respawnBillboard(grp, init, i = 0) {
    const sd = side();
    grp.position.set(sd * rand(14, 22), 0, init ? -120 - i * 260 : -330 - rand(100, 500));
    grp.rotation.y = -sd * rand(0.25, 0.5);
    grp.visible = ['arizona', 'deathvalley', 'iowa', 'canyon'].includes(this.themeId);
    const { board, mats } = grp.userData;
    board.material = pick(mats);
  }

  resetTumble(m, init) {
    const sd = side();
    m.position.set(sd * rand(12, 22), 0.45, init ? rand(-250, -60) : rand(-280, -150));
    m.userData.vx = -sd * rand(2, 5);
    m.scale.setScalar(rand(0.8, 1.4));
    m.visible = ['arizona', 'deathvalley'].includes(this.themeId);
  }

  update(dt) {
    const sp = G.speed;
    const dz = sp * dt;
    this.dist += dz;
    updateTrack(this.dist);
    this.roadTex.offset.y += dz / TILE;
    this.groundTex.offset.y += (dz / 380) * 30;
    for (const p of this.pools) p.update(dz);
    for (const b of this.billboards) {
      b.position.z += dz;
      if (b.position.z > 40) this.respawnBillboard(b, false);
    }
    this.diner.position.z += dz;
    if (this.diner.position.z > 60) {
      this.diner.position.set(side() * 32, 0, -400 - rand(400, 1400));
      this.diner.rotation.y = this.diner.position.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.diner.visible = ['arizona', 'iowa', 'deathvalley'].includes(this.themeId);
    }
    for (const t of this.tumbles) {
      t.position.z += dz;
      t.position.x += t.userData.vx * dt;
      t.rotation.z -= (t.userData.vx * dt) / 0.45;
      t.rotation.x -= dt * 2;
      t.position.y = 0.45 + Math.abs(Math.sin(G.time * 4 + t.id)) * 0.3;
      if (t.position.z > 30 || Math.abs(t.position.x) > 30) this.resetTumble(t, false);
    }
    this.blendParams(dt);
    // céu, sol e luz giram com a direção da pista (você sente a curva)
    this.skyGroup.position.x = 0;
    this.skyGroup.rotation.y = TRACK_STATE.heading;
    if (G.lights) {
      const h = TRACK_STATE.heading;
      G.lights.dir.position.set(-0.4 * Math.cos(h) + 0.7 * Math.sin(h), 1, 0.7 * Math.cos(h) + 0.4 * Math.sin(h));
    }
  }
}
