// Google Analytics 4（アクセス数の計測）。
//
// 測定IDはここだけで管理する。別サイト（Tproject等）とは必ず別のIDを使う
//   （同じIDを使い回すと2サイトの数字が混ざって区別できなくなる）。
// GA4の管理画面 → 管理 → データストリーム → 該当ストリーム で確認できる。
//
// ★2026-09-12 差し替え：G-2SEH5VC55N → G-N7Z63YVGEH
//   最初は Tproject と同じプロパティ（tproject-site）に2本目のストリームとして作ってしまい、
//   GA4のリアルタイムはプロパティ単位なので2サイトの数字が混ざって見えた。
//   釣りサイト専用プロパティ「YAMAGUCHI FISHING JOURNAL」を新規作成し、そのIDに変更。
//   **サイトごとに別プロパティにする**のが正解（同一プロパティに複数サイトを入れない）。
//
// 計測されるもの：訪問者数 / ページ別の閲覧数 / 流入元 / デバイス / 時間帯 /
//   外部リンクのクリック（YouTube・Instagram・Amazon・楽天）。
//   外部リンクは GA4 の「拡張計測機能 → 離脱クリック」で自動的に outbound_click として入る。
//   個別の実装は不要だが、GA4側でこの機能がオンになっていることが前提。
// 計測されないもの：クリックした人が実際にチャンネル登録・購入したか
//   （それは YouTube Studio・アソシエイトの管理画面側の数字）。

const GA_ID = 'G-N7Z63YVGEH';

// localhost での開発中は送信しない（自分のアクセスで数字が汚れるのを防ぐ）
const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

if (GA_ID && !isLocal) {
  window.dataLayer = window.dataLayer || [];
  // gtag は arguments をそのまま積む仕様なのでアロー関数にはしない
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  gtag('js', new Date());
  gtag('config', GA_ID);
}
