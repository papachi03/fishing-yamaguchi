// ストーリーモードの画面（2026-10-03）。章の一覧 → 会話（前口上）→ 対戦（battle-ui.js の openBattle に story を渡す）→ 会話（勝ち／負け）→ 章の一覧
//   進み具合：story.js（ikabu.story.v1）。🎫は初回クリアだけ+2（'ikabu:game' に game:'story' を投げ、tickets-ui.js が付ける）
//   絵：public/assets/ikabu/story/{chars,bg}。会話の窓は画面の部品（半透明の紺＋白枠。名前の札は不透明＝ぱっぱ 10/3）
import { t, esc, assetHref } from '../i18n.js';
import { utcDay } from './rng.js';
import CARDS from './cards-data.json';
import { CHAPTERS, CHARS, BATTLES_CH1, deckNos, RULE_TEXT } from './story-data.js';
import { SCRIPT_CH1, PROLOGUE, EPILOGUE, CALLS } from './story-script.js';
import { readStory, writeStory, heroName, fillName, cleanName, nextBattle, canPlay, isCleared, hintReady, recordWin, recordLoss, chapterCleared, NAME_MAX, STORY_TICKETS } from './story.js';
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
const TENSE_BATTLES = new Set([8, 9]);

const KEY_SEEN = 'ikabu.story.seen';   // プロローグを見たか（このブラウザだけ）
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
  chapterDone: ['第1章 クリア！ 正式部員証を手に入れた', 'Chapter 1 cleared! You earned full membership'],
};

