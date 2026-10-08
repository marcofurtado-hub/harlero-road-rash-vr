// Cartas 3D (menu, game over) que você escolhe atirando nelas
import * as THREE from 'three';
import { G, damp } from './ctx.js';
import { canvasTex, FW, FB, fitFont, wrapLines, strokeText, roundRect, setFont } from './text.js';

export const RARITY = {
  common: ['#a8aeb6', 'COMUM'],
  rare: ['#3a8bff', 'RARO'],
  epic: ['#c25cff', 'ÉPICO'],
  legend: ['#ff9a1e', 'LENDÁRIO'],
};
// ------------------------------------------------------------------ desenho das cartas
function cardBase(g, w, h, color) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#3a2214');
  gr.addColorStop(1, '#140a05');
  roundRect(g, 6, 6, w - 12, h - 12, 30);
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = color;
  g.stroke();
  g.setLineDash([14, 10]);
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(255,220,160,0.35)';
  roundRect(g, 26, 26, w - 52, h - 52, 18);
  g.stroke();
  g.setLineDash([]);
}

export function drawUpgrade(g, w, h, o) {
  const [rc, rname] = RARITY[o.rarity] || RARITY.common;
  cardBase(g, w, h, rc);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = rc;
  g.fillRect(12, 46, w - 24, 58);
  setFont(g, 34, FB);
  g.fillStyle = '#140a05';
  g.fillText(o.banner, w / 2, 77);
  g.font = '104px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
  g.fillText(o.icon, w / 2, 182);
  fitFont(g, o.title, w - 60, 46, FW);
  strokeText(g, o.title, w / 2, 268, '#ffe6b0', '#000', 6);
  if (o.sub) {
    setFont(g, 26, FB);
    g.fillStyle = '#ffd21e';
    g.fillText(o.sub, w / 2, 312);
  }
  g.font = 'bold 25px Arial, sans-serif';
  g.fillStyle = '#f0e0c8';
  const lines = wrapLines(g, o.desc, w - 70);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, w / 2, 352 + i * 30));
  if (o.stats) {
    const y0 = 352 + Math.min(3, lines.length) * 30 + 6;
    o.stats.forEach(([name, v], i) => {
      const y = y0 + i * 30;
      g.textAlign = 'left';
      setFont(g, 17, FB);
      g.fillStyle = '#c8b8a0';
      g.fillText(name, 40, y);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(170, y - 9, w - 210, 18);
      g.fillStyle = rc;
      g.fillRect(170, y - 9, (w - 210) * v, 18);
    });
    g.textAlign = 'center';
  }
  setFont(g, 20, FB);
  g.fillStyle = 'rgba(255,230,180,0.75)';
  if (o.foot) g.fillText(o.foot, w / 2, h - 82);
  g.fillStyle = rc;
  g.fillText(rname, w / 2, h - 48);
}

export function drawTarget(g, w, h, title, sub, color = '#ff3030') {
  cardBase(g, w, h, color);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cx = w / 2;
  const cy = h * 0.43;
  for (let i = 5; i >= 1; i--) {
    g.beginPath();
    g.arc(cx, cy, i * 30, 0, Math.PI * 2);
    g.fillStyle = i % 2 ? color : '#f5ead0';
    g.fill();
  }
  fitFont(g, title, w - 60, 54, FW);
  strokeText(g, title, cx, h * 0.77, '#ffe6b0', '#000', 8);
  setFont(g, 22, FB);
  g.fillStyle = '#ffd21e';
  g.fillText(sub, cx, h * 0.87);
}

export function drawInfo(g, w, h, title, lines, color = '#ffd21e') {
  cardBase(g, w, h, '#8a6a40');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitFont(g, title, w - 60, 44, FW);
  strokeText(g, title, w / 2, 76, color, '#000', 6);
  g.font = 'bold 24px Arial, sans-serif';
  let y = 140;
  for (const l of lines) {
    if (l === '') {
      y += 14;
      continue;
    }
    if (l.startsWith('#')) {
      setFont(g, 22, FB);
      g.fillStyle = '#ffb060';
      g.fillText(l.slice(1), w / 2, y);
      g.font = 'bold 24px Arial, sans-serif';
    } else {
      g.fillStyle = '#f0e0c8';
      const ws = wrapLines(g, l, w - 64);
      for (const x of ws) {
        g.fillText(x, w / 2, y);
        y += 30;
      }
      continue;
    }
    y += 34;
  }
}

export function drawToggle(g, w, h, label, on) {
  roundRect(g, 6, 6, w - 12, h - 12, 26);
  g.fillStyle = on ? '#123a1c' : '#3a1212';
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = on ? '#40d060' : '#e03030';
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  setFont(g, 40, FB);
  g.fillStyle = '#ffe6b0';
  g.fillText(label, w / 2, h * 0.34);
  setFont(g, 58, FB);
  g.fillStyle = on ? '#60ff80' : '#ff5050';
  g.fillText(on ? 'LIGADA' : 'DESLIGADA', w / 2, h * 0.66);
}

export function drawTitle(g, w, h) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const gr = g.createLinearGradient(0, 40, 0, 230);
  gr.addColorStop(0, '#fff3a0');
  gr.addColorStop(0.5, '#ffa020');
  gr.addColorStop(1, '#e02020');
  setFont(g, 190, FW);
  g.lineJoin = 'round';
  g.lineWidth = 22;
  g.strokeStyle = '#1a0a05';
  g.strokeText('HARLERO', w / 2, 150);
  g.fillStyle = gr;
  g.fillText('HARLERO', w / 2, 150);
  setFont(g, 76, FB);
  strokeText(g, 'ROAD RASH 66', w / 2, 290, '#40e8ff', '#1a0a05', 14);
  g.font = 'italic bold 34px Georgia, serif';
  strokeText(g, 'A estrada é sua. Os punks discordam.', w / 2, 370, '#ffe6b0', '#1a0a05', 8);
}

