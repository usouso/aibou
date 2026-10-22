// 効果音をコードで鳴らす（音ファイルなし）。行動したときだけ鳴る。BGM は無し。
(function (root) {
  'use strict';

  class AibouAudio {
    constructor() { this.ctx = null; this.master = null; this.muted = false; }

    unlock() {
      try {
        if (!this.ctx) {
          const AC = root.AudioContext || root.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.6;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* 音が出なくてもゲームは続く */ }
    }

    now() { return this.ctx ? this.ctx.currentTime : 0; }

    // 1音。freq から freqEnd へ滑る。
    tone(o) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime + (o.delay || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + (o.dur || 0.1));
      const vol = o.vol == null ? 0.2 : o.vol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.1));
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + (o.dur || 0.1) + 0.02);
    }

    noise(o) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime + (o.delay || 0);
      const dur = o.dur || 0.1;
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = o.filter || 'bandpass';
      f.frequency.setValueAtTime(o.freq || 1000, t0);
      if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(50, o.freqEnd), t0 + dur);
      f.Q.value = o.q || 1;
      const g = ctx.createGain();
      const vol = o.vol == null ? 0.2 : o.vol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }

    // ---- 行動ごとの音 ----
    pickup() { // 拾った：短く上がる2音
      this.tone({ freq: 660, dur: 0.06, vol: 0.15 });
      this.tone({ freq: 990, dur: 0.09, vol: 0.15, delay: 0.06 });
    }
    drop() { // 持ちきれず落とした
      this.tone({ freq: 400, freqEnd: 250, type: 'triangle', dur: 0.12, vol: 0.12 });
    }
    send() { // 送った：下に落ちていく
      this.noise({ freq: 2400, freqEnd: 300, dur: 0.4, vol: 0.18, q: 2 });
      this.tone({ freq: 700, freqEnd: 180, type: 'sine', dur: 0.4, vol: 0.14 });
    }
    empty() { // 何も持っていないのに送ろうとした
      this.tone({ freq: 160, freqEnd: 120, type: 'square', dur: 0.08, vol: 0.08 });
    }
    expire() { // 部品が時間で落ちた（小さく）
      this.tone({ freq: 520, freqEnd: 180, type: 'sine', dur: 0.2, vol: 0.09 });
      this.noise({ freq: 900, freqEnd: 300, dur: 0.08, vol: 0.05 });
    }
    attach() { // 部品がついた
      this.tone({ freq: 320, freqEnd: 160, type: 'sine', dur: 0.14, vol: 0.2 });
      this.noise({ freq: 1500, dur: 0.04, vol: 0.1, filter: 'highpass' });
    }
    fusion() { // 合体：いちばん大きい音
      this.noise({ freq: 400, freqEnd: 4000, dur: 0.5, vol: 0.25, q: 0.7 });
      [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 1.1, vol: 0.16, delay: 0.05 * i, attack: 0.02 }));
      [1568, 2093, 2637].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.5, vol: 0.08, delay: 0.3 + 0.08 * i }));
      this.tone({ freq: 80, freqEnd: 40, type: 'sine', dur: 0.7, vol: 0.3, delay: 0.1 });
    }
    kill() { // 敵を倒した
      this.tone({ freq: 220, freqEnd: 60, type: 'square', dur: 0.13, vol: 0.14 });
      this.noise({ freq: 1800, freqEnd: 400, dur: 0.1, vol: 0.12 });
    }
    hitEnemy() { // 相棒の攻撃が当たった（小さく）
      this.noise({ freq: 1200, dur: 0.03, vol: 0.06 });
    }
    thunder() { // 雷の角
      this.noise({ freq: 3000, freqEnd: 800, dur: 0.18, vol: 0.14, q: 3 });
      this.tone({ freq: 1200, freqEnd: 300, type: 'sawtooth', dur: 0.1, vol: 0.06 });
    }
    partnerHit() { // 相棒がダメージ
      this.tone({ freq: 130, freqEnd: 60, type: 'sine', dur: 0.12, vol: 0.18 });
    }
    guard() { // 硬いので弾いた
      this.tone({ freq: 900, freqEnd: 700, type: 'square', dur: 0.05, vol: 0.06 });
    }
    dodge() { // よけた
      this.noise({ freq: 4000, freqEnd: 1500, dur: 0.08, vol: 0.1, filter: 'highpass' });
    }
    heal() { // 回復
      this.tone({ freq: 880, freqEnd: 1320, type: 'sine', dur: 0.1, vol: 0.05 });
    }
    playerHit() { // 自分がダメージ
      this.tone({ freq: 240, freqEnd: 90, type: 'sawtooth', dur: 0.2, vol: 0.14 });
      this.noise({ freq: 800, freqEnd: 200, dur: 0.15, vol: 0.1 });
    }
    playerDie() {
      [300, 250, 200, 150].forEach((f, i) => this.tone({ freq: f, freqEnd: f * 0.7, type: 'square', dur: 0.15, vol: 0.12, delay: i * 0.12 }));
    }
    jump() {
      this.tone({ freq: 380, freqEnd: 620, type: 'sine', dur: 0.07, vol: 0.05 });
    }
    rise() { // 敵が上に来た
      this.tone({ freq: 180, freqEnd: 900, type: 'square', dur: 0.35, vol: 0.12 });
      this.noise({ freq: 600, freqEnd: 3000, dur: 0.3, vol: 0.08 });
    }
    bossAppear() {
      this.tone({ freq: 70, freqEnd: 55, type: 'square', dur: 0.6, vol: 0.2 });
      this.tone({ freq: 70, freqEnd: 50, type: 'square', dur: 0.8, vol: 0.2, delay: 0.5 });
      this.noise({ freq: 200, freqEnd: 80, dur: 0.6, vol: 0.15, filter: 'lowpass' });
    }
    success() {
      const seq = [523, 659, 784, 1046, 784, 1046, 1318];
      seq.forEach((f, i) => this.tone({ freq: f, type: 'square', dur: 0.18, vol: 0.12, delay: i * 0.11 }));
      [523, 659, 784, 1046].forEach((f) => this.tone({ freq: f, type: 'triangle', dur: 1.4, vol: 0.1, delay: 0.85, attack: 0.03 }));
    }
    fail() {
      [330, 262, 220, 175].forEach((f, i) => this.tone({ freq: f, freqEnd: f * 0.94, type: 'triangle', dur: 0.5, vol: 0.14, delay: i * 0.4, attack: 0.02 }));
      this.noise({ freq: 150, freqEnd: 60, dur: 1.2, vol: 0.08, filter: 'lowpass', delay: 1.2 });
    }
    toggle(on) {
      this.tone({ freq: on ? 500 : 350, freqEnd: on ? 750 : 250, type: 'square', dur: 0.08, vol: 0.08 });
    }
    start() {
      this.tone({ freq: 523, type: 'square', dur: 0.08, vol: 0.1 });
      this.tone({ freq: 784, type: 'square', dur: 0.14, vol: 0.1, delay: 0.08 });
    }
  }

  root.AibouAudio = AibouAudio;
})(window);
