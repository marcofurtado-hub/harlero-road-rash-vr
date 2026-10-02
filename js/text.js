import * as THREE from 'three';

export const FW = '"Rye", Georgia, serif'; // fonte western
export const FB = '"Bungee", "Arial Black", Impact, sans-serif'; // fonte HUD

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTex(w, h, draw) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function setFont(g, size, family, weight = '') {
  g.font = `${weight} ${size}px ${family}`;
}

export function fitFont(g, text, maxW, size, family, weight = '') {
  let s = size;
  for (;;) {
    setFont(g, s, family, weight);
    if (g.measureText(text).width <= maxW || s <= 10) break;
    s -= 2;
  }
  return s;
}

export function wrapLines(g, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function strokeText(g, text, x, y, fill, stroke = '#000', lw = 6) {
  g.lineJoin = 'round';
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.strokeText(text, x, y);
  }
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export async function loadFonts() {
  if (!document.fonts) return;
  const p = Promise.all([document.fonts.load('48px Rye'), document.fonts.load('48px Bungee')]);
  await Promise.race([p, new Promise((r) => setTimeout(r, 3000))]);
}
