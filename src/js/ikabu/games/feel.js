// エギングの「手ざわり」：振動と、控えめな効果音（2026-09-25）。
//
// 振動：本物で「手に伝わるもの」だけを震わせる（ダディ案）。
//   イカパンチ＝トトッ／アタリ「コン」＝コッ／アタリ「走る」＝ジーッ／フッキング＝ドン／ジェット＝ブーッ（大きいイカほど長く）
//   ／身切れ・バラシ＝長めに1回。アタリ「止まる」「フケる」は目で糸を見て気づくものなので震わせない。
//   Vibration API がある端末（Android など）だけ。iPhone（Safari 含む全ブラウザ）は Apple の制限で振動できない。
// 音：2026-09-27 から既定はオン（ぱっぱ：気づかない人が多い。消したい人が探してオフにする）。小さく短く（音声ファイルは使わず Web Audio で作る）。
//   iPhone は最初に画面を触った後でないと鳴らせないため、最初の操作で unlock() を呼ぶ。

export const canVibrate = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !/iPhone|iPad|iPod/.test(navigator.userAgent ?? '');

const PATTERN = {
  punch: [12, 45, 12],
  tap: [28],
  run: [110],
  hook: [120, 40, 60, 40, 220],
  break: [260],
  landed: [30, 70, 30],
  whoosh: [90],
};
const jetPattern = (power = 0.5) => [Math.round(120 + 160 * Math.min(1, power))];
// アワセが決まった「ズドン！」（2026-09-30 ぱっぱ：Androidなら激しくバイブ）：強く1発→細かく2回→大きいイカほど長い締め
export const hookPattern = (heavy = 0.5) => [120, 40, 60, 40, Math.round(160 + 140 * Math.min(1.6, Math.max(0, heavy)))];

const VOLUME = 0.05; // 控えめに（最大 1）

