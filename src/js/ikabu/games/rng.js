// 同じ種（たね）からは必ず同じ並びになる乱数。「今日の一戦」を世界中で同じ盤面にするために使う。
// ブラウザのAPIに触らない（node --test で試せる）

export function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let z = h;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// 重みつきで1つ選ぶ。items: [{ w: 数値, ... }]
export function pickWeighted(items, rand) {
  const total = items.reduce((s, it) => s + it.w, 0);
  let r = rand() * total;
  for (const it of items) {
    r -= it.w;
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

// UTC の日付（YYYY-MM-DD）。「今日の一戦」の種に使う
export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
