// イカ部の HTML の殻（ikabu/*.html と ikabu/en/*.html、レシピ1品ずつの ikabu/recipes/*.html）を1か所から作る。
//   node scripts/gen-ikabu-shells.mjs
// 殻は「head の情報 ＋ 空の header / main / footer ＋ 入口スクリプト」だけ。
// 本文はビルド時に vite.config.js の prerender-ikabu が書き込み、dev ではブラウザで描く。
// 枚数が多く手で直すと必ずズレるので、直したいときはこのファイルを直して作り直す。
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recipes } from '../src/js/ikabu/data.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://yamaguchifishing.com';
const OG_IMAGE = `${ORIGIN}/assets/ikabu/hero_original.png`;

// ページごとの <title> と description（本文の見出しは views/*.js 側にある）
const PAGES = {
  index: {
    ja: ['山口イカ部 — イカが好き。それだけで、部員。', '山口在住の釣り人が始めた、イカ好きの部活。釣っても、食べても、眺めるだけでも部員。山口マップ、風と波、イカ食堂、世界のイカ図鑑、写真部、あそび場、スタンプ。'],
    en: ['Yamaguchi Ika Club — Love squid? You are already a member.', 'A squid-lovers’ club started by an angler in Yamaguchi, Japan. Map, sea conditions, recipes, a squid atlas, a photo club, games and stickers.'],
  },
  map: { ja: ['山口マップ', '萩・長門・下関の遊漁船の公開案内と、須佐・特牛のイカの食文化スポットを地図に。ピンはエリアの目安で、釣り場そのものは示しません。'], en: ['Map', 'Public boat-trip information for Hagi, Nagato and Shimonoseki, plus squid food-culture stops in Susa and Kottoi. Pins mark areas, never exact fishing spots.'] },
  sea: { ja: ['風と波', '萩・長門・下関・下松・防府の天気、風速、突風、波高、潮汐と堤防の安全判定。ジャーナル本編の海況を部室から。'], en: ['Sea conditions', 'Weather, wind, gusts, wave height, tide and a breakwater safety guide for Hagi, Nagato, Shimonoseki, Kudamatsu and Hofu, from the journal’s sea page.'] },
  recipes: { ja: ['イカ食堂', 'アオリ・ケンサキ・ヤリ・コウイカ・モンゴウ。山口で釣れる5種のイカから選べる家庭料理と、釣ったイカの下処理。刺身は冷凍の約束つき。'], en: ['Recipes', 'Home recipes chosen by the five squid you can catch in Yamaguchi, plus how to handle your catch. Raw dishes come with freezing guidance.'] },
  recipe: { ja: ['材料と作り方', '1品ずつのレシピページ。分量と手順を台所で見やすく。'], en: ['Ingredients & steps', 'One recipe per page, with quantities and steps laid out for the kitchen.'] },
  atlas: { ja: ['世界のイカ', 'アオリイカ、ケンサキイカ、ヤリイカからダイオウイカまで。沿岸から深海まで、山口→日本→世界の順に13種の入門図鑑。'], en: ['Squid atlas', 'From bigfin reef squid and swordtip squid to the giant squid. An introductory atlas of thirteen species, from Yamaguchi to Japan to the world.'] },
  gallery: { ja: ['写真部', '部員の釣果、山口の海、イカの姿、食卓。撮影者と出典を添えた参考アルバム。'], en: ['Gallery', 'Our catches, the Yamaguchi coast, squid life and the table. A reference album with photographers and sources credited.'] },
  play: { ja: ['イカ部のあそび場', 'エギングゲームと「墨つなぎ」。釣りに行けない日のために。'], en: ['Play', 'An eging game and Ink Link, for days you cannot get to the water.'] },
  egi: { ja: ['しゃくって抱かせろ！ エギングゲーム', '山口イカ部のエギングゲーム。投げて、沈めて、しゃくって、フォールで抱かせる。今日の萩の風・波・潮で釣れ具合が変わります。スマホでそのまま遊べます。'], en: ['Jerk, fall, hug! — an eging game', 'The Yamaguchi Ika Club eging game. Cast, sink, jerk and let the squid hug on the fall. Today’s real wind, waves and tide in Hagi set the mood. Plays in your phone browser.'] },
  'egi-guide': { ja: ['部員おすすめ：新子シーズンのエギ選び', '秋の新子（アオリイカ）ねらいのエギを、号数と色で。ヤマシタ「エギ王K」とデュエル「パタパタ」から、マズメ・日中・夜間の3タイプ別に部員が選んだ候補。'], en: ["Members' pick: egi for young-squid season", 'Egi for autumn’s young bigfin reef squid, by size and color. Picks from YAMASHITA Egi-O K and DUEL PataPata for dawn and dusk, daytime and night anglers.'] },
  studio: { ja: ['スタンプとSNS', '紺とオレンジのイカのスタンプ案（ダジャレ編・山口の地名編）と、ダジャレの解説。YouTube・Instagramは準備中。'], en: ['Stickers & social', 'Sticker concepts with our navy-and-orange squid (puns and Yamaguchi place names), a pun glossary, and what is coming on YouTube and Instagram.'] },
  sources: { ja: ['写真と情報の出典', '写真・地図・海況・生きものの出典一覧。AI生成のイラストと海況データの出どころについても。'], en: ['Sources & credits', 'Credits for photographs, maps, forecasts and wildlife information, plus notes on AI-generated artwork and where the sea data comes from.'] },
};

