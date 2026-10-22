// 上の画面：自分が走って跳ぶ。ものを拾う。敵に触るとダメージ。
class TopScene extends Phaser.Scene {
  constructor() { super('top'); }

  create() {
    const A = this.A = window.AIBOU, L = A.LAYOUT;
    this.TILE = 32;
    const cam = this.cameras.main;
    cam.setViewport(0, 0, A.W, L.topH);
    cam.setBackgroundColor('#7ec8f2');

    this.st = AibouStage.buildStage();
    const WW = this.st.pixelWidth, HH = L.topH;
    this.physics.world.setBounds(0, -200, WW, HH + 200);
    cam.setBounds(0, 0, WW, HH);

    this.drawBackground(WW, HH);

    // 地形
    const map = this.make.tilemap({ data: this.st.grid, tileWidth: 32, tileHeight: 32 });
    const ts = map.addTilesetImage('tiles', 'tiles', 32, 32, 0, 0);
    this.layer = map.createLayer(0, ts, 0, 0);
    this.layer.setDepth(2);
    this.layer.setCollision([0, 1, 2, 3]);
    this.layer.forEachTile(t => { if (t.index === 2) t.setCollision(false, false, true, false, true); });

    // 自分
    const s = this.st.ents.start;
    this.startX = s.c * 32 + 16; this.startY = s.r * 32 + 16;
    this.player = this.physics.add.sprite(this.startX, this.startY, 'hero0');
    this.player.setSize(16, 28).setOffset(4, 2);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(6);
    this.physics.add.collider(this.player, this.layer);
    this.hp = 3; this.invUntil = 0; this.dead = false; this.facing = 1; this.walkT = 0;
    this.coyote = 0; this.jumpBuf = 0; this.prevJump = false; this.wasGrounded = true;

    // もの
    this.items = this.physics.add.staticGroup();
    this.st.ents.items.forEach(it => this.spawnItem(it.x, it.y, it.kind));
    this.physics.add.overlap(this.player, this.items, (p, it) => this.onPickup(it));

    // ゴール
    const g = this.st.ents.goal;
    this.flag = this.add.image(g.c * 32 + 16, (g.r + 1) * 32, 'flag').setOrigin(0.5, 1).setDepth(3);
    this.physics.add.existing(this.flag, true);
    this.physics.add.overlap(this.player, this.flag, () => this.onGoal());

    // 敵
    this.enemies = this.physics.add.group();
    this.spawnNativeEnemies();
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.overlap(this.player, this.enemies, (p, e) => this.onEnemyTouch(e));

    cam.startFollow(this.player, true, 0.12, 0.12, -120, 0);

    this.keys = this.input.keyboard.addKeys({ left: 'LEFT', right: 'RIGHT', up: 'UP', space: 'SPACE', a: 'A', d: 'D', w: 'W' });

    this.onRiseLanded = this.onRiseLanded.bind(this);
    A.bus.on('riseLanded', this.onRiseLanded);
    this.events.once('shutdown', () => { A.bus.off('riseLanded', this.onRiseLanded); });
  }

  drawBackground(WW, HH) {
    // 遠くの丘（ゆっくり流れる）
    const far = this.add.graphics().setScrollFactor(0.25, 1).setDepth(0);
    far.fillStyle(0x9fd9f5, 1);
    for (let x = -100; x < WW * 0.25 + 800; x += 180) {
      far.fillEllipse(x, HH - 20, 260, 140);
    }
    far.fillStyle(0x6fb7e0, 1);
    for (let x = 0; x < WW * 0.25 + 800; x += 140) far.fillEllipse(x + 60, HH + 10, 200, 110);
    // 雲
    const cl = this.add.graphics().setScrollFactor(0.5, 1).setDepth(1);
    cl.fillStyle(0xffffff, 0.85);
    for (let x = 40; x < WW * 0.5 + 800; x += 230) {
      const y = 40 + ((x * 7) % 90);
      cl.fillRect(x, y, 70, 14); cl.fillRect(x + 14, y - 10, 40, 12); cl.fillRect(x + 44, y - 6, 34, 10);
    }
  }

