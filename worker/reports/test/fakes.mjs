// ネットにつながずにWorkerを試すための偽物。

// valueが生のバイト列（Uint8Array）なら type:'arrayBuffer' 用に ArrayBuffer化する。
// sliceしないとビューではなく背後のバッファ全体が出てしまう
const asType = (v, type) => (type === 'arrayBuffer' && v instanceof Uint8Array ? v.slice().buffer : v);

export function fakeKV() {
  const store = new Map();
  const options = new Map(); // putの第3引数（expirationTtl・metadata など）。テストから確認する用
  // 何回読んだか。KVの読み取り回数（無料枠1日10万回）を守れているかテストから確かめる用
  const calls = { get: 0, put: 0, delete: 0, list: 0 };
  return {
    _store: store,
    _options: options,
    _calls: calls,
    _resetCalls: () => Object.keys(calls).forEach((k) => (calls[k] = 0)),
    // 実物は get(key, 'json') も get(key, { type: 'json' }) も受けるので両方に合わせる
    async get(key, typeOrOptions) {
      calls.get += 1;
      const v = store.get(key);
      if (v === undefined) return null;
      const type = typeof typeOrOptions === 'string' ? typeOrOptions : typeOrOptions?.type;
      return type === 'json' ? JSON.parse(v) : asType(v, type);
    },
    async getWithMetadata(key, typeOrOptions) {
      calls.get += 1;
      const v = store.get(key);
      const metadata = options.get(key)?.metadata ?? null;
      if (v === undefined) return { value: null, metadata: null };
      const type = typeof typeOrOptions === 'string' ? typeOrOptions : typeOrOptions?.type;
      return { value: type === 'json' ? JSON.parse(v) : asType(v, type), metadata };
    },
    async put(key, value, opts = null) {
      calls.put += 1;
      // 文字列はそのまま、バイト列(Uint8Array)もそのまま保存する（実物のKVも生のバイト列を扱える）
      store.set(key, value);
      options.set(key, opts);
    },
    async delete(key) {
      calls.delete += 1;
      store.delete(key);
      options.delete(key);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      calls.list += 1;
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit);
      return { keys: keys.map((name) => ({ name })), list_complete: true };
    },
  };
}

export function makeEnv(extra = {}) {
  return {
    REPORTS_KV: fakeKV(),
    TURNSTILE_SECRET: 'test-turnstile-secret',
    IP_SALT: 'test-ip-salt',
    SIGN_SECRET: 'test-sign-secret-please-be-long',
    ADMIN_PASSPHRASE: 'aikotoba-test',
    DISCORD_WEBHOOK_URL: 'https://discord.test/webhook',
    NOTIFY_MENTION_USER_ID: '111111111111111111',
    ...extra,
  };
}

// 通知など「応答を返したあとに走る処理」を集めるctx。settle() で待ち切ってから中身を確かめる
export function makeCtx() {
  const pending = [];
  return {
    ctx: { waitUntil: (p) => pending.push(p) },
    settle: () => Promise.all(pending.splice(0)),
  };
}

// fetch を差し替える。handler(url, init) が Response を返す。呼び出しの記録を返す
export function stubFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });
    return handler(url, init);
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

// Turnstileは成功、Discordは204を返す標準の差し替え
export const okFetch = (turnstileOk = true) => (url) =>
  url.includes('siteverify')
    ? new Response(JSON.stringify({ success: turnstileOk }), { status: 200 })
    : new Response(null, { status: 204 });

export const TEST_ORIGIN = 'https://papachi03.github.io';
export const TEST_BASE = 'https://yfj-reports.example.workers.dev';

// 投稿フォームの送信をまねる Request を作る
export function postForm(fields, { photo = null, ip = '203.0.113.1', origin = TEST_ORIGIN } = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries({ 'cf-turnstile-response': 'tok', ...fields })) form.set(k, v);
  if (photo) form.set('photo', new File([photo], 'a.jpg', { type: 'image/jpeg' }));
  return new Request(`${TEST_BASE}/posts`, {
    method: 'POST',
    headers: { origin, 'cf-connecting-ip': ip },
    body: form,
  });
}

// ごく小さいJPEGらしきバイト列。exif:true で "Exif\0\0" を埋め込む
// ごく小さいJPEGらしきバイト列。実物と同じ「マーカーの連なり」になっているので、
// 撮影情報を落とす処理（stripJpegMeta）を通してもJPEGの体裁が崩れない。
// exif:true で APP1 に "Exif\0\0" を入れる
export function jpegBytes({ exif = false, size = 64 } = {}) {
  const seg = (marker, payload) => [0xff, marker, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff, ...payload];
  const app0 = seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x00]); // JFIF
  const app1 = exif ? seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a]) : [];
  const head = [0xff, 0xd8, ...app1, ...app0, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00];
  const body = new Array(Math.max(0, size - head.length - 2)).fill(0x55);
  return new Uint8Array([...head, ...body, 0xff, 0xd9]);
}
