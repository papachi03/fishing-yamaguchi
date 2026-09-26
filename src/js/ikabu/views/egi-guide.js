// egi-guide：記事「部員おすすめ：新子シーズンのエギ選び」。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// タイプの切り替え（マズメ／日中／夜間）は pages/egi-guide.js。アフィリエイトのリンクは AFFILIATE_ON が true になるまで出さない
import { t, pair, esc, pageHref } from '../i18n.js';
import { pageHead, sectionHead, chipsHTML, noteHTML } from './parts.js';
import { ytHTML } from '../yt-facade.js';
import { AFFILIATE_ON, GUIDE_VIDEO_ID, SERIES, BASES, TYPES, TYPE_NOTES, EGIS } from '../egi-guide-data.js';
import { amazonUrl, rakutenUrl, AMAZON_DISCLOSURE } from '../../config/affiliate.js';

export const HEAD = {
  num: '06',
  eyebrow: "MEMBERS' PICK",
  title: pair('部員おすすめ：新子シーズンのエギ選び', "Members' pick: choosing egi for young-squid season"),
  desc: pair('秋の新子（その年に生まれたアオリイカ）ねらいのエギを、号数と色で。ヤマシタ「エギ王K」とデュエル「パタパタ」から、時間帯別に選びました。', 'Egi for autumn’s young bigfin reef squid, by size and color. Picked from YAMASHITA Egi-O K and DUEL PataPata, by time of day.'),
};

