// イカ部カードバトルの画面（2026-09-30 最初の形）。頭脳は battle.js。縦画面・夜の海底（assets/ikabu/battle/stage_b.webp）
//   上＝相手（後列→前列）、真ん中＝潮目の帯（ターン・案内）、下＝自分（前列→後列）、いちばん下＝手札
//   操作：手札をタップ→「出す／使う／伏せる」。対象が要るときは光っているイカをタップ。前列の自分のイカをタップ→相手のイカ（かダイレクト）をタップで攻撃
//   CPU は cpuNext() の手を 0.8 秒ずつ進める
import { t, esc, assetHref } from '../i18n.js';
import CARDS from './cards-data.json';
import EFFECTS from './cards-effects.json';
import { newGame, play, attack, endTurn, cpuNext, canPlay, canAttack, canShakuri, shakuri, needsTarget, statOf, costOf, starterDeck, cpuDeck, CPU_DECKS, view, SHAKURI_COST, SHAKURI_ATK } from './battle.js';
import { readJSON, writeJSON } from './records.js';
import { KEY_DECK, activeDeck } from './deck.js';
import { createGachaAudio } from './gacha-audio.js';
import { tierOf } from './gacha-show.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 曲（Suno・ぱっぱ 2026-10-01）：対戦中（前奏9秒→9〜66秒を繰り返す）／終盤（エギ残り2以下かターン8以降。6〜156秒を繰り返す）／勝ちのジングル
const BATTLE_AUDIO = {
  battle: { src: '/assets/ikabu/audio/battle/bgm_battle.mp3', loop: true, loopStart: 9, loopEnd: 66, volume: 0.18 },
  climax: { src: '/assets/ikabu/audio/battle/bgm_climax.mp3', loop: true, loopStart: 6, loopEnd: 156, volume: 0.2 },
  win: { src: '/assets/ikabu/audio/battle/jingle_win.mp3', volume: 0.6 },
  endturn: { src: '/assets/ikabu/audio/battle/se_endturn.mp3', volume: 0.7 },   // ターン終了（Audiostock 86963・ぱっぱ 2026-10-01）
  place: { src: '/assets/ikabu/audio/gacha/se_flip.mp3', volume: 0.7 },      // カードを出す・伏せる・使う（めくり音）
  swing: { src: '/assets/ikabu/audio/gacha/se_splash.mp3', volume: 0.5 },    // 攻撃の突進（水しぶき）
  hit: { src: '/assets/ikabu/audio/gacha/se_don.mp3', volume: 0.7 },         // 釣った・ダイレクト（ドン）
  trap: { src: '/assets/ikabu/audio/gacha/se_thunder.mp3', volume: 0.5 },    // トラップが開く（稲妻）
  lose: { src: '/assets/ikabu/audio/battle/jingle_lose.mp3', volume: 0.7 },   // 負け（Audiostock 1111485）
  bounce: { src: '/assets/ikabu/audio/battle/se_bounce.mp3', volume: 0.7 },  // 弾かれた（191769）
  tie: { src: '/assets/ikabu/audio/battle/se_tie.mp3', volume: 0.7 },        // バラシ（1436575）
  egilost: { src: '/assets/ikabu/audio/battle/se_egilost.mp3', volume: 0.7 }, // エギを奪われる（1023078）
  climaxIn: { src: '/assets/ikabu/audio/battle/se_climax.mp3', volume: 0.6 }, // 終盤に切り替わる（114892）
};
const KEY_SOUND = 'ikabu.battle.sound';
const KEY_RECORD = 'ikabu.battle.v1';   // 本番の戦績：{ wins, losses, streak, best, byLevel: { bucho: { wins, losses } } }
const readRecord = () => ({ wins: 0, losses: 0, streak: 0, best: 0, byLevel: {}, ...(readJSON(KEY_RECORD) ?? {}) });
function recordResult(level, win) {
  const r = readRecord();
  if (win) { r.wins += 1; r.streak += 1; r.best = Math.max(r.best, r.streak); } else { r.losses += 1; r.streak = 0; }
  r.byLevel[level] = r.byLevel[level] ?? { wins: 0, losses: 0 };
  r.byLevel[level][win ? 'wins' : 'losses'] += 1;
  writeJSON(KEY_RECORD, r);
  return r;
}
// 背景（stage_b.webp・9:16）の砂の枠の位置（画像の%）。相手側は奥＝小さく、自陣は手前＝大きく描かれている（2026-10-01 ぱっぱ「この枠に収めないと背景の意味がない」）
const PADS = {
  'cpu-back': [34.5, 49.5, 64.5].map((cx) => ({ cx, cy: 23, w: 12.5, h: 11.5 })),
  'cpu-front': [33.5, 50, 66.5].map((cx) => ({ cx, cy: 37.5, w: 14, h: 12.5 })),
  'me-front': [31.5, 52, 73].map((cx) => ({ cx, cy: 64.5, w: 18.5, h: 14.5 })),
  'me-back': [31.5, 52, 73].map((cx) => ({ cx, cy: 81, w: 18.5, h: 15 })),
};
const cellStyle = (p) => `left:${p.cx - p.w / 2}%;top:${p.cy - p.h / 2}%;width:${p.w}%;height:${p.h}%`;
// 部長イカの How to（練習デッキの対戦だけ。2026-10-01 ぱっぱ）。状況に合った一言を順に出す
const TUTOR = [
  { id: 'start', pic: 'wave', when: (st) => st.active === 'me' && st.players.me.front.every((x) => !x),
    ja: 'ようこそ、イカ部カードバトルへ！\nまずは手札のイカをタップして\n「前列に出す」。\n左上の数字が「潮」（コスト）。\nターンごとに1ずつ増えるよ', en: 'Welcome! Tap a squid in your hand and play it to the front row. The number on the card is its tide cost; you gain 1 tide per turn.' },
  { id: 'end', pic: 'point', when: (st) => st.active === 'me' && st.players.me.summoned,
    ja: '出したターンのイカは攻撃できない。\n右の丸い「ターン終了」で\n相手の番へ。\n手札は毎ターン1枚引けるよ', en: 'A squid cannot attack the turn it was played. Tap the round End Turn button on the right. You draw a card every turn.' },
  { id: 'attack', pic: 'point', when: (st) => st.active === 'me' && !st.players.me.noAttack && st.players.me.front.some((x) => x && !x.sick && !x.attacked && !x.skipThis) && st.players.cpu.front.some(Boolean),
    ja: '攻撃しよう！\n自分のイカをタップ→相手のイカをタップ。\n赤い数字（攻撃）が相手の\n青い数字（防御）より大きければ釣れる。\n同じなら「バラシ」、\n小さいと弾かれて次のターン休みだよ', en: 'Attack! Tap your squid, then an enemy squid. Red (ATK) higher than their blue (DEF) catches it. Equal is a miss; lower bounces you and the squid rests next turn.' },
  { id: 'direct', pic: 'yatta', when: (st) => st.active === 'me' && !st.players.me.noAttack && st.players.me.front.some((x) => x && !x.sick && !x.attacked && !x.skipThis) && !st.players.cpu.front.some(Boolean),
    ja: '相手の前列が空だ！\n自分のイカをタップして\n「ダイレクトアタック」。\n相手のエギを1個奪えるよ。\n5個ぜんぶ奪えば勝ち！', en: "The enemy front row is empty! Tap your squid and hit Direct Attack to take one of their egi. Take all five to win!" },
  { id: 'trap', pic: 'point', when: (st) => st.active === 'me' && st.players.me.hand.some((x) => x.card.kind === 'trap' && canPlay(st, 'me', x).ok),
    ja: 'トラップは後列に「伏せる」。\n相手が攻撃した時などに自動で開いて、\n1回使ったら捨て札へ。\n伏せると相手は読めないよ', en: 'Traps are set face down in the back row. They open automatically, for example when the enemy attacks, and are used once.' },
  { id: 'tech', pic: 'point', when: (st) => st.active === 'me' && st.players.me.hand.some((x) => x.card.kind === 'tech' && canPlay(st, 'me', x).ok),
    ja: 'テクニックはその場で効く\n（攻撃+2など）。\n同じマークのイカが前列にいると\n潮1安くなるよ。\n攻撃の前に使うのがコツ', en: 'Techniques work instantly (e.g. +2 ATK). If a squid with the same mark is in your front row, they cost 1 less. Use them before attacking.' },
  { id: 'shakuri', pic: 'point', when: (st) => st.active === 'me' && st.players.me.tide >= SHAKURI_COST && st.players.me.front.some((x) => x && !x.sick && !x.attacked && !x.skipThis) && st.players.cpu.front.some(Boolean),
    ja: '潮が余っていたら「潮しゃくり」！\n自分のイカをタップして、\n🌊2で攻撃+1（1体1回）。\nあと1足りない時の一押しに', en: 'Spare tide? Tap your squid and use Tide Jerk: 2 tide for +1 ATK (once per squid). Also, a defender that bounces you loses 1 DEF permanently, so keep pushing.' },
  { id: 'wear', pic: 'wink', when: (st) => st.players.cpu.front.some((x) => x && x.buffs.some((b) => b.stat === 'def' && b.n < 0 && b.expires === Infinity)),
    ja: '弾かれた！ でも無駄じゃない。\n弾いた相手は「守りの疲れ」で\n防御が1下がった（ずっと）。\n同じ相手をもう一度狙えば抜けるよ', en: "Bounced! Not wasted though: the defender is worn down and loses 1 DEF permanently. Hit it again and you'll break through." },
  { id: 'lost', pic: 'sad', when: (st) => st.players.me.egi < 5,
    ja: 'エギを1個取られた…\nでも取られた側は1枚引ける。\n手札を増やして巻き返そう！', en: 'You lost an egi, but you also draw a card. Rebuild and fight back!' },
];
const cardSrc = (no) => assetHref(`/assets/ikabu/cards/card_${String(no).padStart(3, '0')}_240.webp`);
const BACK = assetHref('/assets/ikabu/cards/card_back.webp');
const TX = {
  start: ['CPUと対戦（練習）', 'Practice vs CPU'], startReal: ['部長と対戦（本番）', 'Captain match'],
  realNote: ['部長デッキと本番の対戦。勝ち🎫2・負け🎫1（1日3戦まで）。戦績に残ります', "A real match against the Captain's deck. Win 🎫2, lose 🎫1 (up to 3 a day). Counts toward your record."],
  record: (lang, r) => (lang === 'en' ? `Record ${r.wins}W ${r.losses}L · streak ${r.streak} (best ${r.best})` : `戦績 ${r.wins}勝${r.losses}敗 ・ 連勝 ${r.streak}（最高 ${r.best}）`),
  practiceNote: ['初心者練習デッキのCPUと対戦します。練習なので記録と🎫には数えません。', 'Practice against the beginner CPU deck. Practice matches are not recorded and earn no 🎫.'],
  yourTurn: ['あなたの番', 'Your turn'], cpuTurn: ['相手の番', "CPU's turn"],
  firstNoAttack: ['先攻の最初のターンは攻撃できません', 'The first player cannot attack on turn 1'],
  end: ['ターン終了', 'End turn'], quit: ['やめる', 'Quit'],
  put: ['前列に出す', 'Play'], use: ['使う', 'Use'], set: ['伏せる', 'Set'], cancel: ['やめる', 'Cancel'],
  pickTarget: ['対象を選んでください（光っているイカ）', 'Pick a target (glowing squid)'],
  pickEnemy: ['攻撃する相手を選んでください', 'Pick a squid to attack'],
  direct: ['ダイレクトアタック！', 'Direct attack!'],
  why: { tide: ['潮が足りません', 'Not enough tide'], summoned: ['イカはこのターンもう出しました', 'Already played a squid this turn'], frontFull: ['前列がいっぱいです', 'Front row is full'], backFull: ['後列がいっぱいです', 'Back row is full'], techLimit: ['このターンはテクニックをもう使えません', 'No more techniques this turn'], sick: ['出したターンは攻撃できません', "Can't attack the turn it was played"], tired: ['弾かれたので、このターンは攻撃できません', 'Bounced last time; rests this turn'], attacked: ['このターンはもう攻撃しました', 'Already attacked'], noAttack: ['このターンは攻撃できません', "Can't attack this turn"], shielded: ['そのイカは守られています', 'That squid is protected'] },
  win: ['勝った！', 'You win!'], lose: ['負けた…', 'You lose…'],
  again: ['もう一度', 'Play again'], close: ['閉じる', 'Close'],
  state: { sick: ['出たばかり', 'new'], tired: ['休み', 'rest'], shield: ['守り', 'safe'], attacked: ['攻撃済', 'done'], set: ['伏せ', 'set'] },
  hand: ['手札', 'Hand'], deck: ['山札', 'Deck'], grave: ['捨て', 'Used'],
  kind: { squid: ['イカ', 'Squid'], tech: ['テクニック', 'Technique'], trap: ['トラップ', 'Trap'] },
  noEffect: ['特技なし', 'No ability'], atk: ['攻撃', 'ATK'], def: ['防御', 'DEF'], now: ['いま', 'now'], close: ['閉じる', 'Close'],
  shakuri: (lang) => (lang === 'en' ? `Tide jerk (🌊${SHAKURI_COST} → ATK +${SHAKURI_ATK})` : `潮しゃくり（🌊${SHAKURI_COST}で攻撃+${SHAKURI_ATK}）`),
};

