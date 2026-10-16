// ストーリーモードの画面（2026-10-03）。章の一覧 → 会話（前口上）→ 対戦（battle-ui.js の openBattle に story を渡す）→ 会話（勝ち／負け）→ 章の一覧
//   進み具合：story.js（ikabu.story.v1）。🎫は初回クリアだけ+2（'ikabu:game' に game:'story' を投げ、tickets-ui.js が付ける）
//   絵：public/assets/ikabu/story/{chars,bg}。会話の窓は画面の部品（半透明の紺＋白枠。名前の札は不透明＝ぱっぱ 10/3）
import { t, esc, assetHref } from '../i18n.js';
import { utcDay } from './rng.js';
import CARDS from './cards-data.json';
import { CHAPTERS, CHARS, BATTLES_BY_CH, deckNos, RULE_TEXT } from './story-data.js';
import { SCRIPTS, CALLS } from './story-script.js';
import { readStory, writeStory, heroName, fillName, cleanName, nextBattle, canPlay, isCleared, hintReady, recordWin, recordLoss, chapterCleared, markChapterCleared, NAME_MAX, STORY_TICKETS } from './story.js';
import { IS_TRIAL } from '../views/trial-notice.js';   // 試遊版だけ（本番には出ない）
import { openBattle } from './battle-ui.js';
import { createGachaAudio } from './gacha-audio.js';
import { readJSON, writeJSON } from './records.js';

// 曲（Suno・ぱっぱ 2026-10-03）。音量は対戦の曲（0.18）と同じくらい。ループの位置は bgm/analyze.py で測った拍の位置（99.4bpm・8小節＝19.32秒）
const STORY_AUDIO = {
  talk: { src: '/assets/ikabu/audio/story/story_talk.mp3', loop: true, loopStart: 5.36, loopEnd: 101.96, volume: 0.16 },       // ふだんの会話・章の一覧（2小節のイントロの後から5周）
  tense: { src: '/assets/ikabu/audio/story/story_tense.mp3', loop: true, loopStart: 3.18, loopEnd: 119.1, volume: 0.16 },      // ライバル戦・試験の前口上
  ending: { src: '/assets/ikabu/audio/story/story_ending.mp3', loop: false, volume: 0.18 },                                     // エピローグ前半（達成感）
  ending2: { src: '/assets/ikabu/audio/story/story_ending.mp3', loop: false, offset: 113, volume: 0.18 },                       // 後半（四天王の登場・音が沈む所から）
  don: { src: '/assets/ikabu/audio/gacha/se_don.mp3', volume: 0.7 },                                                            // 「勝負だ！」でVS
};
const KEY_SOUND = 'ikabu.battle.sound';   // 対戦の🔊と同じ切替
// 章ごと：緊張の曲を流す戦／プロローグを見たかの記録（このブラウザだけ）／エピローグの背景（2026-10-15 第2章を足して章ごとに）
const TENSE_BATTLES = { 1: new Set([8, 9]), 2: new Set([3, 8, 9]), 3: new Set([3, 5, 8, 9]) };
const KEY_SEEN_CH = { 1: 'ikabu.story.seen', 2: 'ikabu.story.seen.ch2', 3: 'ikabu.story.seen.ch3' };
const EPILOGUE_BG = { 1: 'bushitsu', 2: 'iso_yoake', 3: 'akatoudai_yoake' };
const openChapters = (story) => CHAPTERS.filter((c) => c.count > 0 && (c.id === 1 || chapterCleared(story, c.id - 1, CHAPTERS[c.id - 2].count)));

const charSrc = (id, face) => assetHref(`/assets/ikabu/story/chars/${id}_${face}.webp`);
const bgSrc = (id) => assetHref(`/assets/ikabu/story/bg/${id}.webp`);
const nameOf = (lang, id, hero) => fillName(t(lang, ...(CHARS[id]?.name ?? ['', ''])), hero);