// dragSample：本物のドラグ音（Audiostock se_drag.mp3・ガチャと共用）の住所。2026-09-30 ぱっぱ「ドラグの出る音が凄く良いので巻き取る時の音に。しゃくる時にも一瞬『ジッ！』」
//   読めた時はそれをループで鳴らし（drag）、頭 0.22 秒を「ジッ！」（zip）に使う。読めない・まだ読み込み中は今までの合成音
const SAMPLE_VOL = 0.55;
export function createFeel({ vibrate = true, sound = false, dragSample = null } = {}) {
  const st = { vibrate, sound, ctx: null, sampleUrl: dragSample, sample: null, sampleLoading: null };
  function loadSample() {
    if (!st.sampleUrl || st.sample || st.sampleLoading || !st.ctx) return;
    st.sampleLoading = fetch(st.sampleUrl)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => new Promise((ok, ng) => { const q = st.ctx.decodeAudioData(ab, ok, ng); if (q?.then) q.then(ok, ng); }))
      .then((buf) => { st.sample = buf; })
      .catch(() => {})   // 読めなければ合成音のまま
      .finally(() => { st.sampleLoading = null; });
  }

  function buzz(kind, opt = {}) {
    if (!st.vibrate || !canVibrate()) return;
    // ブラウザは、画面を一度も触っていない間は振動を止める（警告が出る）。触る前は呼ばない
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const p = kind === 'jet' ? jetPattern(opt.power) : kind === 'hook' && opt.heavy != null ? hookPattern(opt.heavy) : PATTERN[kind];
    if (!p) return;
    try { navigator.vibrate(p); } catch { /* 対応していない端末 */ }
  }

  function unlock() {
    if (!st.sound || st.ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    try {
      st.ctx = new AC();
      st.ctx.resume?.();
      loadSample();
    } catch { st.ctx = null; }
  }
  // しゃくりの「ジッ！」：本物のドラグ音の頭だけ（0.22秒）。音源が無ければ短い合成音
  function zip() {
    const ctx = st.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (!st.sample) { blip({ type: 'noise', f0: 3400, dur: 0.12, vol: 1.2 }); return; }
    const src = ctx.createBufferSource(); src.buffer = st.sample;
    const g = ctx.createGain();
    g.gain.setValueAtTime(SAMPLE_VOL, t); g.gain.setValueAtTime(SAMPLE_VOL, t + 0.16); g.gain.linearRampToValueAtTime(0.0001, t + 0.22);
    src.connect(g).connect(ctx.destination);
    src.start(t, 0.02); src.stop(t + 0.24);
  }

  // 短い音を1つ。type: 'sine' | 'square' | 'sawtooth' | 'noise'
  function blip({ type = 'sine', f0 = 400, f1 = f0, dur = 0.06, at = 0, vol = 1 }) {
    const ctx = st.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(VOLUME * vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(ctx.destination);
    let src;
    if (type === 'noise') {
      const buf = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * dur)), ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f0;
      src.connect(bp).connect(g);
    } else {
      src = ctx.createOscillator();
      src.type = type;
      src.frequency.setValueAtTime(f0, t0);
      if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      src.connect(g);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ヤエン：イカが沖へ走っている間のドラグ「ジーーーッ」（鳴らし続ける。止まった＝食べ始めた合図）
  //   ノイズを高い帯域に通し、細かく刻んでドラグの爪の音に。drag(true) で鳴らし、drag(false) で止める（何度呼んでもよい）
  let dragNode = null;
  function drag(on) {
    const ctx = st.ctx;
    if (!on || !st.sound || !ctx) {
      if (dragNode && ctx) {
        const t = ctx.currentTime;
        try {
          dragNode.g.gain.cancelScheduledValues(t);
          dragNode.g.gain.setTargetAtTime(0.0001, t, 0.03);
          dragNode.srcs.forEach((x) => x.stop(t + 0.25));
        } catch { /* 止まっている */ }
      }
      dragNode = null;
      return;
    }
    if (dragNode) return;
    const t = ctx.currentTime;
    if (st.sample) {   // 本物のドラグ音をループ（頭の立ち上がりは残し、0.4〜7.8秒を繰り返す）
      const src = ctx.createBufferSource(); src.buffer = st.sample; src.loop = true; src.loopStart = 0.4; src.loopEnd = Math.min(7.8, st.sample.duration);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(SAMPLE_VOL, t + 0.04);
      src.connect(g).connect(ctx.destination); src.start(t);
      dragNode = { g, srcs: [src] };
      return;
    }
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3400; bp.Q.value = 2.2;
    const chop = ctx.createGain();
    chop.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.type = 'square'; lfo.frequency.value = 48;   // 1秒に48回の「ジ」
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(chop.gain);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(VOLUME * 0.9, t + 0.04);
    src.connect(bp).connect(chop).connect(g).connect(ctx.destination);
    src.start(t); lfo.start(t);
    dragNode = { g, srcs: [src, lfo] };
  }
  // ジェット噴射「シュワッ」：ノイズの帯域を低→高へ滑らせ、ふくらんで消える
  function whoosh(vol = 1) {
    const ctx = st.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const dur = 0.55;
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * dur), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(VOLUME * 2.2 * vol, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // アワセが決まった「シャキーン！」（2026-09-30 ぱっぱ「キター！という感じ。刃物の響き」→ 3案から B＝高めキラッ、を余韻短めにした B2）。
  //   試聴用は ikabu-research\game-bgm\shing_variants.py（同じ作り。A＝王道／C＝低め重い刃は SHING の数字を替える）
  //   ①シャ：ノイズの帯域を 2500→9000Hz へ駆け上がらせる（刃がこすれる）
  //   ②キーン：刃物・鐘のような整数倍でない倍音（1・1.51・2.14・2.76倍）を、少しずらした2本ずつ重ねて「うなり」でキラキラさせ、高い倍音ほど早く消す
  //   ③キラッ：キーンの頭で、高い小さな音を3つ駆け上がらせる
  const SHING = { base: 3400, ratios: [1, 1.51, 2.14, 2.76], amps: [1, 0.6, 0.4, 0.25], detune: 9, sha: [3000, 11000, 0.11], ring: 0.7, decay: 1.8, sparkle: true, vol: 0.2 };
  function shing() {
    const ctx = st.ctx;
    if (!ctx) return;
    const S = SHING;
    const t = ctx.currentTime;
    // シャ
    const [f0, f1, sd] = S.sha;
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * sd), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + sd);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(S.vol * 1.6, t + sd * 0.6); ng.gain.exponentialRampToValueAtTime(0.0001, t + sd);
    ns.connect(bp).connect(ng).connect(ctx.destination); ns.start(t); ns.stop(t + sd + 0.02);
    // キーン（シャの途中から立ち上がる）
    const t1 = t + sd * 0.55;
    const sum = S.amps.reduce((a, b) => a + b, 0) * 2;
    S.ratios.forEach((r, k) => {
      const tau = 1 / ((1.2 + r * 0.9) * S.decay);   // 高い倍音ほど早く消える（試聴用 shing_variants.py の exp(-t*(1.2+0.9r)*decay) と同じ）
      for (const d of [-S.detune, S.detune]) {
        const f = S.base * r + d;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f * 0.9, t1); o.frequency.linearRampToValueAtTime(f, t1 + 0.04);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t1); g.gain.exponentialRampToValueAtTime((S.vol * S.amps[k]) / sum * 2.2, t1 + 0.004);
        g.gain.setTargetAtTime(0, t1 + 0.004, tau);
        g.gain.setTargetAtTime(0, t1 + S.ring - 0.08, 0.02);   // 最後は短く閉じる（切れ目でプツッと鳴らない）
        o.connect(g).connect(ctx.destination); o.start(t1); o.stop(t1 + S.ring + 0.05);
      }
    });
    if (S.sparkle) {
      [1.25, 1.5, 2].forEach((m, k) => {
        const ts = t1 + 0.05 * k;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = S.base * m;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ts); g.gain.exponentialRampToValueAtTime(S.vol * 0.3, ts + 0.003); g.gain.setTargetAtTime(0, ts + 0.003, 1 / 18);
        o.connect(g).connect(ctx.destination); o.start(ts); o.stop(ts + 0.2);
      });
    }
  }

  function play(kind, opt = {}) {
    if (!st.sound || !st.ctx) return;
    switch (kind) {
      case 'punch': blip({ type: 'noise', f0: 2400, dur: 0.02 }); blip({ type: 'noise', f0: 2400, dur: 0.02, at: 0.06 }); break;
      case 'tap': blip({ type: 'sine', f0: 220, f1: 140, dur: 0.07, vol: 1.4 }); break;
      case 'run': for (let i = 0; i < 4; i++) blip({ type: 'square', f0: 900, dur: 0.018, at: i * 0.045, vol: 0.5 }); break;
      case 'hook': blip({ type: 'sine', f0: 110, f1: 70, dur: 0.12, vol: 1.6 }); shing(); break;   // 手に来る「ドン」＋決まった「シャキーン！」
      case 'jet': break;   // 音は出さない（2026-09-29 ぱっぱ：ドラグの「ジジジッ」と被るので「ピピピッ」は消す）。振動だけ
      case 'whoosh': whoosh(opt.vol ?? 1); break;
      case 'zip': zip(); break;   // しゃくりの「ジッ！」
      case 'break': blip({ type: 'sine', f0: 700, f1: 180, dur: 0.18 }); break;
      case 'landed': blip({ type: 'sine', f0: 520, dur: 0.07 }); blip({ type: 'sine', f0: 780, dur: 0.09, at: 0.09 }); break;
      default: break;
    }
  }

  return {
    get vibrate() { return st.vibrate; },
    get sound() { return st.sound; },
    setVibrate(v) { st.vibrate = Boolean(v); },
    setSound(v) { st.sound = Boolean(v); if (st.sound) unlock(); else drag(false); },
    drag,
    unlock,
    // できごとを1つ伝える（振動と音をまとめて）
    fire(kind, opt) { buzz(kind, opt); play(kind, opt); },
  };
}
