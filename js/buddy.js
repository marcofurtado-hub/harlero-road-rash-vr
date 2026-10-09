// Corvo ajudante: aparece por 8 segundos, voa do lado do seu ombro e dá uns tiros meio tortos.
// Vem pela habilidade Corvo Atirador (de tempos em tempos) ou pela caixa de power-up 🐦.
import * as THREE from 'three';
import { G, rand, pick } from './ctx.js';
import { crowModel } from './models.js';
import { dealDamage, collectHits, enemyPos } from './weapons.js';

const LIFE = 8;
const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _hits = [];

export class Crows {
  constructor(rig) {
    this.rig = rig;
    this.list = [];
    this.cd = 6;
  }

  clear() {
    for (const c of this.list) this.rig.remove(c.m.grp);
    this.list = [];
    this.cd = 6;
  }

  summon() {
    if (this.list.length >= 2) {
      // já tem dois: renova o tempo do mais velho
      this.list.sort((a, b) => a.t - b.t)[0].t = LIFE;
      return;
    }
    const used = this.list.map((c) => c.side);
    const side = used.includes(1) ? -1 : 1;
    const m = crowModel();
    this.rig.add(m.grp);
    this.list.push({ m, side, t: LIFE, cd: rand(0.8, 1.4), ph: Math.random() * 6, kick: 0, enter: 0 });
    G.audio.play('caw');
    G.hud.announce('🐦 CORVO NA ÁREA!', 'ele ajuda por 8 segundos', '#c070ff', 1.4);
  }

  update(dt) {
    const P = G.player;
    if (G.state === 'title') {
      if (this.list.length) this.clear();
      return;
    }
    // habilidade: chama um corvo de tempos em tempos durante a onda
    const lvl = P.lvl('crow');
    if (lvl && G.state === 'wave') {
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = lvl >= 2 ? 15 : 22;
        this.summon();
      }
    }
    if (!this.list.length) return;
    const head = this.rig.worldToLocal(_v.copy(P.headW));
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      const g = c.m.grp;
      c.t -= dt;
      c.enter = Math.min(1, c.enter + dt * 1.5);
      // chega voando de cima e vai embora subindo
      const out = c.t < 0.8 ? (0.8 - c.t) / 0.8 : 0;
      const fly = (1 - c.enter) * 6 + out * out * 10;
      const t = G.time + c.ph;
      if (G.xr) g.position.set(head.x + c.side * 0.55, head.y + 0.15 + Math.sin(t * 2.2) * 0.05 + fly, head.z - 0.15 - fly * 0.5);
      else g.position.set(c.side * 1.55, 2.45 + Math.sin(t * 2.2) * 0.06 + fly, -3.4 - fly * 0.5);
      const flap = Math.sin(t * 16) * 0.7;
      c.m.wings[0].rotation.z = flap;
      c.m.wings[1].rotation.z = -flap;
      c.kick = Math.max(0, c.kick - dt * 6);
      if (c.t <= 0) {
        this.rig.remove(g);
        this.list.splice(i, 1);
        continue;
      }
      g.rotation.set(0, 0, 0);
      if (G.state !== 'wave' || out > 0 || c.enter < 1) continue;
      c.cd -= dt;
      if (c.cd > 0) continue;
      c.cd = rand(1.3, 1.9);
      // não é fominha: pega qualquer punk à vista (nem sempre o mais perigoso) e erra bastante
      const alive = G.enemies.list.filter((e) => !e.dying && e.z < 2 && e.z > -60);
      if (!alive.length) continue;
      const e = pick(alive);
      const from = g.getWorldPosition(new THREE.Vector3());
      const tp = enemyPos(e, new THREE.Vector3());
      g.lookAt(tp);
      g.rotateY(Math.PI);
      c.kick = 1;
      const dir = _d.copy(tp).sub(from).normalize();
      dir.x += rand(-0.07, 0.07);
      dir.y += rand(-0.05, 0.05);
      dir.normalize();
      const hits = collectHits(from, dir, 120, _hits);
      let end = from.clone().addScaledVector(dir, 60);
      for (const h of hits) {
        if (!h.obj.spheres) continue;
        const pt = new THREE.Vector3().copy(from).addScaledVector(dir, h.t);
        dealDamage(h, 24 * (1 + 0.1 * (G.wave - 1)), pt, dir, 0.5, false);
        end = pt;
        break;
      }
      G.fx.tracer(from, end, 0xc070ff, 0.09, 1.4);
      G.fx.burst('purple', from, 4, { speed: 2, size: 0.06, life: 0.2, anchor: 0 });
      G.audio.gun('crow', from);
      if (Math.random() < 0.15) G.audio.play('caw', from);
    }
  }
}