export function mountBattle(root, { lang = 'ja' } = {}) {
  if (!root) return null;
  const rec = readRecord();
  root.innerHTML = `<div class="ika-bt-entry">
    <button type="button" class="ika-gc-imgbtn" data-bt-real><img src="${assetHref('/assets/ikabu/gacha/btn_battle.webp')}" alt="${t(lang, ...TX.startReal)}" width="964" height="170" /><span class="is-real">${t(lang, '本番・部長', 'Captain')}</span></button>
    <p class="ika-bt-entry-note">${t(lang, ...TX.realNote)}<br><b data-bt-record>${TX.record(lang, rec)}</b></p>
    <button type="button" class="ika-gc-imgbtn" data-bt-start><img src="${assetHref('/assets/ikabu/gacha/btn_battle.webp')}" alt="${t(lang, ...TX.start)}" width="964" height="170" /><span>${t(lang, '練習', 'Practice')}</span></button>
    <p class="ika-bt-entry-note">${t(lang, ...TX.practiceNote)}</p></div>`;
  root.querySelector('[data-bt-start]').addEventListener('click', () => openBattle({ lang, practice: true }));
  root.querySelector('[data-bt-real]').addEventListener('click', () => openBattle({ lang, practice: false, level: 'bucho' }));
  addEventListener('ikabu:battle', () => { const b = root.querySelector('[data-bt-record]'); if (b) b.textContent = TX.record(lang, readRecord()); });
  return {};
}

