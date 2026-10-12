// スマホを振ってしゃくる（2026-09-29 ぱっぱ案・試験中）。
//   振った瞬間を1回の「タップ」として渡すだけ。2段しゃくり・スラックジャークは、ゲーム側がタップの間隔で決める
//   （速く2回振れば2段、3回以上ならスラックジャーク）。歩いている時の揺れで動かないよう、しきい値は強めにする。
//   iPhone は許可（DeviceMotionEvent.requestPermission）が要り、ボタンを押した時にしか頼めない

export const SHAKE = {
  threshold: 14,     // 重力を除いた揺れの大きさ（m/s²）。歩く揺れは 3〜6、竿をしゃくるように振ると 15〜30
  rearm: 7,          // いったんここまで下がってから、次の振りを数える（1回の振りを2回と数えない）
  refractory: 180,   // 次の振りまで最低これだけ空ける（ミリ秒）
};

// 揺れの大きさ（m/s²）と時刻（ミリ秒）を入れると、振った瞬間だけ true を返す
export function makeShakeDetector({ threshold = SHAKE.threshold, rearm = SHAKE.rearm, refractory = SHAKE.refractory } = {}) {
  let armed = true;
  let last = -Infinity;
  return (mag, t) => {
    if (!armed) {
      if (mag < rearm) armed = true;
      return false;
    }
    if (mag >= threshold && t - last >= refractory) {
      armed = false;
      last = t;
      return true;
    }
    return false;
  };
}

// 重力を含む値しか取れない端末のために、ゆっくり変わる分（重力）を引いて揺れだけにする
export function makeGravityFilter(k = 0.8) {
  let g = null;
  return (x, y, z) => {
    if (!g) g = [x, y, z];
    g = [k * g[0] + (1 - k) * x, k * g[1] + (1 - k) * y, k * g[2] + (1 - k) * z];
    return Math.hypot(x - g[0], y - g[1], z - g[2]);
  };
}

export const shakeSupported = () => typeof window !== 'undefined' && 'DeviceMotionEvent' in window;

// 許可を頼む（iPhone）。許可が要らない端末は 'granted' を返す
export async function requestShakePermission() {
  const D = window.DeviceMotionEvent;
  if (typeof D?.requestPermission !== 'function') return 'granted';
  try { return await D.requestPermission(); } catch { return 'denied'; }
}

// 振りの見張りを始める。戻り値の関数で止める
export function watchShake(onShake) {
  const detect = makeShakeDetector();
  const filter = makeGravityFilter();
  const onMotion = (e) => {
    const a = e.acceleration;
    let mag;
    if (a && a.x != null) mag = Math.hypot(a.x, a.y, a.z);
    else if (e.accelerationIncludingGravity?.x != null) { const g = e.accelerationIncludingGravity; mag = filter(g.x, g.y, g.z); }
    else return;
    if (detect(mag, performance.now())) onShake(mag);
  };
  addEventListener('devicemotion', onMotion);
  return () => removeEventListener('devicemotion', onMotion);
}

// スマホの傾き（2026-10-04 ぱっぱ：奥へ少し倒すとテンションフォール）。重力の向きから「画面がどれだけ上を向いたか」を度で出す。
//   0 度＝画面を立てて自分に向けている、90 度＝机に置いたように上向き。奥へ倒す（上側を向こうへ）ほど大きくなる。
//   縦・横どちらで持っても同じ式（画面の面に沿った重力の大きさと、画面に垂直な重力の比）
export const pitchOf = (gx, gy, gz) => (Math.atan2(-gz, Math.hypot(gx, gy)) * 180) / Math.PI;

// 傾きの見張り（振ってしゃくると同じ devicemotion を使うので、新しい許可は要らない）。ゆっくり平らにならした角度を onTilt(度) に渡す
export function watchTilt(onTilt, k = 0.85) {
  let p = null;
  const onMotion = (e) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    const v = pitchOf(g.x, g.y, g.z);
    p = p == null ? v : k * p + (1 - k) * v;
    onTilt(p);
  };
  addEventListener('devicemotion', onMotion);
  return () => removeEventListener('devicemotion', onMotion);
}

// 奥へ倒すとテンションフォール、の判定（2026-10-12 まれに入らない不具合の直し）。ゲームの画面から切り離して、テストで確かめられるようにした
// 前の作り：着水して最初の1回の角度を基準にしていた → 投げた直後にスマホが動いていると基準がずれ、15度倒しても入らない／
//   倒したまましゃくると「9度より起こすまで止める」ので、基準がずれているとその投げのあいだ効かなかった
// update(角度, 時刻ms, 入ってよいか) → 'enter'（入る）／'exit'（終わる）／null
export function makeTiltGate({ on = 15, off = 9, block = 800, steadyBand = 3, baseWait = 400, rearmWait = 600, driftWait = 1500 } = {}) {
  let base = null, isOn = false, armed = true, blockUntil = 0, ref = null, since = 0;
  return {
    get on() { return isOn; },
    reset() { base = null; isOn = false; armed = true; blockUntil = 0; ref = null; since = 0; },
    engineEnded() { if (isOn) { isOn = false; armed = false; } },   // ボタンや振りでしゃくった等で、エンジン側が終えた
    block(now) { blockUntil = now + block; if (isOn) { isOn = false; armed = false; } },   // 振った直後は入らない
    update(p, now, canEnter = () => true) {
      if (ref == null || Math.abs(p - ref) > steadyBand) { ref = p; since = now; }
      const steady = now - since;
      if (base == null) { if (steady >= baseWait) base = p; return null; }   // 角度が落ち着いてから基準を取る
      if (isOn) {
        if (p - base < off) { isOn = false; return 'exit'; }
        return null;
      }
      let d = p - base;
      if (d < 0) { base = p; d = 0; }   // 基準より起こした＝そこを新しい基準に
      if (!armed) {
        if (d < off) armed = true;
        else if (steady >= rearmWait) { base = p; armed = true; }   // 落ち着いた所を新しい基準にして再開
        return null;
      }
      if (d > 0 && d < off && steady >= driftWait) { base = p; d = 0; }   // 持ち方のゆっくりしたずれを吸収
      if (now < blockUntil) return null;
      if (d >= on && canEnter()) { isOn = true; return 'enter'; }
      return null;
    },
  };
}
