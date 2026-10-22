// ドット絵をコードで作る。文字の並びが絵になる（1文字 = 2px）。
(function (root) {
  'use strict';

  const PAL = {
    '.': null,
    k: 0x1b1b2f, w: 0xfafafa, x: 0xff5050,
    y: 0xffd23f, Y: 0xd1951a,            // 角（黄）
    c: 0xcdf3ff, C: 0x5ad1ff,            // 羽（水色）
    s: 0x9aa5b1, S: 0x5e6873,            // 石（灰）
    n: 0xff7eb6, N: 0xd6418b,            // 花（桃）
    g: 0x6fe06f, G: 0x2f9a45,            // スライム・苔
    p: 0xb06cf5, P: 0x6b2fb3,            // コウモリ
    r: 0xf05a4a, R: 0xa8271d,            // かたい敵・ボス
    o: 0xffa63f, O: 0xd4722a,            // 相棒
    b: 0x3f7fe8, B: 0x27508f, f: 0xffd9b3, h: 0x6b3e1e, // 自分
    t: 0x2d3561, T: 0x5a66b0,            // 上の画面の敵（とげ）
    i: 0x3c4452, I: 0x8792a3,            // 鉄
    l: 0xeaf6ff, m: 0xb6ff7a, e: 0x7cf7ff,
    d: 0x8a5a33, D: 0x5c3b20, L: 0x7ad457, M: 0x3d9a3a, q: 0xb07a3e,
  };

  function sprite(scene, key, rows, scale) {
    scale = scale || 2;
    const w = Math.max.apply(null, rows.map(r => r.length));
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = PAL[row[x]];
        if (c == null) continue;
        g.fillStyle(c, 1);
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    g.generateTexture(key, w * scale, rows.length * scale);
    g.destroy();
  }

  const HERO_HEAD = [
    '....hhhh....',
    '...hhhhhh...',
    '...hffffh...',
    '...hfkfkf...',
    '....ffff....',
    '...bbbbbb...',
    '..bbbbbbbb..',
    '..fbbbbbbf..',
    '...bbbbbb...',
  ];
  const HERO0 = HERO_HEAD.concat([
    '...BBBBBB...',
    '...BB..BB...',
    '...BB..BB...',
    '...kk..kk...',
    '...kk..kk...',
    '..kkk..kkk..',
  ]);
  const HERO1 = HERO_HEAD.concat([
    '...BBBBBB...',
    '..BB....BB..',
    '..BB....BB..',
    '..kk....kk..',
    '.kk......kk.',
    '.kk......kk.',
  ]);
  const HERO_JUMP = HERO_HEAD.concat([
    '...BBBBBB...',
    '..BB....BB..',
    '..kk....kk..',
    '..kk....kk..',
    '............',
    '............',
  ]);

  const PARTNER_TOP = [
    '......oooooooo......',
    '....oooooooooooo....',
    '...oooooooooooooo...',
    '..oooooooooooooooo..',
    '..oooooooooowwwwoo..',
    '.ooooooooooowkkwwoo.',
    '.ooooooooooowkkwwoo.',
    '.oooooooooooowwwooo.',
    '.oooooooooooooooooo.',
    '.oooooooooooooooooo.',
    '..ooooooooooooOOoo..',
    '..oooooooooooooooo..',
    '...oooooooooooooo...',
  ];
  const PARTNER0 = PARTNER_TOP.concat([
    '....OOOOOOOOOOOO....',
    '.....OOO....OOO.....',
    '.....OOO....OOO.....',
    '.....kkk....kkk.....',
    '....................',
  ]);
  const PARTNER1 = PARTNER_TOP.concat([
    '....OOOOOOOOOOOO....',
    '....OOO......OOO....',
    '...OOO........OOO...',
    '...kkk........kkk...',
    '....................',
  ]);

  const ITEM_HORN = [
    '.........kk.',
    '........kyyk',
    '.......kyyyk',
    '......kyyyk.',
    '.....kyyyk..',
    '....kyyyk...',
    '...kyyyyk...',
    '..kyyyYYk...',
    '..kyYYYYk...',
    '..kYYYYk....',
    '..kYYYk.....',
    '...kkk......',
  ];
  const ITEM_WING = [
    '..........k.',
    '........kkck',
    '......kkcccc',
    '.....kcccwck',
    '....kcccwcck',
    '...kccwccccC',
    '..kcccwccCk.',
    '..kccwccCk..',
    '..kccccCk...',
    '..kcccCk....',
    '...kkkk.....',
    '............',
  ];
  const ITEM_STONE = [
    '............',
    '....kkkk....',
    '...kssssk...',
    '..ksswssskk.',
    '.kssswsssssk',
    '.ksssssSSSsk',
    '.kssssSSSSSk',
    '.ksSSSSSSSSk',
    '..kSSSSSSSk.',
    '..kSSSSSSk..',
    '...kkkkkk...',
    '............',
  ];
  const ITEM_FLOWER = [
    '....nnnn....',
    '...nnNNnn...',
    '...nnNNnn...',
    '.nn..NN..nn.',
    'nnNNNyyNNNnn',
    'nnNNyyyyNNnn',
    'nnNNyyyyNNnn',
    'nnNNNyyNNNnn',
    '.nn..NN..nn.',
    '...nnNNnn...',
    '...nnNNnn...',
    '....nnnn....',
  ];

  const WALKER0 = [
    '...w..w..w...',
    '..wt..t..tw..',
    '..tttttttt...',
    '.tttttttttt..',
    'wtttxxttxxttw',
    '.tttxxttxxtt.',
    '.tttttttttt..',
    'wtttttttttttw',
    '.tttttttttt..',
    '..tttttttt...',
    '...tt..tt....',
    '...kk..kk....',
  ];
  const WALKER1 = WALKER0.slice(0, 10).concat([
    '..tt....tt...',
    '..kk....kk...',
  ]);
  const DRIFTER = [
    '....tttt....',
    '..tttttttt..',
    '.tttttttttt.',
    '.tttwwwwttt.',
    'tttwwxxwwttt',
    'tttwwxxwwttt',
    '.tttwwwwttt.',
    '.tttttttttt.',
    '..tttttttt..',
    '...tt..tt...',
    '..t......t..',
    '............',
  ];

  const SLIME = [
    '.....gggg.....',
    '...gggggggg...',
    '..gggggggggg..',
    '.ggwwggggggwwg',
    '.gwkkwggggwkkw',
    'gggggggggggggg',
    'gggggggggggggg',
    'ggggggGGgggggg',
    'gGgggggggggGgg',
    '.gGGGGGGGGGGg.',
    '..GGGGGGGGGG..',
  ];
  const BAT0 = [
    'pp..........pp',
    'ppp...pp...ppp',
    'pppp.pppp.pppp',
    'pppppppppppppp',
    '.ppppwkppkwpp.',
    '..pppppppppp..',
    '...pPPPPPPp...',
    '....pp..pp....',
    '....k....k....',
    '..............',
  ];
  const BAT1 = [
    '..............',
    '......pp......',
    '.....pppp.....',
    '..pppppppppp..',
    'ppppppwkppkwpp',
    'pppppppppppppp',
    'pp.pPPPPPPp.pp',
    'p....pp..pp..p',
    '.....k....k...',
    '..............',
  ];
  const TOUGH = [
    '....RRRRRRR....',
    '...RRRRRRRRR...',
    '..RRrrrrrrrRR..',
    '..RrrrrrrrrrR..',
    '..RrrkkkkkrrR..',
    '..RrrkwkwkrrR..',
    '..RrrkkkkkrrR..',
    '..RrrrrrrrrrR..',
    '.RRrrrrrrrrrRR.',
    '.RRrrrRRRrrrRR.',
    '.RRrrrrrrrrrRR.',
    '..RRrrrrrrrRR..',
    '...RRRRRRRRR...',
    '...RR.....RR...',
    '...kk.....kk...',
  ];
  const BOSS = [
    '..kk..................kk',
    '.kyyk................kyyk',
    '.kyyyk..............kyyyk',
    '..kyyykRRRRRRRRRRRRkyyyk.',
    '...kyRRRRRRRRRRRRRRRRyk..',
    '....RRRRRRRRRRRRRRRRRR...',
    '...RRRrrrrrrrrrrrrrrRRR..',
    '..RRrrrrrrrrrrrrrrrrrrRR.',
    '..RRrrwwwwrrrrrrwwwwrrRR.',
    '..RRrrwxxwrrrrrrwxxwrrRR.',
    '..RRrrwxxwrrrrrrwxxwrrRR.',
    '..RRrrrwwrrrrrrrrwwrrrRR.',
    '..RRrrrrrrrrrrrrrrrrrrRR.',
    '..RRrrrkkkkkkkkkkkkrrrRR.',
    '..RRrrrkwkwkwkwkwkkrrrRR.',
    '..RRrrrkkkkkkkkkkkkrrrRR.',
    '..RRrrrrrrrrrrrrrrrrrrRR.',
    '...RRrrrrrrrrrrrrrrrrRR..',
    '....RRRrrrrrrrrrrrrRRR...',
    '.....RRRRRRRRRRRRRRRR....',
    '......RRRR......RRRR.....',
    '......RRRR......RRRR.....',
    '......kkkk......kkkk.....',
  ];

  // 相棒につく部品
  const P_HORN = [
    '......kk',
    '.....kyyk',
    '....kyyyk',
    '...kyyyk.',
    '..kyyyk..',
    '.kyyyyk..',
    '.kyYYYk..',
    '.kYYYk...',
    '..kkk....',
  ];
  const P_THUNDER = [
    '.......kll',
    '......klll',
    '.....klle.',
    '....klle..',
    '...kllee..',
    '....kee...',
    '...keee...',
    '..keeee...',
    '.keeeek...',
    '.keeek....',
    '..kkk.....',
  ];
  const P_IRON = [
    '........kii',
    '.......kiII',
    '......kiIIi',
    '.....kiIIi.',
    '....kiIIi..',
    '...kiIIi...',
    '..kiiIIi...',
    '.kiiIIIi...',
    '.kiIIIIi...',
    '.kiIIIi....',
    '..kkkk.....',
  ];
  const P_WING0 = [
    '..........k.',
    '........kkck',
    '......kkcccc',
    '....kkccwcck',
    '..kkcccwcck.',
    '.kcccwccck..',
    '.kcccccck...',
    '..kkkkkk....',
  ];
  const P_WING1 = [
    '............',
    '............',
    '............',
    '.kkkkkkk....',
    '.kcccccckk..',
    '..kccwccccck',
    '...kkccwcccC',
    '.....kkkkkk.',
  ];
  const P_PETAL0 = [
    '..........n.',
    '........nnNn',
    '......nnnnnn',
    '....nnnnwnnN',
    '..nnnnnwnnN.',
    '.nnnnwnnnN..',
    '.nnnnnnnN...',
    '..NNNNNN....',
  ];
  const P_PETAL1 = [
    '............',
    '............',
    '............',
    '.NNNNNNN....',
    '.nnnnnnnNN..',
    '..nnnwnnnnnN',
    '...NNnnwnnnn',
    '.....NNNNNN.',
  ];
  const P_FLOWER = [
    '...nn...',
    '..nNNn..',
    '.n.NN.n.',
    'nNNyyNNn',
    'nNNyyNNn',
    '.n.NN.n.',
    '..nNNn..',
    '...nn...',
  ];
  const P_STONE = [
    '......ssSS......ssS...',
    '....ssSSSS....ssSSSs..',
    '...sSSSSS.....sSSSSS..',
    '......................',
    '.sSS......ssSS........',
    '.sSSS....ssSSSs...sSS.',
    '..SSS....sSSSSs..sSSSs',
    '..................SSS.',
  ];
  const P_MOSS = [
    '......mgGG......mgG...',
    '....mgGGGG....mgGGGg..',
    '...gGGGGG.....gGGGGG..',
    '......................',
    '.mgG......mgGG........',
    '.mgGG....mgGGGg...mgG.',
    '..GGG....gGGGGg..gGGGg',
    '..................GGG.',
  ];

  const HEART = [
    '.rr...rr.',
    'rrrr.rrrr',
    'rrrrrrrrr',
    'rrrrrrrrr',
    '.rrrrrrr.',
    '..rrrrr..',
    '...rrr...',
    '....r....',
  ];
  const HEART_EMPTY = HEART.map(r => r.replace(/r/g, 'S'));
  const MINI_PARTNER = [
    '..oooo..',
    '.oooooo.',
    'oooowwoo',
    'oooowkoo',
    'oooooooo',
    '.oooooo.',
    '.OO..OO.',
  ];
  const MINI_BOSS = [
    'k......k',
    'kyRRRRyk',
    '.RRRRRR.',
    '.RwRRwR.',
    '.RRRRRR.',
    '.RkkkkR.',
    '..RRRR..',
  ];
  const MINI_RISE = [
    '....gg....',
    '...gggg...',
    '..gggggg..',
    '.ggwggwgg.',
    '.ggggggggg',
    '....ww....',
    '...wwww...',
    '..ww..ww..',
    '.ww....ww.',
  ];

  function tiles(scene) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    const T = 32;
    // 0: 土
    g.fillStyle(PAL.d, 1); g.fillRect(0, 0, T, T);
    g.fillStyle(PAL.D, 1);
    [[4, 6], [18, 10], [10, 20], [24, 24], [2, 26]].forEach(([x, y]) => g.fillRect(x, y, 6, 4));
    // 1: 草（地面の上）
    g.fillStyle(PAL.d, 1); g.fillRect(T, 0, T, T);
    g.fillStyle(PAL.M, 1); g.fillRect(T, 0, T, 10);
    g.fillStyle(PAL.L, 1); g.fillRect(T, 0, T, 6);
    g.fillStyle(PAL.L, 1); g.fillRect(T + 6, 6, 4, 4); g.fillRect(T + 18, 6, 4, 4);
    g.fillStyle(PAL.D, 1); g.fillRect(T + 8, 20, 6, 4); g.fillRect(T + 22, 14, 6, 4);
    // 2: 板（下から飛び乗れる）
    g.fillStyle(PAL.q, 1); g.fillRect(2 * T, 2, T, 12);
    g.fillStyle(PAL.d, 1); g.fillRect(2 * T, 8, T, 6);
    g.fillStyle(PAL.k, 1); g.fillRect(2 * T, 14, T, 2);
    g.fillStyle(PAL.k, 1); g.fillRect(2 * T + 6, 4, 2, 2); g.fillRect(2 * T + 24, 4, 2, 2);
    // 3: 岩（壁・天井）
    g.fillStyle(PAL.S, 1); g.fillRect(3 * T, 0, T, T);
    g.fillStyle(PAL.s, 1); g.fillRect(3 * T + 2, 2, 12, 10); g.fillRect(3 * T + 18, 16, 12, 12);
    g.fillStyle(PAL.k, 1); g.fillRect(3 * T, 0, T, 2); g.fillRect(3 * T, 0, 2, T);
    g.fillStyle(0x4a525c, 1); g.fillRect(3 * T + 16, 2, 14, 12); g.fillRect(3 * T + 2, 16, 14, 14);
    g.generateTexture('tiles', 4 * T, T);
    g.destroy();
  }

  function simple(scene) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    // 白い四角（火花・粒）
    g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 6, 6);
    g.generateTexture('px', 6, 6); g.clear();
    // 丸い光
    g.fillStyle(0xffffff, 1); g.fillCircle(16, 16, 16);
    g.generateTexture('glow', 32, 32); g.clear();
    // 輪
    g.lineStyle(4, 0xffffff, 1); g.strokeCircle(32, 32, 30);
    g.generateTexture('ring', 64, 64); g.clear();
    // ゴールの旗
    g.fillStyle(PAL.k, 1); g.fillRect(2, 0, 4, 64);
    g.fillStyle(PAL.y, 1); g.fillTriangle(6, 2, 34, 12, 6, 24);
    g.fillStyle(PAL.Y, 1); g.fillRect(6, 20, 14, 4);
    g.generateTexture('flag', 36, 64); g.clear();
    // 落ちた花（花びらの羽の跡）
    g.fillStyle(PAL.n, 1); g.fillCircle(5, 5, 5);
    g.fillStyle(PAL.y, 1); g.fillCircle(5, 5, 2);
    g.generateTexture('petal', 10, 10); g.clear();
    g.destroy();
  }

  function generate(scene) {
    tiles(scene); simple(scene);
    sprite(scene, 'hero0', HERO0); sprite(scene, 'hero1', HERO1); sprite(scene, 'hero_jump', HERO_JUMP);
    sprite(scene, 'partner0', PARTNER0); sprite(scene, 'partner1', PARTNER1);
    sprite(scene, 'item_horn', ITEM_HORN); sprite(scene, 'item_wing', ITEM_WING);
    sprite(scene, 'item_stone', ITEM_STONE); sprite(scene, 'item_flower', ITEM_FLOWER);
    sprite(scene, 'walker0', WALKER0); sprite(scene, 'walker1', WALKER1); sprite(scene, 'drifter', DRIFTER);
    sprite(scene, 'slime', SLIME); sprite(scene, 'bat0', BAT0); sprite(scene, 'bat1', BAT1); sprite(scene, 'tough', TOUGH);
    sprite(scene, 'boss', BOSS, 3);
    sprite(scene, 'p_horn', P_HORN); sprite(scene, 'p_thunder', P_THUNDER); sprite(scene, 'p_iron', P_IRON);
    sprite(scene, 'p_wing0', P_WING0); sprite(scene, 'p_wing1', P_WING1);
    sprite(scene, 'p_petal0', P_PETAL0); sprite(scene, 'p_petal1', P_PETAL1);
    sprite(scene, 'p_flower', P_FLOWER); sprite(scene, 'p_stone', P_STONE); sprite(scene, 'p_moss', P_MOSS);
    sprite(scene, 'heart', HEART); sprite(scene, 'heart_empty', HEART_EMPTY);
    sprite(scene, 'mini_partner', MINI_PARTNER); sprite(scene, 'mini_boss', MINI_BOSS); sprite(scene, 'mini_rise', MINI_RISE);
  }

  root.AibouTextures = { generate, PAL };
})(window);
