// 数値の組み合わせをまとめて回す（調整用）。
// 使い方: node bot/sweep.js [回数] [grid.json]
// grid.json: { "base": ["a=1", ...], "dims": [ { "name": "boss", "options": [ { "label": "220/20", "sets": ["enemies.boss.hp=220", "enemies.boss.atk=20"] } ] } ] }
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const N = process.argv[2] || '200';
const gridPath = process.argv[3];
let grid;
if (gridPath) grid = JSON.parse(fs.readFileSync(gridPath, 'utf8'));
else {
  grid = {
    base: ['enemies.tough.hp=50', 'enemies.tough.atk=8'],
    dims: [
      { name: 'life', options: [25, 35, 40].map(v => ({ label: '25/' + v, sets: ['partLife=25', 'fusedLife=' + v] })) },
      { name: 'boss', options: [[280, 24], [220, 20], [180, 18]].map(([h, a]) => ({ label: h + '/' + a, sets: ['enemies.boss.hp=' + h, 'enemies.boss.atk=' + a] })) },
    ],
  };
}
const combos = [];
(function rec(i, label, sets) {
  if (i === grid.dims.length) { combos.push({ label, sets }); return; }
  const d = grid.dims[i];
  for (const o of d.options) rec(i + 1, label + (label ? ' ' : '') + d.name + '=' + o.label, sets.concat(o.sets));
})(0, '', grid.base || []);

console.log('runs=' + N + ' base: ' + (grid.base || []).join(' '));
console.log('combo'.padEnd(48) + ' none  immed  fusOnly pairs  panic | reach(imm/fus) sends(imm/fus/panic) fusions(fus/panic)');
for (const c of combos) {
  const args = [path.join(__dirname, 'run.js'), N, '--json'];
  for (const s of c.sets) args.push('--set', s);
  const out = execFileSync('node', args, { encoding: 'utf8' });
  const json = JSON.parse(out.slice(out.indexOf('[')));
  const by = {}; json.forEach(s => { by[s.name] = s; });
  const p = v => (v * 100).toFixed(0).padStart(4) + '%';
  console.log(
    c.label.padEnd(48) + ' ' + p(by.none.winRate) + ' ' + p(by.immediate.winRate) + '  ' + p(by.fusionOnly.winRate) + '  ' + p(by.pairs.winRate) + ' ' + p(by.fusionOrPanic.winRate) +
    ' | ' + p(by.immediate.reachedBossRate) + '/' + p(by.fusionOnly.reachedBossRate) +
    ' ' + by.immediate.avgSends.toFixed(1) + '/' + by.fusionOnly.avgSends.toFixed(1) + '/' + by.fusionOrPanic.avgSends.toFixed(1) +
    '  ' + by.fusionOnly.avgFusions.toFixed(1) + '/' + by.fusionOrPanic.avgFusions.toFixed(1)
  );
}
