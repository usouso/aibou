// いちばん上にかぶさる画面：体力・持ちもの・送るボタン・スマホのボタン・画面をまたぐ演出。
class UIScene extends Phaser.Scene {
  constructor() { super('ui'); }

  create() {
    const A = this.A = window.AIBOU, L = A.LAYOUT, W = A.W;
    this.input.addPointer(3);

    // ---- HUD の帯 ----
    this.add.rectangle(W / 2, L.hudY + L.hudH / 2, W, L.hudH, 0x14142a);
    this.add.rectangle(W / 2, L.hudY + 1, W, 2, 0x2e2e52);
    this.add.rectangle(W / 2, L.botY - 1, W, 2, 0x2e2e52);
    this.hearts = [0, 1, 2].map(i => this.add.image(28 + i * 26, L.hudY + 24, 'heart'));

    // 相棒の進み（ボスまで）
    this.progX0 = 150; this.progX1 = 384; this.progY = L.hudY + 52;
    this.add.rectangle((this.progX0 + this.progX1) / 2, this.progY, this.progX1 - this.progX0, 4, 0x3a3a62);
    for (let i = 1; i < 4; i++) this.add.rectangle(Phaser.Math.Linear(this.progX0, this.progX1, i / 4), this.progY, 2, 8, 0x3a3a62);
    this.add.image(this.progX1 + 16, this.progY - 2, 'mini_boss');
    this.progIcon = this.add.image(this.progX0, this.progY - 4, 'mini_partner');

    // T：倒し損ねた敵が上に来る（入/切）の表示
    this.riseFrame = this.add.rectangle(W - 40, L.hudY + 40, 44, 44, 0x1e1e3a).setStrokeStyle(2, 0x3a3a62);
    this.riseIcon = this.add.image(W - 40, L.hudY + 40, 'mini_rise');
    this.refreshRiseIcon();

    // ---- ボタンの帯 ----
    this.add.rectangle(W / 2, L.ctrlY + L.ctrlH / 2, W, L.ctrlH, 0x10101e);
    this.add.rectangle(W / 2, L.ctrlY + 1, W, 2, 0x2e2e52);
    const cy = L.ctrlY + 88;
    this.btnL = this.makeRoundBtn(68, cy, 46, 'left');
    this.btnR = this.makeRoundBtn(170, cy, 46, 'right');
    this.btnJ = this.makeRoundBtn(466, cy, 56, 'jump');
    this.sendRect = new Phaser.Geom.Rectangle(236, L.ctrlY + 14, 168, 148);
    this.sendBtn = this.add.container(320, cy);
    this.sendBg = this.add.graphics();
    this.sendBtn.add(this.sendBg);
    this.slotPos = [{ x: -32, y: -22 }, { x: 32, y: -22 }];
    this.slotImgs = [null, null];
    this.sparkle = this.add.image(0, -22, 'glow').setTint(0xfff3a0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.8);
    this.sendBtn.add(this.sparkle);
    this.drawSendBtn(false);

    // ---- 入力 ----
    this.input.keyboard.on('keydown-S', () => this.trySend());
    this.input.keyboard.on('keydown-T', () => this.toggleRise());
    this.input.keyboard.on('keydown', (ev) => this.onAnyKey(ev));
    this.input.on('pointerdown', (p) => this.onPointerDown(p));
    this.input.on('pointerup', () => A.sfx.unlock());

    // ---- 他の画面からの知らせ ----
    this.handlers = {
      pickup: this.onPickup.bind(this),
      heldChanged: () => this.refreshSlots(),
      playerHp: () => this.refreshHearts(),
      fusion: this.onFusion.bind(this),
      rise: this.onRise.bind(this),
      result: this.onResult.bind(this),
      goal: this.onGoal.bind(this),
      bossAppear: () => { this.tweens.add({ targets: this.progIcon, scaleX: 1.4, scaleY: 1.4, duration: 150, yoyo: true, repeat: 3 }); },
    };
    Object.keys(this.handlers).forEach(k => A.bus.on(k, this.handlers[k]));
    this.events.once('shutdown', () => { Object.keys(this.handlers).forEach(k => A.bus.off(k, this.handlers[k])); });

    this.retryIcon = null; this.overlay = null; this.resultAt = 0;
    if (A.state.phase === 'ready') this.showStart();
    this.refreshSlots(); this.refreshHearts();
  }

