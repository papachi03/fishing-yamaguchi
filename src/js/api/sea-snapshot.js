// ブラウザ側の予報の読み方（2026-09-24 乗り換えで新設）。
//
// met.no は User-Agent を名乗れる場所からしか呼べない（規約）ので、ブラウザは予報を直接取りに行かない。
// サイトのビルド（GitHub Actions、3時間ごと）で5エリア分を取り、
//   ・SEAページには <script type="application/json" id="sea-snapshot"> として埋め込み
//   ・それ以外のページ（HOME など）は /data/sea-snapshot.json を読む
// 予報は最大3時間ほど古いので、「今」の値は時間別の中から開いた時刻の1時間を選び直す（atNow）。

let loading = null;

export function embeddedSnapshot() {
  try {
    const el = typeof document !== 'undefined' ? document.getElementById('sea-snapshot') : null;
    return el ? JSON.parse(el.textContent) : null;
  } catch {
    return null;
  }
}

// base: サイトの置き場所（import.meta.env.BASE_URL）。埋め込みがあればそれを使う
export function loadSnapshot(base = '/') {
  const emb = embeddedSnapshot();
  if (emb) return Promise.resolve(emb);
  loading ??= fetch(`${base}data/sea-snapshot.json`, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`snapshot ${r.status}`);
    return r.json();
  });
  return loading;
}

const hourKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`;

// 予報の「今」を、開いた時刻の1時間に合わせ直す（ビルド時の current は最大3時間前のもの）
export function atNow(w, now = new Date()) {
  if (!w?.hourly?.length) return w;
  const key = hourKey(now);
  const h = w.hourly.find((x) => x.time === key);
  if (!h) return w;
  return {
    ...w,
    current: {
      ...w.current,
      temp: h.temp,
      code: h.code,
      wind: h.wind,
      windDir: h.windDir,
      gust: null,
      precipitation: h.rain ?? null,
      wave: h.wave,
      wavePeriod: h.wavePeriod,
    },
  };
}