  // ---- もの ----
  spawnItem(x, y, kind) {
    const it = this.items.create(x, y, 'item_' + kind);
    it.kind = kind; it.setDepth(4); it.cooldownUntil = 0;
    it.body.setSize(22, 22);
    this.tweens.add({ targets: it, scaleX: 1.12, scaleY: 1.12, duration: 500 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return it;
  }

  onPickup(it) {
    if (!it.active || it.cooldownUntil > this.time.now || this.dead) return;
    const A = this.A, S = A.state;
    if (S.phase !== 'playing') return;
    const kind = it.kind;
    const cam = this.cameras.main;
    const sx = it.x - cam.scrollX, sy = it.y - cam.scrollY;
    it.destroy();
    S.held.push(kind);
    let dropped = null;
    if (S.held.length > 2) dropped = S.held.shift();
    A.sfx.pickup();
    this.sparkle(this.player.x, this.player.y - 20, 0xffffff, 6);
    A.bus.emit('pickup', { kind, sx, sy });
    if (dropped) {
      // 持ちきれない分は足元に落とす（拾い直せる）
      const d = this.spawnItem(this.player.x - this.facing * 26, this.player.y - 6, dropped);
      d.cooldownUntil = this.time.now + 1000;
      d.setAlpha(0.4);
      this.tweens.add({ targets: d, alpha: 1, duration: 900 });
      A.sfx.drop();
      A.bus.emit('heldChanged');
    }
  }

  // ---- 敵 ----
  spawnNativeEnemies() {
    this.st.ents.enemies.forEach(def => {
      this.spawnEnemy(def.type, def.c * 32 + 16, def.r * 32 + 16, def);
    });
  }

  spawnEnemy(type, x, y, def) {
    def = def || {};
    const key = { walker: 'walker0', drifter: 'drifter', slime: 'slime', bat: 'bat0', tough: 'tough' }[type];
    const e = this.enemies.create(x, y, key);
    e.kind = type; e.setDepth(5);
    e.phase = def.phase || 0;
    e.flying = (type === 'drifter' || type === 'bat');
    e.risen = !!def.risen;
    if (e.flying) {
      e.body.setAllowGravity(false);
      e.body.setVelocity(0, 0);
      if (type === 'drifter') {
        e.minY = (def.minR != null ? def.minR : 6) * 32 + 16;
        e.maxY = (def.maxR != null ? def.maxR : 9) * 32 + 16;
        e.body.setSize(20, 20);
      } else {
        e.baseY = y - 50; e.baseX = x; e.dir = -1; e.speed = 70;
        e.body.setSize(22, 14);
      }
    } else {
      e.speed = { walker: 55, slime: 45, tough: 38 }[type] || 50;
      e.dir = def.dir || (type === 'walker' ? 1 : -1);
      e.minX = def.minC != null ? def.minC * 32 + 16 : x - 140;
      e.maxX = def.maxC != null ? def.maxC * 32 + 16 : x + 140;
      e.body.setSize(e.width - 8, e.height - 4).setOffset(4, 4);
      e.setVelocityX(e.speed * e.dir);
    }
    if (e.risen) {
      // 来たことが分かるように、少し光ってから落ち着く
      e.setTintFill(0xffffff);
      this.time.delayedCall(120, () => { if (e.active) e.clearTint(); });
    }
    return e;
  }

  updateEnemy(e, time, dt) {
    if (!e.active) return;
    if (e.kind === 'drifter') {
      const mid = (e.minY + e.maxY) / 2, amp = (e.maxY - e.minY) / 2;
      e.y = mid + Math.sin(time * 0.0022 + e.phase) * amp;
      return;
    }
    if (e.kind === 'bat') {
      if (e.x < e.baseX - 120) e.dir = 1;
      if (e.x > e.baseX + 120) e.dir = -1;
      e.x += e.dir * e.speed * dt;
      e.y = e.baseY + Math.sin(time * 0.005 + e.phase) * 18;
      e.setFlipX(e.dir > 0);
      e.setTexture(Math.floor(time / 120) % 2 ? 'bat0' : 'bat1');
      return;
    }
    // 歩く敵：端や壁で向きを変える。段差から落ちない
    const b = e.body;
    if (b.blocked.right) e.dir = -1;
    else if (b.blocked.left) e.dir = 1;
    if (e.x > e.maxX && e.dir > 0) e.dir = -1;
    if (e.x < e.minX && e.dir < 0) e.dir = 1;
    if (b.blocked.down) {
      const ahead = this.layer.getTileAtWorldXY(e.x + e.dir * (e.width / 2 + 4), e.y + e.height / 2 + 6);
      if (!ahead || ahead.index === -1) e.dir = -e.dir;
    }
    e.setVelocityX(e.speed * e.dir);
    e.setFlipX(e.dir < 0);
    if (e.kind === 'walker') e.setTexture(Math.floor(time / 160) % 2 ? 'walker1' : 'walker0');
    if (e.kind === 'slime') e.scaleY = 1 + Math.sin(time * 0.012) * 0.06;
  }

  onEnemyTouch(e) {
    const t = this.time.now;
    if (t < this.invUntil || this.dead || this.A.state.phase !== 'playing' || this.A.state.goalReached) return;
    this.hp--;
    this.invUntil = t + 1200;
    this.A.state.playerHp = this.hp;
    this.A.sfx.playerHit();
    this.A.bus.emit('playerHp', this.hp);
    const p = this.player;
    p.setVelocity(e.x < p.x ? 230 : -230, -320);
    p.setTintFill(0xffffff);
    this.time.delayedCall(90, () => { if (p.active) p.clearTint(); });
    this.sparkle(p.x, p.y, 0xff5050, 8);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.A.state.deaths = (this.A.state.deaths || 0) + 1;
    this.A.sfx.playerDie();
    const p = this.player;
    p.setVelocity(0, 0);
    this.tweens.add({ targets: p, angle: 90, y: p.y + 10, alpha: 0.2, duration: 650, ease: 'Quad.easeIn', onComplete: () => this.resetStage() });
  }

  // 体力 0 → ステージの最初から。取ったものはそのまま（戻らない）。敵は元に戻る
  resetStage() {
    const p = this.player;
    p.setAngle(0).setAlpha(1).clearTint();
    p.setPosition(this.startX, this.startY);
    p.setVelocity(0, 0);
    this.hp = 3; this.dead = false; this.invUntil = this.time.now + 800;
    this.A.state.playerHp = 3;
    this.enemies.clear(true, true);
    this.spawnNativeEnemies();
    this.cameras.main.centerOn(this.startX + 120, this.A.LAYOUT.topH / 2);
    this.A.bus.emit('playerHp', 3);
    this.A.bus.emit('playerReset');
  }

  onGoal() {
    const S = this.A.state;
    if (S.goalReached || S.phase !== 'playing' || this.dead) return;
    S.goalReached = true;
    this.player.setVelocity(0, 0);
    this.player.setTexture('hero0');
    this.sparkle(this.flag.x, this.flag.y - 50, 0xffd23f, 14);
    this.A.sfx.pickup();
    this.A.bus.emit('goal');
    this.tweens.add({ targets: this.player, y: this.player.y - 18, duration: 260, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
  }

  // ---- 下から上がってくる敵 ----
  // 自分の少し前の、立てる場所を選ぶ
  pickRiseSpot() {
    const px = this.player.x;
    const prow = Math.floor(this.player.y / 32);
    const c0 = Math.floor((px + 250) / 32), c1 = Math.floor((px + 330) / 32);
    let best = null;
    for (let c = c0; c <= c1 && c < this.st.width - 2; c++) {
      for (let r = 1; r < this.st.rows; r++) {
        const v = this.st.grid[r][c], above = this.st.grid[r - 1][c];
        if (v !== -1 && v !== 2 && above === -1) {
          const d = Math.abs((r - 1) - prow) + (r - 1 < prow ? 1.5 : 0);
          if (!best || d < best.d) best = { c, r: r - 1, d };
        }
      }
    }
    if (!best) best = { c: Math.min(c0, this.st.width - 3), r: this.st.ground - 1 };
    return { x: best.c * 32 + 16, y: best.r * 32 + 14 };
  }

  onRiseLanded(data) {
    if (this.A.state.phase !== 'playing' || this.dead) return;
    const e = this.spawnEnemy(data.type, data.x, data.y - 4, { risen: true, dir: -1 });
    this.sparkle(data.x, data.y + 10, 0xffffff, 10);
    this.A.sfx.rise();
    e.setScale(1.6);
    this.tweens.add({ targets: e, scaleX: 1, scaleY: 1, duration: 250, ease: 'Back.easeOut' });
  }

  getPlayerScreenPos() {
    const cam = this.cameras.main;
    return { x: this.player.x - cam.scrollX, y: this.player.y - cam.scrollY };
  }

  sparkle(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'px').setTint(color).setDepth(9).setScale(0.6 + Math.random() * 0.6);
      const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 30;
      this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 300 + Math.random() * 200, onComplete: () => s.destroy() });
    }
  }

