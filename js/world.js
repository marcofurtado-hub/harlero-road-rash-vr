import * as THREE from 'three';
import { G, rand, pick, damp, chance } from './ctx.js';
import { curveMaterial } from './curve.js';
import { MAT } from './builder.js';
import * as Models from './models.js';
import { canvasTex, FW, FB, fitFont, strokeText } from './text.js';

export const ROAD_W = 18;
export const ROAD_HALF = 8.2; // limite jogável
const ROAD_LEN = 336; // em cima do tambor só ~20 m à frente/atrás ficam visíveis
const ROAD_Z0 = 48;
const TILE = 24;
const SPAN = 150; // faixa de reciclagem do cenário
const FAR = -115;

export const HORIZON = 0xf0a070;

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

function drawSand(g, w, h) {
  g.fillStyle = '#c98d5a';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    const r = 170 + Math.random() * 50;
    g.fillStyle = `rgba(${r},${r * 0.68},${r * 0.42},0.6)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = 'rgba(120,80,50,0.25)';
    g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, 4 + Math.random() * 14, 2 + Math.random() * 6, 0, 0, Math.PI * 2);
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

class Pool {
  constructor(scene, geo, mat, count, spawn) {
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.items = [];
    this.spawn = spawn;
    for (let i = 0; i < count; i++) {
      const it = { x: 0, y: 0, z: 0, ry: 0, s: 1, sy: 1, i };
      spawn(it, true);
      this.items.push(it);
    }
    scene.add(this.mesh);
  }
  update(dz) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const it of this.items) {
      it.z += dz;
      if (it.z > 35) this.spawn(it, false);
      e.set(0, it.ry, 0);
      q.setFromEuler(e);
      m.compose(p.set(it.x, it.y, it.z), q, s.set(it.s, it.s * it.sy, it.s));
      this.mesh.setMatrixAt(it.i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const side = () => (Math.random() < 0.5 ? -1 : 1);

export class World {
  constructor(scene) {
    this.scene = scene;
    this.dist = 0;
    this.makeSky();
    this.makeGround();
    this.makeRoad();
    this.makeScenery();
  }

  makeSky() {
    this.skyGroup = new THREE.Group();
    const geo = new THREE.SphereGeometry(1100, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x1a1446) },
        mid: { value: new THREE.Color(0xc0406a) },
        hor: { value: new THREE.Color(HORIZON) },
        sunDir: { value: new THREE.Vector3(0, 0.07, -1).normalize() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h));
          c = mix(c, top, smoothstep(0.22, 0.75, h));
          float s = max(dot(vDir, sunDir), 0.0);
          c += vec3(1.0, 0.55, 0.25) * pow(s, 10.0) * 0.45;
          c += vec3(1.0, 0.85, 0.6) * pow(s, 60.0) * 0.4;
          if (h < 0.0) c = hor;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    // Cores do shader vão cruas pro framebuffer (já são sRGB)
    mat.uniforms.top.value.setHex(0x1a1446, THREE.LinearSRGBColorSpace);
    mat.uniforms.mid.value.setHex(0xc0406a, THREE.LinearSRGBColorSpace);
    mat.uniforms.hor.value.setHex(HORIZON, THREE.LinearSRGBColorSpace);
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.skyGroup.add(sky);
    // sol retrô com listras
    const sunTex = canvasTex(256, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#fff3a0');
      gr.addColorStop(0.6, '#ff9a3c');
      gr.addColorStop(1, '#ff4a6a');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 6; i++) {
        const y = h * 0.58 + i * i * 2.6 + i * 9;
        g.fillRect(0, y, w, 3 + i * 1.6);
      }
    });
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(95, 32),
      new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false })
    );
    // sol "sentado" na crista do tambor
    sun.position.set(0, -60, -1000);
    sun.scale.setScalar(1.35);
    sun.renderOrder = -9;
    this.skyGroup.add(sun);
    const back = Models.backdrop();

    back.renderOrder = -8;
    this.skyGroup.add(back);
    this.scene.add(this.skyGroup);
  }

  makeGround() {
    const tex = canvasTex(256, 256, drawSand);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(60, 18);
    const geo = new THREE.PlaneGeometry(1400, 420, 10, 140);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -0.03, 70 - 210);
    const mat = curveMaterial(new THREE.MeshLambertMaterial({ map: tex }));
    this.ground = new THREE.Mesh(geo, mat);
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
    const geo = new THREE.PlaneGeometry(ROAD_W, ROAD_LEN, 1, 200);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.0, ROAD_Z0 - ROAD_LEN / 2);
    const mat = curveMaterial(new THREE.MeshLambertMaterial({ map: tex }));
    this.road = new THREE.Mesh(geo, mat);
    this.road.frustumCulled = false;
    this.roadTex = tex;
    this.scene.add(this.road);
  }

  makeScenery() {
    const s = this.scene;
    const L = MAT.lit;
    // no tambor só ~25 m à frente ficam visíveis: cenário denso e perto, reciclado numa faixa curta
    const initZ = () => rand(FAR, 35);
    this.pools = [
      new Pool(s, Models.cactusGeo(), L, 34, (it, init) => {
        it.x = side() * rand(11, 45);
        it.z = init ? initZ() : it.z - SPAN;
        it.ry = rand(0, 6.28);
        it.s = rand(0.7, 1.5);
      }),
      new Pool(s, Models.rockGeo(), L, 26, (it, init) => {
        it.x = side() * rand(10.5, 50);
        it.z = init ? initZ() : it.z - SPAN;
        it.ry = rand(0, 6.28);
        it.s = rand(0.5, 2.3);
        it.sy = rand(0.6, 1.4);
      }),
      new Pool(s, Models.bushGeo(), L, 34, (it, init) => {
        it.x = side() * rand(10, 35);
        it.z = init ? initZ() : it.z - SPAN;
        it.ry = rand(0, 6.28);
        it.s = rand(0.6, 1.4);
      }),
      new Pool(s, Models.poleGeo(), L, 5, (it, init) => {
        it.x = -12.5;
        it.z = init ? 35 - it.i * 30 : it.z - 5 * 30;
        it.ry = 0;
      }),
      new Pool(s, Models.fencePostGeo(), L, 22, (it, init) => {
        it.x = 15.5;
        it.z = init ? 35 - it.i * 6.8 : it.z - 22 * 6.8;
        it.ry = 0;
        it.s = 1;
      }),
      new Pool(s, Models.mesaGeo(), L, 6, (it, init) => {
        it.x = side() * rand(55, 90);
        it.z = init ? initZ() : it.z - SPAN;
        it.ry = rand(0, 6.28);
        it.s = rand(0.35, 0.7);
        it.sy = rand(0.6, 1.4);
      }),
    ];
    // placas US 66
    const shieldMat = curveMaterial(new THREE.MeshLambertMaterial({ map: shieldTex(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    const shieldGeo = new THREE.PlaneGeometry(1.1, 1.1);
    shieldGeo.translate(0, 2.6, 0);
    const placeSign = (it, init) => {
      it.x = 10.3;
      it.z = init ? -40 - it.i * 75 : it.z - 2 * 75;
      it.ry = -0.25;
    };
    this.pools.push(new Pool(s, shieldGeo, shieldMat, 2, placeSign));
    this.pools.push(new Pool(s, Models.postGeo(), L, 2, placeSign));

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
    this.diner.position.set(-30, 0, -200);
    this.diner.rotation.y = Math.PI / 2;
    s.add(this.diner);
    // neon do diner
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
    grp.position.set(sd * rand(14, 22), 0, init ? -60 - i * 90 : -120 - rand(20, 260));
    grp.rotation.y = -sd * rand(0.25, 0.5);
    const { board, mats } = grp.userData;
    board.material = pick(mats);
  }

  resetTumble(m, init) {
    const sd = side();
    m.position.set(sd * rand(12, 22), 0.45, init ? rand(-90, -30) : rand(-120, -70));
    m.userData.vx = -sd * rand(2, 5);
    m.scale.setScalar(rand(0.8, 1.4));
  }

  update(dt) {
    const sp = G.speed;
    const dz = sp * dt;
    this.dist += dz;
    this.roadTex.offset.y += dz / TILE;
    this.groundTex.offset.y += (dz / 420) * 18;
    for (const p of this.pools) p.update(dz);
    for (const b of this.billboards) {
      b.position.z += dz;
      if (b.position.z > 40) this.respawnBillboard(b, false);
    }
    this.diner.position.z += dz;
    if (this.diner.position.z > 60) {
      this.diner.position.set(side() * 30, 0, -150 - rand(150, 700));
      this.diner.rotation.y = this.diner.position.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    for (const t of this.tumbles) {
      t.position.z += dz;
      t.position.x += t.userData.vx * dt;
      t.rotation.z -= (t.userData.vx * dt) / 0.45;
      t.rotation.x -= dt * 2;
      t.position.y = 0.45 + Math.abs(Math.sin(G.time * 4 + t.id)) * 0.3;
      if (t.position.z > 30 || Math.abs(t.position.x) > 30) this.resetTumble(t, false);
    }
    this.skyGroup.position.x = G.player ? G.player.x : 0;
  }
}
