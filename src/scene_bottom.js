// 下の画面：相棒が自動で歩き、自動で戦う。ルールは sim.js、ここは見せ方。
class BottomScene extends Phaser.Scene {
  constructor() { super('bottom'); }

  create() {
    const A = this.A = window.AIBOU, L = A.LAYOUT;
    this.W = A.W; this.H = L.botH;
    this.groundY = 252; this.px = 110;
    const cam = this.cameras.main;
    cam.setViewport(0, L.botY, A.W, L.botH);
    cam.setBackgroundColor('#3b3f7a');

    this.makeBgTextures();
    this.add.rectangle(this.W / 2, 60, this.W, 120, 0x4a4f8f).setDepth(0);
    this.add.rectangle(this.W / 2, 160, this.W, 100, 0x5a5f9f).setDepth(0);
    this.hills = this.add.tileSprite(this.W / 2, this.groundY - 40, this.W, 80, 'b_hills').setDepth(1);
    this.ground = this.add.tileSprite(this.W / 2, this.groundY + 34, this.W, 68, 'b_ground').setDepth(2);
    this.dusk = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x1a0a2a, 1).setAlpha(0).setDepth(40);

    // 相棒
    this.partner = this.add.container(this.px, this.groundY - 18).setDepth(10);
    this.pBody = this.add.image(0, 0, 'partner0');
    this.partner.add(this.pBody);
    this.partViews = [];   // 部品ごとの絵（時間で小さくなる）
    this.wingSprites = [];