const TX = {
  title: ['ストーリー', 'Story'],
  lead: ['新子の{name}が、名誉部員証を目指して勝ち上がる。勝つと🎫2（初めての時だけ）', '{name} the rookie squid climbs toward honorary membership. Win 🎫2 (first clear only)'],
  nameLabel: ['主人公の名前（8文字まで・空なら「アオ」）', 'Hero name (up to 8, blank = Ao)'],
  nameSave: ['決める', 'Set'],
  wip: ['工事中', 'Coming soon'],
  locked: ['🔒', '🔒'],
  cleared: ['✔ クリア', '✔ Cleared'],
  next: ['▶ いま挑める', '▶ Up next'],
  replay: ['もう一度', 'Replay'],
  challenge: ['挑む', 'Fight'],
  skip: ['とばす ≫', 'Skip ≫'],
  tap: ['▼', '▼'],
  start: ['勝負だ！', 'Fight!'],
  toList: ['章の一覧へ', 'Back to chapters'],
  hintTag: ['ヒント', 'Hint'],
  ruleOk: ['わかった', 'OK'],
  stars: (n) => '★'.repeat(n) + '☆'.repeat(5 - n),
  gotTickets: (lang, n) => (lang === 'en' ? `🎫 +${n} (first clear)` : `🎫 ${n}枚ゲット！（初クリア）`),
  chapterDone: { 1: ['第1章 クリア！ 正式部員証を手に入れた', 'Chapter 1 cleared! You earned full membership'], 2: ['第2章 クリア！ エリート章を手に入れた', 'Chapter 2 cleared! You earned the elite badge'], 3: ['第3章 クリア！ 四天王の印を2つ手に入れた', 'Chapter 3 cleared! You earned two Big Four seals'] },
  trialSkip: ['🧪 試遊版だけ：第1章をクリアしたことにする（🎫は増えません）', '🧪 Trial only: mark chapter 1 as cleared (no tickets)'],
  trialSkipped: ['第1章をクリアしたことにしました。第2章が開きました', 'Chapter 1 marked as cleared. Chapter 2 is open'],
  lockedCh: (lang, n) => (lang === 'en' ? `🔒 Clear chapter ${n} to unlock` : `🔒 第${n}章をクリアすると開きます`),
};

export function mountStoryButton(root, { lang = 'ja' } = {}) {
  if (!root) return null;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'ika-story-entry'; btn.setAttribute('data-story-open', '');
  const sync = () => {
    const s = readStory(); const chs = openChapters(s); const c = chs[chs.length - 1]; const n = nextBattle(s, c.id, c.count);
    btn.innerHTML = `<span class="ika-story-entry-tag">${t(lang, 'NEW', 'NEW')}</span><b>📖 ${t(lang, ...TX.title)}</b><small>${n ? t(lang, `第${c.id}章 ・ 第${n}戦まで進行中`, `Chapter ${c.id} · battle ${n}`) : t(lang, `第${c.id}章 クリア済み`, `Chapter ${c.id} cleared`)}</small>`;
  };
  sync();
  btn.addEventListener('click', () => openStory({ lang, onClose: sync }));
  root.prepend(btn);
  return { sync };
}

