// 下の画面（相棒の戦い）のルール。Phaser に依存しない。
// ブラウザでは window.AibouSim、Node では module.exports として使える。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AibouSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const ITEMS = ['horn', 'wing', 'stone', 'flower'];

  // 合体の組み合わせ（名前は並べ替えて結合）
  const FUSIONS = {
    'horn+wing': 'thunder',   // 雷の角
    'flower+stone': 'moss',   // 光る苔
    'horn+stone': 'iron',     // 鉄の角
    'flower+wing': 'petal',   // 花びらの羽
  };
  function fusionOf(a, b) {
    if (!a || !b) return null;
    return FUSIONS[[a, b].sort().join('+')] || null;
  }

  const CONFIG = {
    partner: { hp: 150, atk: 16, atkInterval: 0.8, dodge: 0, regen: 0, speed: 60, reach: 40 },
    maxParts: 3,
    partLife: 25,      // 部品がついてから落ちるまでの秒数（単品）
    fusedLife: 35,     // 合体した部品は 2 つ分なので少し長持ち
    minDmgMul: 0.35,   // どれだけ硬くても、受けるダメージは 35% までしか減らない
    dodgeCap: 0.55,
    firstStrike: 0.6,  // 敵が相棒に届いてから一発目までの秒数
    bossTime: 140,
    spawnX: 520,
    mobHpMul: 1,       // ボス以外の敵の体力の倍率
    mobAtkMul: 0.8,    // ボス以外の敵の攻撃の倍率（部品が外れるようになった分、少し弱く）
    fusionBurst: { damage: 20, knockback: 90, stun: 0.8, range: 340 },
    enemies: {
      slime: { hp: 30, atk: 6, atkInterval: 1.0, speed: 40, passTime: 3.0 },
      bat:   { hp: 18, atk: 4, atkInterval: 0.7, speed: 80, passTime: 2.0 },
      tough: { hp: 50, atk: 8, atkInterval: 1.3, speed: 30, passTime: 4.5 },
      boss:  { hp: 220, atk: 20, atkInterval: 1.2, speed: 25, passTime: Infinity },
    },
  };

  // 部品の効果（guard = 受けるダメージを減らす割合）
  const PART_EFFECTS = {
    horn:    { atk: 12 },
    wing:    { atkIntervalMul: 0.75, dodge: 0.25, speedMul: 1.4 },
    stone:   { guard: 0.3 },
    flower:  { regen: 1.0 },
    thunder: { atk: 8, atkIntervalMul: 0.85, chain: { radius: 140, ratio: 0.5 } },
    moss:    { guard: 0.35, regen: 0.9 },
    iron:    { atk: 10, guard: 0.3, atkIntervalMul: 1.3, speedMul: 0.7 },
    petal:   { atkIntervalMul: 0.7, dodge: 0.25, speedMul: 1.5, regen: 0.5 },
  };
  const FUSED = { thunder: true, moss: true, iron: true, petal: true };

  function makeWaves() {
    const w = [];
    const add = (t, type) => w.push({ t, type });
    // 前半：1〜2体ずつ。何も送らないと、ここでもう体力が減っていく
    add(3, 'slime'); add(9, 'bat'); add(14, 'slime'); add(16, 'bat'); add(22, 'slime'); add(24, 'slime');
    add(30, 'bat'); add(32, 'bat'); add(38, 'slime'); add(40, 'tough');
    // 中盤：かたい敵がまざる
    add(47, 'tough'); add(49, 'bat'); add(55, 'slime'); add(56, 'slime'); add(57, 'bat');
    add(63, 'tough'); add(65, 'bat'); add(71, 'slime'); add(72, 'slime'); add(73, 'slime');
    add(79, 'tough'); add(81, 'tough');
    // 後半：重い
    add(88, 'bat'); add(89, 'bat'); add(90, 'bat'); add(91, 'slime');
    add(97, 'tough'); add(99, 'slime'); add(100, 'slime');
    add(106, 'tough'); add(107, 'tough'); add(108, 'bat');
    add(114, 'slime'); add(115, 'slime'); add(116, 'slime'); add(117, 'bat');
    add(122, 'tough'); add(123, 'tough'); add(124, 'bat'); add(125, 'bat');
    add(130, 'tough'); add(131, 'slime'); add(132, 'slime'); add(133, 'tough');
    add(136, 'bat'); add(137, 'bat');
    return w;
  }

  class Battle {
    constructor(opts) {
      opts = opts || {};
      this.cfg = opts.config || CONFIG;
      this.rng = createRng(opts.seed || 12345);
      this.waves = opts.waves || makeWaves();
      this.time = 0;
      this.state = 'running'; // running | win | lose
      this.partner = { hp: this.cfg.partner.hp, maxHp: this.cfg.partner.hp, parts: [], atkTimer: 0.3 };
      this.enemies = [];
      this.spawnIdx = 0;
      this.bossSpawned = false;
      this.walking = true;
      this.events = [];
      this.nextId = 1;
      this.partSeq = 1;
      this.fusionCount = 0;
      this.sendCount = 0;
      this.passCount = 0;
      this.killCount = 0;
      this.regenAcc = 0;
    }

    emit(type, data) { this.events.push(Object.assign({ type, t: this.time }, data || {})); }
    drainEvents() { const e = this.events; this.events = []; return e; }

    stats() {
      const b = this.cfg.partner;
      let atk = b.atk, interval = b.atkInterval, dmgMul = 1, dodge = b.dodge, regen = b.regen, speed = b.speed;
      let chain = null;
      for (const p of this.partner.parts) {
        const ef = PART_EFFECTS[p.kind];
        if (!ef) continue;
        atk += ef.atk || 0; dodge += ef.dodge || 0; regen += ef.regen || 0;
        if (ef.guard) dmgMul *= (1 - ef.guard);
        if (ef.atkIntervalMul) interval *= ef.atkIntervalMul;
        if (ef.speedMul) speed *= ef.speedMul;
        if (ef.chain) chain = chain ? { radius: Math.max(chain.radius, ef.chain.radius), ratio: Math.min(1, chain.ratio + ef.chain.ratio) } : Object.assign({}, ef.chain);
      }
      dodge = Math.min(dodge, this.cfg.dodgeCap || 0.55);
      dmgMul = Math.max(dmgMul, this.cfg.minDmgMul || 0.35);
      interval = Math.max(interval, 0.25);
      // guard = 受けるダメージを減らす割合（0〜0.65）
      return { atk, atkInterval: interval, guard: 1 - dmgMul, dmgMul, dodge, regen, speed, chain, reach: b.reach };
    }

    // 上から送られてきたものを受け取る
    send(items) {
      if (this.state !== 'running' || !items || items.length === 0) return null;
      this.sendCount++;
      const fusion = items.length === 2 ? fusionOf(items[0], items[1]) : null;
      if (fusion) {
        this.addPart(fusion, true);
        this.fusionCount++;
        this.emit('fusion', { kind: fusion, from: items.slice() });
        this.fusionBurst();
        return fusion;
      }
      for (const it of items) this.addPart(it, false);
      return null;
    }

    addPart(kind, fused) {
      const life = fused ? this.cfg.fusedLife : this.cfg.partLife;
      const part = { id: this.partSeq++, kind, fused: !!fused, life, maxLife: life };
      this.partner.parts.push(part);
      this.emit('partAttached', { part });
      if (this.partner.parts.length > this.cfg.maxParts) {
        const dropped = this.partner.parts.shift();
        this.emit('partDropped', { part: dropped });
      }
    }

    fusionBurst() {
      const fb = this.cfg.fusionBurst;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if ((e.state === 'approach' || e.state === 'contact') && e.x < fb.range) {
          this.hit(e, fb.damage, 'burst');
          if (e.dead) continue;
          e.x += fb.knockback;
          e.stun = fb.stun;
          if (e.state === 'contact') { e.state = 'approach'; e.contactTime *= 0.5; }
        }
      }
    }

    spawn(type) {
      const d = this.cfg.enemies[type];
      const boss = type === 'boss';
      const hp = Math.round(d.hp * (boss ? 1 : (this.cfg.mobHpMul || 1)));
      const atk = Math.round(d.atk * (boss ? 1 : (this.cfg.mobAtkMul || 1)));
      const e = {
        id: this.nextId++, type, x: this.cfg.spawnX, hp, maxHp: hp,
        atk, atkInterval: d.atkInterval, speed: d.speed, passTime: d.passTime,
        atkTimer: this.cfg.firstStrike != null ? this.cfg.firstStrike : d.atkInterval * 0.6,
        contactTime: 0, state: 'approach', stun: 0, passT: 0, dead: false,
      };
      this.enemies.push(e);
      this.emit('spawn', { enemy: e });
      return e;
    }

    hit(e, dmg, kind) {
      if (e.dead) return;
      e.hp -= dmg;
      this.emit('enemyHit', { enemy: e, dmg, kind: kind || 'normal' });
      if (e.hp <= 0) {
        e.dead = true;
        this.killCount++;
        this.emit('enemyKilled', { enemy: e });
        if (e.type === 'boss') { this.state = 'win'; this.emit('win'); }
      }
    }

    step(dt) {
      if (this.state !== 'running') return;
      this.time += dt;
      const cfg = this.cfg;
      while (this.spawnIdx < this.waves.length && this.waves[this.spawnIdx].t <= this.time) {
        this.spawn(this.waves[this.spawnIdx++].type);
      }
      if (!this.bossSpawned && this.time >= cfg.bossTime) {
        this.bossSpawned = true;
        const b = this.spawn('boss');
        this.emit('bossAppear', { enemy: b });
      }
      const st = this.stats();
      const p = this.partner;

      let anyContact = false;
      for (const e of this.enemies) {
        if (!e.dead && (e.state === 'approach' || e.state === 'contact') && e.x <= st.reach + 6) anyContact = true;
      }
      this.walking = !anyContact;
      const scroll = this.walking ? st.speed : 0;

      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.stun > 0) { e.stun -= dt; if (e.state === 'contact') continue; }
        if (e.state === 'approach') {
          e.x -= (e.speed + scroll) * dt;
          if (e.x <= st.reach) { e.x = st.reach; e.state = 'contact'; }
        } else if (e.state === 'contact') {
          e.contactTime += dt;
          e.atkTimer -= dt;
          if (e.atkTimer <= 0) {
            e.atkTimer = e.atkInterval;
            if (this.rng() < st.dodge) {
              this.emit('dodge', { enemy: e });
            } else {
              const dmg = Math.max(1, Math.round(e.atk * st.dmgMul));
              p.hp -= dmg;
              this.emit('partnerHit', { enemy: e, dmg, blocked: e.atk - dmg });
              if (p.hp <= 0) { p.hp = 0; this.state = 'lose'; this.emit('lose'); return; }
            }
          }
          if (e.contactTime >= e.passTime) {
            e.state = 'passing'; e.passT = 0; this.passCount++;
            this.emit('pass', { enemy: e });
          }
        } else if (e.state === 'passing') {
          e.passT += dt;
          const k = Math.min(1, e.passT / 0.5);
          e.x = st.reach + (-80 - st.reach) * k;
          if (k >= 1) { e.state = 'fleeing'; this.emit('passed', { enemy: e }); }
        } else if (e.state === 'fleeing') {
          e.x -= (e.speed + 80 + scroll) * dt;
          if (e.x < -260) { e.dead = true; e.escaped = true; this.emit('escaped', { enemy: e }); }
        }
      }

      // 相棒の攻撃
      if (!this.walking) {
        p.atkTimer -= dt;
        if (p.atkTimer <= 0) {
          p.atkTimer = st.atkInterval;
          let target = null;
          for (const e of this.enemies) {
            if (e.dead || e.state !== 'contact') continue;
            if (!target || e.x < target.x) target = e;
          }
          if (!target) {
            for (const e of this.enemies) {
              if (e.dead || e.state !== 'approach' || e.x > st.reach + 6) continue;
              if (!target || e.x < target.x) target = e;
            }
          }
          if (target) {
            const chained = [];
            this.emit('partnerAttack', { target, chain: !!st.chain });
            this.hit(target, st.atk);
            if (st.chain) {
              for (const o of this.enemies) {
                if (o.dead || o === target) continue;
                if (o.state !== 'approach' && o.state !== 'contact') continue;
                if (Math.abs(o.x - target.x) <= st.chain.radius) {
                  chained.push(o);
                  this.hit(o, Math.round(st.atk * st.chain.ratio), 'chain');
                }
              }
              if (chained.length) this.emit('chainHit', { from: target, targets: chained });
            }
          }
        }
      } else {
        p.atkTimer = Math.min(p.atkTimer, 0.25);
      }

      // 部品は時間で小さくなって落ちる
      if (p.parts.length) {
        const keep = [];
        for (const part of p.parts) {
          part.life -= dt;
          if (part.life <= 0) { this.expiredCount = (this.expiredCount || 0) + 1; this.emit('partExpired', { part }); }
          else keep.push(part);
        }
        p.parts = keep;
      }

      if (st.regen > 0 && p.hp < p.maxHp) {
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + st.regen * dt);
        this.regenAcc += (p.hp - before);
        if (this.regenAcc >= 4) { this.regenAcc = 0; this.emit('regenTick'); }
      }

      this.enemies = this.enemies.filter(e => !e.dead);
    }

    isDone() { return this.state !== 'running'; }
  }

  return { Battle, CONFIG, PART_EFFECTS, FUSIONS, FUSED, ITEMS, fusionOf, makeWaves, createRng };
});
