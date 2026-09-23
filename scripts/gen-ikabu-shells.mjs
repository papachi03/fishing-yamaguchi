// イカ部の HTML の殻（ikabu/*.html と ikabu/en/*.html、計20枚）を1か所から作る。
//   node scripts/gen-ikabu-shells.mjs
// 殻は「head の情報 ＋ 空の header / main / footer ＋ 入口スクリプト」だけ。
// 本文はビルド時に vite.config.js の prerender-ikabu が書き込み、dev ではブラウザで描く。
// 20枚を手で直すと必ずズレるので、直したいときはこのファイルを直して作り直す。
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://yamaguchifishing.com';
const OG_IMAGE = `${ORIGIN}/assets/ikabu/hero_original.png`;

// ページごとの <title> と description（本文の見出しは views/*.js 側にある）
const PAGES = {
  index: {
    ja: ['山口イカ部 — イカが好き。それだけで、部員。', '山口在住の釣り人が始めた、イカ好きの部活。釣っても、食べても、眺めるだけでも部員。山口マップ、風と波、イカ食堂、世界のイカ図鑑、写真部、あそび場、スタンプ。'],
    en: ['Yamaguchi Ika Club — Love squid? You are already a member.', 'A squid-lovers’ club started by an angler in Yamaguchi, Japan. Map, sea conditions, recipes, a squid atlas, a photo club, games and stickers.'],
  },
  map: { ja: ['山口マップ', '公開されている遊漁船の案内と、イカの食文化を楽しむ立ち寄り先。ピンはエリアの目安。'], en: ['Map', 'Public boat-trip information and stops to explore local squid food culture in Yamaguchi.'] },
  sea: { ja: ['風と波', '萩・長門・下関の風と波。ジャーナル本編の海況を部室から。'], en: ['Sea conditions', 'Wind and waves for Hagi, Nagato and Shimonoseki, from the journal’s sea page.'] },
  recipes: { ja: ['イカ食堂', '家庭で作る４つの加熱料理。人数に合わせて分量を切り替えられます。'], en: ['Recipes', 'Four home recipes using cooked squid. Switch quantities for two or four servings.'] },
  recipe: { ja: ['材料と作り方', '1品ずつのレシピページ。分量と手順を台所で見やすく。'], en: ['Ingredients & steps', 'One recipe per page, with quantities and steps laid out for the kitchen.'] },
  atlas: { ja: ['世界のイカ', '沿岸から深海まで、山口→日本→世界の順に約12種。'], en: ['Squid atlas', 'About twelve species, from Yamaguchi to Japan to the world.'] },
  gallery: { ja: ['写真部', '海、生きもの、食卓。撮影者と撮影地を添えた参考アルバム。'], en: ['Gallery', 'Sea, wildlife and food. A reference album with photographers and locations credited.'] },
  play: { ja: ['イカ部のあそび場', 'エギングゲームと「墨つなぎ」。釣りに行けない日のために。'], en: ['Play', 'An eging game and Ink Link, for days you cannot get to the water.'] },
  studio: { ja: ['スタンプとSNS', '紺とオレンジのイカのスタンプ案と、ダジャレの解説。'], en: ['Stickers & social', 'Sticker concepts with our navy-and-orange squid, and a pun glossary.'] },
  sources: { ja: ['写真と情報の出典', '写真・地図・海況・生きものの出典一覧。'], en: ['Sources & credits', 'Credits for photographs, maps, forecasts and wildlife information.'] },
};

const SITE = { ja: '山口イカ部', en: 'Yamaguchi Ika Club' };
const FONTS =
  'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Zen+Maru+Gothic:wght@500;700;900&display=swap';

const pagePath = (page, lang) => `/ikabu/${lang === 'en' ? 'en/' : ''}${page === 'index' ? '' : `${page}.html`}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function shell(page, lang) {
  const [name, desc] = PAGES[page][lang];
  const title = page === 'index' ? name : `${name} | ${SITE[lang]}`;
  const canonical = ORIGIN + pagePath(page, lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="ja" href="${ORIGIN + pagePath(page, 'ja')}" />
  <link rel="alternate" hreflang="en" href="${ORIGIN + pagePath(page, 'en')}" />
  <link rel="alternate" hreflang="x-default" href="${ORIGIN + pagePath(page, 'ja')}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="${SITE[lang]}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ja_JP'}" />
  <meta name="twitter:card" content="summary_large_image" />
  <!-- ぱっぱのOKが出るまで検索に載せない。正式公開のときに gen-ikabu-shells.mjs から外して作り直す -->
  <meta name="robots" content="noindex" />
  <link rel="icon" href="/assets/images/logo_cd_96.png" />
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

// 直接実行したときだけ書き出す（vite.config.js から import しても副作用が出ないように）
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let n = 0;
  for (const lang of ['ja', 'en']) {
    const dir = resolve(ROOT, 'ikabu', lang === 'en' ? 'en' : '');
    mkdirSync(dir, { recursive: true });
    for (const page of IKABU_PAGES) {
      writeFileSync(resolve(dir, `${page}.html`), shell(page, lang), 'utf8');
      n++;
    }
  }
  console.log(`[gen-ikabu-shells] ${n} files written`);
}
