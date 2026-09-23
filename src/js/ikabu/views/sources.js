// sources：ページの見出しだけ本物、中身は準備中（第2段階で入る）。
import { pair } from '../i18n.js';
import { pageHead, comingSoon } from './parts.js';

export const HEAD = {
  num: '',
  eyebrow: 'SOURCES & CREDITS',
  title: pair('情報にも、写真にも、出どころを。', "Every fact and photograph has a source."),
  desc: pair('写真・地図・海況・生きものの出典一覧。', "Credits for photographs, maps, forecasts and wildlife information."),
};

export function render(lang) {
  return pageHead(lang, HEAD) + comingSoon(lang, 'sources', pair('各ページの中身と一緒に、出典をここに集めます。', "Sources are collected here as each page fills in."));
}
