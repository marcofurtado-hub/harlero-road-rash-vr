// Corvo Atirador (habilidade): voa do lado do seu ombro e atira sozinho no punk mais ameaçador.
// Nível 2 = um segundo corvo do outro lado.
import * as THREE from 'three';
import { G, rand } from './ctx.js';
import { crowModel } from './models.js';
import { dealDamage, collectHits, enemyPos } from './weapons.js';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _hits = [];

export class Crows {
  constructor(rig) {
    this.rig = rig;
    this.list = [];
  }

  clear() {
    for (const c of this.list) this.rig.remove(c.m.grp);
    this.list = [];
  }

  update(dt) {
    const P = G.player;
    const want = G.state === 'title' ? 0 : P.lvl('crow');
    while (this.list.length < want) {
      const side = this.list.length === 0 ? 1 : -1;
      const m = crowModel();
      this.rig.add(m.grp);
      this.list.push({ m, side, cd: rand(0.3, 1), ph: Math.random() * 6, kick: 0 });
      G.audio.play('caw');
    }
    while (this.list.length > want) this.rig.remove(this.list.pop().m.grp);
    if (!this.list.length) return;
    // posição: no VR perto do ombro; no PC mais à frente e de lado pra não tapar a mira
    const head = this.rig.worldToLocal(_v.copy(P.headW));
    for (const c of this.list) {
      const t = G.time + c.ph;
      const g = c.m.grp;
      if (G.xr) g.position.set(head.x + c.side * 0.5, head.y + 0.12 + Math.sin(t * 2.2) * 0.04, head.z - 0.1);
      else g.position.set(c.side * 1.55, 2.45 + Math.sin(t * 2.2) * 0.06, -3.4);
      const flap = Math.sin(t * 16) * 0.7;
      c.m.wings[0].rotation.z = flap;
      c.m.wings[1].rotation.z = -flap;
      c.kick = Math.max(0, c.kick - dt * 6);
      if (G.state !== 'wave') {
        g.rotation.set(0, 0, 0);
        continue;
      }
      c.cd -= dt * P.rateMul();
      const e = G.enemies.acquire(g.getWorldPosition(_v), G.camera.getWorldDirection(_d));
      if (!e) continue;
      // vira o bico pro alvo
      const tp = enemyPos(e, new THREE.Vector3());
      g.lookAt(tp);
      g.rotateY(Math.PI);
      g.rotation.x += c.kick * 0.5;
      if (c.cd > 0) continue;
      c.cd = 1.1;
      c.kick = 1;
      const from = g.getWorldPosition(new THREE.Vector3());
      const aim = Math.random() < 0.3 && e.spheres[0].part === 'head' ? e.sw[0] : tp;
      const dir = _d.copy(aim).sub(from).normalize();
      const hits = collectHits(from, dir, 160, _hits);
      let end = aim;
      for (const h of hits) {
        if (!h.obj.spheres) continue;
        const pt = new THREE.Vector3().copy(from).addScaledVector(dir, h.t);
        dealDamage(h, 42 * (1 + 0.12 * (G.wave - 1)) * P.dmgMul(), pt, dir, 1);
        end = pt;
        break;
      }
      G.fx.tracer(from, end, 0xc070ff, 0.09, 1.4);
      G.fx.burst('purple', from, 4, { speed: 2, size: 0.06, life: 0.2, anchor: 0 });
      G.audio.gun('crow', from);
      if (Math.random() < 0.12) G.audio.play('caw', from);
    }
  }
}
