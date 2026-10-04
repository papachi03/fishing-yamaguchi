// イカ部トップ。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 部員の掲示板の「本物の投稿」だけはブラウザで後から差し替える（pages/index.js）。
import { t, pair, esc, pageHref, assetHref, SECTIONS } from '../i18n.js';
import { sectionHead } from './parts.js';
import { HERO_ANIM, sceneSVG } from '../hero-scene.js';
import { vlogs } from '../../data/vlogs.js';
import { placeById } from '../../data/spot-list.js';
import { FISH, nameOf } from '../../data/report-options.js';

/* ---------- 入口カードの文言（小松氏のサイトの対訳をもとに） ---------- */

const ENTRY = {
  map: {
    title: pair('海へ行く、その前に。', 'Before you head for the sea.'),
    desc: pair('船釣りの公開案内、食の寄り道、場所ごとの目安。ピンは「エリアの目安」まで。', 'Public boat-trip information, food stops and area guides. Pins mark areas, never exact spots.'),
  },
  sea: {
    title: pair('今日の海は、いかが？', "How's the sea today?"),
    desc: pair('萩・長門・下関の風と波。ジャーナル本編の海況を、そのまま部室から。', 'Wind and waves for Hagi, Nagato and Shimonoseki, straight from the journal.'),
  },
  recipes: {
    title: pair('今日の一杯を、一皿に。', 'From a squid to a good meal.'),
    desc: pair('分量と手順で作れる家庭料理。海外からも、日本のイカ食堂へ。', 'Recipes with quantities and clear steps. A Japanese squid kitchen, wherever you live.'),
  },
  atlas: {
    title: pair('知るほど、イカはおもしろい。', 'The more you know, the stranger it gets.'),
    desc: pair('光るイカ。大きなイカ。模様で伝えるイカ。山口から、世界の海へ。', 'Squid that glow. Squid of astonishing size. Squid that signal with their skin.'),
  },
  gallery: {
    title: pair('イカのある風景。', 'Life, with a little squid.'),
    desc: pair('海、生きもの、食卓。部員の写真も募集中（投稿すると🎫1枚）。', 'Sea, wildlife and food. Members can post their own photos too (🎫 +1).'),
  },
  play: {
    title: pair('同じイカで、世界と一戦。', 'One board. A world of players.'),
    desc: pair('エギングゲームと「墨つなぎ」。釣りに行けない日のために。', 'An eging game and Ink Link, for the days you cannot get to the water.'),
  },
  studio: {
    title: pair('LINEスタンプ', 'LINE stickers'),
    desc: pair('イカがダジャレで動くスタンプ3セット。10月10日発売。', 'Three sets of animated squid-pun stickers. On sale October 10.'),
  },
};

/* ---------- 部活動の記録：ジャーナルの動画からイカの回を3本 ---------- */

const ACTIVITY = [
  { vlog: 'kouika-present', tag: pair('大漁', 'Big day'), note: pair('釣れない地域の友達に、10杯まるごとプレゼントした日。', 'Ten cuttlefish, all given away to a friend whose home waters have none.') },
  { vlog: 'mongo-dawn', tag: pair('朝練', 'Dawn practice'), note: pair('糸の走りだけで掛けた。ロッドより先に、目が気づく。', 'Hooked on the line movement alone. The eyes notice before the rod does.') },
  { vlog: 'yariika-cd', tag: pair('夜練', 'Night practice'), note: pair('CD式の灯火でヤリイカ。寒いけど、部員は行く。', 'Spear squid under a CD lantern rig. Cold, but the club still goes.') },
];

/* ---------- 部員の掲示板：見本（本物の投稿が無いときだけ出す） ---------- */

export const SQUID_IDS = new Set(['aori', 'kensaki', 'yari', 'kouika', 'shiriyake']);

export const SAMPLE_POSTS = [
  { id: 's1', name: 'ダディ', spotId: null, fish: 'yari', date: '2026-02-14', comment: pair('風は弱め。灯火にヤリイカが寄ってきて3杯。寒いけど部活日和。', 'Light wind. Three spear squid came to the lantern. Cold, but a fine club day.'), hasPhoto: false },
  { id: 's2', name: 'イカ部員A', spotId: null, fish: 'kouika', date: '2026-04-02', comment: pair('昼のコウイカ、エギの色を変えたら急に来ました。詳しい場所は非公開で。', 'Daytime cuttlefish. Changed the jig colour and they suddenly turned up. Location stays private.'), hasPhoto: false },
  { id: 's3', name: 'まぁいっか', spotId: null, fish: 'aori', date: '2026-09-20', comment: pair('釣れませんでした。でも夕日がよかったので部活成立。', 'Nothing caught. The sunset was good, so the session still counts.'), hasPhoto: false },
];

