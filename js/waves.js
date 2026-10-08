// Diretor de ondas: compõe cada onda com orçamento crescente e tipos variados
import { G, rand, pick, chance, shuffle, weightedPick } from './ctx.js';
import { TYPES, BOSS_NAMES } from './enemies.js';

const GANGS = [
  'OS ESCORPIÕES', 'CAVEIRAS DE CROMO', 'COIOTES RAIVOSOS', 'FILHOS DO ASFALTO', 'VÍBORAS DO DESERTO',
  'OS CARECAS DE AÇO', 'ANJOS DO ESCAPAMENTO', 'BANDO DO CACTO', 'OS RATOS DE POSTO', 'MOICANOS MALDITOS',
  'GANGUE DA GRAXA', 'LOBOS DA 66',
];

// chefões: Golden Gate (onda 5) e o grande final em Washington (onda 8); depois, a cada 4 ondas
export const isBossWave = (n) => n === 5 || n === 8 || (n > 8 && n % 4 === 0);

export class Waves {
  constructor() {
    this.active = false;
    this.queue = [];
  }

  start(n, place = '') {
    this.n = n;
    this.active = true;
    this.queue = [];
    this.spawnT = 2.5;
    G.aggro = 1 + 0.05 * (n - 1);
    const boss = isBossWave(n);
    const types = Object.keys(TYPES).filter((t) => TYPES[t].minWave <= n);
    let budget = boss ? 3 + n * 0.8 : 4 + n * 3.2;
    // tipo novo aparece em destaque na sua primeira onda
    const fresh = types.filter((t) => TYPES[t].minWave === n);
    for (const f of fresh) {
      this.queue.push(f, f);
      budget -= TYPES[f].cost * 2;
    }
    while (budget > 0) {
      const t = weightedPick(types, (k) => TYPES[k].w * (k === 'punk' ? Math.max(0.35, 1.4 - n * 0.1) : 1));
      this.queue.push(t);
      budget -= TYPES[t].cost;
    }
    shuffle(this.queue);
    if (boss) this.queue.unshift('BOSS');
    this.maxC = Math.min(3 + Math.floor(n * 0.6), 10);
    this.interval = Math.max(0.7, 2.6 - n * 0.14);
    if (boss) {
      const name = BOSS_NAMES[G.enemies.bossCount % BOSS_NAMES.length];
      G.hud.announce(`ONDA ${n}: CHEFÃO!`, `${name} • ${place}`, '#ff3030', 3.5);
    } else {
      const fr = fresh.length ? `NOVO: ${fresh.map((f) => TYPES[f].name.toUpperCase()).join(' + ')}` : pick(GANGS);
      G.hud.announce(place || `ONDA ${n}`, `ONDA ${n} • ${fr}`, '#ffd21e', 3.2);
    }
  }

  update(dt) {
    if (!this.active) return;
    this.spawnT -= dt;
    const alive = G.enemies.aliveCount();
    if (this.queue.length && this.spawnT <= 0 && alive < this.maxC) {
      const t = this.queue.shift();
      const from = t === 'kamikaze' || t === 'sniper' || t === 'torch' ? 'ahead' : chance(0.55) ? 'behind' : 'ahead';
      G.enemies.spawn(t, { from });
      if (from === 'behind' && t !== 'BOSS') G.audio.play('whoosh');
      this.spawnT = this.interval * rand(0.7, 1.3);
    }
    if (!this.queue.length && alive === 0) {
      this.active = false;
      G.game.waveCleared();
    }
  }

  remaining() {
    return this.queue.length + G.enemies.aliveCount();
  }
}
