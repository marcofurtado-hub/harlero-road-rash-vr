// Contexto global compartilhado entre os módulos (preenchido pelo main.js)
export const G = {
  time: 0,
  timeScale: 1,
  slowmoT: 0,
  state: 'boot',
  wave: 0,
  score: 0,
  combo: 0,
  comboT: 0,
  kills: 0,
  xr: false,
  paused: false,
  speed: 18,
  pow: { gold: 0, boom: 0, slow: 0 }, // power-ups ativos (segundos restantes)
};

export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const chance = (p) => Math.random() < p;

export function weightedPick(items, weightFn) {
  let total = 0;
  for (const it of items) total += weightFn(it);
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightFn(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
