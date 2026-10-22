// 下の戦いをボットで自動で回す。
// 使い方: node bot/run.js [回数]
'use strict';
const path = require('path');
const sim = require(path.join(__dirname, '..', 'src', 'sim.js'));
const stage = require(path.join(__dirname, '..', 'src', 'stage.js'));

const N = parseInt(process.argv[2] || '300', 10);
// 調整用: --set partner.atk=12 --set parts.horn.atk=9 --set enemies.tough.hp=60
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] !== '--set') continue;
  const [key, val] = process.argv[i + 1].split('=');
  const parts = key.split('.');
  let obj = parts[0] === 'parts' ? sim.PART_EFFECTS : sim.CONFIG;
  if (parts[0] === 'parts') parts.shift();
  for (let k = 0; k < parts.length - 1; k++) obj = obj[parts[k]];
  obj[parts[parts.length - 1]] = parseFloat(val);
}
const ST = stage.buildStage();
const ITEMS = ST.ents.items.map(it => ({ x: it.x, kind: it.kind }));

// 上の画面をざっくり真似る：進む速さ（px/秒）は 1 回ごとにばらつく。
// 取りそこねる割合も少し入れる。送ったものが届くまで 0.7 秒かかる。
const PLAYER = { speedMin: 55, speedMax: 85, missRate: 0.15, deliverDelay: 0.7 };

const STRATEGIES = {
  // 1. 何も送らない
  none: {
    onPickup() {},
  },
  // 2. 拾ったらすぐ全部送る（合体を狙わない）
  immediate: {
    onPickup(ctx) { ctx.send(); },
  },
  // 3. 2つためて、合体になる組だけ送る
  fusionOnly: {
    onPickup(ctx) {
      const h = ctx.held;
      if (h.length === 2 && sim.fusionOf(h[0], h[1])) ctx.send();
    },
  },
  // 4. 2つたまったら中身を見ずに送る
  pairs: {
    onPickup(ctx) { if (ctx.held.length === 2) ctx.send(); },
  },
  // 5. 合体を狙うが、相棒の部品が落ちそう（残り 4 秒未満）か、体力が 4 割以下なら持っているものをすぐ送る
  fusionOrPanic: {
    onPickup(ctx) {
      const h = ctx.held;
      if (h.length === 2 && sim.fusionOf(h[0], h[1])) ctx.send();
    },
    onTick(ctx) {
      if (ctx.held.length === 0) return;
      const p = ctx.battle.partner;
      const lowHp = p.hp <= p.maxHp * 0.4;
      const expiring = p.parts.some(part => part.life < 4);
      if (lowHp || expiring) ctx.send();
    },
  },
};

function runOnce(strategy, seed) {
  const rng = sim.createRng(seed * 7919 + 17);
  const battle = new sim.Battle({ seed: seed * 104729 + 3 });
  const speed = PLAYER.speedMin + rng() * (PLAYER.speedMax - PLAYER.speedMin);
  const pickups = [];
  for (const it of ITEMS) {
    if (rng() < PLAYER.missRate) continue;
    pickups.push({ t: it.x / speed + (rng() - 0.5) * 2, kind: it.kind });
  }
  pickups.sort((a, b) => a.t - b.t);
  let pi = 0;
  const held = [];
  const pending = []; // 届くのを待っている送りもの
  const ctx = {
    held, battle,
    send() {
      if (held.length === 0) return;
      pending.push({ t: battle.time + PLAYER.deliverDelay, items: held.splice(0, held.length) });
    },
  };
  const dt = 1 / 30;
  let hpAtBoss = null;
  let sends = 0, fusions = 0;
  while (!battle.isDone() && battle.time < 300) {
    while (pi < pickups.length && pickups[pi].t <= battle.time) {
      held.push(pickups[pi].kind);
      if (held.length > 2) held.shift();
      pi++;
      strategy.onPickup(ctx);
    }
    if (strategy.onTick) strategy.onTick(ctx);
    while (pending.length && pending[0].t <= battle.time) {
      const s = pending.shift();
      sends++;
      if (battle.send(s.items)) fusions++;
    }
    battle.step(dt);
    if (hpAtBoss === null && battle.bossSpawned) hpAtBoss = battle.partner.hp;
  }
  const boss = battle.enemies.find(e => e.type === 'boss');
  return {
    win: battle.state === 'win',
    time: battle.time,
    hpLeft: battle.partner.hp,
    hpAtBoss,
    bossHpLeft: battle.state === 'win' ? 0 : (boss ? boss.hp : sim.CONFIG.enemies.boss.hp),
    reachedBoss: battle.bossSpawned,
    sends, fusions, passes: battle.passCount, kills: battle.killCount,
    expired: battle.expiredCount || 0,
    parts: battle.partner.parts.map(p => p.kind),
  };
}

function summarize(name, results) {
  const n = results.length;
  const wins = results.filter(r => r.win).length;
  const reached = results.filter(r => r.reachedBoss).length;
  const avg = (k, filt) => {
    const arr = results.filter(filt || (() => true)).map(r => r[k]).filter(v => v != null);
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
  };
  return {
    name, n, wins, winRate: wins / n,
    reachedBossRate: reached / n,
    avgHpAtBoss: avg('hpAtBoss', r => r.reachedBoss),
    avgBossHpLeftOnLoss: avg('bossHpLeft', r => r.reachedBoss && !r.win),
    avgDeathTime: avg('time', r => !r.win),
    avgSends: avg('sends'), avgFusions: avg('fusions'), avgPasses: avg('passes'), avgKills: avg('kills'),
    avgExpired: avg('expired'),
  };
}

const order = ['none', 'immediate', 'fusionOnly', 'pairs', 'fusionOrPanic'];
const out = [];
for (const name of order) {
  const res = [];
  for (let i = 0; i < N; i++) res.push(runOnce(STRATEGIES[name], i + 1));
  out.push(summarize(name, res));
}
const pct = v => (v * 100).toFixed(1) + '%';
const f1 = v => (isNaN(v) ? '-' : v.toFixed(1));
console.log('runs per strategy: ' + N);
console.log('strategy        win    reachBoss  hp@boss  bossHpLeft(loss)  deathT  sends fusions passes kills expired');
for (const s of out) {
  console.log(
    s.name.padEnd(15) + ' ' + pct(s.winRate).padStart(6) + ' ' + pct(s.reachedBossRate).padStart(9) + '  ' +
    f1(s.avgHpAtBoss).padStart(7) + '  ' + f1(s.avgBossHpLeftOnLoss).padStart(16) + '  ' + f1(s.avgDeathTime).padStart(6) + '  ' +
    f1(s.avgSends).padStart(5) + ' ' + f1(s.avgFusions).padStart(7) + ' ' + f1(s.avgPasses).padStart(6) + ' ' + f1(s.avgKills).padStart(5) + ' ' + f1(s.avgExpired).padStart(7)
  );
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
