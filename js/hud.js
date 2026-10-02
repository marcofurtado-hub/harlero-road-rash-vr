// HUD diegético: painel no tanque da moto + letreiro de anúncios + barra do chefão
import * as THREE from 'three';
import { G, clamp } from './ctx.js';
import { makeCanvas, FW, FB, fitFont, strokeText, roundRect, setFont } from './text.js';

export class Hud {
  constructor(player) {
    this.player = player;
    // painel
    this.canvas = makeCanvas(512, 320);
    this.canvas.id = 'dash';
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), new THREE.MeshBasicMaterial({ map: this.tex, fog: false }));
    dash.position.set(0, 0.975, -0.283);
    dash.rotation.x = -0.83;
    player.bike.group.add(dash);
    this.dash = dash;
    this.timer = 0;
    // letreiro de anúncios
    this.annCanvas = makeCanvas(1024, 256);
    this.annTex = new THREE.CanvasTexture(this.annCanvas);
    this.annTex.colorSpace = THREE.SRGBColorSpace;
    this.ann = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 0.9),
      new THREE.MeshBasicMaterial({ map: this.annTex, transparent: true, depthTest: false, fog: false })
    );
    this.ann.position.set(0, 2.3, -5.5);
    this.ann.renderOrder = 30;
    this.ann.visible = false;
    player.rig.add(this.ann);
    this.annT = 0;
    this.annDur = 0;
    // barra do chefão
    this.bossCanvas = makeCanvas(1024, 96);
    this.bossTex = new THREE.CanvasTexture(this.bossCanvas);
    this.bossTex.colorSpace = THREE.SRGBColorSpace;
    this.bossBar = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.3),
      new THREE.MeshBasicMaterial({ map: this.bossTex, transparent: true, depthTest: false, fog: false })
    );
    this.bossBar.position.set(0, 2.95, -6.5);
    this.bossBar.renderOrder = 29;
    this.bossBar.visible = false;
    player.rig.add(this.bossBar);
    this.bossShown = -1;
  }

  announce(title, sub = '', color = '#ffd21e', dur = 2.6) {
    const c = this.annCanvas;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const grd = g.createLinearGradient(0, 0, c.width, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.2, 'rgba(10,4,2,0.65)');
    grd.addColorStop(0.8, 'rgba(10,4,2,0.65)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 20, c.width, 216);
    fitFont(g, title, c.width - 120, 110, FW);
    strokeText(g, title, c.width / 2, sub ? 100 : 128, color, '#000', 12);
    if (sub) {
      fitFont(g, sub, c.width - 160, 46, FB);
      strokeText(g, sub, c.width / 2, 195, '#ffffff', '#000', 8);
    }
    this.annTex.needsUpdate = true;
    this.ann.visible = true;
    this.annT = 0;
    this.annDur = dur;
  }

  drawBoss(b) {
    const c = this.bossCanvas;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    roundRect(g, 10, 44, c.width - 20, 40, 10);
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fill();
    const k = clamp(b.hp / b.maxHp, 0, 1);
    roundRect(g, 16, 50, (c.width - 32) * k + 0.01, 28, 8);
    g.fillStyle = '#e02020';
    g.fill();
    setFont(g, 34, FB);
    strokeText(g, b.name, c.width / 2, 22, '#ffd21e', '#000', 6);
    this.bossTex.needsUpdate = true;
  }

  update(dt) {
    // anúncio
    if (this.ann.visible) {
      this.annT += dt;
      const k = this.annT / this.annDur;
      const s = k < 0.1 ? 0.6 + (k / 0.1) * 0.4 : 1;
      this.ann.scale.set(s, s, 1);
      this.ann.material.opacity = k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : 1;
      this.ann.position.y = this.player.head.y + 0.85;
      if (k >= 1) this.ann.visible = false;
    }
    // chefão
    const boss = G.enemies.boss();
    if (boss) {
      this.bossBar.visible = true;
      this.bossBar.position.y = this.player.head.y + 1.45;
      const hpKey = Math.round((boss.hp / boss.maxHp) * 200);
      if (hpKey !== this.bossShown) {
        this.bossShown = hpKey;
        this.drawBoss(boss);
      }
    } else this.bossBar.visible = false;
    // painel (10 Hz)
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.1;
    this.drawDash();
  }

  drawDash() {
    const g = this.g;
    const W = 512;
    const H = 320;
    const P = this.player;
    g.clearRect(0, 0, W, H);
    roundRect(g, 4, 4, W - 8, H - 8, 30);
    g.fillStyle = '#0c0a0a';
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#9aa0aa';
    g.stroke();
    // velocímetro
    const cx = 140;
    const cy = 175;
    const R = 112;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fillStyle = '#f2e8d0';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#555';
    g.stroke();
    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((a1 - a0) * i) / 12;
      const big = i % 2 === 0;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
      g.lineTo(cx + Math.cos(a) * (R - (big ? 24 : 14)), cy + Math.sin(a) * (R - (big ? 24 : 14)));
      g.lineWidth = big ? 5 : 3;
      g.strokeStyle = i >= 10 ? '#c01010' : '#111';
      g.stroke();
      if (big) {
        setFont(g, 20, FB);
        g.fillStyle = '#111';
        g.fillText(String(i * 10), cx + Math.cos(a) * (R - 44), cy + Math.sin(a) * (R - 44));
      }
    }
    const mph = P.speed * 2.237;
    const na = a0 + (a1 - a0) * clamp(mph / 120, 0, 1);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(na) * (R - 18), cy + Math.sin(na) * (R - 18));
    g.lineWidth = 6;
    g.strokeStyle = '#d01010';
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 10, 0, Math.PI * 2);
    g.fillStyle = '#222';
    g.fill();
    setFont(g, 28, FB);
    g.fillStyle = '#111';
    g.fillText(Math.round(mph), cx, cy + 52);
    setFont(g, 13, FB);
    g.fillText('MPH', cx, cy + 76);

    // painel direito
    const x0 = 275;
    g.textAlign = 'left';
    setFont(g, 30, FB);
    if (G.state === 'title') strokeText(g, 'ROTA 66', x0, 48, '#ffd21e', null);
    else strokeText(g, `ONDA ${G.wave}`, x0, 48, '#ffd21e', null);
    setFont(g, 18, FB);
    g.fillStyle = '#ff9a5a';
    const left = G.waves.active ? G.waves.remaining() : 0;
    g.fillText(G.state === 'wave' ? `PUNKS: ${left}` : G.state === 'upgrade' ? 'ESCOLHA UPGRADE' : G.state === 'dead' ? 'GAME OVER' : '', x0, 82);
    setFont(g, 26, FB);
    g.fillStyle = '#ffffff';
    g.fillText(String(Math.floor(G.score)).padStart(7, '0'), x0, 120);
    // vida
    const hpK = clamp(P.hp / P.stats.maxHp, 0, 1);
    setFont(g, 15, FB);
    g.fillStyle = '#aaa';
    g.fillText('VIDA', x0, 152);
    roundRect(g, x0, 164, 210, 30, 8);
    g.fillStyle = '#2a1414';
    g.fill();
    roundRect(g, x0 + 3, 167, 204 * hpK + 0.01, 24, 6);
    g.fillStyle = hpK > 0.5 ? '#40d060' : hpK > 0.25 ? '#e0c020' : Math.sin(G.time * 12) > 0 ? '#ff2020' : '#801010';
    g.fill();
    setFont(g, 16, FB);
    g.fillStyle = '#000';
    g.textAlign = 'center';
    g.fillText(`${Math.ceil(P.hp)} / ${P.stats.maxHp}`, x0 + 105, 180);
    g.textAlign = 'left';
    // combo / fúria
    if (G.combo > 1) {
      setFont(g, 24, FB);
      strokeText(g, `COMBO x${G.combo}`, x0, 222, '#ff4fd0', null);
    }
    if (G.furyT > 0) {
      setFont(g, 20, FB);
      g.fillStyle = Math.sin(G.time * 14) > 0 ? '#ff3030' : '#ffd21e';
      g.fillText(`FÚRIA ${Math.ceil(G.furyT)}s`, x0, 252);
    }
    // alerta de inimigos atrás
    let l = false;
    let r = false;
    for (const e of G.enemies.list) {
      if (e.dying) continue;
      if (e.z > 1.5 && e.z < 45) {
        if (e.x < P.x) l = true;
        else r = true;
      }
    }
    if ((l || r) && Math.sin(G.time * 10) > -0.3) {
      setFont(g, 20, FB);
      g.fillStyle = '#ff3030';
      g.textAlign = 'center';
      g.fillText(`${l ? '◀ ' : ''}ATRÁS${r ? ' ▶' : ''}`, x0 + 105, 290);
    }
    this.tex.needsUpdate = true;
  }
}
