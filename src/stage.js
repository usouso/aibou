// 上の画面（自分のステージ）の地形と配置。Phaser に依存しない。
// グリッドの値: -1 = 空, 0 = 土, 1 = 草（地面の上）, 2 = 板（下から飛び乗れる）, 3 = 岩（壁・天井）
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AibouStage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TILE = 32;
  const ROWS = 12;
  const GROUND = 10; // 地面の上の段（この段と11段目が土）

  // 拾う順番（左から）。わざと並べてある。
  const ITEM_ORDER = [
    'horn', 'wing', 'stone', 'flower',
    'horn', 'horn', 'wing', 'flower',
    'stone', 'horn', 'flower', 'wing',
    'stone', 'horn', 'wing', 'flower',
    'horn', 'stone', 'flower', 'wing',
    'horn', 'stone', 'wing', 'flower',
  ];

  function buildStage() {
    const grid = [];
    const ents = { items: [], enemies: [], start: null, goal: null };
    let width = 0;

    function ensure(cols) {
      while (width < cols) {
        for (let r = 0; r < ROWS; r++) {
          if (!grid[r]) grid[r] = [];
          grid[r][width] = -1;
        }
        width++;
      }
    }
    function set(c, r, v) { if (r >= 0 && r < ROWS && c >= 0) { ensure(c + 1); grid[r][c] = v; } }
    function ground(c0, c1, top) {
      top = top == null ? GROUND : top;
      for (let c = c0; c <= c1; c++) {
        for (let r = top; r < ROWS; r++) set(c, r, r === top ? 1 : 0);
      }
    }
    function rock(c, r, w, h) {
      for (let x = c; x < c + w; x++) for (let y = r; y < r + h; y++) set(x, y, 3);
    }
    function plank(c, r, w) { for (let x = c; x < c + w; x++) set(x, r, 2); }
    function item(c, r) { ents.items.push({ c, r }); }
    function enemy(c, r, type, minC, maxC, extra) {
      ents.enemies.push(Object.assign({ c, r, type, minC, maxC }, extra || {}));
    }

    // ---- セグメント ----
    function segStart(c) {
      const w = 18; ground(c, c + w - 1);
      ents.start = { c: c + 3, r: GROUND - 1 };
      item(c + 11, GROUND - 1);
      return w;
    }
    function segWalker(c) {
      const w = 22; ground(c, c + w - 1);
      plank(c + 8, GROUND - 3, 3);
      item(c + 9, GROUND - 4);
      enemy(c + 13, GROUND - 1, 'walker', c + 6, c + 19);
      return w;
    }
    function segSteps(c) {
      const w = 26; ground(c, c + w - 1);
      enemy(c + 4, GROUND - 1, 'walker', c + 1, c + 7);
      rock(c + 9, GROUND - 2, 4, 2);
      rock(c + 14, GROUND - 4, 4, 4);
      item(c + 15, GROUND - 5);
      enemy(c + 21, GROUND - 1, 'walker', c + 19, c + 25);
      item(c + 24, GROUND - 1);
      return w;
    }
    function segTunnel(c, two) {
      const w = 24; ground(c, c + w - 1);
      rock(c + 6, 0, 13, GROUND - 2); // 天井。通れるのは 2 段ぶん
      enemy(c + 12, GROUND - 1, 'walker', c + 7, c + 17);
      if (two) enemy(c + 16, GROUND - 1, 'walker', c + 8, c + 18, { phase: 1 });
      item(c + 16, GROUND - 1);
      item(c + 22, GROUND - 1);
      return w;
    }
    function segPit(c, hard) {
      const w = 28;
      ground(c, c + 5);
      ground(c + 6, c + 21, GROUND + 1); // 1 段低い
      ground(c + 22, c + w - 1);
      plank(c + 7, GROUND - 2, 2);
      plank(c + 12, GROUND - 2, 2);
      plank(c + 17, GROUND - 2, 2);
      enemy(c + 9, GROUND, 'walker', c + 6, c + 13);
      enemy(c + 16, GROUND, 'walker', c + 13, c + 21);
      if (hard) enemy(c + 12, GROUND - 3, 'walker', c + 12, c + 13);
      item(c + 12, GROUND - 3);
      item(c + 19, GROUND);
      return w;
    }
    function segWall(c) {
      const w = 20; ground(c, c + w - 1);
      rock(c + 8, GROUND - 2, 2, 2);
      item(c + 8, GROUND - 3);
      enemy(c + 13, GROUND - 2, 'drifter', c + 13, c + 13, { minR: GROUND - 4, maxR: GROUND - 1 });
      return w;
    }
    function segDrifters(c) {
      const w = 24; ground(c, c + w - 1);
      enemy(c + 6, GROUND - 2, 'drifter', c + 6, c + 6, { minR: GROUND - 4, maxR: GROUND - 1, phase: 0 });
      enemy(c + 12, GROUND - 3, 'drifter', c + 12, c + 12, { minR: GROUND - 4, maxR: GROUND - 1, phase: 2 });
      enemy(c + 18, GROUND - 2, 'drifter', c + 18, c + 18, { minR: GROUND - 4, maxR: GROUND - 1, phase: 4 });
      item(c + 9, GROUND - 1);
      item(c + 15, GROUND - 1);
      return w;
    }
    function segGauntlet(c, hard) {
      const w = 30; ground(c, c + w - 1);
      plank(c + 8, GROUND - 3, 16);
      enemy(c + 6, GROUND - 1, 'walker', c + 3, c + 10);
      enemy(c + 14, GROUND - 1, 'walker', c + 11, c + 18);
      enemy(c + 22, GROUND - 1, 'walker', c + 19, c + 27);
      enemy(c + 16, GROUND - 4, 'walker', c + 8, c + 23);
      if (hard) enemy(c + 10, GROUND - 4, 'walker', c + 8, c + 23, { phase: 1 });
      item(c + 20, GROUND - 4);
      item(c + 26, GROUND - 1);
      return w;
    }
    function segHill(c) {
      const w = 26; ground(c, c + w - 1);
      ground(c + 8, c + 17, GROUND - 2);
      rock(c + 8, GROUND - 1, 1, 1); rock(c + 17, GROUND - 1, 1, 1);
      enemy(c + 12, GROUND - 3, 'walker', c + 9, c + 16);
      item(c + 13, GROUND - 3);
      enemy(c + 22, GROUND - 1, 'walker', c + 19, c + 25);
      return w;
    }
    function segGoal(c) {
      const w = 16; ground(c, c + w - 1);
      ents.goal = { c: c + 9, r: GROUND - 1 };
      return w;
    }

    let c = 0;
    c += segStart(c);
    c += segWalker(c);
    c += segSteps(c);
    c += segTunnel(c, false);
    c += segPit(c, false);
    c += segWall(c);
    c += segDrifters(c);
    c += segGauntlet(c, false);
    c += segHill(c);
    c += segTunnel(c, true);
    c += segPit(c, true);
    c += segGauntlet(c, true);
    c += segGoal(c);
    ensure(c);

    ents.items.sort((a, b) => a.c - b.c);
    ents.items.forEach((it, i) => {
      it.kind = ITEM_ORDER[i % ITEM_ORDER.length];
      it.x = it.c * TILE + TILE / 2;
      it.y = it.r * TILE + TILE / 2;
    });

    return { grid, width, rows: ROWS, tile: TILE, ground: GROUND, ents, pixelWidth: width * TILE };
  }

  return { buildStage, TILE, ROWS, GROUND, ITEM_ORDER };
});
