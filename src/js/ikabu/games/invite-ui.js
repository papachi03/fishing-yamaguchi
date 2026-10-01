// 友だち紹介キャンペーン（2026-10-01 ぱっぱ）。テストプレイ中だけ、あそび場の注意書きの下に出す。
//   ・「友だちに紹介」ボタン → スマホの共有画面（navigator.share）で公式LINEの友だち追加リンクを送る
//   ・送り終えたら🎫2枚。1人（ブラウザ）5回まで＝合計10枚（tickets.js の earnInvite）
//   ・共有画面の無い端末は LINE の「送る」画面を開くリンク（送ったかは分からないので、開いた時点で付ける）
//   ・本当に友だちに届いたか・追加したかまでは確かめられない（LINE がその情報を出さないため）。上限10枚で割り切る
import { t } from '../i18n.js';
import { IS_TRIAL } from '../views/trial-notice.js';
import { readTickets, INVITE_MAX, INVITE_BONUS, inviteLeft } from './tickets.js';

export const LINE_ADD_URL = 'https://lin.ee/YiK3hIJ';   // 山口イカ部 公式LINE（募集画像のQRと同じ）

export const INVITE_TEXT = {
  title: (lang) => (lang === 'en' ? '📣 Invite a friend, get 🎫 2' : '📣 友だちに紹介して🎫2枚'),
  lead: (lang) => (lang === 'en'
    ? `Share the official LINE link with a friend who might like the test play. 🎫 ${INVITE_BONUS} per share, up to ${INVITE_MAX} times (🎫 ${INVITE_BONUS * INVITE_MAX} in total).`
    : `テストプレイに誘いたい友だちに、公式LINEのリンクを送ってください。1回で🎫${INVITE_BONUS}枚、${INVITE_MAX}回まで（合計🎫${INVITE_BONUS * INVITE_MAX}枚）。`),
  btn: (lang) => (lang === 'en' ? '📣 Invite a friend' : '📣 友だちに紹介する'),
  left: (lang, n) => (n > 0 ? (lang === 'en' ? `${n} more time${n > 1 ? 's' : ''}` : `あと ${n} 回`) : lang === 'en' ? 'All done. Thank you!' : '5回ぜんぶ使いました。ありがとう！'),
  share: (lang) => ({
    title: lang === 'en' ? 'Yamaguchi Ika Club: test play' : '山口イカ部 テストプレイ',
    text: lang === 'en'
      ? `Yamaguchi Ika Club's games are in test play! Eging, puzzles and a card gacha 🦑 Join from the official LINE: ${LINE_ADD_URL}`
      : `山口イカ部のゲーム、テストプレイ中！エギング・パズル・カードガチャが遊べるよ🦑 公式LINEから参加できます → ${LINE_ADD_URL}`,
  }),
  done: (lang) => (lang === 'en' ? 'Thanks for sharing!' : '紹介ありがとう！'),
  cancel: (lang) => (lang === 'en' ? 'Share cancelled.' : '送らずに閉じました。'),
  copied: (lang) => (lang === 'en' ? 'Copied. Paste it to a friend in LINE.' : 'コピーしました。LINEで友だちに貼り付けて送ってください。'),
};

export function inviteHTML(lang) {
  const T = INVITE_TEXT;
  return `<div class="wrap"><section class="ika-invite" id="ika-invite" aria-label="${T.title(lang)}">
    <p class="ika-invite-title">${T.title(lang)}</p>
    <p class="ika-invite-lead">${T.lead(lang)}</p>
    <div class="ika-invite-row">
      <button type="button" class="ika-btn ika-btn--primary ika-invite-btn" data-invite>${T.btn(lang)}</button>
      <span class="ika-invite-left" data-invite-left></span>
    </div>
    <p class="ika-invite-msg" data-invite-msg role="status" aria-live="polite"></p>
  </section></div>`;
}

// テストプレイ版だけ、注意書き（.ika-trial-note）の直後に出す
export function mountInvite(lang, { trialOnly = true } = {}) {
  if (trialOnly && !IS_TRIAL) return null;
  if (document.getElementById('ika-invite')) return null;
  const note = document.querySelector('.ika-trial-note')?.closest('.wrap');
  (note ?? document.querySelector('main'))?.insertAdjacentHTML(note ? 'afterend' : 'afterbegin', inviteHTML(lang));
  const root = document.getElementById('ika-invite');
  const btn = root.querySelector('[data-invite]');
  const left = root.querySelector('[data-invite-left]');
  const msg = root.querySelector('[data-invite-msg]');
  const T = INVITE_TEXT;
  const render = () => {
    const n = inviteLeft(readTickets());
    left.textContent = T.left(lang, n);
    btn.disabled = n <= 0;
  };
  const earn = () => dispatchEvent(new CustomEvent('ikabu:game', { detail: { game: 'invite', counted: true } }));
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy || inviteLeft(readTickets()) <= 0) return;
    busy = true;
    msg.textContent = '';
    const s = T.share(lang);
    try {
      if (navigator.share) {
        await navigator.share({ title: s.title, text: s.text });   // 送り終えると resolve、閉じると AbortError
        earn();
        msg.textContent = T.done(lang);
      } else {
        // 共有画面が無い（PCなど）：LINEの「送る」画面を新しいタブで開き、本文もコピーしておく
        window.open(`https://line.me/R/share?text=${encodeURIComponent(s.text)}`, '_blank', 'noopener');
        try { await navigator.clipboard?.writeText(s.text); } catch { /* コピーできなくてもよい */ }
        earn();
        msg.textContent = T.done(lang);
      }
    } catch (e) {
      msg.textContent = e?.name === 'AbortError' ? T.cancel(lang) : T.cancel(lang);
    } finally {
      busy = false;
      render();
    }
  });
  addEventListener('ikabu:tickets', render);
  render();
  return { render };
}