const SITE = { ja: '山口イカ部', en: 'Yamaguchi Ika Club' };
const FONTS =
  'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Zen+Maru+Gothic:wght@500;700;900&display=swap';

const pagePath = (page, lang) => `/ikabu/${lang === 'en' ? 'en/' : ''}${page === 'index' ? '' : `${page}.html`}`;
const recipePath = (id, lang) => `/ikabu/${lang === 'en' ? 'en/' : ''}recipes/${id}.html`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 1枚の殻。path(lang) は同じページの各言語の URL（hreflang と canonical に使う）
function shell({ page, lang, name, desc, path }) {
  // 「recipe.html」は旧URLからの転送と1品を選ぶだけのページなので検索には載せない（1品ずつのページを載せる）
  const robots = path(lang).endsWith('/recipe.html') ? '  <meta name="robots" content="noindex" />\n' : '';
  const title = page === 'index' ? name : `${name} | ${SITE[lang]}`;
  const canonical = ORIGIN + path(lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="ja" href="${ORIGIN + path('ja')}" />
  <link rel="alternate" hreflang="en" href="${ORIGIN + path('en')}" />
  <link rel="alternate" hreflang="x-default" href="${ORIGIN + path('ja')}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="${SITE[lang]}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ja_JP'}" />
  <meta name="twitter:card" content="summary_large_image" />
${robots}  <link rel="icon" href="/assets/images/logo_cd_96.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONTS}" rel="stylesheet" />
  <link rel="stylesheet" href="/src/css/style.css" />
  <link rel="stylesheet" href="/src/css/ikabu.css" />
</head>
<body class="ikabu" data-page="${page}">
  <a class="skip-link" href="#main">${lang === 'en' ? 'Skip to content' : '本文へスキップ'}</a>
  <header id="ika-header"></header>
  <main id="main"></main>
  <footer id="ika-footer"></footer>
  <script type="module" src="/src/js/ikabu/pages/${page}.js"></script>
</body>
</html>
`;
}

// vite.config.js の input に登録する名前の一覧（同じ規則で作る）
export const IKABU_PAGES = Object.keys(PAGES);
export const IKABU_RECIPE_IDS = recipes.map((r) => r.id);

// 作る殻の一覧：{ file（ROOT からの相対）, page, lang, name, desc, path }
export function ikabuShells() {
  const out = [];
  for (const lang of ['ja', 'en']) {
    const dir = lang === 'en' ? 'ikabu/en' : 'ikabu';
    for (const page of IKABU_PAGES) {
      const [name, desc] = PAGES[page][lang];
      out.push({ file: `${dir}/${page}.html`, page, lang, name, desc, path: (l) => pagePath(page, l) });
    }
    for (const r of recipes) {
      // 1品の title は料理名、description は一言＋分数
      const name = r.name[lang];
      const desc = lang === 'en' ? `${r.intro.en} About ${r.time} minutes. Ingredients for 2 or 4 servings, numbered steps and a print view.` : `${r.intro.ja} 目安${r.time}分。2人分／4人分の材料と手順、印刷用の表示つき。`;
      out.push({ file: `${dir}/recipes/${r.id}.html`, page: 'recipe', lang, name, desc, path: (l) => recipePath(r.id, l) });
    }
  }
  return out;
}

// 直接実行したときだけ書き出す（vite.config.js から import しても副作用が出ないように）
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let n = 0;
  for (const s of ikabuShells()) {
    const file = resolve(ROOT, s.file);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, shell(s), 'utf8');
    n++;
  }
  console.log(`[gen-ikabu-shells] ${n} files written`);
  // サイトマップ（公開ページだけ。recipe.html は除く）。YFJ 本体の分は手で書いたまま触らない
  const today = new Date().toISOString().slice(0, 10);
  const entries = ikabuShells()
    .map((sh) => sh.path(sh.lang))
    .filter((u) => !u.endsWith('/recipe.html'))
    .map((u) => `  <url>\n    <loc>${ORIGIN}${u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.includes('/sea.html') ? 'daily' : 'monthly'}</changefreq>\n    <priority>${/\/ikabu\/(en\/)?$/.test(u) ? '0.8' : '0.6'}</priority>\n  </url>`)
    .join('\n');
  const smFile = resolve(ROOT, 'public/sitemap.xml');
  const sm = readFileSync(smFile, 'utf8');
  const START = '  <!-- ikabu:start（scripts/gen-ikabu-shells.mjs が書く） -->';
  const END = '  <!-- ikabu:end -->';
  const block = `${START}\n${entries}\n${END}`;
  const next = sm.includes(START)
    ? sm.replace(new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END}`), block)
    : sm.replace('</urlset>', `${block}\n</urlset>`);
  writeFileSync(smFile, next, 'utf8');
  console.log(`[gen-ikabu-shells] sitemap: ${entries.split('<url>').length - 1} urls`);
}
