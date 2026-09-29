// ゲームのBGM（2026-09-30 ぱっぱ：BGMは好みがあるので、最初はオフ・スイッチでオン。効果音はそのまま）。
// 曲は Suno Pro で作ったトレーラーの曲（ikabu-research\game-bgm\make_game_bgm.py でゲーム用に作り直したもの）。
//   前奏を1回流したあと [loopStart, loopEnd) を繰り返す。つなぎ目は曲ファイルの側で溶かしてあるので、
//   AudioBufferSourceNode の loop で飛ぶだけでプツッと鳴らない。
// ・iPhone は画面を触った後でないと鳴らせない → オンにするボタンを押した時に AudioContext を作る（押す＝触る）
// ・曲は、オンになった時に初めて読み込む（オフのままの人は1バイトも読まない）
// ・ページを裏に回したら止め、戻ったら続きから
// 曲の住所は呼び出す側から href（assetHref）でもらう（ここで i18n.js を読むと、テスト＝Node で import.meta.env が無く落ちる）

// 音量は控えめ（ぱっぱ 2026-09-30：エギングはドラグの出る音などが大事）。エギングがいちばん小さい
export const TRACKS = {
  egi: { src: '/assets/ikabu/audio/bgm_egi.mp3', loopStart: 8.731, loopEnd: 67.384, volume: 0.12 },
  sumi: { src: '/assets/ikabu/audio/bgm_sumi.mp3', loopStart: 9.799, loopEnd: 118.097, volume: 0.18 },
  rush: { src: '/assets/ikabu/audio/bgm_rush.mp3', loopStart: 8.545, loopEnd: 68.104, volume: 0.18 },
};
export const DUCK = 0.3;   // 聞かせたい音（ドラグ・アタリ・やり取り）の間は、さらにこの割合まで下げる
const FADE = 0.6;
const level = (st) => (TRACKS[st.playing]?.volume ?? 0) * (st.ducked ? DUCK : 1);

export function createBgm({ on = false, track = null, href = (p) => p } = {}) {
  const st = { on: Boolean(on), track, ctx: null, gain: null, src: null, playing: null, ducked: false, buffers: new Map(), loading: new Map() };
  const hasWindow = typeof window !== 'undefined';

  function ac() {
    if (!hasWindow) return null;
    if (!st.ctx) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      st.ctx = new AC();
      st.gain = st.ctx.createGain();
      st.gain.gain.value = 0;
      st.gain.connect(st.ctx.destination);
    }
    if (st.ctx.state === 'suspended') st.ctx.resume().catch(() => {});
    return st.ctx;
  }
  function load(name) {
    if (st.buffers.has(name)) return Promise.resolve(st.buffers.get(name));
    if (st.loading.has(name)) return st.loading.get(name);
    const c = ac();
    if (!c || !TRACKS[name]) return Promise.resolve(null);
    const p = fetch(href(TRACKS[name].src))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => new Promise((ok, ng) => { const q = c.decodeAudioData(ab, ok, ng); if (q?.then) q.then(ok, ng); }))
      .then((buf) => { st.buffers.set(name, buf); return buf; })
      .catch(() => null)   // 読めなくてもゲームは続ける（音が鳴らないだけ）
      .finally(() => st.loading.delete(name));
    st.loading.set(name, p);
    return p;
  }
  function stopNow(fade = FADE) {
    const c = st.ctx;
    const s = st.src;
    st.src = null; st.playing = null;
    if (!c || !s) return;
    const t = c.currentTime;
    st.gain.gain.cancelScheduledValues(t);
    st.gain.gain.setValueAtTime(st.gain.gain.value, t);
    st.gain.gain.linearRampToValueAtTime(0, t + fade);
    try { s.stop(t + fade + 0.05); } catch { /* 止まっている */ }
  }
  async function sync() {
    const want = st.on && st.track && !(hasWindow && document.hidden) ? st.track : null;
    if (want === st.playing) return;
    if (st.playing) stopNow(want ? 0.25 : FADE);
    if (!want) return;
    st.playing = want;
    const buf = await load(want);
    if (!buf || st.playing !== want || !st.on) return;   // 読み込み中にオフ・曲替えされた
    const c = ac();
    const s = c.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = TRACKS[want].loopStart;
    s.loopEnd = Math.min(TRACKS[want].loopEnd, buf.duration);
    s.connect(st.gain);
    const t = c.currentTime;
    st.gain.gain.cancelScheduledValues(t);
    st.gain.gain.setValueAtTime(0, t);
    st.gain.gain.linearRampToValueAtTime(level(st), t + FADE);
    s.start(t);
    st.src = s;
  }
  // 下げる／戻す（毎コマ呼んでよい。変わった時だけ動かす）
  function duck(v) {
    v = Boolean(v);
    if (v === st.ducked) return;
    st.ducked = v;
    const c = st.ctx;
    if (!c || !st.src) return;
    const t = c.currentTime;
    st.gain.gain.cancelScheduledValues(t);
    st.gain.gain.setValueAtTime(st.gain.gain.value, t);
    st.gain.gain.linearRampToValueAtTime(level(st), t + (v ? 0.15 : 0.8));   // 下げるのは速く、戻すのはゆっくり
  }
  if (hasWindow) document.addEventListener('visibilitychange', () => { if (document.hidden) stopNow(0.1); sync(); });
  return {
    get on() { return st.on; },
    get track() { return st.track; },
    get playing() { return st.playing; },
    // オン／オフ（ボタンから呼ぶ：iPhone で鳴らせるよう、この中で AudioContext を作る）
    setOn(v) { st.on = Boolean(v); if (st.on) ac(); sync(); },
    // 曲を替える（墨つなぎ⇔墨のがれ）。null で止める
    setTrack(name) { st.track = name && TRACKS[name] ? name : null; sync(); },
    duck,
    get ducked() { return st.ducked; },
    stop() { st.on = false; stopNow(); },
  };
}