const monthDay = (date) => {
  const [, m, d] = String(date ?? '').split('-');
  return m && d && Number.isFinite(Number(m)) && Number.isFinite(Number(d)) ? `${Number(m)}/${Number(d)}` : '';
};

// 投稿1件。利用者の文字は必ず esc() を通す。sample=true のときは通報ボタンを出さない
export function voiceCardHTML(post, lang, { sample = false, photoUrl } = {}) {
  const place = placeById(post.spotId)?.name ?? t(lang, '場所は非公開', 'Location private');
  const fish = nameOf(FISH, post.fish);
  const day = monthDay(post.date);
  const comment = typeof post.comment === 'object' ? t(lang, post.comment) : post.comment;
  return `
  <article class="ika-voice${sample ? ' ika-voice--sample' : ''}" data-id="${esc(post.id)}">
    ${post.hasPhoto && photoUrl ? `<figure class="ika-voice-photo"><img src="${esc(photoUrl(post.id))}" alt="" loading="lazy" decoding="async" /></figure>` : ''}
    <div class="ika-voice-body">
      <p class="ika-voice-place">${esc(place)}</p>
      <p class="ika-voice-meta">${esc(post.name)}${day ? ` ・ ${esc(day)}` : ''}${sample ? ` ・ ${t(lang, '見本', 'sample')}` : ''}</p>
      ${fish ? `<p class="ika-voice-tags"><span>${esc(fish)}</span></p>` : ''}
      <p class="ika-voice-comment">${esc(comment)}</p>
      ${sample ? '' : `<button type="button" class="ika-voice-flag" data-report="${esc(post.id)}">${t(lang, '不適切な投稿を知らせる', 'Report this post')}</button>`}
    </div>
  </article>`;
}

/* ---------- ページ本体 ---------- */

const PUNS_JA = ['いかが？', 'いかしてる！', 'まぁ、いっか。', 'いかほど？', 'いかんせん、眠い。', 'いかないで！', 'イカんぱい！', 'すみません。'];
const PUNS_EN = ['IKAGA? — HOW ABOUT IT?', 'IKASHITERU! — LOOKING SHARP', 'MAA, IKKA. — OH WELL', 'EXPLORE THE COAST', 'COOK SOMETHING GOOD', 'PLAY TOGETHER'];