// ------------------------------------------------------------------ gerenciador
const _inv = new THREE.Matrix4();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

export class Cards {
  constructor(rig) {
    this.group = new THREE.Group();
    rig.add(this.group);
    this.items = [];
    this.active = false;
    this.armT = 0;
    this.pickT = 0;
  }

  clear() {
    for (const it of this.items) {
      this.group.remove(it.mesh);
      it.mesh.geometry.dispose();
      it.mesh.material.map?.dispose();
      it.mesh.material.dispose();
    }
    this.items = [];
    this.active = false;
  }

  add(o) {
    const tex = canvasTex(o.cw || 420, o.ch || 580, (g, w, h) => o.draw(g, w, h));
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 1.25, o.h || 1.72), mat);
    const x = o.x || 0;
    const z = o.z ?? -3.6;
    const y = o.y ?? 1.5;
    mesh.position.set(x, y - 2.5, z);
    mesh.rotation.y = o.face === false ? 0 : Math.atan2(-x, -z + 0.02);
    this.group.add(mesh);
    const it = { o, mesh, base: new THREE.Vector3(x, y, z), t: 0, hover: 0, chosen: false, idx: this.items.length };
    this.items.push(it);
    return it;
  }

  redraw(it) {
    const old = it.mesh.material.map;
    it.mesh.material.map = canvasTex(it.o.cw || 420, it.o.ch || 580, (g, w, h) => it.o.draw(g, w, h));
    it.mesh.material.needsUpdate = true;
    if (old) old.dispose();
  }
  redrawToggles() {
    for (const it of this.items) if (it.o.toggle) this.redraw(it);
  }

  show(list) {
    this.clear();
    list.forEach((o) => this.add(o));
    this.active = true;
    this.armT = 0.7;
    this.pickT = 0;
    this.picked = null;
  }

  hide() {
    this.clear();
  }

  rayHits(o, d, max, out) {
    if (!this.active) return;
    for (const it of this.items) {
      if (it.o.ghost) continue;
      const m = it.mesh;
      m.updateWorldMatrix(true, false);
      _inv.copy(m.matrixWorld).invert();
      _o.copy(o).applyMatrix4(_inv);
      _d.copy(d).transformDirection(_inv);
      if (Math.abs(_d.z) < 1e-5) continue;
      const t = -_o.z / _d.z;
      if (t <= 0 || t > max) continue;
      const px = _o.x + _d.x * t;
      const py = _o.y + _d.y * t;
      const w = (it.o.w || 1.25) / 2;
      const h = (it.o.h || 1.72) / 2;
      if (Math.abs(px) <= w && Math.abs(py) <= h) out.push({ t, obj: this.wrap(it), part: 'card' });
    }
  }

  wrap(it) {
    return {
      isCard: true,
      takeHit: (dmg, part, pt) => {
        if (pt) G.fx.spark(pt, 6);
        if (it.o.toggle) {
          // interruptor: alterna sem fechar o menu
          if (this.armT > 0 || this.picked || G.time - (it.lastT || -9) < 0.6) return { solid: true };
          it.lastT = G.time;
          it.o.onToggle();
          this.redraw(it);
          G.audio.play('grab');
          return { solid: true };
        }
        if (!it.o.onPick || this.armT > 0 || this.picked) return { solid: true };
        this.picked = it;
        it.chosen = true;
        this.pickT = 0;
        G.audio.play('select');
        if (pt) G.fx.burst('spark', pt, 30, { speed: 5, size: 0.08, life: 0.5, anchor: 0 });
        return { solid: true };
      },
    };
  }

  // rays: [{o, d}] das miras atuais (pra destacar a carta mirada)
  update(dt, rays) {
    if (!this.active) return;
    this.armT -= dt;
    const tmp = [];
    for (const it of this.items) it.aimed = false;
    if (!this.picked) {
      // destaca a carta para onde alguma arma está mirando
      for (const it of this.items) {
        if (!it.o.onPick && !it.o.toggle) continue;
        for (const r of rays) {
          tmp.length = 0;
          const save = this.items;
          this.items = [it];
          this.rayHits(r.o, r.d, 30, tmp);
          this.items = save;
          if (tmp.length) it.aimed = true;
        }
      }
    }
    for (const it of this.items) {
      it.t += dt;
      const m = it.mesh;
      const b = it.base;
      const intro = Math.min(1, it.t / 0.55);
      const ease = 1 - Math.pow(1 - intro, 3);
      if (this.picked) {
        const k = Math.min(1, this.pickT / 0.7);
        if (it.chosen) {
          m.position.y = b.y + k * 0.6;
          m.scale.setScalar(1 + k * 0.3);
          m.material.opacity = 1 - Math.max(0, k - 0.5) * 2;
        } else {
          m.position.y = b.y - k * 3;
          m.material.opacity = 1 - k;
        }
      } else {
        it.hover = damp(it.hover, it.aimed ? 1 : 0, 12, dt);
        m.position.y = b.y - 2.5 * (1 - ease) + Math.sin(it.t * 1.7 + it.idx) * 0.035;
        m.scale.setScalar(1 + it.hover * 0.08);
      }
    }
    if (this.picked) {
      this.pickT += dt;
      if (this.pickT >= 0.75) {
        const fn = this.picked.o.onPick;
        this.hide();
        fn();
      }
    }
  }
}