    this.hpBar = this.add.graphics().setDepth(20);
    this.bossBar = this.add.graphics().setDepth(20);
    this.bossIcon = null;
    this.fx = this.add.graphics().setDepth(30);
    this.enemySprites = new Map();
    this.petals = [];
    this.petalTimer = 0;
    this.walkT = 0; this.scroll = 0; this.acc = 0;
    this.battle = A.state.battle;
    this.ended = false;
  }

  makeBgTextures() {
    if (this.textures.exists('b_hills')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x2d2f66, 1);
    for (let x = 0; x < this.W + 200; x += 135) g.fillEllipse(x, 80, 220, 110);
    g.fillStyle(0x24264f, 1);
    for (let x = 60; x < this.W + 200; x += 170) g.fillEllipse(x, 92, 160, 70);
    g.generateTexture('b_hills', this.W, 80);
    g.clear();
    g.fillStyle(0x3d9a3a, 1); g.fillRect(0, 0, 64, 10);
    g.fillStyle(0x7ad457, 1); g.fillRect(0, 0, 64, 5); g.fillRect(10, 5, 6, 3); g.fillRect(40, 5, 6, 3);
    g.fillStyle(0x6b4a2a, 1); g.fillRect(0, 10, 64, 58);
    g.fillStyle(0x4d3420, 1); g.fillRect(8, 20, 10, 6); g.fillRect(38, 34, 12, 6); g.fillRect(20, 50, 10, 6); g.fillRect(50, 16, 8, 5);
    g.generateTexture('b_ground', 64, 68);
    g.destroy();
  }

  getPartnerScreenPos() { return { x: this.partner.x, y: this.A.LAYOUT.botY + this.partner.y - 10 }; }

  // ---- 部品の見た目 ----
  rebuildParts() {
    this.partViews.forEach(v => v.sprites.forEach(s => s.destroy()));
    this.partViews = []; this.wingSprites = [];
    const parts = this.battle.partner.parts;
    const counts = {};
    parts.forEach(p => {
      const i = counts[p.kind] || 0; counts[p.kind] = i + 1;
      const view = { part: p, sprites: [], base: [] };
      const add = (s, back, isGlow) => {
        if (back) this.partner.addAt(s, 0); else this.partner.add(s);
        s.isGlow = !!isGlow;
        view.sprites.push(s);
        view.base.push({ sx: s.scaleX, sy: s.scaleY, a: s.alpha });
      };
      let s, g;
      switch (p.kind) {
        case 'horn':
          add(this.add.image(8 - i * 10, -28 - i * 2, 'p_horn').setOrigin(0.5, 1)); break;
        case 'thunder':
          add(this.add.image(6 - i * 10, -30, 'p_thunder').setOrigin(0.5, 1));
          g = this.add.image(6, -40, 'glow').setTint(0x7cf7ff).setAlpha(0.5).setScale(0.9).setBlendMode(Phaser.BlendModes.ADD);
          add(g, false, true); break;
        case 'iron':
          add(this.add.image(6 - i * 10, -30, 'p_iron').setOrigin(0.5, 1)); break;
        case 'wing':
          s = this.add.image(-16 - i * 4, -8 - i * 4, 'p_wing0').setOrigin(0.5, 1);
          add(s, true); this.wingSprites.push({ s, k: 'p_wing' }); break;
        case 'petal':
          s = this.add.image(-16 - i * 4, -8 - i * 4, 'p_petal0').setOrigin(0.5, 1);
          add(s, true); this.wingSprites.push({ s, k: 'p_petal' }); break;
        case 'stone':
          add(this.add.image(0, 2 + i * 3, 'p_stone').setAlpha(0.95)); break;
        case 'moss':
          add(this.add.image(0, 2 + i * 3, 'p_moss'));
          g = this.add.image(0, 0, 'glow').setTint(0xb6ff7a).setAlpha(0.35).setScale(1.8).setBlendMode(Phaser.BlendModes.ADD);
          add(g, true, true); break;
        case 'flower':
          add(this.add.image(-10 - i * 8, -26, 'p_flower').setOrigin(0.5, 1)); break;
      }
      this.partViews.push(view);
    });
  }

  // 残り時間が短い部品は小さくなり、最後は点滅する
  updatePartViews(time) {
    for (const v of this.partViews) {
      const life = v.part.life, max = v.part.maxLife || 25;
      const shrinkFrom = Math.min(10, max * 0.4);
      const k = life < shrinkFrom ? 0.45 + 0.55 * Math.max(0, life / shrinkFrom) : 1;
      const blink = life < 3 ? (Math.floor(time / 90) % 2 ? 0.3 : 1) : 1;
      v.sprites.forEach((s, j) => {
        const b = v.base[j];
        s.setScale(b.sx * k, b.sy * k);
        const glowPulse = s.isGlow ? (0.6 + 0.4 * Math.sin(time * 0.006)) : 1;
        s.setAlpha(b.a * blink * glowPulse);
      });
    }
  }

  // ---- 敵の見た目 ----
  makeEnemySprite(e) {
    const key = { slime: 'slime', bat: 'bat0', tough: 'tough', boss: 'boss' }[e.type];
    const img = this.add.image(0, 0, key);
    const bar = this.add.graphics();
    const c = this.add.container(this.px + e.x, this.groundY - img.height / 2, [img, bar]).setDepth(e.type === 'boss' ? 9 : 8);
    c.img = img; c.bar = bar; c.hgt = img.height; c.wid = img.width;
    if (e.type === 'boss') { c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 600 }); }
    return c;
  }

  syncEnemies(time) {
    const seen = new Set();
    let stackIdx = 0;
    for (const e of this.battle.enemies) {
      seen.add(e.id);
      let s = this.enemySprites.get(e.id);
      if (!s) { s = this.makeEnemySprite(e); this.enemySprites.set(e.id, s); }
      let x = this.px + e.x;
      let y = this.groundY - s.hgt / 2;
      if (e.state === 'contact') { x += stackIdx * 10; stackIdx++; }
      if (e.type === 'bat') y -= 44 + Math.sin(time * 0.006 + e.id) * 8;
      if (e.state === 'passing') y -= Math.sin(Math.PI * Math.min(1, e.passT / 0.5)) * 100;
      s.x = x; s.y = y;
      if (e.stun > 0) s.img.setAngle(Math.sin(time * 0.05) * 12); else s.img.setAngle(0);
      if (e.type === 'bat') s.img.setTexture(Math.floor(time / 110) % 2 ? 'bat0' : 'bat1');
      if (e.type === 'slime') s.img.scaleY = 1 + Math.sin(time * 0.01 + e.id) * 0.07;
      if (e.type === 'boss') s.img.scaleY = 1 + Math.sin(time * 0.004) * 0.03;
      s.bar.clear();
      if (e.hp < e.maxHp && e.type !== 'boss') {
        const w = s.wid, r = Math.max(0, e.hp / e.maxHp);
        s.bar.fillStyle(0x000000, 0.6); s.bar.fillRect(-w / 2, -s.hgt / 2 - 8, w, 4);
        s.bar.fillStyle(0xff6060, 1); s.bar.fillRect(-w / 2, -s.hgt / 2 - 8, w * r, 4);
      }
    }
    for (const [id, s] of this.enemySprites) {
      if (!seen.has(id)) { s.destroy(); this.enemySprites.delete(id); }
    }
  }

  // ---- 出来事ごとの演出 ----
  handleEvents(evs) {
    const A = this.A;
    for (const ev of evs) {
      switch (ev.type) {
        case 'partnerAttack': {
          this.tweens.killTweensOf(this.pBody);
          this.pBody.x = 0;
          this.tweens.add({ targets: this.pBody, x: 18, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
          break;
        }
        case 'enemyHit': {
          const s = this.enemySprites.get(ev.enemy.id);
          if (s) {
            s.img.setTintFill(0xffffff);
            this.time.delayedCall(60, () => { if (s.active) s.img.clearTint(); });
            const color = ev.kind === 'chain' ? 0x7cf7ff : ev.kind === 'burst' ? 0xffb347 : 0xffffff;
            this.burst(s.x, s.y, color, ev.kind === 'burst' ? 8 : 4, ev.kind === 'burst' ? 40 : 22);
            if (ev.kind === 'normal') A.sfx.hitEnemy();
          }
          break;
        }
        case 'chainHit': {
          const from = this.enemySprites.get(ev.from.id);
          this.fx.clear();
          this.fx.lineStyle(3, 0xbff9ff, 1);
          const sx = from ? from.x : this.px + 40, sy = from ? from.y : this.groundY - 20;
          ev.targets.forEach(t => {
            const s = this.enemySprites.get(t.id);
            if (!s) return;
            this.lightning(sx, sy, s.x, s.y);
          });
          this.time.delayedCall(110, () => this.fx.clear());
          A.sfx.thunder();
          break;
        }
        case 'enemyKilled': {
          const s = this.enemySprites.get(ev.enemy.id);
          if (s) {
            const color = { slime: 0x6fe06f, bat: 0xb06cf5, tough: 0xf05a4a, boss: 0xa8271d }[ev.enemy.type];
            this.burst(s.x, s.y, color, ev.enemy.type === 'boss' ? 40 : 10, ev.enemy.type === 'boss' ? 120 : 50);
            s.img.setTintFill(0xffffff);
          }
          A.sfx.kill();
          break;
        }
        case 'partnerHit': {
          this.pBody.setTintFill(0xff6060);
          this.time.delayedCall(80, () => this.pBody.clearTint());
          this.tweens.add({ targets: this.partner, x: this.px - 6, duration: 50, yoyo: true, repeat: 1, onComplete: () => { this.partner.x = this.px; } });
          if (ev.blocked >= 3) { this.burst(this.partner.x + 10, this.partner.y, 0xc0c8d0, 5, 24); A.sfx.guard(); }
          else A.sfx.partnerHit();
          break;
        }
        case 'dodge': {
          const ghost = this.add.image(this.partner.x, this.partner.y, this.pBody.texture.key).setAlpha(0.5).setDepth(9).setTint(0xcdf3ff);
          this.tweens.add({ targets: ghost, alpha: 0, x: ghost.x - 10, duration: 220, onComplete: () => ghost.destroy() });
          this.tweens.add({ targets: this.partner, x: this.px - 22, y: this.groundY - 30, duration: 90, yoyo: true, onComplete: () => { this.partner.x = this.px; this.partner.y = this.groundY - 18; } });
          A.sfx.dodge();
          break;
        }
        case 'regenTick': {
          for (let i = 0; i < 3; i++) {
            const s = this.add.image(this.partner.x - 14 + Math.random() * 28, this.partner.y + 10, 'px').setTint(0x9dff9d).setDepth(12).setScale(0.7);
            this.tweens.add({ targets: s, y: s.y - 36, alpha: 0, duration: 600 + Math.random() * 300, onComplete: () => s.destroy() });
          }
          A.sfx.heal();
          break;
        }
        case 'partAttached': {
          this.rebuildParts();
          this.partner.setScale(1.15);
          this.tweens.add({ targets: this.partner, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' });
          if (!ev.part.fused) { A.sfx.attach(); this.burst(this.partner.x, this.partner.y - 20, 0xffffff, 6, 26); }
          break;
        }
        case 'partDropped':
        case 'partExpired': {
          this.rebuildParts();
          const key = this.partKey(ev.part.kind);
          if (key) {
            const small = ev.type === 'partExpired';
            const d = this.add.image(this.partner.x - 10, this.partner.y - 20, key).setDepth(11).setScale(small ? 0.5 : 1);
            this.tweens.add({ targets: d, x: d.x - 40, y: d.y + 70, angle: -120, alpha: 0, duration: 700, ease: 'Quad.easeIn', onComplete: () => d.destroy() });
            if (small) this.burst(this.partner.x - 4, this.partner.y - 22, 0xc0c8d0, 4, 18);
          }
          if (ev.type === 'partExpired') A.sfx.expire(); else A.sfx.drop();
          break;
        }
        case 'fusion': {
          A.sfx.fusion();
          A.bus.emit('fusion', { kind: ev.kind, x: this.partner.x, y: this.A.LAYOUT.botY + this.partner.y });
          this.partner.setScale(1.5);
          this.tweens.add({ targets: this.partner, scaleX: 1, scaleY: 1, duration: 500, delay: 500, ease: 'Back.easeOut' });
          const color = this.fusionColor(ev.kind);
          for (let i = 0; i < 3; i++) {
            const ring = this.add.image(this.partner.x, this.partner.y, 'ring').setTint(color).setDepth(35).setScale(0.3).setAlpha(0);
            this.tweens.add({ targets: ring, scaleX: 7, scaleY: 7, alpha: { from: 1, to: 0 }, duration: 600, delay: 620 + i * 120, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
          }
          break;
        }
        case 'bossAppear': {
          A.sfx.bossAppear();
          this.tweens.add({ targets: this.dusk, alpha: 0.3, duration: 1500 });
          this.bossIcon = this.add.image(110, 16, 'mini_boss').setDepth(21);
          A.bus.emit('bossAppear');
          break;
        }
        case 'passed': {
          if (A.options.riseEnabled) {
            A.bus.emit('rise', { type: ev.enemy.type, x: this.px + ev.enemy.x, y: this.A.LAYOUT.botY + this.groundY - 20 });
          }
          break;
        }
        case 'win': this.onWin(); break;
        case 'lose': this.onLose(); break;
      }
    }
  }

  partKey(kind) {
    return { horn: 'p_horn', thunder: 'p_thunder', iron: 'p_iron', wing: 'p_wing0', petal: 'p_petal0', stone: 'p_stone', moss: 'p_moss', flower: 'p_flower' }[kind];
  }
  fusionColor(kind) { return { thunder: 0x7cf7ff, moss: 0xb6ff7a, iron: 0xc0c8d0, petal: 0xff9ccb }[kind] || 0xffffff; }

  lightning(x1, y1, x2, y2) {
    const n = 5;
    let px = x1, py = y1;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const nx = Phaser.Math.Linear(x1, x2, t) + (i < n ? (Math.random() - 0.5) * 24 : 0);
      const ny = Phaser.Math.Linear(y1, y2, t) + (i < n ? (Math.random() - 0.5) * 24 : 0);
      this.fx.lineBetween(px, py, nx, ny);
      px = nx; py = ny;
    }
  }

  burst(x, y, color, n, dist) {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'px').setTint(color).setDepth(31).setScale(0.6 + Math.random() * 0.8);
      const a = Math.random() * Math.PI * 2, d = dist * (0.5 + Math.random() * 0.5);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 250 + Math.random() * 250, onComplete: () => s.destroy() });
    }
  }

  onWin() {
    if (this.ended) return; this.ended = true;
    const A = this.A;
    A.state.result = 'win';
    A.sfx.success();
    this.tweens.add({ targets: this.dusk, alpha: 0, duration: 400 });
    // 光って踊る
    const glow = this.add.image(0, 0, 'glow').setScale(2.6).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD);
    this.partner.addAt(glow, 0);
    this.tweens.add({ targets: glow, scaleX: 3.4, scaleY: 3.4, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.partner, y: this.groundY - 60, duration: 280, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.partner, angle: { from: -15, to: 15 }, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.hue = { v: 0 };
    this.tweens.add({ targets: this.hue, v: 1, duration: 1200, repeat: -1, onUpdate: () => {
      const c = Phaser.Display.Color.HSVToRGB(this.hue.v, 0.5, 1).color;
      this.pBody.setTint(c); glow.setTint(c);
    } });
    this.time.addEvent({ delay: 220, repeat: 12, callback: () => this.burst(this.partner.x + (Math.random() - 0.5) * 120, this.partner.y - 40 + (Math.random() - 0.5) * 80, Phaser.Display.Color.HSVToRGB(Math.random(), 0.6, 1).color, 8, 60) });
    A.bus.emit('result', 'win');
  }

  onLose() {
    if (this.ended) return; this.ended = true;
    const A = this.A;
    A.state.result = 'lose';
    A.sfx.fail();
    // 倒れて暗くなる
    this.tweens.add({ targets: this.partner, angle: 90, y: this.groundY - 6, x: this.px - 10, duration: 700, ease: 'Bounce.easeOut' });
    this.tweens.add({ targets: this.dusk, alpha: 0.75, duration: 1600, delay: 300 });
    this.pBody.setTint(0x8a8a9a);
    this.partViews.forEach(v => v.sprites.forEach(s => s.setTint(0x8a8a9a)));
    A.bus.emit('result', 'lose');
  }

  drawBars() {
    const b = this.battle;
    const g = this.hpBar; g.clear();
    const r = Phaser.Math.Clamp(b.partner.hp / b.partner.maxHp, 0, 1);
    const x = this.partner.x - 32, y = this.groundY - 78, w = 64, h = 8;
    g.fillStyle(0x000000, 0.6); g.fillRect(x - 1, y - 1, w + 2, h + 2);
    const col = r > 0.5 ? 0x6fe06f : r > 0.25 ? 0xffd23f : 0xff5050;
    g.fillStyle(col, 1); g.fillRect(x, y, w * r, h);
    const bb = this.bossBar; bb.clear();
    const boss = b.enemies.find(e => e.type === 'boss');
    if (boss) {
      const bw = 300, bx = 128, by = 10;
      bb.fillStyle(0x000000, 0.6); bb.fillRect(bx - 1, by - 1, bw + 2, 14);
      bb.fillStyle(0xa8271d, 1); bb.fillRect(bx, by, bw * Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1), 12);
    }
  }

  animatePartner(time, delta, walking) {
    if (this.ended) return;
    const st = this.battle.stats();
    if (walking) {
      this.walkT += delta * (st.speed / 60);
      this.pBody.setTexture(Math.floor(this.walkT / 180) % 2 ? 'partner1' : 'partner0');
      this.pBody.y = Math.floor(this.walkT / 180) % 2 ? -2 : 0;
    } else {
      this.pBody.setTexture('partner0'); this.pBody.y = 0;
    }
    const wf = Math.floor(time / 140) % 2;
    this.wingSprites.forEach(w => w.s.setTexture(w.k + wf));
    this.updatePartViews(time);
    // 花びらの羽：通った後に花が咲く
    const hasPetal = this.battle.partner.parts.some(p => p.kind === 'petal');
    if (hasPetal && walking) {
      this.petalTimer += delta;
      if (this.petalTimer > 260) {
        this.petalTimer = 0;
        const f = this.add.image(this.partner.x - 22, this.groundY - 4 + Math.random() * 6, 'petal').setDepth(3).setScale(0.3);
        this.tweens.add({ targets: f, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
        f.life = 3200;
        this.petals.push(f);
      }
    }
    const sp = walking ? st.speed * delta / 1000 : 0;
    this.petals = this.petals.filter(f => {
      f.x -= sp; f.life -= delta;
      if (f.life < 600) f.setAlpha(Math.max(0, f.life / 600));
      if (f.life <= 0 || f.x < -20) { f.destroy(); return false; }
      return true;
    });
  }

  update(time, delta) {
    const A = this.A, S = A.state, b = this.battle;
    const running = S.phase === 'playing' && !A.frozen(time) && b.state === 'running';
    if (running) {
      this.acc += Math.min(delta, 50) / 1000;
      const step = 1 / 60;
      while (this.acc >= step) { b.step(step); this.acc -= step; }
      this.handleEvents(b.drainEvents());
      if (b.walking) {
        this.scroll += b.stats().speed * delta / 1000;
        this.hills.tilePositionX = this.scroll * 0.3;
        this.ground.tilePositionX = this.scroll;
      }
    } else if (b.state !== 'running' && b.events.length) {
      this.handleEvents(b.drainEvents());
    }
    this.syncEnemies(time);
    this.animatePartner(time, delta, running && b.walking);
    this.drawBars();
  }
}
