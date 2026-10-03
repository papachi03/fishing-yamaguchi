// 「ホーム画面に追加」の案内（2026-10-03 ぱっぱ：ここが不便と一番言われている。上下のURLの帯が出たり隠れたりするのも、ホーム画面から開けば消える）
//   スマホのブラウザで開いている時だけ出す。ホーム画面から開いている時（standalone）は出さない
//   見ている環境ごとに手順を変える：
//     LINE・Instagram などアプリの中のブラウザ → まず Safari／Chrome で開く（LINE は openExternalBrowser=1 のリンクで外のブラウザが開く）
//     iPhone の Safari → 共有ボタン → ホーム画面に追加 → 追加
//     Android の Chrome → beforeinstallprompt があればボタン1つで追加。無ければ ⋮ → ホーム画面に追加
import { t, esc } from '../i18n.js';

const KEY_HIDE = 'ikabu.homescreen.hide';   // 「あとで」を押した日（このブラウザだけ・7日は出さない）
const UA = () => navigator.userAgent || '';
export const isStandalone = () => Boolean(navigator.standalone) || matchMedia('(display-mode: standalone)').matches;
export const isIOS = () => /iPhone|iPad|iPod/i.test(UA()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/i.test(UA());
// アプリの中のブラウザ（LINE・Instagram・Facebook・X・Threads）：ホーム画面に追加のメニューが無い
export const inAppOf = () => (/\bLine\//i.test(UA()) ? 'line' : /Instagram/i.test(UA()) ? 'instagram' : /FBAN|FBAV|FB_IAB/i.test(UA()) ? 'facebook' : /Twitter|X\/\d|Barcelona/i.test(UA()) ? 'x' : null);
export const isMobile = () => isIOS() || isAndroid();

let deferredPrompt = null;
if (typeof addEventListener === 'function') addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.querySelectorAll('[data-hs-install]').forEach((b) => { b.hidden = false; }); });

const TX = {
  title: ['ホーム画面に追加すると、もっと遊びやすく', 'Add to your Home Screen'],
  lead: ['上下のバーが出ないので画面いっぱいで遊べて、記録も消えにくくなります。次からはアイコンをタップするだけ。', 'No browser bars, safer records, and one tap to play next time.'],
  how: ['やり方を見る', 'Show me how'],
  later: ['あとで', 'Later'],
  close: ['閉じる', 'Close'],
  added: ['✅ ホーム画面から開いています', '✅ Opened from the Home Screen'],
  // アプリの中のブラウザ
  inapp: {
    line: ['いまはLINEの中のブラウザです。ホーム画面に追加するには、まず Safari（iPhone）か Chrome（Android）で開きます。', 'This is the LINE in-app browser. First open the page in Safari (iPhone) or Chrome (Android).'],
    other: ['いまはアプリの中のブラウザです。ホーム画面に追加するには、まず Safari（iPhone）か Chrome（Android）で開きます。', 'This is an in-app browser. First open the page in Safari (iPhone) or Chrome (Android).'],
    openExt: ['Safari／Chrome で開く', 'Open in Safari / Chrome'],
    manual: ['開かない時は、右上の「…」（または「⋮」）→「他のアプリで開く」「ブラウザで開く」を選んでください。', 'If that does not work, tap “…” (or “⋮”) at the top right → “Open in browser”.'],
    copy: ['URLをコピー', 'Copy URL'],
    copied: ['コピーしました。Safari／Chrome を開いて、アドレス欄に貼り付けてください', 'Copied. Open Safari / Chrome and paste it in the address bar'],
    then: ['開けたら、もう一度この案内を見てください（手順が変わります）', 'Once open there, check this guide again'],
  },
  ios: {
    head: ['iPhone（Safari）での手順', 'On iPhone (Safari)'],
    s1: ['画面の下（または上）の「共有」ボタンをタップ', 'Tap the Share button at the bottom (or top)'],
    s2: ['下にスクロールして「ホーム画面に追加」をタップ', 'Scroll down and tap “Add to Home Screen”'],
    s3: ['右上の「追加」をタップ', 'Tap “Add” at the top right'],
    note: ['Chrome で見ている時は、右上の「…」→「ホーム画面に追加」でも同じです。', 'In Chrome, tap “…” at the top right → “Add to Home Screen”.'],
  },
  android: {
    head: ['Android（Chrome）での手順', 'On Android (Chrome)'],
    install: ['ホーム画面に追加する', 'Add to Home Screen'],
    s1: ['右上の「⋮」をタップ', 'Tap “⋮” at the top right'],
    s2: ['「ホーム画面に追加」（または「アプリをインストール」）をタップ', 'Tap “Add to Home screen” (or “Install app”)'],
    s3: ['「追加」をタップ', 'Tap “Add”'],
  },
  pc: ['スマホで開くと、ホーム画面に追加できます。', 'Open on your phone to add it to the Home Screen.'],
};

const SHARE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3l4 4h-3v8h-2V7H8l4-4zM5 11h3v2H7v7h10v-7h-1v-2h3v11H5V11z" fill="currentColor"/></svg>';
const PLUS_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const MENU_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/></svg>';

const extUrl = () => { const u = new URL(location.href); u.searchParams.set('openExternalBrowser', '1'); return u.toString(); };
const hiddenRecently = () => { try { const d = Number(localStorage.getItem(KEY_HIDE) ?? 0); return Date.now() - d < 7 * 86400e3; } catch { return false; } };