// 横から見たエギの絵。背中の色（back）と下地（base）の2色
const egiArt = (e, i) => {
  const id = `ika-eg-${i}`;
  const base = BASES[e.base].color;
  return `<svg class="ika-guide-egi" viewBox="0 0 120 44" width="120" height="44" aria-hidden="true" focusable="false">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e.back}"/><stop offset="0.55" stop-color="${e.back}"/><stop offset="0.62" stop-color="${base}"/><stop offset="1" stop-color="${base}"/></linearGradient></defs>
    <path d="M8,22 Q14,8 40,8 L88,10 Q98,12 100,22 Q98,32 88,34 L40,36 Q14,36 8,22 Z" fill="url(#${id})" stroke="#16233a" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M30,14 Q34,22 30,30 M48,13 Q52,22 48,31 M66,13 Q70,22 66,31" stroke="rgba(255,255,255,.45)" stroke-width="1.6" fill="none"/>
    <circle cx="20" cy="19" r="3.2" fill="#fff" stroke="#16233a" stroke-width="1.6"/><circle cx="20" cy="19" r="1.4" fill="#16233a"/>
    <path d="M14,28 L4,36" stroke="#16233a" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M100,22 L112,22 M104,22 L114,15 M104,22 L114,29 M108,22 L117,18 M108,22 L117,26" stroke="#16233a" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;
};

const shopLinks = (lang, e) => {
  if (!AFFILIATE_ON) return '';
  return `<p class="ika-guide-shop">
      <a class="ika-guide-shopbtn ika-guide-shopbtn--amazon" href="${esc(amazonUrl(e))}" target="_blank" rel="sponsored noopener">${t(lang, 'Amazonで探す', 'Find on Amazon')}</a>
      <a class="ika-guide-shopbtn ika-guide-shopbtn--rakuten" href="${esc(rakutenUrl(e))}" target="_blank" rel="sponsored noopener">${t(lang, '楽天市場で探す', 'Find on Rakuten')}</a>
    </p>`;
};

const egiCard = (lang, e, i) => `
      <li class="ika-guide-card" data-type="${e.type}">
        <div class="ika-guide-card-art">${egiArt(e, i)}</div>
        <p class="ika-guide-card-series">${t(lang, SERIES[e.series].name)}</p>
        <p class="ika-guide-card-name">${t(lang, e.name)} <span class="ika-guide-card-code">${esc(e.code)}</span></p>
        <p class="ika-guide-card-tags">
          <span class="ika-guide-base" style="--b:${BASES[e.base].color}"><i aria-hidden="true"></i>${t(lang, BASES[e.base].label)}</span>
          <span class="ika-guide-badge">${e.used ? t(lang, '部員愛用', 'Member’s favorite') : t(lang, '部員おすすめ', "Members' pick")}</span>
        </p>
        <p class="ika-guide-card-why">${t(lang, e.why)}</p>
        ${shopLinks(lang, e)}
      </li>`;

const videoHTML = (lang) => {
  if (!GUIDE_VIDEO_ID) {
    return `<div class="ika-yt ika-yt--soon"><p><span class="ika-yt-tag">${t(lang, '解説動画', 'Video')}</span>${t(lang, 'この記事の解説動画は準備中です。', 'The video for this article is coming soon.')}</p></div>`;
  }
  return ytHTML(lang, { id: GUIDE_VIDEO_ID, poster: '/assets/ikabu/egi-guide-poster.jpg', label: pair('解説動画を再生', 'Play the video') });
};

const SIZE_ROWS = [
  [pair('9月〜10月前半', 'September to mid-October'), '2.5', pair('イカがまだ小さい。沈むのもゆっくりで、浅い所を探りやすい', 'The squid are still small. It sinks slowly and suits shallow water')],
  [pair('10月後半〜11月', 'Late October to November'), '3.0', pair('イカが育ってくる。遠くへ投げやすく、風にも強い', 'The squid have grown. It casts farther and handles wind')],
  [pair('風が強い日・深い所', 'Windy days, deep water'), '3.0+', pair('3.0号を基本に、重めのものや沈むのが速いタイプ', 'Start at #3.0; choose heavier or faster-sinking models')],
];

const BACK_ROWS = [
  ['#f28c28', pair('オレンジ・ピンク', 'Orange, pink'), pair('目立つ。マズメや濁り', 'Stands out. Dawn, dusk, murky water')],
  ['#7c7a3a', pair('茶・緑・オリーブ', 'Brown, green, olive'), pair('自然な色。澄んだ日中、イカがスレているとき', 'Natural. Clear daytime water, wary squid')],
  ['#5a3a6a', pair('紫・暗い色', 'Purple, dark'), pair('夜にシルエットがはっきりする', 'A clear silhouette at night')],
];

const BASE_NOTES = {
  gold: pair('晴れて水が澄んだ日中に、キラッと光って目立つ', 'Flashes in clear water on sunny days'),
  red: pair('暗いと黒っぽいシルエットになる。マズメ・夜・濁りに強い', 'Turns into a dark silhouette in low light. Good at dawn, dusk, night and in murky water'),
  keimura: pair('紫外線で青白く光る。朝夕・曇り・月夜に強い', 'Glows bluish-white under UV. Good at dawn, dusk, on cloudy days and moonlit nights'),
  glow: pair('暗い所でぼんやり光る。月の無い夜・深い所向け', 'Glows softly in the dark. For moonless nights and deep water'),
};

export function render(lang) {
  const types = [['all', pair('ぜんぶ', 'All')], ...TYPES];
  return `${pageHead(lang, HEAD)}
  <article class="ika-guide">
    <section class="ika-section ika-guide-top">
      <div class="wrap">
        ${AFFILIATE_ON ? `<p class="ika-guide-pr">${t(lang, '広告', 'Ad')}｜${t(lang, 'この記事には広告（アフィリエイトリンク）が含まれます。', 'This article contains affiliate links.')}</p>` : ''}
        ${videoHTML(lang)}
        ${noteHTML(lang, { label: pair('この記事について', 'About this article'), tone: 'orange', html: `<p>${t(lang, '山口イカ部の部員が、釣具屋さんで迷ったことから作った「候補」の一覧です。まだ実際の釣りで確かめたものではありません。釣れた色は「部員愛用」として書き足していきます。', 'A list of candidates put together by a club member who got lost in the tackle shop aisle. Not yet proven on the water; colors that catch will be marked as a member’s favorite.')}</p>` })}
      </div>
    </section>

    <section class="ika-section ika-section--tint">
      <div class="wrap">
        ${sectionHead(lang, { num: '01', en: 'THE SEASON', title: pair('新子シーズンとは', 'What is young-squid season?') })}
        <p class="ika-guide-p">${t(lang, '山口・日本海側では9〜11月。春に生まれたアオリイカが100〜800gくらいに育ち、堤防の浅い所に群れでいます。数が多く好奇心も強いので、エギングを始めるのに一番いい季節。ただ、まだ小さいのでエギの大きさ選びが大事です。', 'On the Sea of Japan side of Yamaguchi, it runs from September to November. Squid born in spring have grown to about 100–800 g and school in the shallows along the breakwaters. They are plentiful and curious, which makes this the best season to start eging, but they are still small, so egi size matters.')}</p>
      </div>
    </section>

    <section class="ika-section">
      <div class="wrap">
        ${sectionHead(lang, { num: '02', en: 'SIZE', title: pair('号数の選び方', 'Choosing a size'), note: pair('エギ王Kは2.5号と3.0号で同じ色がそろっているので、色はそのまま号数だけ替えられます。', 'Egi-O K comes in the same colors in #2.5 and #3.0, so you can keep the color and just change size.') })}
        <div class="ika-guide-sizes">
          ${SIZE_ROWS.map(([when, size, why]) => `<div class="ika-guide-size"><p class="ika-guide-size-when">${t(lang, when)}</p><p class="ika-guide-size-num">${size}<small>${t(lang, '号', '')}</small></p><p class="ika-guide-size-why">${t(lang, why)}</p></div>`).join('')}
        </div>
      </div>
    </section>

    <section class="ika-section ika-section--tint">
      <div class="wrap">
        ${sectionHead(lang, { num: '03', en: 'COLOR', title: pair('色の考え方：下地と背中の色', 'Color: base tape and back cloth'), note: pair('下地（布の下に貼ってあるテープ）は「光ったときの見え方」、背中の色（布の色）は「どれだけ目立たせるか」。', 'The base tape under the cloth decides how it shines; the cloth color decides how much it stands out.') })}
        <div class="ika-guide-colors">
          <div>
            <h3 class="ika-guide-h3">${t(lang, '下地', 'Base tape')}</h3>
            <ul class="ika-guide-list">
              ${['gold', 'red', 'keimura', 'glow'].map((b) => `<li><span class="ika-guide-sw" style="--b:${BASES[b].color}" aria-hidden="true"></span><b>${t(lang, BASES[b].label)}</b>：${t(lang, BASE_NOTES[b])}</li>`).join('')}
            </ul>
          </div>
          <div>
            <h3 class="ika-guide-h3">${t(lang, '背中の色', 'Back cloth')}</h3>
            <ul class="ika-guide-list">
              ${BACK_ROWS.map(([c, name, why]) => `<li><span class="ika-guide-sw" style="--b:${c}" aria-hidden="true"></span><b>${t(lang, name)}</b>：${t(lang, why)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="ika-section" id="picks">
      <div class="wrap">
        ${sectionHead(lang, { num: '04', en: 'THREE TYPES', title: pair('3タイプ別のおすすめ', 'Picks for three kinds of angler'), note: pair('いつ釣りに行くことが多いかで選んでください。どれも3.0号・2.5号があります。', 'Choose by when you usually fish. All come in #3.0 and #2.5.') })}
        ${chipsHTML(lang, types, { attr: 'type', current: 'all', label: pair('時間帯で絞り込む', 'Filter by time of day'), id: 'ika-guide-types' })}
        ${TYPES.map(([k, name]) => `
        <div class="ika-guide-group" data-type="${k}">
          <h3 class="ika-guide-group-name">${t(lang, name)}</h3>
          <p class="ika-guide-group-note">${t(lang, TYPE_NOTES[k])}</p>
          <ul class="ika-guide-cards">${EGIS.map((e, i) => (e.type === k ? egiCard(lang, e, i) : '')).join('')}
          </ul>
        </div>`).join('')}
        <p class="ika-guide-small">${t(lang, '※色の絵は見た目のイメージで、実物の色とは違います。品番・色名はメーカー公式の3.0号のラインナップで確かめたもの（2026年9月）。', '* The drawings are impressions, not the real colors. Codes and names checked against the makers’ official #3.0 line-ups (September 2026).')}</p>
      </div>
    </section>

    <section class="ika-section ika-section--tint">
      <div class="wrap">
        ${sectionHead(lang, { num: '05', en: 'ROTATION', title: pair('カラーローテーション', 'Rotating colors') })}
        <ul class="ika-guide-list ika-guide-list--steps">
          <li>${t(lang, '同じ色で2投反応がなければ、色を替える。', 'No interest after two casts? Change color.')}</li>
          <li>${t(lang, '明るい色→暗い色、目立つ色→自然な色と、系統を変えるのがコツ。', 'Switch families: bright to dark, loud to natural.')}</li>
          <li>${t(lang, '釣れたら、その色はしばらく投げ続ける。', 'When one catches, keep throwing it for a while.')}</li>
        </ul>
      </div>
    </section>

    <section class="ika-section">
      <div class="wrap">
        ${noteHTML(lang, { label: pair('新子は来年の親イカ', 'Today’s young squid, next spring’s adults'), html: `<p>${t(lang, '新子は来年の春に大きな親イカになります。持ち帰るのは食べる分だけ。小さいイカは海へ返しましょう。', 'The young squid grow into next spring’s big adults. Keep only what you will eat and return the small ones.')}</p>` })}
        <p class="ika-guide-p">${t(lang, '同じ色の考え方は、イカ部のエギングゲーム「しゃくって抱かせろ！」でも試せます。', 'You can try the same color ideas in the club’s eging game, “Jerk, fall, hug!”.')} <a class="ika-guide-link" href="${pageHref('egi', lang)}">${t(lang, 'ゲームで試す', 'Try it in the game')} →</a></p>
        ${AFFILIATE_ON ? `<p class="ika-guide-small">${esc(AMAZON_DISCLOSURE)}</p>` : ''}
      </div>
    </section>
  </article>`;
}
