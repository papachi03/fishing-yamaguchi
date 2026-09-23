// 山口イカ部の日英対訳とURLの決まり。
// ブラウザのAPI（window / document）には触らない：ビルド時（prerender-ikabu）でも同じ関数を使うため。
import { url } from '../base.js';

// 対訳を1つの値にまとめる。t() に渡すと言語に合わせて片方を返す
export const pair = (ja, en) => ({ ja, en });

// 言語はパスで決まる：/ikabu/en/ 配下だけ英語
export const langFromPath = (pathname = '') => (/\/ikabu\/en(\/|$)/.test(pathname) ? 'en' : 'ja');

// t(lang, pair) でも t(lang, '日本語', 'English') でも使える
export const t = (lang, a, b) => {
  if (a && typeof a === 'object') return a[lang] ?? a.ja ?? '';
  return lang === 'en' ? (b ?? a ?? '') : (a ?? '');
};

// 利用者の文字や外部データは必ずここを通してから HTML に入れる
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ページ名 → ルート基準のURL（/ikabu/、/ikabu/map.html、/ikabu/en/、/ikabu/en/map.html）
export const pageUrl = (page = 'index', lang = 'ja') =>
  `/ikabu/${lang === 'en' ? 'en/' : ''}${page === 'index' ? '' : `${page}.html`}`;

// 画面に出す用（サイトのベースパス付き）。ビルド時は vite の base、ブラウザでは import.meta.env.BASE_URL で同じ値になる
export const pageHref = (page, lang) => url(pageUrl(page, lang));
export const assetHref = (p) => url(p);

// 7つの部活動（ヘッダーのナビ・トップの入口カード・フッターで共有）
export const SECTIONS = [
  { page: 'map', num: '01', label: pair('山口マップ', 'Map'), en: 'MAP' },
  { page: 'sea', num: '02', label: pair('風と波', 'Sea conditions'), en: 'SEA' },
  { page: 'recipes', num: '03', label: pair('イカ食堂', 'Recipes'), en: 'KITCHEN' },
  { page: 'atlas', num: '04', label: pair('世界のイカ', 'Squid atlas'), en: 'ATLAS' },
  { page: 'gallery', num: '05', label: pair('写真部', 'Gallery'), en: 'PHOTO' },
  { page: 'play', num: '06', label: pair('イカ部のあそび場', 'Play'), en: 'PLAY' },
  { page: 'studio', num: '07', label: pair('スタンプとSNS', 'Stickers & social'), en: 'STUDIO' },
];

// recipe（1品のページ）はナビ上は recipes の子として扱う
export const navPageOf = (page) => (page === 'recipe' ? 'recipes' : page);
