// Habilidades estilo Archero (como no Chicken Rancher): mudam o tiro de forma VISÍVEL e viram uma "build".
// Toda oferta tem 3 portais, 1 de cada categoria: ATAQUE, EFEITO e DEFESA.
import { G, pick } from './ctx.js';

export const CATS = {
  atk: { name: 'ATAQUE', color: '#ff4040' },
  fx: { name: 'EFEITO', color: '#40a8ff' },
  def: { name: 'DEFESA', color: '#40d060' },
};

export const SKILLS = [
  // ATAQUE
  { id: 'double', cat: 'atk', rar: 'epic', icon: '➕', name: 'Bala Dupla', desc: '+1 tiro lado a lado em TODAS as armas', max: 2 },
  { id: 'fan', cat: 'atk', rar: 'epic', icon: '🔱', name: 'Tiro em Leque', desc: '+2 tiros em diagonal em todas as armas', max: 2 },
  { id: 'dmg', cat: 'atk', rar: 'common', icon: '💪', name: 'Calibre Grosso', desc: '+25% de dano', max: 5 },
  { id: 'rate', cat: 'atk', rar: 'common', icon: '⚡', name: 'Gatilho Nervoso', desc: '+20% de cadência', max: 4 },
  { id: 'crit', cat: 'atk', rar: 'rare', icon: '💀', name: 'Olho de Águia', desc: '+15% de chance de crítico (dano x2)', max: 3 },
  { id: 'rage', cat: 'atk', rar: 'rare', icon: '😤', name: 'Sangue Quente', desc: 'quanto menos vida, mais dano', max: 2 },
  // EFEITO (no impacto)
  { id: 'pierce', cat: 'fx', rar: 'rare', icon: '🗡️', name: 'Bala Perfurante', desc: 'atravessa +1 punk', max: 2 },
  { id: 'ricochet', cat: 'fx', rar: 'rare', icon: '🔁', name: 'Ricochete', desc: 'a bala quica pro punk mais perto', max: 3 },
  { id: 'fire', cat: 'fx', rar: 'rare', icon: '🔥', name: 'Bala Incendiária', desc: 'o punk pega fogo por 3 segundos', max: 2 },
  { id: 'ice', cat: 'fx', rar: 'rare', icon: '❄️', name: 'Bala Congelante', desc: 'punk congelado fica lento e atira menos', max: 2 },
  { id: 'shock', cat: 'fx', rar: 'rare', icon: '🌩️', name: 'Bala Elétrica', desc: 'o choque pula pros punks vizinhos', max: 2 },
  { id: 'boom', cat: 'fx', rar: 'epic', icon: '🧨', name: 'Munição Explosiva', desc: 'acertos causam mini-explosões', max: 2 },
  { id: 'magnet', cat: 'fx', rar: 'common', icon: '🧲', name: 'Mira Magnética', desc: 'os tiros curvam até os punks', max: 3 },
  // DEFESA
  { id: 'crow', cat: 'def', rar: 'epic', icon: '🐦', name: 'Corvo Atirador', desc: 'um corvo voa do seu lado e atira sozinho', max: 2 },
  { id: 'shield', cat: 'def', rar: 'rare', icon: '🛡️', name: 'Escudo Cromado', desc: 'bloqueia 1 golpe e recarrega', max: 2 },
  { id: 'jacket', cat: 'def', rar: 'rare', icon: '🧥', name: 'Jaqueta de Couro', desc: '-20% de dano recebido', max: 2 },
  { id: 'heart', cat: 'def', rar: 'common', icon: '❤️', name: 'Coração V8', desc: '+25 de vida máxima e cura 25', max: 4 },
  { id: 'leech', cat: 'def', rar: 'common', icon: '🦇', name: 'Vampiro do Asfalto', desc: '+3 de vida a cada punk derrubado', max: 3 },
  { id: 'luck', cat: 'def', rar: 'common', icon: '🍀', name: 'Sorte Grande', desc: '+50% de chance de power-up', max: 3 },
  { id: 'combo', cat: 'def', rar: 'common', icon: '⏱️', name: 'Combo Mestre', desc: '+1.5 s de janela de combo', max: 3 },
];
// socorro e reserva
export const SKILL_HEAL = { id: 'heal', cat: 'def', rar: 'common', icon: '🔧', name: 'Pit Stop', desc: 'recupera TODA a vida', max: 99 };
const SKILL_CASH = { id: 'cash', cat: 'def', rar: 'common', icon: '💰', name: 'Bolada', desc: '+2000 pontos', max: 99 };
export const SKILL_BY_ID = Object.fromEntries([...SKILLS, SKILL_HEAL, SKILL_CASH].map((s) => [s.id, s]));

// chance de raro/épico sobe ao longo da viagem
function rollRarity() {
  const w = G.wave;
  const [c, r] = w <= 3 ? [0.62, 0.3] : w <= 6 ? [0.5, 0.36] : [0.4, 0.4];
  const x = Math.random();
  return x < c ? 'common' : x < c + r ? 'rare' : 'epic';
}

// kind: 'first' (ataque épico garantido), 'boss' (um épico garantido) ou 'normal'
export function buildOffer(kind) {
  const P = G.player;
  const epicCat = kind === 'first' ? 'atk' : kind === 'boss' ? pick(['atk', 'fx', 'def', 'atk']) : null;
  const out = [];
  for (const cat of ['atk', 'fx', 'def']) {
    const pool = SKILLS.filter((x) => x.cat === cat && P.lvl(x.id) < x.max);
    if (!pool.length) {
      out.push(SKILL_CASH);
      continue;
    }
    const rar = cat === epicCat ? 'epic' : rollRarity();
    const order = rar === 'epic' ? ['epic', 'rare', 'common'] : rar === 'rare' ? ['rare', 'common', 'epic'] : ['common', 'rare', 'epic'];
    let cand = [];
    for (const r of order) {
      cand = pool.filter((x) => x.rar === r);
      if (cand.length) break;
    }
    // sinergia: às vezes oferece algo que você já tem, pra subir de nível
    const owned = cand.filter((x) => P.lvl(x.id));
    out.push(owned.length && Math.random() < 0.35 ? pick(owned) : pick(cand));
  }
  // socorro: vida baixa vira Pit Stop no portal de defesa
  if (P.hp < P.stats.maxHp * 0.45) out[2] = SKILL_HEAL;
  return out;
}
