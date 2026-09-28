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