export function mountStoryButton(root, { lang = 'ja' } = {}) {
  if (!root) return null;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'ika-story-entry'; btn.setAttribute('data-story-open', '');
  const sync = () => {
    const s = readStory(); const n = nextBattle(s, 1, CHAPTERS[0].count);
    btn.innerHTML = `<span class="ika-story-entry-tag">${t(lang, 'NEW', 'NEW')}</span><b>📖 ${t(lang, ...TX.title)}</b><small>${n ? t(lang, `第1章 ・ 第${n}戦まで進行中`, `Chapter 1 · battle ${n}`) : t(lang, '第1章 クリア済み', 'Chapter 1 cleared')}</small>`;
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
    story = readStory();
    const hero = heroName(story);
    const ch1 = CHAPTERS[0];
    const nxt = nextBattle(story, 1, ch1.count);
    ov.innerHTML = `<div class="ika-st-list">
      <header class="ika-st-head"><button type="button" class="ika-st-close" data-close aria-label="${t(lang, '閉じる', 'Close')}">×</button><button type="button" class="ika-st-sound" data-sound aria-pressed="${audio.on}">${audio.on ? '🔊' : '🔇'}</button><h2>📖 ${t(lang, ...TX.title)}</h2><p>${esc(fillName(t(lang, ...TX.lead), hero))}</p></header>
      <form class="ika-st-nameform" data-name-form><label>${t(lang, ...TX.nameLabel)}<input type="text" name="name" maxlength="${NAME_MAX}" value="${esc(story.name ?? '')}" placeholder="アオ" autocomplete="off"></label><button type="button" class="ika-btn" data-name-save>${t(lang, ...TX.nameSave)}</button></form>
      <section class="ika-st-ch is-open">
        <h3><span class="ika-st-chno">${t(lang, '第1章', 'Ch. 1')}</span>${t(lang, ...ch1.title)}<small>${t(lang, 'ゴール', 'Goal')}：${t(lang, ...ch1.goal)}</small></h3>
        <ol class="ika-st-battles">${BATTLES_CH1.map((b) => {
          const done = isCleared(story, 1, b.i), ok = canPlay(story, 1, b.i, ch1.count);
          return `<li class="ika-st-b${done ? ' is-done' : ''}${nxt === b.i ? ' is-next' : ''}${ok ? '' : ' is-locked'}">
            <button type="button" ${ok ? `data-battle="${b.i}"` : 'disabled'}>
              <img class="ika-st-b-face" src="${ok ? charSrc(b.foe, 'normal') : ''}" alt="" ${ok ? '' : 'hidden'} />
              <span class="ika-st-b-body"><b>${t(lang, `第${b.i}戦`, `Battle ${b.i}`)}　${ok ? esc(nameOf(lang, b.foe, hero)) : '？？？'}</b><small>${ok ? `${t(lang, ...b.rank)} ・ ${t(lang, ...b.place)}` : '　'}</small><i>${TX.stars(b.stars)}</i></span>
              <span class="ika-st-b-state">${done ? t(lang, ...TX.cleared) : nxt === b.i ? t(lang, ...TX.next) : t(lang, ...TX.locked)}</span>
            </button></li>`; }).join('')}</ol>
      </section>
      ${CHAPTERS.slice(1).map((c) => `<section class="ika-st-ch is-wip"><h3><span class="ika-st-chno">${t(lang, `第${c.id}章`, `Ch. ${c.id}`)}</span>${t(lang, ...c.title)}<small>${t(lang, 'ゴール', 'Goal')}：${t(lang, ...c.goal)}</small></h3><p class="ika-st-wip">🚧 ${t(lang, ...TX.wip)}</p></section>`).join('')}
    </div>`;
    ov.querySelector('[data-close]').addEventListener('click', close);
    ov.querySelector('[data-sound]').addEventListener('click', (e) => { audio.setOn(!audio.on); writeJSON(KEY_SOUND, audio.on); e.currentTarget.textContent = audio.on ? '🔊' : '🔇'; e.currentTarget.setAttribute('aria-pressed', String(audio.on)); if (audio.on) { audio.unlock(); audio.bgm('talk'); } });
    audio.bgm('talk');
    const saveName = () => { const v = ov.querySelector('input[name=name]').value; story = { ...readStory(), name: cleanName(v) === 'アオ' && !v.trim() ? '' : cleanName(v) }; writeStory(story); list(); };
    ov.querySelector('[data-name-save]').addEventListener('click', saveName);
    ov.querySelector('[data-name-form]').addEventListener('submit', (e) => { e.preventDefault(); saveName(); });
    ov.querySelectorAll('[data-battle]').forEach((b) => b.addEventListener('click', () => startBattle(Number(b.dataset.battle))));
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
      const who = l.who === 'ao' ? 'me' : (l.who === foeId ? 'foe' : 'other');
      if (hasFoe && who === 'foe') fo.hidden = false;   // 相手は初めて話した時から出る（プロローグの間は出ない）
      if (callOut && i >= lines.length - 2) { if (vs.hidden) audio.se('don'); fo.hidden = !hasFoe; vs.hidden = false; }   // 掛け声（最後の2行）でVS＋ドン
      if (l.who === 'nyudo') audio.bgm('ending2', { xfade: 0.3 });   // エピローグ：四天王の登場で曲の後半へ
      me.classList.toggle('is-dim', who !== 'me' && l.who !== 'narr');
      fo.classList.toggle('is-dim', who !== 'foe' && l.who !== 'narr');
      if (who === 'me') me.querySelector('img').src = charSrc('ao', l.face);
      if (who === 'foe') fo.querySelector('img').src = charSrc(foeId, l.face);
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
    const markOf = { night: 'star', summerNight: 'sun' }[rule];   // その場のルールが効くマーク（絵で見せる）
    d.innerHTML = `<div class="ika-st-rule-in"><b>${t(lang, ...r.title)}</b>${markOf ? `<img class="ika-st-rule-mark" src="${assetHref(`/assets/ikabu/tiles/${markOf}_128.webp`)}" alt="" width="56" height="56" />` : ''}<p>${t(lang, ...r.body)}</p><p class="ika-st-rule-note">${markOf ? t(lang, 'カードの左上の印・カードを押した説明で、マークが分かります', 'The mark shows at the top-left of each card and in the card details') : ''}</p><button type="button" class="ika-btn ika-btn--primary" data-ok>${t(lang, ...TX.ruleOk)}</button></div>`;
    ov.appendChild(d);
    d.querySelector('[data-ok]').addEventListener('click', () => { d.remove(); done(); });
  }

  function startBattle(i) {
    const b = BATTLES_CH1.find((x) => x.i === i);
    story = readStory();
    const hero = heroName(story);
    const foeName = nameOf(lang, b.foe, hero);
    const seen = (() => { try { return localStorage.getItem(KEY_SEEN) === '1'; } catch { return false; } })();
    const pre = i === 1 && !seen ? [...PROLOGUE, ...SCRIPT_CH1[1].before] : SCRIPT_CH1[i].before;
    audio.bgm(TENSE_BATTLES.has(i) ? 'tense' : 'talk', { xfade: 1.2 });
    const calls = [{ who: 'ao', face: 'attack', text: CALLS.start[0] }, { who: b.foe, face: 'attack', text: CALLS.start[1] }];
    ov.querySelector('.ika-st-list')?.classList.add('is-hidden');
    talk({ lines: [...pre, ...calls], bg: b.bg, foe: b.foe, hero, callOut: true, done: () => {
      if (i === 1) { try { localStorage.setItem(KEY_SEEN, '1'); } catch {} }
      ruleCard(b.rule, () => {
        audio.stopBgm(0.4);   // 対戦は対戦の曲（battle-ui.js）
        openBattle({ lang, story: {
          foeName, stage: b.stage, cpuDeck: deckNos(b.deck), myDeck: b.myDeck ? deckNos(b.myDeck) : null, cpuEgi: b.cpuEgi, brain: b.brain, rule: b.rule,
          onEnd: (win) => afterBattle(b, win, hero),
        } });
      });
    } });
  }

  function afterBattle(b, win, hero) {
    if (win === null) { audio.bgm('talk'); list(); return; }   // やめた
    story = readStory();
    let lines, toast = '';
    if (win) {
      const r = recordWin(story, 1, b.i, { day: utcDay() });
      story = r.story; writeStory(story);
      if (r.got) { dispatchEvent(new CustomEvent('ikabu:game', { detail: { game: 'story', amount: r.got, counted: true, tickets: true } })); toast = TX.gotTickets(lang, r.got); }
      lines = [{ who: 'ao', face: 'attack', text: CALLS.win }, ...SCRIPT_CH1[b.i].win];
      if (b.i === BATTLES_CH1.length && r.first) lines = [...lines, ...EPILOGUE];
      audio.bgm(b.i === BATTLES_CH1.length && r.first ? 'ending' : 'talk', { xfade: 1 });
    } else {
      const r = recordLoss(story, 1, b.i);
      story = r.story; writeStory(story);
      audio.bgm('talk', { xfade: 1 });
      lines = [...SCRIPT_CH1[b.i].lose, ...(r.hint ? SCRIPT_CH1[b.i].hint.map((l) => ({ ...l, text: `💡 ${l.text}` })) : [])];
    }
    talk({ lines, bg: b.i === BATTLES_CH1.length && win ? 'bushitsu' : b.bg, foe: b.foe, hero, done: () => {
      audio.bgm('talk', { xfade: 1.5 });
      list();
      if (toast) banner(toast);
      if (win && chapterCleared(story, 1, CHAPTERS[0].count) && b.i === BATTLES_CH1.length) banner(t(lang, ...TX.chapterDone), 3600);
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