  // ---- ボタンの絵 ----
  makeRoundBtn(x, y, r, kind) {
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x2a2a48, 1); bg.fillCircle(0, 0, r);
    bg.lineStyle(3, 0x4a4a7a, 1); bg.strokeCircle(0, 0, r);
    const ic = this.add.graphics();
    ic.fillStyle(0xdedeff, 1);
    if (kind === 'left') ic.fillTriangle(-14, 0, 10, -18, 10, 18);
    else if (kind === 'right') ic.fillTriangle(14, 0, -10, -18, -10, 18);
    else { ic.fillTriangle(0, -22, -20, 2, 20, 2); ic.fillRect(-8, 2, 16, 18); }
    c.add([bg, ic]);
    c.r = r; c.kind = kind; c.pressed = false;
    return c;
  }

  drawSendBtn(pressed) {
    const S = this.A.state;
    const g = this.sendBg; g.clear();
    const has = S.held.length > 0;
    const w = 168, h = 148;
    g.fillStyle(has ? 0xffb347 : 0x3a3a58, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    g.lineStyle(4, has ? 0xffe0a8 : 0x55557a, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    // 2 つの置き場
    this.slotPos.forEach(p => {
      g.fillStyle(has ? 0xd98a2a : 0x2a2a44, 1); g.fillCircle(p.x, p.y, 24);
      g.lineStyle(2, has ? 0xffe0a8 : 0x44446a, 1); g.strokeCircle(p.x, p.y, 24);
    });
    // 下向きの矢印（下の相棒へ）
    const ac = has ? 0x2a1a08 : 0x6a6a90;
    g.fillStyle(ac, 1);
    g.fillRect(-7, 22, 14, 22);
    g.fillTriangle(-20, 42, 20, 42, 0, 62);
    this.sendBtn.setScale(pressed ? 0.94 : 1);
  }

  // ---- 持ちもの ----
  refreshSlots() {
    const S = this.A.state;
    this.slotImgs.forEach(s => { if (s) s.destroy(); });
    this.slotImgs = [null, null];
    S.held.forEach((kind, i) => {
      const img = this.add.image(this.slotPos[i].x, this.slotPos[i].y, 'item_' + kind).setScale(1.3);
      this.sendBtn.add(img);
      this.slotImgs[i] = img;
    });
    this.sendBtn.bringToTop(this.sparkle);
    this.drawSendBtn(false);
    const fus = S.held.length === 2 && AibouSim.fusionOf(S.held[0], S.held[1]);
    this.tweens.killTweensOf(this.sparkle);
    if (fus) {
      this.sparkle.setAlpha(0.5);
      this.tweens.add({ targets: this.sparkle, alpha: 0.95, scaleX: 1.1, scaleY: 1.1, duration: 380, yoyo: true, repeat: -1 });
    } else this.sparkle.setAlpha(0);
    this.tweens.killTweensOf(this.sendBtn);
    this.sendBtn.setScale(1);
    if (S.held.length > 0) this.tweens.add({ targets: this.sendBtn, scaleX: 1.03, scaleY: 1.03, duration: 450, yoyo: true, repeat: -1 });
  }

  refreshHearts() {
    const hp = this.A.state.playerHp;
    this.hearts.forEach((h, i) => h.setTexture(i < hp ? 'heart' : 'heart_empty'));
  }

  refreshRiseIcon() {
    const on = this.A.options.riseEnabled;
    this.riseIcon.setAlpha(on ? 1 : 0.25);
    this.riseFrame.setStrokeStyle(2, on ? 0x6fe06f : 0x3a3a62);
  }

  toggleRise() {
    const A = this.A;
    A.options.riseEnabled = !A.options.riseEnabled;
    A.sfx.unlock(); A.sfx.toggle(A.options.riseEnabled);
    this.refreshRiseIcon();
    this.riseIcon.setScale(1.5);
    this.tweens.add({ targets: this.riseIcon, scaleX: 1, scaleY: 1, duration: 200 });
  }

  // 拾ったものが置き場へ飛んでいく
  onPickup(d) {
    const S = this.A.state;
    const idx = S.held.length - 1;
    const to = this.slotPos[idx];
    const img = this.add.image(d.sx, d.sy, 'item_' + d.kind).setDepth(100).setScale(1.4);
    this.tweens.add({
      targets: img, x: this.sendBtn.x + to.x, y: this.sendBtn.y + to.y, scaleX: 1.3, scaleY: 1.3,
      duration: 380, ease: 'Quad.easeIn', onComplete: () => { img.destroy(); this.refreshSlots(); },
    });
    this.refreshSlots();
    if (this.slotImgs[idx]) this.slotImgs[idx].setAlpha(0.25);
  }

  // ---- 送る ----
  trySend() {
    const A = this.A, S = A.state;
    A.sfx.unlock();
    if (S.phase !== 'playing' || A.frozen(this.time.now)) return;
    if (S.held.length === 0) {
      A.sfx.empty();
      this.tweens.add({ targets: this.sendBtn, x: 326, duration: 40, yoyo: true, repeat: 2, onComplete: () => { this.sendBtn.x = 320; } });
      return;
    }
    const items = S.held.splice(0, S.held.length);
    this.refreshSlots();
    this.drawSendBtn(true);
    this.time.delayedCall(120, () => this.drawSendBtn(false));
    A.sfx.send();
    const top = this.scene.get('top'), bot = this.scene.get('bottom');
    const from = top.getPlayerScreenPos();
    const to = bot.getPartnerScreenPos();
    let landed = 0;
    items.forEach((kind, i) => {
      const img = this.add.image(from.x, from.y, 'item_' + kind).setDepth(100).setScale(1.3);
      const o = { t: 0 };
      this.tweens.add({
        targets: o, t: 1, duration: 700, delay: i * 110, ease: 'Quad.easeIn',
        onUpdate: () => {
          const t = o.t;
          img.x = Phaser.Math.Linear(from.x, to.x + (i - 0.5) * 16, t);
          img.y = Phaser.Math.Linear(from.y, to.y, t) - Math.sin(Math.PI * t) * 50;
          img.angle = t * 360 * (i ? -1 : 1);
          if (Math.random() < 0.5) {
            const s = this.add.image(img.x, img.y, 'px').setDepth(99).setTint(0xfff3a0).setScale(0.7);
            this.tweens.add({ targets: s, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 300, onComplete: () => s.destroy() });
          }
        },
        onComplete: () => {
          img.destroy();
          landed++;
          if (landed === items.length) S.battle.send(items);
        },
      });
    });
  }

  // ---- 合体：一瞬止まって、光る ----
  onFusion(d) {
    const A = this.A;
    A.freeze(this, 650);
    const W = A.W, H = A.H;
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 1).setDepth(200);
    this.tweens.add({ targets: flash, alpha: 0, duration: 750, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    const color = { thunder: 0x7cf7ff, moss: 0xb6ff7a, iron: 0xc0c8d0, petal: 0xff9ccb }[d.kind] || 0xffffff;
    const glow = this.add.image(d.x, d.y, 'glow').setTint(color).setDepth(201).setBlendMode(Phaser.BlendModes.ADD).setScale(1);
    this.tweens.add({ targets: glow, scaleX: 14, scaleY: 14, alpha: 0, duration: 900, delay: 100, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
    for (let i = 0; i < 24; i++) {
      const s = this.add.image(d.x, d.y, 'px').setTint(i % 2 ? color : 0xffffff).setDepth(202).setScale(1 + Math.random());
      const a = (i / 24) * Math.PI * 2, dist = 120 + Math.random() * 160;
      this.tweens.add({ targets: s, x: d.x + Math.cos(a) * dist, y: d.y + Math.sin(a) * dist, alpha: 0, duration: 800, delay: 150, ease: 'Quad.easeOut', onComplete: () => s.destroy() });
    }
  }

  // ---- 倒し損ねた敵が上に飛び上がる ----
  onRise(d) {
    const A = this.A;
    if (A.state.phase !== 'playing') return;
    const top = this.scene.get('top');
    const spot = top.pickRiseSpot();
    const key = { slime: 'slime', bat: 'bat0', tough: 'tough' }[d.type] || 'slime';
    const img = this.add.image(d.x, d.y, key).setDepth(100);
    const cam = top.cameras.main;
    const o = { t: 0 };
    A.sfx.rise();
    this.tweens.add({
      targets: o, t: 1, duration: 750, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = o.t;
        const tx = spot.x - cam.scrollX, ty = spot.y - cam.scrollY;
        img.x = Phaser.Math.Linear(d.x, tx, t);
        img.y = Phaser.Math.Linear(d.y, ty, t) - Math.sin(Math.PI * t) * 140;
        img.setScale(1 + Math.sin(Math.PI * t) * 0.5);
        const s = this.add.image(img.x, img.y + 10, 'px').setDepth(99).setTint(0xffffff).setScale(0.8);
        this.tweens.add({ targets: s, alpha: 0, y: s.y + 20, duration: 350, onComplete: () => s.destroy() });
      },
      onComplete: () => { img.destroy(); A.bus.emit('riseLanded', { type: d.type, x: spot.x, y: spot.y }); },
    });
  }

  onGoal() {
    const L = this.A.LAYOUT;
    for (let i = 0; i < 16; i++) {
      const s = this.add.image(Math.random() * this.A.W, L.topH - 10, 'px').setTint(0xffd23f).setDepth(100);
      this.tweens.add({ targets: s, y: s.y - 60 - Math.random() * 80, alpha: 0, duration: 700 + Math.random() * 400, onComplete: () => s.destroy() });
    }
  }

  // ---- はじめ / おわり ----
  showStart() {
    const A = this.A, W = A.W, H = A.H;
    this.overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(300);
    const g = this.add.graphics().setDepth(301);
    g.fillStyle(0xffffff, 1); g.fillCircle(W / 2, 440, 64);
    g.fillStyle(0x14142a, 1); g.fillTriangle(W / 2 - 22, 440 - 34, W / 2 - 22, 440 + 34, W / 2 + 36, 440);
    this.startIcon = g;
    this.tweens.add({ targets: g, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
  }

  startGame() {
    const A = this.A;
    A.sfx.unlock(); A.sfx.start();
    A.state.phase = 'playing';
    A.state.startedAt = this.time.now;
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    if (this.startIcon) { this.startIcon.destroy(); this.startIcon = null; }
    A.bus.emit('start');
  }

  onResult(kind) {
    const A = this.A, W = A.W, L = A.LAYOUT;
    A.state.phase = 'result';
    this.resultAt = this.time.now;
    if (kind === 'lose') {
      const dark = this.add.rectangle(W / 2, L.topH / 2, W, L.topH, 0x000000, 1).setAlpha(0).setDepth(150);
      this.tweens.add({ targets: dark, alpha: 0.6, duration: 1500, delay: 300 });
    } else {
      // 上の画面にも光の粒
      this.time.addEvent({ delay: 120, repeat: 20, callback: () => {
        const s = this.add.image(Math.random() * W, -10, 'px').setTint(Phaser.Display.Color.HSVToRGB(Math.random(), 0.6, 1).color).setDepth(150).setScale(1.2);
        this.tweens.add({ targets: s, y: L.topH + 10, angle: 360, duration: 1800 + Math.random() * 800, onComplete: () => s.destroy() });
      } });
    }
    this.time.delayedCall(2600, () => this.showRetry());
  }

  showRetry() {
    const A = this.A, W = A.W;
    const g = this.add.graphics().setDepth(301);
    const cx = W / 2, cy = 440;
    g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, 64);
    g.lineStyle(10, 0x14142a, 1);
    g.beginPath(); g.arc(cx, cy, 30, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(230), false); g.strokePath();
    g.fillStyle(0x14142a, 1); g.fillTriangle(cx + 12, cy - 38, cx + 36, cy - 14, cx + 6, cy - 6);
    this.retryIcon = g;
    this.tweens.add({ targets: g, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
  }

  retry() {
    const A = this.A;
    A.sfx.unlock(); A.sfx.start();
    A.newRun();
    this.scene.get('top').scene.restart();
    this.scene.get('bottom').scene.restart();
    this.scene.restart();
  }

  onAnyKey(ev) {
    const S = this.A.state;
    if (S.phase === 'ready') { this.startGame(); return; }
    if (S.phase === 'result' && this.retryIcon && (ev.code === 'Space' || ev.code === 'Enter' || ev.key === 'r' || ev.key === 'R')) this.retry();
  }

  onPointerDown(p) {
    const A = this.A, S = A.state;
    A.sfx.unlock();
    if (S.phase === 'ready') { this.startGame(); return; }
    if (S.phase === 'result') { if (this.retryIcon) this.retry(); return; }
    if (Phaser.Geom.Rectangle.Contains(this.sendRect, p.x, p.y)) this.trySend();
    else if (Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(this.riseFrame.x - 26, this.riseFrame.y - 26, 52, 52), p.x, p.y)) this.toggleRise();
    else if (Phaser.Math.Distance.Between(p.x, p.y, this.btnJ.x, this.btnJ.y) <= this.btnJ.r + 14) A.input.jumpPress = true; // 短いタップでも跳ぶ
  }

  update(time) {
    const A = this.A, S = A.state;
    // スマホのボタン：押されている指をすべて見る
    const inp = A.input;
    inp.left = false; inp.right = false; inp.jump = false;
    const btns = [this.btnL, this.btnR, this.btnJ];
    btns.forEach(b => { b.pressed = false; });
    for (const p of this.input.manager.pointers) {
      if (!p.isDown) continue;
      for (const b of btns) {
        if (Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) <= b.r + 14) {
          b.pressed = true;
          if (b.kind === 'left') inp.left = true;
          else if (b.kind === 'right') inp.right = true;
          else inp.jump = true;
        }
      }
    }
    btns.forEach(b => { b.setScale(b.pressed ? 0.92 : 1); b.setAlpha(b.pressed ? 1 : 0.85); });

    // 相棒の進み
    const b = S.battle;
    const r = Phaser.Math.Clamp(b.time / b.cfg.bossTime, 0, 1);
    this.progIcon.x = Phaser.Math.Linear(this.progX0, this.progX1, r);
    this.progIcon.y = this.progY - 4 - (b.bossSpawned ? Math.abs(Math.sin(time * 0.02)) * 4 : 0);
  }
}
