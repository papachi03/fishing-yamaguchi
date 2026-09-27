// 墨つなぎの効果音（2026-09-27 ぱっぱ：ポップでかわいい、楽しい。連鎖するたびに音階が上がる）。
// 音のファイルは使わず、ブラウザの中で合成する（Web Audio）＝軽い・権利の心配なし。
// iPhone は最初に画面を触った後でないと鳴らせないので、最初の操作で unlock() を呼ぶ。音は最初からオン（エギングと同じ）
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];   // ド レ ミ ソ ラ ド…（明るいペンタトニック）
const VOLUME = 0.14;

export function createSfx({ on = true } = {}) {
  const st = { on, ctx: null };
  function ac() {
    if (!st.on || typeof window === 'undefined') return null;
    if (!st.ctx) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      st.ctx = new AC();
    }
    if (st.ctx.state === 'suspended') st.ctx.resume().catch(() => {});
    return st.ctx;
  }
  // 1音：立ち上がりは速く、なめらかに消える。slide＝終わりの高さの倍率（ぽよーん・しゅーっ）
  function tone(freq, { at = 0, dur = 0.14, type = 'triangle', vol = 1, slide = 1, vibrato = 0 } = {}) {
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    if (vibrato) {
      const lfo = c.createOscillator(); const lg = c.createGain();
      lfo.frequency.value = 9; lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(VOLUME * vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  const note = (i) => SCALE[Math.max(0, Math.min(SCALE.length - 1, i))];
  const api = {
    get on() { return st.on; },
    setOn(v) { st.on = Boolean(v); if (st.on) ac(); },
    unlock() { ac(); },
    // ぷちっ：連鎖の段目（1から）で音階が上がる
    pop(chain = 1) { const f = note(chain - 1); tone(f, { dur: 0.11, vol: 0.9 }); tone(f * 2, { at: 0.01, dur: 0.06, type: 'sine', vol: 0.35 }); },
    // 墨フラッシュで順番に弾ける：i 番目ほど高く
    popSeq(i) { const f = note(2 + (i % 8)); tone(f, { dur: 0.08, vol: 0.7 }); },
    // しゅーっ＋駆け上がる
    line() { tone(420, { dur: 0.22, type: 'sawtooth', vol: 0.25, slide: 3.2 }); [0, 1, 2, 3].forEach((k) => tone(note(3 + k * 2), { at: 0.05 + k * 0.035, dur: 0.1, vol: 0.5 })); },
    // ぽよーん（低めで弾む）
    bomb() { tone(260, { dur: 0.42, type: 'sine', vol: 1.2, slide: 0.45, vibrato: 18 }); tone(520, { at: 0.02, dur: 0.18, vol: 0.4, slide: 0.6 }); },
    // きらりん（鈴のような和音）
    ball() { [0, 2, 4].forEach((k, j) => tone(note(6 + k), { at: j * 0.05, dur: 0.5, type: 'sine', vol: 0.55 })); },
    // きらきらきら（スペシャル同士のコンボ）
    combo() { [0, 2, 4, 5, 7, 9].forEach((k, j) => tone(note(k), { at: j * 0.06, dur: 0.22, vol: 0.7 })); },
    // ちゃらーん♪（墨ゲージ満タン）
    full() { [5, 7, 9].forEach((k, j) => tone(note(k), { at: j * 0.09, dur: 0.45, type: 'sine', vol: 0.6 })); },
    // どぅーん（墨フラッシュ発動）
    flash() { tone(150, { dur: 0.6, type: 'sine', vol: 1.3, slide: 0.5 }); tone(300, { dur: 0.3, type: 'triangle', vol: 0.3, slide: 0.5 }); },
    // 生まれた（パネル）
    born() { tone(note(4), { dur: 0.12, vol: 0.6 }); tone(note(7), { at: 0.07, dur: 0.16, vol: 0.6 }); },
    // そろわない入れ替え：ぼよっ
    nope() { tone(220, { dur: 0.16, type: 'sine', vol: 0.7, slide: 0.8 }); },
    // 目標達成のファンファーレ
    goal() { [[0, 0], [2, 0.1], [4, 0.2], [7, 0.32]].forEach(([k, at]) => tone(note(k + 1), { at, dur: at > 0.3 ? 0.5 : 0.14, vol: 0.8 })); },
  };
  // 開発時だけ：鳴らした音の名前と時刻を window.__sumiSfx に残す（トレーラーの撮影で、同じ音を後から重ねるため。本番には入らない）
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    for (const k of ['pop', 'popSeq', 'line', 'bomb', 'ball', 'combo', 'full', 'flash', 'born', 'nope', 'goal']) {
      const f = api[k];
      api[k] = (...a) => { (window.__sumiSfx ??= []).push({ n: k, a, t: performance.now() }); return f(...a); };
    }
  }
  return api;
}