export function render(lang) {
  const puns = lang === 'en' ? PUNS_EN : PUNS_JA;
  const tickerItems = [...puns, ...puns].map((p) => `<span>${p}</span>`).join('');

  const entries = SECTIONS.map((s) => {
    const e = ENTRY[s.page];
    return `
    <a class="ika-entry" href="${pageHref(s.page, lang)}">
      <span class="ika-entry-num">${s.num}</span>
      <span class="ika-entry-en">${s.en}</span>
      <span class="ika-entry-name">${t(lang, s.label)}</span>
      <span class="ika-entry-title">${t(lang, e.title)}</span>
      <span class="ika-entry-desc">${t(lang, e.desc)}</span>
      <span class="ika-entry-go">${t(lang, 'のぞいてみる', 'Explore')} <span aria-hidden="true">→</span></span>
    </a>`;
  }).join('');

  const activity = ACTIVITY.map(({ vlog, tag, note }) => {
    const v = vlogs.find((x) => x.id === vlog);
    if (!v) return '';
    return `
    <a class="ika-card" href="${assetHref('/journal.html')}#${esc(v.id)}">
      <figure><img src="${assetHref(v.poster)}" alt="" loading="lazy" decoding="async" /></figure>
      <div class="ika-card-body">
        <span class="ika-card-tag">${t(lang, tag)}</span>
        <h3>${esc(v.species)}${v.duration ? ` <small>${esc(v.duration)}</small>` : ''}</h3>
        <p>${t(lang, note)}</p>
      </div>
    </a>`;
  }).join('');

  const samples = SAMPLE_POSTS.map((p) => voiceCardHTML(p, lang, { sample: true })).join('');

  return `
  <!-- ===== HERO：夜の海のシーンが HERO そのもの（hero-scene.js が静止 SVG、hero-anim.js が動かす） ===== -->
  <section class="ika-hero">
    <div class="ika-hero-view">
      <div class="ika-hero-scene">${sceneSVG(HERO_ANIM, assetHref, lang)}</div>
      <div class="ika-hero-scrim" aria-hidden="true"></div>
      <div class="wrap ika-hero-copy"><div class="ika-hero-copy-inner">
        <p class="ika-pennant"><span>EST. 2026</span><span>YAMAGUCHI, JAPAN</span></p>
        <h1 class="ika-title">
          <span class="ika-logo-patch">
            <img class="ika-logo" src="${assetHref('/assets/ikabu/logo_1200.png')}" srcset="${assetHref('/assets/ikabu/logo_600.png')} 600w, ${assetHref('/assets/ikabu/logo_1200.png')} 1200w" sizes="(max-width: 760px) 70vw, 460px" alt="${t(lang, '山口イカ部 — YAMAGUCHI IKA CLUB', 'Yamaguchi Ika Club')}" width="1200" height="438" fetchpriority="high" />
          </span>
        </h1>
        <p class="ika-catch">${t(lang, '“釣り”でつながるコミュニティ', 'A community connected by fishing')}</p>
        <p class="ika-lead">${t(lang, 'イカが好き。<br />それだけで、部員。', 'Love squid?<br />Then you are already a member.')}</p>
        <p class="ika-sub">${t(
          lang,
          '山口在住の釣り人が始めた、イカ好きの部活です。釣っても、食べても、眺めるだけでも。釣り場は言わなくていい、釣れなくても部員。',
          'A squid-lovers’ club started by an angler living in Yamaguchi. Fish them, cook them, or just admire them. Secret spots stay secret, and a blank day still counts.'
        )}</p>
        <div class="ika-cta">
          <a class="ika-btn ika-btn--primary" href="#join">${t(lang, '入部する', 'Join the club')}</a>
          <a class="ika-btn ika-btn--ghost" href="#activities">${t(lang, '部活動を見る', 'See the activities')}</a>
        </div>
        <!-- ステッカーは文字の列の中（竿・糸・釣れたイカ・投げ直しの軌道にかからない場所） -->
        <p class="ika-hero-badges" aria-hidden="true">
          <span class="ika-sticker ika-sticker--a">${t(lang, '釣り場は言わなくてOK', 'Secret spots stay secret')}</span>
          <span class="ika-sticker ika-sticker--b">${t(lang, '部費 <b>0</b>円', 'Dues <b>¥0</b>')}</span>
        </p>
      </div></div>
      <!-- 「タップで釣る」：HERO の右下の隅に控えめに。物語の間は薄くなる（hero-anim.js が is-playing を付ける） -->
      <button type="button" class="ika-hook-btn" aria-label="${t(lang, 'タップしてイカを釣ろう', 'Tap to hook a squid')}">${t(lang, 'タップで釣る', 'Tap to hook')}</button>
      <!-- 物語の中で出る吹き出し。data-world はシーンの世界座標（hero-anim.js が画面上の位置に写す） -->
      <span class="ika-hero-drag" data-world="700,560" hidden aria-hidden="true">${t(lang, 'ジジジッ', 'Zzzzt!')}</span>
      <span class="ika-hero-ink" data-world="1120,760" hidden aria-hidden="true">${t(lang, 'ぷしゅっ', 'Squirt!')}</span>
      <div class="ika-hero-callout" data-world="1160,330" hidden aria-live="polite">
        <span class="ika-hero-callout-word">${t(lang, '抱いた！', 'Hooked!')}</span>
        <a class="ika-hero-callout-link" href="${pageHref('play', lang)}" hidden>${t(lang, 'エギングゲームで遊ぶ →', 'Play the egi game →')}</a>
      </div>
    </div>
    <div class="ika-ticker" aria-hidden="true"><div class="ika-ticker-track">${tickerItems}</div></div>
  </section>

  <!-- ===== 部則 ===== -->
  <section class="ika-rules" aria-label="${t(lang, '部則', 'Club rules')}">
    <div class="wrap">
      <p class="ika-rules-label">CLUB RULES<span>${t(lang, '部則', 'Three rules')}</span></p>
      <ol class="ika-rules-list">
        <li><span class="ika-rule-num">${t(lang, '一', '01')}</span><span>${t(lang, '釣り場は、言わなくていい。', 'Your fishing spot can stay secret.')}</span></li>
        <li><span class="ika-rule-num">${t(lang, '二', '02')}</span><span>${t(lang, '釣れなくても、部員。', 'No catch? Still a member.')}</span></li>
        <li><span class="ika-rule-num">${t(lang, '三', '03')}</span><span>${t(lang, 'ダジャレは、減点しない。', 'Puns are never penalized.')}</span></li>
      </ol>
    </div>
  </section>

  <!-- ===== 入口 ===== -->
  <section class="ika-section" id="activities">
    <div class="wrap">
      ${sectionHead(lang, { num: 'PICK', en: 'YOUR CLUB ACTIVITY', title: pair('今日は、何イカする？', 'What kind of squid day is it?'), note: pair('海に行く日も、おうちの日も。7つの部活動から。', 'For days at sea and days at home. Seven activities to choose from.') })}
      <div class="ika-entries">${entries}</div>
    </div>
  </section>

  <!-- ===== 部活動の記録 ===== -->
  <section class="ika-section ika-section--tint" id="activity">
    <div class="wrap">
      ${sectionHead(lang, { num: 'LOG', en: 'CLUB ACTIVITY LOG', title: pair('部活動の記録', 'Activity log'), note: pair('ジャーナル本編よりも、ゆるめに。釣った日も、釣れなかった日も。', 'A looser take than the main journal. Days with a catch, and days without.') })}
      <div class="ika-cards">${activity}</div>
      <p class="ika-more"><a href="${assetHref('/journal.html')}">${t(lang, '本気の釣行記録はジャーナルへ →', 'Full trip reports are in the journal →')}</a></p>
    </div>
  </section>

  <!-- ===== 部員の掲示板 ===== -->
  <section class="ika-section ika-section--board" id="voices">
    <div class="wrap">
      ${sectionHead(lang, { num: 'BOARD', en: 'MEMBERS’ BOARD', title: pair('部員の掲示板', 'The members’ board'), note: pair('「現地の声」のうち、イカの投稿だけをここに集めます。仕組みはジャーナルと同じ、見た目だけイカ部仕様。', 'Squid posts from the journal’s field reports, gathered here. Same system, club colours.') })}
      <div class="ika-voices" id="ika-voices" data-lang="${lang}">${samples}</div>
      <p class="ika-more"><a class="ika-btn ika-btn--sea" href="${assetHref('/reports.html')}">${t(lang, 'イカの声を投稿する', 'Post a squid report')}</a></p>
    </div>
  </section>

  <!-- ===== 入部 ===== -->
  <section class="ika-join" id="join">
    <div class="wrap ika-join-inner">
      <img class="ika-join-badge" src="${assetHref('/assets/ikabu/badge_ikaga.png')}" alt="" width="180" height="200" loading="lazy" />
      <div>
        <p class="ika-eyebrow ika-eyebrow--ink"><span class="ika-eyebrow-num">JOIN</span>NO PAPERWORK</p>
        <h2>${t(lang, '入部届は、<br class="sp-only" />いりません。', 'No application form.<br class="sp-only" /> Really.')}</h2>
        <p>${t(lang, 'Instagramをフォローして、イカの投稿に「いかしてる！」と書けば、もう部員です。', 'Follow us on Instagram and leave an “ikashiteru!” on any squid post. That is the whole ceremony.')}</p>
        <div class="ika-cta">
          <a class="ika-btn ika-btn--sea" href="https://www.instagram.com/child_daddy_o3z/" target="_blank" rel="noopener">${t(lang, 'Instagramをフォロー', 'Follow on Instagram')}</a>
          <a class="ika-btn ika-btn--ink" href="${assetHref('/reports.html')}">${t(lang, '掲示板に書く', 'Write on the board')}</a>
        </div>
        <dl class="ika-faq">
          <div class="ika-faq-item">
            <dt><span class="ika-faq-mark" aria-hidden="true">Q</span>${t(lang, '山口県に住んでいないけど、イカ部に入れますか？', 'I don’t live in Yamaguchi. Can I still join?')}</dt>
            <dd><span class="ika-faq-mark" aria-hidden="true">A</span>${t(lang, '山口県に来てイカ釣りを楽しんでくださるなら、あなたも立派な部員です！ステッカーをタックルボックスに貼って、部員であることをアピールしてください！', 'If you come to Yamaguchi and enjoy squid fishing here, you are a proud member! Put our sticker on your tackle box and show everyone you are one of us!')}</dd>
          </div>
          <div class="ika-faq-item">
            <dt><span class="ika-faq-mark" aria-hidden="true">Q</span>${t(lang, 'ステッカーはどこでもらえますか？', 'Where can I get a sticker?')}</dt>
            <dd><span class="ika-faq-mark" aria-hidden="true">A</span>${t(lang, '釣り場で部員に会ったら、声をかけてみてください。県外の方は、InstagramのDMでご相談ください。', 'If you meet a member at the water, just say hi. Outside Yamaguchi? Send us a DM on Instagram.')}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>`;
}