// 章の一覧（全画面）
export function openStory({ lang = 'ja', onClose = null } = {}) {
  const ov = document.createElement('div');
  ov.className = 'ika-st';
  document.body.appendChild(ov);
  document.documentElement.classList.add('is-battle');
  let story = readStory();
  const audio = createGachaAudio({ on: readJSON(KEY_SOUND) ?? true, href: assetHref, tracks: STORY_AUDIO });
  audio.unlock(); audio.bgm('talk');
  const close = () => { audio.stopBgm(0.6); audio.stopAllSe(); ov.remove(); document.documentElement.classList.remove('is-battle'); onClose?.(); };

  function list() {
    document.documentElement.classList.add('is-battle');   // 対戦から戻った時も、サイトの帯を隠したままに（念のため）
    story = readStory();
    const hero = heroName(story);
    const opened = new Set(openChapters(story).map((c) => c.id));
    const chapterHTML = (c) => {
      const head = `<h3><span class="ika-st-chno">${t(lang, `第${c.id}章`, `Ch. ${c.id}`)}</span>${t(lang, ...c.title)}<small>${t(lang, 'ゴール', 'Goal')}：${t(lang, ...c.goal)}</small></h3>`;
      if (c.count === 0) return `<section class="ika-st-ch is-wip">${head}<p class="ika-st-wip">🚧 ${t(lang, ...TX.wip)}</p></section>`;
      if (!opened.has(c.id)) return `<section class="ika-st-ch is-wip">${head}<p class="ika-st-wip">${TX.lockedCh(lang, c.id - 1)}</p>${IS_TRIAL && c.id === 2 ? `<button type="button" class="ika-btn" data-trial-skip>${t(lang, ...TX.trialSkip)}</button>` : ''}</section>`;
      const nxt = nextBattle(story, c.id, c.count);
      return `<section class="ika-st-ch is-open">${head}
        <ol class="ika-st-battles">${BATTLES_BY_CH[c.id].map((b) => {
          const done = isCleared(story, c.id, b.i), ok = canPlay(story, c.id, b.i, c.count);
          return `<li class="ika-st-b${done ? ' is-done' : ''}${nxt === b.i ? ' is-next' : ''}${ok ? '' : ' is-locked'}">
            <button type="button" ${ok ? `data-ch="${c.id}" data-battle="${b.i}"` : 'disabled'}>
              <img class="ika-st-b-face" src="${ok ? charSrc(b.foe, 'normal') : ''}" alt="" ${ok ? '' : 'hidden'} />
              <span class="ika-st-b-body"><b>${t(lang, `第${b.i}戦`, `Battle ${b.i}`)}　${ok ? esc(nameOf(lang, b.foe, hero)) : '？？？'}</b><small>${ok ? `${t(lang, ...b.rank)} ・ ${t(lang, ...b.place)}` : '　'}</small><i>${TX.stars(b.stars)}</i></span>
              <span class="ika-st-b-state">${done ? t(lang, ...TX.cleared) : nxt === b.i ? t(lang, ...TX.next) : t(lang, ...TX.locked)}</span>
            </button></li>`; }).join('')}</ol>
      </section>`;
    };
    ov.innerHTML = `<div class="ika-st-list">
      <header class="ika-st-head"><button type="button" class="ika-st-close" data-close aria-label="${t(lang, '閉じる', 'Close')}">×</button><button type="button" class="ika-st-sound" data-sound aria-pressed="${audio.on}">${audio.on ? '🔊' : '🔇'}</button><h2>📖 ${t(lang, ...TX.title)}</h2><p>${esc(fillName(t(lang, ...TX.lead), hero))}</p></header>
      <form class="ika-st-nameform" data-name-form><label>${t(lang, ...TX.nameLabel)}<input type="text" name="name" maxlength="${NAME_MAX}" value="${esc(story.name ?? '')}" placeholder="アオ" autocomplete="off"></label><button type="button" class="ika-btn" data-name-save>${t(lang, ...TX.nameSave)}</button></form>
      ${CHAPTERS.map(chapterHTML).join('')}
    </div>`;
    ov.querySelector('[data-close]').addEventListener('click', close);
    ov.querySelector('[data-sound]').addEventListener('click', (e) => { audio.setOn(!audio.on); writeJSON(KEY_SOUND, audio.on); e.currentTarget.textContent = audio.on ? '🔊' : '🔇'; e.currentTarget.setAttribute('aria-pressed', String(audio.on)); if (audio.on) { audio.unlock(); audio.bgm('talk'); } });
    audio.bgm('talk');
    const saveName = () => { const v = ov.querySelector('input[name=name]').value; story = { ...readStory(), name: cleanName(v) === 'アオ' && !v.trim() ? '' : cleanName(v) }; writeStory(story); list(); };
    ov.querySelector('[data-name-save]').addEventListener('click', saveName);
    ov.querySelector('[data-name-form]').addEventListener('submit', (e) => { e.preventDefault(); saveName(); });
    ov.querySelectorAll('[data-battle]').forEach((b) => b.addEventListener('click', () => startBattle(Number(b.dataset.ch), Number(b.dataset.battle))));
    ov.querySelector('[data-trial-skip]')?.addEventListener('click', () => { if (!IS_TRIAL) return; writeStory(markChapterCleared(readStory(), 1, CHAPTERS[0].count, { day: utcDay() })); list(); banner(t(lang, ...TX.trialSkipped), 2600); });
  }

  // 会話：lines を1行ずつ。タップで次へ、「とばす」で終わり。終わったら done()
  function talk({ lines, bg, foe, done, hero, callOut = false }) {
    let i = 0;
    const foeId = foe;
    const box = document.createElement('div');
    box.className = 'ika-st-talk';
    box.innerHTML = `<div class="ika-st-scene" style="background-image:url('${bgSrc(bg)}')">
      <div class="ika-st-who ika-st-who--foe" data-foe hidden><img src="${foeId && CHARS[foeId]?.squid ? charSrc(foeId, 'normal') : ''}" alt="" /></div>
      <div class="ika-st-who ika-st-who--me" data-me><img src="${charSrc('ao', 'normal')}" alt="" /></div>
      <img class="ika-st-vs" src="${assetHref('/assets/ikabu/story/chars/vs.webp')}" alt="VS" hidden />
      <button type="button" class="ika-st-skip" data-skip>${t(lang, ...TX.skip)}</button>
      <div class="ika-st-win" data-win><span class="ika-st-plate" data-name></span><p data-text></p><span class="ika-st-next">${t(lang, ...TX.tap)}</span></div>
    </div>`;
    ov.appendChild(box);
    const me = box.querySelector('[data-me]'), fo = box.querySelector('[data-foe]'), nm = box.querySelector('[data-name]'), tx = box.querySelector('[data-text]');
    let typing = 0;
    const hasFoe = Boolean(foeId && CHARS[foeId]?.squid);
    const vs = box.querySelector('.ika-st-vs');
    const show = () => {
      const l = lines[i];
      const shadow = Boolean(CHARS[l.who]?.shadow);   // 影だけの人物（第4章の予告）は相手の枠に影で出す
      const who = l.who === 'ao' ? 'me' : (l.who === foeId || shadow ? 'foe' : 'other');
      if ((hasFoe || shadow) && who === 'foe') fo.hidden = false;   // 相手は初めて話した時から出る（プロローグの間は出ない）
      if (callOut && i >= lines.length - 2) { if (vs.hidden) audio.se('don'); fo.hidden = !hasFoe; vs.hidden = false; }   // 掛け声（最後の2行）でVS＋ドン
      if (l.who === 'nyudo' || l.bgm) audio.bgm(l.bgm ?? 'ending2', { xfade: 0.3 });   // エピローグ：四天王の登場（第2章は行の bgm）で曲の後半へ
      me.classList.toggle('is-dim', who !== 'me' && l.who !== 'narr');
      fo.classList.toggle('is-dim', who !== 'foe' && l.who !== 'narr');
      if (who === 'me') me.querySelector('img').src = charSrc('ao', l.face);
      if (who === 'foe') fo.querySelector('img').src = shadow ? charSrc(l.who, 'shadow') : charSrc(foeId, l.face);
      const label = l.who === 'narr' ? '' : nameOf(lang, l.who, hero);
      nm.textContent = label; nm.hidden = !label; nm.classList.toggle('is-foe', who !== 'me' && l.who !== 'narr');
      box.querySelector('[data-win]').classList.toggle('is-narr', l.who === 'narr');
      // 文字送り（1文字 22ms）。タップで全部出す
      const full = fillName(l.text, hero); tx.textContent = ''; clearInterval(typing); let k = 0;
      typing = setInterval(() => { k++; tx.textContent = full.slice(0, k); if (k >= full.length) clearInterval(typing); }, 22);
      tx.dataset.full = full;
    };
    let ended = false;
    const finish = () => { if (ended) return; ended = true; clearInterval(typing); box.remove(); done(); };   // 二重に進まない
    box.querySelector('[data-skip]').addEventListener('click', finish);
    box.querySelector('[data-win]').addEventListener('click', () => {
      if (ended) return;
      if (tx.textContent.length < (tx.dataset.full ?? '').length) { clearInterval(typing); tx.textContent = tx.dataset.full; return; }
      i++; if (i >= lines.length) finish(); else show();
    });
    show();
  }
  // 場のルールの札（対戦の直前）
  function ruleCard(rule, done) {
    if (!rule) return done();
    const r = RULE_TEXT[rule];
    const d = document.createElement('div'); d.className = 'ika-st-rule';
    const markOf = { night: 'star', summerNight: 'sun', sarashi: 'sun', tidepool: 'sun', moba: 'wave', harbor: 'star', yamiyo: 'star', yureiNight: 'star', ichimonji: 'anchor', akatoudai: 'anchor' }[rule];   // その場のルールが効くマーク（絵で見せる）
    d.innerHTML = `<div class="ika-st-rule-in"><b>${t(lang, ...r.title)}</b>${markOf ? `<img class="ika-st-rule-mark" src="${assetHref(`/assets/ikabu/tiles/${markOf}_128.webp`)}" alt="" width="56" height="56" />` : ''}<p>${t(lang, ...r.body)}</p><p class="ika-st-rule-note">${markOf ? t(lang, 'カードの左上の印・カードを押した説明で、マークが分かります', 'The mark shows at the top-left of each card and in the card details') : ''}</p><button type="button" class="ika-btn ika-btn--primary" data-ok>${t(lang, ...TX.ruleOk)}</button></div>`;
    ov.appendChild(d);
    d.querySelector('[data-ok]').addEventListener('click', () => { d.remove(); done(); });
  }

  function startBattle(ch, i) {
    const b = BATTLES_BY_CH[ch].find((x) => x.i === i);
    const sc = SCRIPTS[ch];
    const keySeen = KEY_SEEN_CH[ch];
    story = readStory();
    const hero = heroName(story);
    const foeName = nameOf(lang, b.foe, hero);
    const seen = (() => { try { return localStorage.getItem(keySeen) === '1'; } catch { return false; } })();
    const pre = i === 1 && !seen ? [...sc.prologue, ...sc.script[1].before] : sc.script[i].before;
    audio.bgm(TENSE_BATTLES[ch]?.has(i) ? 'tense' : 'talk', { xfade: 1.2 });
    const calls = [{ who: 'ao', face: 'attack', text: CALLS.start[0] }, { who: b.foe, face: 'attack', text: CALLS.start[1] }];
    ov.querySelector('.ika-st-list')?.classList.add('is-hidden');
    talk({ lines: [...pre, ...calls], bg: b.bg, foe: b.foe, hero, callOut: true, done: () => {
      if (i === 1) { try { localStorage.setItem(keySeen, '1'); } catch {} }
      ruleCard(b.rule, () => {
        audio.stopBgm(0.4);   // 対戦は対戦の曲（battle-ui.js）
        openBattle({ lang, story: {
          foeName, stage: b.stage, cpuDeck: deckNos(b.deck), myDeck: b.myDeck ? deckNos(b.myDeck) : null, cpuEgi: b.cpuEgi, brain: b.brain, rule: b.rule,
          onEnd: (win) => afterBattle(ch, b, win, hero),
        } });
      });
    } });
  }

  function afterBattle(ch, b, win, hero) {
    const sc = SCRIPTS[ch], last = BATTLES_BY_CH[ch].length, chap = CHAPTERS[ch - 1];
    if (win === null) { audio.bgm('talk'); list(); return; }   // やめた
    story = readStory();
    let lines, toast = '';
    if (win) {
      const r = recordWin(story, ch, b.i, { day: utcDay() });
      story = r.story; writeStory(story);
      if (r.got) { dispatchEvent(new CustomEvent('ikabu:game', { detail: { game: 'story', amount: r.got, counted: true, tickets: true } })); toast = TX.gotTickets(lang, r.got); }
      lines = [{ who: 'ao', face: 'attack', text: CALLS.win }, ...sc.script[b.i].win];
      if (b.i === last && r.first) lines = [...lines, ...sc.epilogue];
      audio.bgm(b.i === last && r.first ? 'ending' : 'talk', { xfade: 1 });
    } else {
      const r = recordLoss(story, ch, b.i);
      story = r.story; writeStory(story);
      audio.bgm('talk', { xfade: 1 });
      lines = [...sc.script[b.i].lose, ...(r.hint ? sc.script[b.i].hint.map((l) => ({ ...l, text: `💡 ${l.text}` })) : [])];
    }
    talk({ lines, bg: b.i === last && win ? EPILOGUE_BG[ch] : b.bg, foe: b.foe, hero, done: () => {
      audio.bgm('talk', { xfade: 1.5 });
      list();
      if (toast) banner(toast);
      if (win && chapterCleared(story, ch, chap.count) && b.i === last) banner(t(lang, ...TX.chapterDone[ch]), 3600);
    } });
  }
  function banner(text, ms = 2200) {
    const d = document.createElement('div'); d.className = 'ika-st-banner'; d.textContent = text; ov.appendChild(d);
    requestAnimationFrame(() => d.classList.add('is-on'));
    setTimeout(() => d.remove(), ms);
  }
  list();
  if (import.meta.env.DEV) window.__story = { startBattle, list, afterBattle, audio, get story() { return readStory(); } };
  return { close };
}
