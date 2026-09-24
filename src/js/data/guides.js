// 攻略記事（guides/*.html）の一覧。SEAの「今月の旬」から、季節の合う記事へリンクする。
// 記事を足したら、ここと vite.config.js の input と public/sitemap.xml の3か所に書く。
export const guides = [
  {
    slug: 'autumn-eging',
    title: '山口で秋の新子アオリを狙う、エギング道具一式',
    months: [9, 10, 11],
  },
];

export const guideHref = (g) => `/guides/${g.slug}.html`;
export const guidesForMonth = (month) => guides.filter((g) => g.months.includes(month));
