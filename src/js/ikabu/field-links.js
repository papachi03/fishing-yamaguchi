// エギングの「釣行のまとめ」の下に出す、本物の釣りへの道（ジャーナル本編へのリンク）。2026-10-17 ぱっぱOK
//   GA4 で「イカ部から本編へ何人来たか」を数えるため、リンクに ?from=ikabu-egi を付ける（11/1 の月次レポートで比べる）。
//   utm_ は付けない（サイトの中の移動に付けると、GA4 が別の訪問として数え直してしまう）
//   他のファイルを読み込まない（i18n.js→base.js はビルド時だけの値を読むので node --test で読めない）。アドレスの作り方は呼び出し側から渡す
const t = (lang, ja, en) => (lang === 'en' ? en : ja);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const FIELD_FROM = 'ikabu-egi';

// 釣り方ごとに、2つ目のリンク先を変える（ゲームで遊んだ釣りと、本編の記事をそろえる）
const SECOND = {
  egi: { href: '/guides/autumn-eging.html', ja: '最初にそろえるエギングの道具', en: 'Gear to start egging' },
  jado: { href: '/guides/autumn-eging.html', ja: '最初にそろえるエギングの道具', en: 'Gear to start egging' },
  yaen: { href: '/guides/yaen-beginner.html', ja: 'ヤエン釣りの道具と、春の大型の狙い方', en: 'Yaen gear and how to target big spring squid' },
  tailor: { href: '/spots.html', ja: '山口の釣り場の一覧', en: 'Fishing spots in Yamaguchi' },
};

// 釣り方別の動画ページ（videos.html）の見出しと、カードに出す主役の動画（videos.html の MAIN と同じ）。ふつうのエギングはページの先頭
const VIDEO = {
  jado: { hash: '#jado', id: 'czNLWIHE8CQ', ja: 'ダディの邪道エギング', en: "Daddy's jado eging" },
  yaen: { hash: '#yaen', id: 'TJfAOkytZDE', ja: 'ダディのヤエン釣り', en: "Daddy's yaen fishing" },
  tailor: { hash: '#tailor', id: 'gc1c6fg2hU0', ja: 'ダディのCD式灯火フィッシング', en: "Daddy's CD-style light fishing" },
  egi: { hash: '', id: 'TJfAOkytZDE', ja: 'ダディの実際のイカ釣り', en: "Daddy's real squid fishing" },
};

export const fieldHref = (path, toHref = (p) => p) => `${toHref(path)}?from=${FIELD_FROM}`;

export function fieldLinksHTML(lang, method, toHref = (p) => p) {
  const second = SECOND[method] ?? SECOND.egi;
  const v = VIDEO[method] ?? VIDEO.egi;
  const ja = lang !== 'en';
  const note = ja ? '' : ' <span class="ika-egi-field-lang">(Japanese)</span>';
  return `<div class="ika-egi-field">
        <p class="ika-egi-field-title">${t(lang, '本物の海で釣るなら', 'Fishing the real sea')}</p>
        <ul class="ika-egi-field-links">
          <li class="ika-egi-field-video"><a href="${esc(fieldHref('/videos.html', toHref))}${v.hash}">
            <span class="ika-egi-field-thumb"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" width="320" height="180" loading="lazy" decoding="async" /><span class="ika-egi-field-play" aria-hidden="true"></span></span>
            <span class="ika-egi-field-text"><b>${t(lang, '実際の釣りを動画で見る', 'Watch the real fishing')}</b><small>${esc(ja ? v.ja : v.en)}${note}</small></span>
          </a></li>
          <li><a href="${esc(fieldHref('/sea.html', toHref))}">${t(lang, '今日の本物の萩の海（風・波）', "Today's real sea at Hagi (wind and waves)")}${note}<span aria-hidden="true">→</span></a></li>
          <li><a href="${esc(fieldHref(second.href, toHref))}">${esc(ja ? second.ja : second.en)}${note}<span aria-hidden="true">→</span></a></li>
        </ul>
      </div>`;
}