function sheetHTML(lang) {
  const app = inAppOf();
  let body;
  if (app) {
    body = `<p class="ika-hs-p">${t(lang, ...TX.inapp[app === 'line' ? 'line' : 'other'])}</p>
      <a class="ika-btn ika-btn--primary ika-hs-ext" href="${esc(extUrl())}" target="_blank" rel="noopener">${t(lang, ...TX.inapp.openExt)}</a>
      <p class="ika-hs-p ika-hs-small">${t(lang, ...TX.inapp.manual)}</p>
      <button type="button" class="ika-btn" data-hs-copy>${t(lang, ...TX.inapp.copy)}</button><p class="ika-hs-p ika-hs-small" data-hs-copied hidden>${t(lang, ...TX.inapp.copied)}</p>
      <p class="ika-hs-p ika-hs-small">${t(lang, ...TX.inapp.then)}</p>`;
  } else if (isIOS()) {
    body = `<h4 class="ika-hs-h">${t(lang, ...TX.ios.head)}</h4>
      <ol class="ika-hs-steps">
        <li><i>${SHARE_SVG}</i><span>${t(lang, ...TX.ios.s1)}</span></li>
        <li><i>${PLUS_SVG}</i><span>${t(lang, ...TX.ios.s2)}</span></li>
        <li><i><b>追加</b></i><span>${t(lang, ...TX.ios.s3)}</span></li>
      </ol><p class="ika-hs-p ika-hs-small">${t(lang, ...TX.ios.note)}</p>`;
  } else if (isAndroid()) {
    body = `<h4 class="ika-hs-h">${t(lang, ...TX.android.head)}</h4>
      <button type="button" class="ika-btn ika-btn--primary ika-hs-install" data-hs-install ${deferredPrompt ? '' : 'hidden'}>📲 ${t(lang, ...TX.android.install)}</button>
      <ol class="ika-hs-steps">
        <li><i>${MENU_SVG}</i><span>${t(lang, ...TX.android.s1)}</span></li>
        <li><i>${PLUS_SVG}</i><span>${t(lang, ...TX.android.s2)}</span></li>
        <li><i><b>追加</b></i><span>${t(lang, ...TX.android.s3)}</span></li>
      </ol>`;
  } else {
    body = `<p class="ika-hs-p">${t(lang, ...TX.pc)}</p>`;
  }
  return `<div class="ika-hs-sheet" role="dialog" aria-modal="true" aria-label="${t(lang, ...TX.title)}"><div class="ika-hs-sheet-in">
    <button type="button" class="ika-hs-x" data-hs-close aria-label="${t(lang, ...TX.close)}">×</button>
    <div class="ika-hs-icon"><img src="/assets/ikabu/icons/icon-192.png" alt="" width="64" height="64" /><span>イカ部</span></div>
    <h3 class="ika-hs-title">${t(lang, ...TX.title)}</h3>
    <p class="ika-hs-p">${t(lang, ...TX.lead)}</p>
    ${body}
    <button type="button" class="ika-btn ika-hs-done" data-hs-close>${t(lang, ...TX.close)}</button>
  </div></div>`;
}

export function openHomescreenSheet(lang = 'ja') {
  document.querySelector('.ika-hs-sheet')?.remove();
  document.body.insertAdjacentHTML('beforeend', sheetHTML(lang));
  const sh = document.querySelector('.ika-hs-sheet');
  const close = () => sh.remove();
  sh.addEventListener('click', (e) => { if (e.target === sh || e.target.closest('[data-hs-close]')) close(); });
  sh.querySelector('[data-hs-copy]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href.replace(/[?&]openExternalBrowser=1/, '')); sh.querySelector('[data-hs-copied]').hidden = false; } catch { prompt('URL', location.href); } });
  sh.querySelector('[data-hs-install]')?.addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); const r = await deferredPrompt.userChoice.catch(() => null); deferredPrompt = null; if (r?.outcome === 'accepted') close(); });
  return { close };
}

// 案内の札：compact=true は小さな1行（ゲームのページ用）、false は TOP の大きな札
export function mountHomescreen(anchor, { lang = 'ja', compact = false, force = false } = {}) {
  if (!anchor) return null;
  if (!force && (!isMobile() || isStandalone())) return null;
  if (!force && compact && hiddenRecently()) return null;
  const el = document.createElement('div');
  el.className = compact ? 'ika-hs ika-hs--compact' : 'wrap ika-hs';
  el.innerHTML = compact
    ? `<button type="button" class="ika-hs-pill" data-hs-open>📲 <b>${t(lang, 'ホーム画面に追加', 'Add to Home Screen')}</b><span>${t(lang, '上下のバーなしで遊べます', 'play without browser bars')}</span></button><button type="button" class="ika-hs-later" data-hs-later aria-label="${t(lang, ...TX.later)}">×</button>`
    : `<div class="ika-hs-card"><img src="/assets/ikabu/icons/icon-192.png" alt="" width="56" height="56" /><div><b>📲 ${t(lang, ...TX.title)}</b><p>${t(lang, ...TX.lead)}</p><button type="button" class="ika-btn ika-btn--primary" data-hs-open>${t(lang, ...TX.how)}</button></div></div>`;
  anchor.insertAdjacentElement(compact ? 'afterbegin' : 'afterend', el);
  el.querySelector('[data-hs-open]').addEventListener('click', () => openHomescreenSheet(lang));
  el.querySelector('[data-hs-later]')?.addEventListener('click', () => { try { localStorage.setItem(KEY_HIDE, String(Date.now())); } catch {} el.remove(); });
  return el;
}
