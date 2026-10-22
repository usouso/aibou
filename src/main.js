// ゲーム全体の設定と、画面をまたいで共有するもの。
(function () {
  'use strict';
  const W = 540, H = 960;
  // 縦に 4 つの帯：上の画面 / HUD / 下の画面 / ボタン
  const LAYOUT = { topH: 384, hudY: 384, hudH: 80, botY: 464, botH: 320, ctrlY: 784, ctrlH: 176 };

  const A = window.AIBOU = {
    W, H, LAYOUT,
    bus: new Phaser.Events.EventEmitter(),
    sfx: new AibouAudio(),
    options: { riseEnabled: true }, // T キーで切り替え：倒し損ねた敵が上に来る
    input: { left: false, right: false, jump: false },
    state: null,
    runCount: 0,
    newRun() {
      this.runCount++;
      this.state = {
        battle: new AibouSim.Battle({ seed: (Math.random() * 1e9) | 0 }),
        held: [],
        phase: this.runCount === 1 ? 'ready' : 'playing', // ready | playing | result
        freezeUntil: 0,
        result: null,
        playerHp: 3,
        goalReached: false,
        startedAt: 0,
      };
      return this.state;
    },
    frozen(time) { return !!this.state && this.state.freezeUntil > time; },
    freeze(scene, ms) { this.state.freezeUntil = Math.max(this.state.freezeUntil, scene.time.now + ms); },
  };

  class BootScene extends Phaser.Scene {
    constructor() { super('boot'); }
    create() {
      AibouTextures.generate(this);
      A.newRun();
      this.scene.launch('top');
      this.scene.launch('bottom');
      this.scene.launch('ui');
      this.scene.stop();
    }
  }

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: W, height: H,
    backgroundColor: '#0e0e16',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: 1500 }, debug: false } },
    input: { activePointers: 4 },
    scene: [BootScene, TopScene, BottomScene, UIScene],
  };
  // 動作確認用：?bg=1 をつけると、画面が隠れていてもゲームが進む（タイマーで回す）
  if (/[?&]bg=1/.test(location.search)) config.fps = { forceSetTimeOut: true, target: 60 };
  window.addEventListener('load', () => { window.game = new Phaser.Game(config); });
})();
