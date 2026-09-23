// イカ部の各ページ入口が最初に呼ぶ共通処理。
//   1. GA4（ジャーナルと同じ analytics.js）
//   2. ヘッダー・フッター（ビルド済みなら触らない、dev では埋める）
//   3. main が空なら view で描く（dev モード。ビルド時は prerender-ikabu が書き込み済み）
//   4. 画面に入ったら現れる演出（.ika-reveal）
import '../analytics.js';
import { mountShell } from './shell.js';
import { langFromPath } from './i18n.js';

export function boot(render) {
  const lang = langFromPath(location.pathname);
  const page = document.body.dataset.page || 'index';
  mountShell({ lang, page });

  const main = document.getElementById('main');
  if (main && !main.innerHTML.trim()) main.innerHTML = render(lang);

  initReveal();
  return { lang, page, main };
}

function initReveal() {
  const els = document.querySelectorAll('.ika-reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach((e) => e.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      }
    },
    { threshold: 0.1 }
  );
  els.forEach((e) => io.observe(e));
}
