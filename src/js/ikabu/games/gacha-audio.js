// ガチャの音（2026-09-30）。BGM 2曲と効果音 6つを WebAudio で鳴らす。
//   ・曲：bgm_lobby（入口で繰り返す）・bgm_rise（投げた時に頭から。4秒で入り、12秒あたりから盛り上がる）
//   ・効果音：Audiostock（利用許諾証明書は ikabu-research\audio-licenses\ikabu-gacha\）
//   ・iPhone は画面を触った後でないと鳴らない → 最初のボタンで unlock() を呼ぶ
//   ・読み込みは初めて鳴らす時（オフの人は1バイトも読まない）。読めなくても演出は続く
//   ・bgm.js（ゲーム用）と同じ考え方だが、曲の切り替え（入口↔盛り上がり）と効果音が要るので別に持つ
export const AUDIO = {
  lobby: { src: '/assets/ikabu/audio/gacha/bgm_lobby.mp3', loop: true, volume: 0.16, loopEnd: 116.0 },   // 116秒で音が消えるので、その手前で頭へ
  rise: { src: '/assets/ikabu/audio/gacha/bgm_rise.mp3', loop: false, volume: 0.2 },   // 2026-09-30 ぱっぱ「BGMが大きい」→ 半分に
  splash: { src: '/assets/ikabu/audio/gacha/se_splash.mp3', volume: 0.8 },
  drag: { src: '/assets/ikabu/audio/gacha/se_drag.mp3', volume: 0.7 },
  don: { src: '/assets/ikabu/audio/gacha/se_don.mp3', volume: 0.9 },
  flip: { src: '/assets/ikabu/audio/gacha/se_flip.mp3', volume: 0.8 },
  thunder: { src: '/assets/ikabu/audio/gacha/se_thunder.mp3', volume: 0.9 },
  fanfare: { src: '/assets/ikabu/audio/gacha/se_fanfare.mp3', volume: 0.9 },
};
const FADE = 0.5;

export function createGachaAudio({ on = true, href = (p) => p, tracks = AUDIO } = {}) {
  const AUDIO = tracks;   // 対戦は別の表（battle-ui.js）を渡す
  const st = { on: Boolean(on), ctx: null, bgmGain: null, seGain: null, bgm: null, bgmName: null, buffers: new Map(), loading: new Map(), playing: new Map(), seq: 0 };
  const hasWindow = typeof window !== 'undefined';

  function ac() {
    if (!hasWindow) return null;
    if (!st.ctx) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      st.ctx = new AC();
      st.bgmGain = st.ctx.createGain(); st.bgmGain.gain.value = 1; st.bgmGain.connect(st.ctx.destination);
      st.seGain = st.ctx.createGain(); st.seGain.gain.value = 1; st.seGain.connect(st.ctx.destination);
    }
    if (st.ctx.state === 'suspended') st.ctx.resume().catch(() => {});
    return st.ctx;
  }
  function load(name) {
    if (st.buffers.has(name)) return Promise.resolve(st.buffers.get(name));
    if (st.loading.has(name)) return st.loading.get(name);
    const c = ac();
    if (!c || !AUDIO[name]) return Promise.resolve(null);
    const p = fetch(href(AUDIO[name].src))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => new Promise((ok, ng) => { const q = c.decodeAudioData(ab, ok, ng); if (q?.then) q.then(ok, ng); }))
      .then((buf) => { st.buffers.set(name, buf); return buf; })
      .catch(() => null)
      .finally(() => st.loading.delete(name));
    st.loading.set(name, p);
    return p;
  }
  // 先に読んでおく（入口で曲と効果音をまとめて）
  function preload(names) { if (!st.on) return; for (const n of names) load(n); }

  function stopBgm(fade = FADE) {
    const c = st.ctx, s = st.bgm, g = s?.__gain;
    st.bgm = null; st.bgmName = null; st.seq += 1;
    if (!c || !s) return;
    const t = c.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade);
    try { s.stop(t + fade + 0.05); } catch { /* 止まっている */ }
  }
  // 曲を替える（クロスフェード：前の曲を xfade 秒で下げながら次を上げる。2026-09-30 ぱっぱ「つなぎが急」）。同じ曲なら何もしない
  async function bgm(name, { xfade = FADE } = {}) {
    if (!st.on) { st.bgmName = name; return; }
    if (st.bgmName === name && st.bgm) return;
    stopBgm(xfade);
    st.bgmName = name;
    const seq = ++st.seq;   // 最新の再生だけ鳴らす（停止→再生の二重を防ぐ）
    const buf = await load(name);
    if (!buf || st.bgmName !== name || !st.on || seq !== st.seq || st.bgm) return;
    const c = ac(); const A = AUDIO[name];
    const s = c.createBufferSource(); s.buffer = buf; s.loop = Boolean(A.loop);
    if (A.loop) { s.loopStart = A.loopStart ?? 0; s.loopEnd = Math.min(A.loopEnd ?? buf.duration, buf.duration); }
    const g = c.createGain(); g.gain.value = 0; s.connect(g).connect(st.bgmGain); s.__gain = g;
    const t = c.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(A.volume, t + xfade);
    s.start(t);
    st.bgm = s;
  }
  // 効果音を1つ。戻り値の stop() で途中で止められる（ドラグ音）
  async function se(name) {
    if (!st.on) return { stop() {} };
    const buf = await load(name);
    if (!buf || !st.on) return { stop() {} };
    const c = ac(); const A = AUDIO[name];
    const s = c.createBufferSource(); s.buffer = buf;
    const g = c.createGain(); g.gain.value = A.volume; s.connect(g).connect(st.seGain);
    s.start();
    st.playing.set(s, g); s.onended = () => st.playing.delete(s);
    return { stop(fade = 0.25) { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); try { s.stop(t + fade + 0.05); } catch { /* 済み */ } } };
  }
  function stopAllSe() { for (const [s, g] of st.playing) { try { g.gain.value = 0; s.stop(); } catch { /* 済み */ } } st.playing.clear(); }

  if (hasWindow) {
    document.addEventListener('visibilitychange', () => {
      if (!st.ctx) return;
      if (document.hidden) st.ctx.suspend().catch(() => {}); else if (st.on) st.ctx.resume().catch(() => {});
    });
  }
  return {
    get on() { return st.on; },
    setOn(v) {
      st.on = Boolean(v);
      if (!st.on) { stopBgm(0.2); stopAllSe(); }
      else if (st.bgmName) { const n = st.bgmName; st.bgmName = null; bgm(n); }
    },
    unlock() { ac(); },
    preload, bgm, stopBgm, se, stopAllSe,
  };
}