export function openBattle({ lang = 'ja', practice = true, level = practice ? 'practice' : 'bucho' } = {}) {
  const myDeck = activeDeck(readJSON(KEY_DECK), starterDeck(CARDS), CARDS);   // 3つのうち「使う」にしたデッキ
  const st = newGame({ myDeck, cpuDeck: cpuDeck(CARDS, level), cards: CARDS, effects: EFFECTS, first: Math.random() < 0.5 ? 'me' : 'cpu' });
  const ov = document.createElement('div');
  ov.className = 'ika-bt';
  ov.innerHTML = `
    <div class="ika-bt-stage">
      <div class="ika-bt-board" style="background-image:url('${assetHref('/assets/ikabu/battle/stage_b.webp')}')">
        <div class="ika-bt-row" data-row="cpu-back"></div>
        <div class="ika-bt-row" data-row="cpu-front"></div>
        <div class="ika-bt-row" data-row="me-front"></div>
        <div class="ika-bt-row" data-row="me-back"></div>
      </div>
      <div class="ika-bt-side ika-bt-side--cpu" data-side="cpu"><div class="ika-bt-side-left"><div class="ika-bt-egi" data-egi="cpu"></div><div class="ika-bt-tide" data-tide="cpu"></div></div><div class="ika-bt-nums" data-nums="cpu"></div></div>
      <div class="ika-bt-band"><span class="ika-bt-turn" data-turn></span><span class="ika-bt-msg" data-msg></span></div>
      <div class="ika-bt-side ika-bt-side--me" data-side="me"><div class="ika-bt-egi" data-egi="me"></div><div class="ika-bt-tide" data-tide="me"></div><div class="ika-bt-nums" data-nums="me"></div></div>
      <button type="button" class="ika-bt-scale" data-scale aria-label="${t(lang, 'カードの大きさ', 'Card size')}">⚙</button>
      <button type="button" class="ika-bt-sound" data-sound aria-pressed="true">🔊</button>
      <div class="ika-bt-actions">
        <button type="button" class="ika-bt-imgbtn ika-bt-direct" data-direct hidden><img src="${assetHref('/assets/ikabu/battle/btn_direct.webp')}" alt="${t(lang, ...TX.direct)}" draggable="false" /></button>
        <button type="button" class="ika-bt-imgbtn ika-bt-end" data-end><img src="${assetHref('/assets/ikabu/battle/btn_end.webp')}" alt="${t(lang, ...TX.end)}" draggable="false" /></button>
      </div>
      <button type="button" class="ika-bt-quit" data-quit>${t(lang, ...TX.quit)}</button>
      <div class="ika-bt-hand" data-hand></div>
      <div class="ika-bt-sheet" data-sheet hidden></div>
      <div class="ika-bt-callout" data-callout></div>
      <div class="ika-bt-tutor" data-tutor hidden><img src="" alt="" width="433" height="480" /><div class="ika-bt-tutor-bubble"><p data-tutor-text></p><button type="button" class="ika-btn ika-btn--primary" data-tutor-ok>OK</button></div></div>
      <div class="ika-bt-over" data-over hidden></div>
    </div>`;
  document.body.appendChild(ov);
  document.documentElement.classList.add('is-battle');
  const $ = (s) => ov.querySelector(s);
  const el = { tide: { me: $('[data-tide="me"]'), cpu: $('[data-tide="cpu"]') }, rows: { 'cpu-back': $('[data-row="cpu-back"]'), 'cpu-front': $('[data-row="cpu-front"]'), 'me-front': $('[data-row="me-front"]'), 'me-back': $('[data-row="me-back"]') }, egi: { me: $('[data-egi="me"]'), cpu: $('[data-egi="cpu"]') }, nums: { me: $('[data-nums="me"]'), cpu: $('[data-nums="cpu"]') }, turn: $('[data-turn]'), msg: $('[data-msg]'), hand: $('[data-hand]'), sheet: $('[data-sheet]'), callout: $('[data-callout]'), over: $('[data-over]'), direct: $('[data-direct]'), end: $('[data-end]') };
  const audio = createGachaAudio({ on: readJSON(KEY_SOUND) ?? true, href: assetHref, tracks: BATTLE_AUDIO });
  const soundBtn = $('[data-sound]');
  const syncSound = () => { soundBtn.textContent = audio.on ? '🔊' : '🔇'; soundBtn.setAttribute('aria-pressed', String(audio.on)); };
  soundBtn.addEventListener('click', () => { audio.setOn(!audio.on); writeJSON(KEY_SOUND, audio.on); syncSound(); if (audio.on) { audio.unlock(); audio.bgm(climax() ? 'climax' : 'battle'); } });
  syncSound();
  const climax = () => st.players.me.egi <= 2 || st.players.cpu.egi <= 2 || st.turn >= 8;
  let climaxOn = false;
  audio.unlock(); audio.bgm('battle');
  // カードの大きさ（小・中・大）。⚙で切替、保存
  const SCALES = ['s', 'm', 'l'];
  let scale = readJSON('ikabu.battle.scale') ?? 'm';
  const applyScale = () => { ov.dataset.scale = scale; };
  applyScale();
  $('[data-scale]').addEventListener('click', () => { scale = SCALES[(SCALES.indexOf(scale) + 1) % SCALES.length]; writeJSON('ikabu.battle.scale', scale); applyScale(); callout(t(lang, { s: '小', m: '中', l: '大' }[scale], { s: 'S', m: 'M', l: 'L' }[scale])); });
  // 部長イカの How to（練習だけ）
  const tutorEl = $('[data-tutor]'); const tutorShown = new Set(); let tutorOpen = false;
  tutorEl.querySelector('[data-tutor-ok]').addEventListener('click', () => { tutorEl.hidden = true; tutorOpen = false; tutor(); });
  function tutor() {
    if (!practice || tutorOpen || st.winner) return;
    const step = TUTOR.find((s) => !tutorShown.has(s.id) && s.when(st));
    if (!step) return;
    tutorShown.add(step.id); tutorOpen = true;
    tutorEl.querySelector('img').src = assetHref(`/assets/ikabu/mascot/${step.pic}.webp`);
    tutorEl.querySelector('[data-tutor-text]').textContent = t(lang, step.ja, step.en);
    tutorEl.hidden = false;
  }
  let sel = null;          // { kind:'hand', x } | { kind:'attacker', x } | { kind:'target', x, who }
  let busy = false;
  let logSeen = st.log.length;

  const egiHTML = (n) => Array.from({ length: 5 }, (_, i) => `<img class="ika-bt-egi-i${i < n ? '' : ' is-lost'}" src="${assetHref('/assets/ikabu/battle/egi.webp')}" alt="" width="240" height="120" />`).join('');
  const stateOf = (x, side) => (x.shield ? 'shield' : x.sick && side === st.active ? 'sick' : x.skipThis ? 'tired' : x.attacked && side === st.active ? 'attacked' : '');
  function cardHTML(x, side, row) {
    if (!x) return '<div class="ika-bt-slot"></div>';
    const hidden = row === 'back' && side === 'cpu';
    const s = x.card.kind === 'squid' ? stateOf(x, side) : row === 'back' && side === 'me' ? 'set' : '';
    return `<div class="ika-bt-card${hidden ? ' is-facedown' : ''}${row === 'back' ? ' is-back' : ''}" data-uid="${x.uid}" data-tier="${tierOf(x.card.rarity)}">
      <img src="${hidden ? BACK : cardSrc(x.no)}" alt="${hidden ? '' : esc(x.card.name)}" width="240" height="360" draggable="false" />
      ${x.card.kind === 'squid' ? `<b class="ika-bt-atk">${statOf(st, x, 'atk')}</b><b class="ika-bt-def">${statOf(st, x, 'def')}</b>` : ''}
      ${s ? `<i class="ika-bt-state is-${s}">${t(lang, ...TX.state[s])}</i>` : ''}
    </div>`;
  }
  function render() {
    for (const side of ['me', 'cpu']) {
      const p = st.players[side];
      el.rows[`${side}-front`].innerHTML = p.front.map((x, i) => `<div class="ika-bt-cell" style="${cellStyle(PADS[`${side}-front`][i])}">${cardHTML(x, side, 'front')}</div>`).join('');
      el.rows[`${side}-back`].innerHTML = p.back.map((x, i) => `<div class="ika-bt-cell" style="${cellStyle(PADS[`${side}-back`][i])}">${cardHTML(x, side, 'back')}</div>`).join('');
      el.egi[side].innerHTML = egiHTML(p.egi);
      const v = view(st, side);
      el.nums[side].innerHTML = `<span>🌊 ${v.tide}/${v.tideMax}</span><span>${t(lang, ...TX.hand)} ${v.hand}</span><span>${t(lang, ...TX.deck)} ${v.deck}</span>`;
    }
    const me = st.players.me;
    for (const side of ['me', 'cpu']) { const q = st.players[side]; el.tide[side].innerHTML = Array.from({ length: 8 }, (_, i) => `<i class="${i < q.tide ? 'is-on' : i < q.tideMax ? 'is-max' : ''}"></i>`).join(''); }
    el.turn.textContent = `${st.active === 'me' ? t(lang, ...TX.yourTurn) : t(lang, ...TX.cpuTurn)} ・ T${st.turn}${practice ? '' : ` ・ ${t(lang, ...CPU_DECKS[level].name)}`}`;
    el.hand.innerHTML = me.hand.map((x) => {
      const c = canPlay(st, 'me', x);
      return `<button type="button" class="ika-bt-hcard${c.ok ? '' : ' is-no'}${sel?.kind === 'hand' && sel.x === x ? ' is-sel' : ''}" data-uid="${x.uid}" data-tier="${tierOf(x.card.rarity)}"><img src="${cardSrc(x.no)}" alt="${esc(x.card.name)}" width="240" height="360" draggable="false" /><i class="ika-bt-cost">${costOf(st, 'me', x)}</i></button>`;
    }).join('');
    const enemies = st.players.cpu.front.filter(Boolean);
    el.direct.hidden = !(sel?.kind === 'attacker' && !enemies.length);
    el.end.disabled = st.active !== 'me' || busy;
    // 選択中の光り方
    ov.querySelectorAll('.ika-bt-card').forEach((c) => c.classList.remove('is-sel', 'is-pick'));
    if (sel?.kind === 'attacker') { ov.querySelector(`.ika-bt-card[data-uid="${sel.x.uid}"]`)?.classList.add('is-sel'); enemies.forEach((e) => { if (!e.shield) ov.querySelector(`.ika-bt-card[data-uid="${e.uid}"]`)?.classList.add('is-pick'); }); }
    if (sel?.kind === 'target') {
      const list = sel.who.startsWith('own') ? st.players.me.front.filter(Boolean) : enemies;
      list.forEach((e) => ov.querySelector(`.ika-bt-card[data-uid="${e.uid}"]`)?.classList.add('is-pick'));
    }
    // 案内
    if (!st.winner && climax() && !climaxOn) { climaxOn = true; audio.se('climaxIn'); audio.bgm('climax', { xfade: 2 }); }
    el.msg.textContent = sel?.kind === 'target' ? t(lang, ...TX.pickTarget) : sel?.kind === 'attacker' ? (enemies.length ? t(lang, ...TX.pickEnemy) : '') : st.active === 'me' && st.players.me.noAttack ? t(lang, ...TX.firstNoAttack) : '';
    flushLog();
    if (!busy) tutor();
  }
  let calloutTimer = 0;
  function callout(text, kind = '') { el.callout.textContent = text; el.callout.className = `ika-bt-callout is-on ${kind}`; clearTimeout(calloutTimer); calloutTimer = setTimeout(() => el.callout.classList.remove('is-on'), 1300); }
  function flushLog() {
    const fresh = st.log.slice(logSeen); logSeen = st.log.length;
    const last = fresh.filter((l) => /釣った|バラシ|弾かれた|トラップ|ダイレクト|無効|止められた/.test(l.text)).pop();
    if (last) callout(last.text, /釣った|ダイレクト/.test(last.text) ? 'is-good' : /トラップ|止められた|無効/.test(last.text) ? 'is-trap' : '');
  }
  const findInst = (uid) => { for (const s of ['me', 'cpu']) { const p = st.players[s]; for (const x of [...p.front, ...p.back, ...p.hand]) if (x && String(x.uid) === String(uid)) return x; } return null; };

  // 手札
  el.hand.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-bt-hcard'); if (!b || busy || st.active !== 'me') return;
    const x = findInst(b.dataset.uid); if (!x) return;
    const c = canPlay(st, 'me', x);
    if (!c.ok) { callout(t(lang, ...(TX.why[c.why] ?? ['', ''])), 'is-no'); return; }
    sel = { kind: 'hand', x }; render(); showSheet(x);
  });
  // mode='hand'：出す／使う／伏せるのボタン付き。mode='info'：盤面のカードを見るだけ
  function cardInfoHTML(x, onField) {
    const c = x.card;
    const stats = c.kind === 'squid' ? `<p class="ika-bt-sheet-stats"><span class="is-atk">${t(lang, ...TX.atk)} ${c.atk}${onField && statOf(st, x, 'atk') !== c.atk ? `<b>→${statOf(st, x, 'atk')}</b>` : ''}</span><span class="is-def">${t(lang, ...TX.def)} ${c.def}${onField && statOf(st, x, 'def') !== c.def ? `<b>→${statOf(st, x, 'def')}</b>` : ''}</span></p>` : '';
    return `<p class="ika-bt-sheet-name"><img class="ika-bt-sheet-rimg" src="${assetHref(`/assets/ikabu/gacha/rarity_${tierOf(c.rarity)}.webp`)}" alt="${c.rarity}" /><span>${esc(c.name)}</span><small>${t(lang, ...TX.kind[c.kind])} ・ 🌊${onField ? c.cost : costOf(st, 'me', x)}</small></p>${stats}<p class="ika-bt-sheet-effect">${c.effect ? esc(c.effect) : t(lang, ...TX.noEffect)}</p>`;
  }
  function showInfo(x) {
    el.sheet.hidden = false;
    const canJ = st.players.me.front.includes(x) && canShakuri(st, 'me', x).ok;
    el.sheet.innerHTML = `<div class="ika-bt-sheet-in">${cardInfoHTML(x, true)}<div>${canJ ? `<button type="button" class="ika-btn ika-btn--primary" data-shakuri>${TX.shakuri(lang)}</button>` : ''}<button type="button" class="ika-btn" data-cancel>${t(lang, ...TX.close)}</button></div></div>`;
    el.sheet.querySelector('[data-cancel]').addEventListener('click', () => { el.sheet.hidden = true; });
    el.sheet.querySelector('[data-shakuri]')?.addEventListener('click', () => { const r = shakuri(st, 'me', x); if (r.ok) { audio.se('place'); callout(t(lang, `攻撃+${SHAKURI_ATK}！`, `ATK +${SHAKURI_ATK}!`), 'is-good'); } render(); showInfo(x); });
  }
  function showSheet(x) {
    const label = x.card.kind === 'squid' ? TX.put : x.card.kind === 'tech' ? TX.use : TX.set;
    el.sheet.hidden = false;
    el.sheet.innerHTML = `<div class="ika-bt-sheet-in">${cardInfoHTML(x, false)}<div><button type="button" class="ika-btn ika-btn--primary" data-go>${t(lang, ...label)}</button><button type="button" class="ika-btn" data-cancel>${t(lang, ...TX.cancel)}</button></div></div>`;
    el.sheet.querySelector('[data-cancel]').addEventListener('click', () => { sel = null; el.sheet.hidden = true; render(); });
    el.sheet.querySelector('[data-go]').addEventListener('click', () => {
      el.sheet.hidden = true;
      const who = needsTarget(st, x);
      if (who) { sel = { kind: 'target', x, who }; render(); return; }
      doPlay(x, null);
    });
  }
  function doPlay(x, target) {
    const r = play(st, 'me', x, { target });
    if (r.ok) audio.se('place');
    sel = null;
    if (!r.ok) callout(t(lang, ...(TX.why[r.why] ?? ['', ''])), 'is-no');
    render(); checkOver();
  }
  // 盤面のタップ：対象を選ぶ／攻撃する
  ov.addEventListener('click', (e) => {
    const c = e.target.closest('.ika-bt-card'); if (!c) return;
    const x = findInst(c.dataset.uid); if (!x) return;
    if (busy || st.active !== 'me') { if (!st.players.cpu.back.includes(x)) showInfo(x); return; }
    const mine = st.players.me.front.includes(x), enemy = st.players.cpu.front.includes(x);
    if (sel?.kind === 'target') {
      const okSide = sel.who.startsWith('own') ? mine : enemy;
      if (okSide) doPlay(sel.x, x);
      return;
    }
    if (sel?.kind === 'attacker' && enemy) { doAttack(sel.x, x); return; }
    if (mine) {
      const ca = canAttack(st, 'me', x);
      if (!ca.ok) { callout(t(lang, ...(TX.why[ca.why] ?? ['', ''])), 'is-no'); showInfo(x); return; }
      sel = sel?.kind === 'attacker' && sel.x === x ? null : { kind: 'attacker', x }; render();
      if (sel) showInfo(x); else el.sheet.hidden = true;
      return;
    }
    // 相手の前列・自分の後列（伏せたカード）：説明だけ。相手の伏せカードは見えない
    if (enemy || st.players.me.back.includes(x)) showInfo(x);
  });
  el.direct.addEventListener('click', () => { if (sel?.kind === 'attacker') doAttack(sel.x, null); });
  async function doAttack(x, target) {
    busy = true;
    const node = ov.querySelector(`.ika-bt-card[data-uid="${x.uid}"]`);
    node?.classList.add('is-attack-up'); audio.se('swing');
    await wait(280);
    const r = attack(st, 'me', x, target);
    seForResult(r);
    sel = null; busy = false;
    if (!r.ok) callout(t(lang, ...(TX.why[r.why] ?? ['', ''])), 'is-no');
    render(); checkOver();
  }
  el.end.addEventListener('click', async () => { if (busy || st.active !== 'me') return; audio.se('endturn'); sel = null; el.sheet.hidden = true; endTurn(st); render(); if (!checkOver()) await cpuTurn(); });
  $('[data-quit]').addEventListener('click', close);
  function close() { audio.stopBgm(0.6); audio.stopAllSe(); ov.remove(); document.documentElement.classList.remove('is-battle'); }

  async function cpuTurn() {
    busy = true; render();
    await wait(600);
    let guard = 0;
    while (st.active === 'cpu' && !st.winner && guard++ < 40) {
      const a = cpuNext(st);
      if (a.type === 'end') break;
      if (a.type === 'shakuri') { shakuri(st, 'cpu', a.x); audio.se('place'); render(); await wait(600); continue; }
      if (a.type === 'play') { play(st, 'cpu', a.x, { target: a.target }); audio.se('place'); render(); await wait(800); }
      else { const node = ov.querySelector(`.ika-bt-card[data-uid="${a.x.uid}"]`); node?.classList.add('is-attack-down'); audio.se('swing'); await wait(280); const r = attack(st, 'cpu', a.x, a.target); seForResult(r); render(); await wait(900); }
    }
    if (!st.winner) endTurn(st);
    busy = false; render(); checkOver();
  }
  function seForResult(r) {
    if (!r?.ok) return;
    if (r.result === 'trapped') audio.se('trap');
    else if (r.result === 'catch') audio.se('hit');
    else if (r.result === 'direct') { audio.se('hit'); setTimeout(() => audio.se('egilost'), 250); }
    else if (r.result === 'blocked') audio.se('bounce');
    else if (r.result === 'tie') audio.se('tie');
  }
  function checkOver() {
    if (!st.winner) return false;
    const win = st.winner === 'me';
    audio.stopBgm(0.8); audio.se(win ? 'win' : 'lose');
    el.over.hidden = false;
    const rec = practice ? null : recordResult(level, win);
    if (rec) dispatchEvent(new CustomEvent('ikabu:battle', { detail: { level, win } }));
    el.over.innerHTML = `<div class="ika-bt-over-in"><p class="ika-bt-over-title ${win ? 'is-win' : 'is-lose'}">${t(lang, ...(win ? TX.win : TX.lose))}</p>${practice ? `<p class="ika-bd-hint">${t(lang, ...TX.practiceNote)}</p>` : `<p class="ika-bd-hint">${t(lang, ...CPU_DECKS[level].name)} ・ ${TX.record(lang, rec)}</p>`}<div><button type="button" class="ika-btn ika-btn--primary" data-again>${t(lang, ...TX.again)}</button><button type="button" class="ika-btn" data-close>${t(lang, ...TX.close)}</button></div></div>`;
    el.over.querySelector('[data-again]').addEventListener('click', () => { close(); openBattle({ lang, practice, level }); });
    el.over.querySelector('[data-close]').addEventListener('click', close);
    dispatchEvent(new CustomEvent('ikabu:game', { detail: { game: 'battle', win, counted: !practice } }));
    return true;
  }
  render();
  if (st.active === 'cpu') cpuTurn();
  return { st, close };
}
