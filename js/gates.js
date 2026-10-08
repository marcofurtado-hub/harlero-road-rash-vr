// Portais de habilidade: 3 arcos atravessam a estrada (ATAQUE à esquerda, EFEITO no meio, DEFESA à direita).
// Nada de menu: é só pilotar e passar pelo portal que você quer. Sem fazer nada, pega o do meio.
import * as THREE from 'three';
import { G, damp } from './ctx.js';
import { Builder } from './builder.js';
import { curveMaterial, toWorld } from './curve.js';
import { canvasTex, FW, FB, fitFont, wrapLines, strokeText, roundRect, setFont } from './text.js';
import { RARITY } from './upgrades.js';
import { CATS } from './skills.js';

const LANES = [-5.6, 0, 5.6];
const EMOJI = '"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
const _v = new THREE.Vector3();

function drawPanel(g, w, h, sk, lvl) {
  const [rc, rname] = RARITY[sk.rar] || RARITY.common;
  const cat = CATS[sk.cat];
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#2a1a10');
  gr.addColorStop(1, '#0c0604');
  roundRect(g, 8, 8, w - 16, h - 16, 34);
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = 16;
  g.strokeStyle = rc;
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = cat.color;
  g.fillRect(16, 22, w - 32, 56);
  setFont(g, 32, FB);
  g.fillStyle = '#100804';
  g.fillText(`${cat.name} • ${rname}`, w / 2, 51);
  g.font = `118px ${EMOJI}`;
  g.fillText(sk.icon, w / 2, 160);
  fitFont(g, sk.name, w - 50, 56, FW);
  strokeText(g, sk.name, w / 2, 262, '#ffe6b0', '#000', 7);
  g.font = 'bold 27px Arial, sans-serif';
  g.fillStyle = '#f0e0c8';
  wrapLines(g, sk.desc, w - 60)
    .slice(0, 2)
    .forEach((l, i) => g.fillText(l, w / 2, 310 + i * 30));
  setFont(g, 28, FB);
  g.fillStyle = '#ffd21e';
  const txt = sk.max >= 99 ? '' : lvl ? `NÍVEL ${lvl} ➜ ${lvl + 1}` : 'NOVO!';
  if (txt) g.fillText(txt, w / 2, h - 34);
}

export class Gates {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.items = [];
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.grp);
      it.grp.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (o.material.map) {
            o.material.map.dispose();
            o.material.dispose();
          }
        }
      });
    }
    this.items = [];
    this.active = false;
  }

  start(offer, onDone, title = 'ESCOLHA SEU PODER') {
    this.clear();
    this.active = true;
    this.onDone = onDone;
    this.z = -200;
    this.done = false;
    this.endT = 0;
    offer.forEach((sk, i) => {
      const grp = new THREE.Group();
      const rc = new THREE.Color(RARITY[sk.rar][0]).getHex();
      const b = new Builder();
      for (const s of [-1, 1]) {
        b.box(0.28, 6.3, 0.28, 0x222222, s * 2.35, 3.15, 0);
        b.box(0.12, 6.0, 0.32, rc, s * 2.35, 3.1, 0, 0, 0, 0, { glow: true });
      }
      b.box(4.98, 0.3, 0.3, rc, 0, 6.35, 0, 0, 0, 0, { glow: true });
      b.box(4.6, 0.04, 0.45, rc, 0, 0.03, 0, 0, 0, 0, { glow: true }); // linha no asfalto
      grp.add(b.build());
      const mat = curveMaterial(new THREE.MeshBasicMaterial({ map: canvasTex(512, 400, (g, w, h) => drawPanel(g, w, h, sk, G.player.lvl(sk.id))) }));
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 3.36), mat);
      panel.position.set(0, 4.45, 0.2);
      grp.add(panel);
      grp.traverse((o) => (o.frustumCulled = false));
      grp.position.set(LANES[i], 0, this.z);
      this.scene.add(grp);
      this.items.push({ sk, grp, panel, hl: 0, out: 0 });
    });
    G.hud.announce(title, 'passe de moto pelo portal que você quer', '#ffd21e', 3);
    G.audio.play('wave');
  }

  update(dt) {
    if (!this.active) return;
    const P = G.player;
    this.z += G.speed * dt;
    let lane = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(P.x - LANES[i]) < Math.abs(P.x - LANES[lane])) lane = i;
    this.items.forEach((it, i) => {
      const mine = i === lane && !this.done;
      it.hl = damp(it.hl, mine ? 1 : 0, 10, dt);
      it.grp.position.z = this.z;
      it.panel.scale.setScalar(1 + it.hl * (0.12 + Math.sin(G.time * 10) * 0.03));
      if (this.done && !it.chosen) {
        it.out += dt;
        it.grp.position.y = -it.out * it.out * 9;
      }
    });
    if (!this.done && this.z > -1.2) {
      this.done = true;
      const it = this.items[lane];
      it.chosen = true;
      const sk = it.sk;
      const n = P.addSkill(sk.id);
      G.audio.play('gate');
      P.pulseAll(0.8, 160);
      toWorld(_v.set(LANES[lane], 4.4, -1));
      G.fx.burst('spark', _v, 50, { speed: 7, size: 0.1, life: 0.8, anchor: 0.8 });
      G.fx.burst(sk.cat === 'atk' ? 'red' : sk.cat === 'fx' ? 'cyan' : 'green', _v, 40, { speed: 5, size: 0.16, life: 0.7, anchor: 0.8 });
      G.hud.announce(`${sk.icon} ${sk.name.toUpperCase()}`, sk.max >= 99 ? sk.desc : n > 1 ? `NÍVEL ${n}` : sk.desc, '#60ff80', 2.4);
      this.endT = 1.4;
    }
    if (this.done) {
      this.endT -= dt;
      if (this.endT <= 0) {
        this.clear();
        const cb = this.onDone;
        this.onDone = null;
        if (cb) cb();
      }
    }
  }
}