  update(time, delta) {
    const A = this.A, S = A.state;
    const active = S.phase === 'playing' && !A.frozen(time) && !this.dead && !S.goalReached;
    if (!active) {
      if (!this.physics.world.isPaused) this.physics.world.pause();
      return;
    }
    if (this.physics.world.isPaused) this.physics.world.resume();
    const dt = Math.min(delta, 50) / 1000;
    const k = this.keys, inp = A.input;
    const left = k.left.isDown || k.a.isDown || inp.left;
    const right = k.right.isDown || k.d.isDown || inp.right;
    const jumpHeld = k.space.isDown || k.up.isDown || k.w.isDown || inp.jump;
    const jumpPressed = (jumpHeld && !this.prevJump) || inp.jumpPress;
    inp.jumpPress = false;
    this.prevJump = jumpHeld;

    const p = this.player, b = p.body;
    const SPEED = 170;
    if (left && !right) { p.setVelocityX(-SPEED); this.facing = -1; }
    else if (right && !left) { p.setVelocityX(SPEED); this.facing = 1; }
    else p.setVelocityX(0);
    p.setFlipX(this.facing < 0);

    const grounded = b.blocked.down;
    if (grounded) this.coyote = 0.08; else this.coyote -= dt;
    if (jumpPressed) this.jumpBuf = 0.1; else this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      p.setVelocityY(-600);
      this.coyote = 0; this.jumpBuf = 0;
      A.sfx.jump();
      p.setScale(0.8, 1.2);
      this.tweens.add({ targets: p, scaleX: 1, scaleY: 1, duration: 160, ease: 'Quad.easeOut' });
    }
    if (!jumpHeld && b.velocity.y < -220) p.setVelocityY(-220); // 短く押すと低く跳ぶ

    if (grounded && !this.wasGrounded) {
      p.setScale(1.2, 0.85);
      this.tweens.add({ targets: p, scaleX: 1, scaleY: 1, duration: 120, ease: 'Quad.easeOut' });
    }
    this.wasGrounded = grounded;

    if (!grounded) p.setTexture('hero_jump');
    else if (Math.abs(b.velocity.x) > 10) { this.walkT += dt; p.setTexture(Math.floor(this.walkT * 9) % 2 ? 'hero1' : 'hero0'); }
    else p.setTexture('hero0');

    p.setAlpha(time < this.invUntil ? (Math.floor(time / 80) % 2 ? 0.35 : 1) : 1);

    this.enemies.children.iterate(e => { this.updateEnemy(e, time, dt); });
  }
}
