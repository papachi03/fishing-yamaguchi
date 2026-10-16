var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../src/js/ikabu/games/rng.js
function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 1831565813;
    let z = h;
    z = Math.imul(z ^ z >>> 15, z | 1);
    z ^= z + Math.imul(z ^ z >>> 7, z | 61);
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
}
__name(seeded, "seeded");

// ../../src/js/ikabu/games/battle.js
var BACK = 3;
var EGI = 5;
var HAND_MAX = 7;
var TIDE_MAX = 8;
var DECK_SIZE = 30;
var START_HAND = 5;
var DECK_RULE = { squid: [12, 15], tech: [9, 12], trap: [4, 6], copies: 2, SSR: 2, UR: 1 };
var SHAKURI_COST = 2;
var SHAKURI_ATK = 1;
var WEAR_DEF = 1;
var SETTLE_DEF = 2;
var TAILWIND_TURNS = 2;
var TAILWIND_TIDE = 1;
var other = /* @__PURE__ */ __name((side) => side === "me" ? "cpu" : "me", "other");
var NIGHT_NOS = /* @__PURE__ */ new Set([
  4,
  5,
  7,
  15,
  22,
  23,
  34,
  49,
  125,
  126,
  128,
  // イカ：ケンサキ・ヤリ・ホタル・アカ・欧州ヤリ・カリフォルニアヤリ・アメリカオオアカ・ヤリの群れ・月夜のケンサキ・スナイプヤリ・真冬の大槍
  68,
  71,
  76,
  85,
  86,
  90,
  127
  // テクニック：常夜灯・ナイトエギング・夜光エギ・満月の夜・新月・イカメタル・ヤリイカの接岸
]);
var isNight = /* @__PURE__ */ __name((card) => NIGHT_NOS.has(card.no), "isNight");
var markOf = /* @__PURE__ */ __name((x) => x.mark ?? x.card.mark, "markOf");
var MARK_IDS = ["anchor", "sun", "wave", "star", "shell"];
function checkDeck(nos, cards) {
  const byNo = new Map(cards.map((c) => [c.no, c]));
  const list = nos.map((n) => byNo.get(n)).filter(Boolean);
  const errors = [];
  if (list.length !== DECK_SIZE) errors.push(`\u679A\u6570\u304C${list.length}\u679A\uFF0830\u679A\u3061\u3087\u3046\u3069\uFF09`);
  const cnt = /* @__PURE__ */ __name((k) => list.filter((c) => c.kind === k).length, "cnt");
  for (const k of ["squid", "tech", "trap"]) {
    const [lo, hi] = DECK_RULE[k];
    const n = cnt(k);
    if (n < lo || n > hi) errors.push(`${{ squid: "\u30A4\u30AB", tech: "\u30C6\u30AF\u30CB\u30C3\u30AF", trap: "\u30C8\u30E9\u30C3\u30D7" }[k]}\u304C${n}\u679A\uFF08${lo}\u301C${hi}\uFF09`);
  }
  const copies = /* @__PURE__ */ new Map();
  for (const c of list) copies.set(c.no, (copies.get(c.no) ?? 0) + 1);
  for (const [no, n] of copies) if (n > DECK_RULE.copies) errors.push(`${byNo.get(no).name}\u304C${n}\u679A\uFF08\u540C\u3058\u30AB\u30FC\u30C9\u306F2\u679A\u307E\u3067\uFF09`);
  const ssr = list.filter((c) => c.rarity === "SSR").length, ur = list.filter((c) => c.rarity === "UR").length;
  if (ssr > DECK_RULE.SSR) errors.push(`SSR\u304C${ssr}\u679A\uFF082\u679A\u307E\u3067\uFF09`);
  if (ur > DECK_RULE.UR) errors.push(`UR\u304C${ur}\u679A\uFF081\u679A\u307E\u3067\uFF09`);
  return { ok: errors.length === 0, errors };
}
__name(checkDeck, "checkDeck");
var STARTER = {
  //   2026-10-04 潮1で出せるイカを1枚→5枚に（スルメ・ヤリ・ハリ・スレたイカ→シリヤケ×2・ヒメコウ×2）。先攻の潮止まり83%→36%、部長に勝つ割合は39%→38%で同じ（ぱっぱ）
  squid: [14, 14, 15, 28, 29, 6, 5, 12, 4, 4, 1, 2, 2, 24, 24],
  // アオリ×2・アカ・アルゼンチン・NZスルメ・スルメ・ヤリ・トビ・ケンサキ×2・ヒイカ・シリヤケ×2・ヒメコウ×2
  tech: [51, 51, 65, 65, 66, 64, 70, 69, 67, 55, 68],
  // しゃくり×2・2段×2・3段・ディープ・朝マズメ・夕マズメ・スラック・フリーフォール・常夜灯
  trap: [96, 99, 103, 108]
  // 根掛かり・濁り潮・バラシ・フグ
};
var PRACTICE = {
  squid: [6, 6, 5, 4, 4, 11, 21, 23, 2, 2, 3, 3, 1, 22],
  // Nだけ。スルメ×2・ヤリ・ケンサキ×2・ハリ・欧州コウ・カリフォルニアヤリ…
  tech: [51, 51, 64, 52, 54, 55, 58, 61, 63, 60, 56],
  trap: [96, 99, 101, 97, 98]
};
function starterDeck(cards, { practice = false } = {}) {
  const src = practice ? PRACTICE : STARTER;
  const have = new Set(cards.map((c) => c.no));
  const deck = [...src.squid, ...src.tech, ...src.trap].filter((no) => have.has(no));
  return deck;
}
__name(starterDeck, "starterDeck");
var uidSeq = 1;
var inst = /* @__PURE__ */ __name((card) => ({ uid: uidSeq++, no: card.no, card, buffs: [], sick: true, skipNext: false, skipThis: false, attacked: false, shield: false, resting: false, faceDown: false, flags: {} }), "inst");
var player = /* @__PURE__ */ __name((nos, byNo, rnd, { egi = EGI, back = BACK } = {}) => {
  const deck = nos.map((n) => inst(byNo.get(n)));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { deck, hand: [], front: [null, null, null], back: Array(back).fill(null), grave: [], egi, tideMax: 0, tide: 0, tideNext: 0, summoned: false, techUsed: 0, techLimit: null, noAttack: false, lost: null };
}, "player");
var FIELD_RULES = {
  night: { back: BACK },
  summerNight: { back: BACK },
  rough: { back: 4 },
  exam: { back: BACK, first: "cpu" }
};
function newGame({ myDeck, cpuDeck, cards, effects, first = "me", seed = `${Date.now()}`, cpuEgi = EGI, rule = null }) {
  const byNo = new Map(cards.map((c) => [c.no, c]));
  const rnd = seeded(`battle:${seed}`);
  const fr = rule ? FIELD_RULES[rule] : null;
  if (fr?.first) first = fr.first;
  const back = fr?.back ?? BACK;
  const st = { turn: 0, active: first, first, players: { me: player(myDeck, byNo, rnd, { back }), cpu: player(cpuDeck, byNo, rnd, { egi: cpuEgi, back }) }, effects, byNo, log: [], winner: null, rnd, pending: null, rule };
  for (const side of ["me", "cpu"]) dealStart(st, side, rnd);
  startTurn(st);
  return st;
}
__name(newGame, "newGame");
var P = /* @__PURE__ */ __name((st, side) => st.players[side], "P");
var firstTide = /* @__PURE__ */ __name((st, side) => 1 + (side !== st.first ? TAILWIND_TIDE : 0), "firstTide");
function dealStart(st, side, rnd) {
  const p = P(st, side), max = firstTide(st, side);
  const ok = /* @__PURE__ */ __name((x) => x.card.kind === "squid" && x.card.cost <= max, "ok");
  for (let tries = 0; tries < 10; tries++) {
    for (let i = 0; i < START_HAND; i++) draw(st, side);
    if (p.hand.some(ok)) {
      p.shiodome = tries > 0;
      return;
    }
    if (tries === 9) break;
    p.deck.push(...p.hand.splice(0));
    for (let i = p.deck.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p.deck[i], p.deck[j]] = [p.deck[j], p.deck[i]];
    }
  }
  p.shiodome = true;
  const cheap = p.deck.filter(ok).sort((a, b) => a.card.cost - b.card.cost)[0];
  if (!cheap) return;
  const high = [...p.hand].sort((a, b) => b.card.cost - a.card.cost)[0];
  p.hand[p.hand.indexOf(high)] = cheap;
  p.deck[p.deck.indexOf(cheap)] = high;
}
__name(dealStart, "dealStart");
var effectsOf = /* @__PURE__ */ __name((st, no) => st.effects[String(no)] ?? [], "effectsOf");
var passive = /* @__PURE__ */ __name((st, x, name) => effectsOf(st, x.no).some((e) => e.when === "passive" && e.do === name), "passive");
var say = /* @__PURE__ */ __name((st, text) => {
  st.log.push({ turn: st.turn, side: st.active, text });
  if (st.log.length > 200) st.log.shift();
}, "say");
function draw(st, side, n = 1) {
  const p = P(st, side);
  for (let i = 0; i < n; i++) {
    if (!p.deck.length) {
      p.lost = "deck";
      return false;
    }
    if (p.hand.length >= HAND_MAX + 3) return true;
    p.hand.push(p.deck.shift());
  }
  return true;
}
__name(draw, "draw");
function startTurn(st) {
  st.turn += 1;
  const side = st.active, p = P(st, side);
  p.tideMax = Math.min(TIDE_MAX, p.tideMax + 1);
  p.tide = Math.max(0, p.tideMax + p.tideNext);
  p.tideNext = 0;
  p.tailwind = side !== st.first && Math.ceil(st.turn / 2) <= TAILWIND_TURNS;
  if (p.tailwind) p.tide = Math.min(TIDE_MAX, p.tide + TAILWIND_TIDE);
  p.summoned = false;
  p.techUsed = 0;
  p.techLimit = null;
  p.noAttack = st.turn === 1;
  for (const x of p.front) if (x) {
    x.sick = false;
    x.attacked = false;
    x.shield = false;
    x.shakuri = false;
    x.skipThis = x.skipNext;
    x.skipNext = false;
    if (x.resting) {
      x.resting = false;
    }
  }
  if (!draw(st, side)) {
    finish(st, other(side));
    return st;
  }
  fireTraps(st, other(side), "enemyTurnStart", {});
  return st;
}
__name(startTurn, "startTurn");
var overflow = /* @__PURE__ */ __name((st, side) => Math.max(0, P(st, side).hand.length - HAND_MAX), "overflow");
function endTurn(st, { discard = null } = {}) {
  const side = st.active, p = P(st, side);
  const n = overflow(st, side);
  if (n > 0) {
    const chosen = (discard ?? []).filter((x) => p.hand.includes(x)).slice(0, n);
    const rest = p.hand.filter((x) => !chosen.includes(x)).sort((a, b) => b.card.cost - a.card.cost);
    for (const x of [...chosen, ...rest.slice(0, n - chosen.length)]) {
      p.hand.splice(p.hand.indexOf(x), 1);
      p.grave.push(x);
      say(st, `${x.card.name}\u3092\u6368\u3066\u305F\uFF08\u7D0D\u7AFF\uFF09`);
    }
  }
  for (const s of ["me", "cpu"]) for (const x of P(st, s).front) if (x) {
    x.buffs = x.buffs.filter((b) => b.expires > st.turn);
    for (const k of Object.keys(x.flags)) if (x.flags[k] <= st.turn) delete x.flags[k];
  }
  st.active = other(side);
  return startTurn(st);
}
__name(endTurn, "endTurn");
function finish(st, winner) {
  st.winner = winner;
  say(st, winner === "me" ? "\u52DD\u3063\u305F\uFF01" : "\u8CA0\u3051\u305F\u2026");
}
__name(finish, "finish");
function statOf(st, x, stat) {
  if (!x) return 0;
  let v = x.card[stat] ?? 0;
  for (const b of x.buffs) if (b.stat === stat && (b.starts ?? 0) <= st.turn) v += b.n;
  if (stat === "def" && passive(st, x, "defOnEnemyTurn") && ownerOf(st, x) !== st.active) v += effectsOf(st, x.no).find((e) => e.do === "defOnEnemyTurn").n;
  if (stat === "atk" && x.flags.zeroAtk) return 0;
  if (stat === "atk" && st.rule === "night" && markOf(x) === "star") v += 1;
  return Math.max(0, v);
}
__name(statOf, "statOf");
var ownerOf = /* @__PURE__ */ __name((st, x) => P(st, "me").front.includes(x) || P(st, "me").back.includes(x) || P(st, "me").hand.includes(x) ? "me" : "cpu", "ownerOf");
var settle = /* @__PURE__ */ __name((st, x) => {
  buff(st, x, "def", SETTLE_DEF, "oppTurnEnd");
  x.flags.settle = st.turn + 1;
}, "settle");
var buff = /* @__PURE__ */ __name((st, x, stat, n, until) => {
  if (!x) return;
  const expires = until === "forever" ? Infinity : until === "oppTurnEnd" ? st.turn + 1 : until === "nextTurn" ? st.turn + 2 : st.turn;
  x.buffs.push({ stat, n, expires, starts: until === "nextTurn" ? st.turn + 2 : 0 });
}, "buff");
function costOf(st, side, x) {
  const p = P(st, side);
  let c = x.card.cost;
  if (x.card.kind === "tech") {
    if (p.front.some((f) => f && markOf(f) === x.card.mark)) c -= 1;
    if (st.rule === "summerNight" && x.card.mark === "sun") c -= 1;
    for (const f of p.front) if (f) {
      for (const e of effectsOf(st, f.no)) if (e.when === "passive" && e.do === "techCheaper" && (e.only === "all" || e.only === "night" && isNight(x.card))) {
        c -= e.n;
        break;
      }
    }
  }
  return Math.max(0, c);
}
__name(costOf, "costOf");
function resolveWho(st, side, who, ctx) {
  const me = P(st, side), en = P(st, other(side));
  const own = me.front.filter(Boolean), enemy = en.front.filter(Boolean);
  switch (who) {
    case "ownOne":
    case "enemyOne":
    case "ownNightOne":
    case "ownTiredOne":
      return ctx.target ? [ctx.target] : [];
    case "same":
      return ctx.last ? [ctx.last] : [];
    case "ownAll":
      return own;
    case "enemyAll":
      return enemy;
    case "ownNight":
      return own.filter((x) => isNight(x.card));
    case "ownCheap":
      return own.filter((x) => x.card.cost <= 1);
    case "target":
      return ctx.target ? [ctx.target] : [];
    case "attacker":
      return ctx.attacker ? [ctx.attacker] : [];
    case "defender":
      return ctx.defender ? [ctx.defender] : [];
    case "entered":
      return ctx.entered ? [ctx.entered] : [];
    default:
      return [];
  }
}
__name(resolveWho, "resolveWho");
function needsTarget(st, x) {
  const e = effectsOf(st, x.no).find((e2) => ["ownOne", "enemyOne", "ownNightOne", "ownTiredOne"].includes(e2.who) && (e2.when === "play" || e2.when === "enter"));
  return e ? e.who : null;
}
__name(needsTarget, "needsTarget");
function favoriteMark(p, x) {
  const n = {};
  for (const h of p.hand) if (h.card.kind === "tech") n[h.card.mark] = (n[h.card.mark] ?? 0) + 1;
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
  return best ?? (x ? markOf(x) : "anchor");
}
__name(favoriteMark, "favoriteMark");
function removeFromFront(st, side, x) {
  const p = P(st, side);
  const i = p.front.indexOf(x);
  if (i >= 0) p.front[i] = null;
}
__name(removeFromFront, "removeFromFront");
function run(st, side, acts, ctx) {
  const me = P(st, side), en = P(st, other(side));
  for (const a of acts) {
    const targets = a.who ? resolveWho(st, side, a.who, ctx) : [];
    switch (a.do) {
      case "draw":
        draw(st, side, a.n);
        break;
      case "drawEnemy":
        draw(st, other(side), a.n);
        break;
      case "tide":
        me.tide = a.ignoreCap ? me.tide + a.n : Math.min(TIDE_MAX, me.tide + a.n);
        break;
      case "tideEnemyNext":
        en.tideNext += a.n;
        break;
      case "buff":
        for (const x of targets) buff(st, x, a.stat, a.n, a.until);
        if (targets[0]) ctx.last = targets[0];
        break;
      case "shield":
        for (const x of targets) x.shield = true;
        if (targets[0]) ctx.last = targets[0];
        break;
      case "rest":
        for (const x of targets) {
          x.resting = true;
          x.attacked = true;
          buff(st, x, "atk", a.thenAtk, "nextTurn");
        }
        break;
      case "flag":
        for (const x of targets) x.flags[a.flag] = a.until === "forever" ? Infinity : st.turn;
        break;
      case "zeroAtk":
        for (const x of targets) x.flags.zeroAtk = st.turn;
        break;
      case "heal":
        for (const x of targets) {
          x.skipThis = false;
          x.skipNext = false;
        }
        break;
      case "bounce":
        for (const x of targets) {
          const o = ownerOf(st, x);
          removeFromFront(st, o, x);
          x.buffs = [];
          x.flags = {};
          delete x.mark;
          P(st, o).hand.push(x);
        }
        break;
      case "catch":
        for (const x of targets) if (a.maxDef == null || statOf(st, x, "def") <= a.maxDef) caught(st, other(side), x, side);
        break;
      case "tutor": {
        const i = me.deck.findIndex((x) => x.card.name === a.name);
        if (i >= 0) me.hand.push(...me.deck.splice(i, 1));
        break;
      }
      case "tutorSquid": {
        let n = a.n ?? 1;
        for (let i = 0; i < me.deck.length && n > 0; i++) {
          const x = me.deck[i];
          if (x.card.kind === "squid" && (a.maxCost == null || x.card.cost <= a.maxCost)) {
            me.hand.push(...me.deck.splice(i, 1));
            i--;
            n--;
          }
        }
        break;
      }
      case "peekPick": {
        const top = me.deck.slice(0, a.n);
        if (top.length) {
          const best = top.reduce((m, x) => x.card.cost > m.card.cost ? x : m, top[0]);
          me.deck.splice(me.deck.indexOf(best), 1);
          me.hand.push(best);
        }
        break;
      }
      case "summonFromDeck": {
        const slot = me.front.indexOf(null);
        const i = me.deck.findIndex((x) => x.card.kind === "squid" && x.card.cost <= a.maxCost);
        if (slot >= 0 && i >= 0) {
          const x = me.deck.splice(i, 1)[0];
          x.sick = true;
          me.front[slot] = x;
          settle(st, x);
        }
        break;
      }
      case "revealTrap": {
        const i = en.back.findIndex((x) => x && x.card.kind === "trap");
        if (i >= 0) {
          en.grave.push(en.back[i]);
          en.back[i] = null;
          say(st, "\u30C8\u30E9\u30C3\u30D7\u3092\u898B\u7834\u3063\u305F\uFF01");
        }
        break;
      }
      case "changeMark": {
        const m = MARK_IDS.includes(ctx.mark) ? ctx.mark : favoriteMark(me, targets[0]);
        for (const x of targets) {
          x.mark = m;
          say(st, `${x.card.name}\u306E\u30DE\u30FC\u30AF\u304C\u5909\u308F\u3063\u305F`);
        }
        break;
      }
      case "discardEnemy":
        if (en.hand.length) en.grave.push(en.hand.splice(Math.floor(st.rnd() * en.hand.length), 1)[0]);
        break;
      case "limitTech":
        en.techLimit = a.n;
        break;
      case "noAttack":
        en.noAttack = true;
        break;
      case "tire":
        for (const x of targets) x.skipNext = true;
        break;
      case "block":
        ctx.blocked = true;
        break;
      case "negate":
        ctx.negated = true;
        break;
      case "saveToHand":
        ctx.saved = true;
        break;
      default:
        break;
    }
  }
}
__name(run, "run");
function fireTraps(st, side, when, ctx) {
  const p = P(st, side);
  for (let i = 0; i < p.back.length; i++) {
    const x = p.back[i];
    if (!x || x.card.kind !== "trap") continue;
    const acts = effectsOf(st, x.no).filter((e) => e.when === when);
    if (!acts.length) continue;
    if (acts.some((a) => a.onlyNight) && !(ctx.attacker && isNight(ctx.attacker.card))) continue;
    p.back[i] = null;
    p.grave.push(x);
    say(st, `\u30C8\u30E9\u30C3\u30D7\u300C${x.card.name}\u300D\u304C\u958B\u3044\u305F\uFF01`);
    ctx.trap = x;
    run(st, side, acts, ctx);
    return x;
  }
  return null;
}
__name(fireTraps, "fireTraps");
function caught(st, side, x, bySide) {
  const ctx = { defender: x };
  fireTraps(st, side, "ownCaught", ctx);
  removeFromFront(st, side, x);
  x.buffs = [];
  x.flags = {};
  delete x.mark;
  if (ctx.saved) {
    P(st, side).hand.push(x);
    say(st, `${x.card.name}\u306F\u624B\u672D\u306B\u623B\u3063\u305F`);
    return;
  }
  P(st, side).grave.push(x);
  say(st, `${x.card.name}\u3092\u91E3\u3063\u305F\uFF01`);
  run(st, side, effectsOf(st, x.no).filter((e) => e.when === "caught"), { target: pickEnemyForCaught(st, side) });
}
__name(caught, "caught");
var pickEnemyForCaught = /* @__PURE__ */ __name((st, side) => P(st, other(side)).front.filter(Boolean).sort((a, b) => statOf(st, b, "atk") - statOf(st, a, "atk"))[0] ?? null, "pickEnemyForCaught");
function canPlay(st, side, x) {
  const p = P(st, side);
  if (st.active !== side || st.winner) return { ok: false, why: "notYourTurn" };
  if (!p.hand.includes(x)) return { ok: false, why: "notInHand" };
  if (x.card.kind === "squid") {
    if (p.summoned) return { ok: false, why: "summoned" };
    if (!p.front.includes(null)) return { ok: false, why: "frontFull" };
  }
  if (x.card.kind === "trap" && !p.back.includes(null)) return { ok: false, why: "backFull" };
  if (x.card.kind === "tech" && p.techLimit != null && p.techUsed >= p.techLimit) return { ok: false, why: "techLimit" };
  if (costOf(st, side, x) > p.tide) return { ok: false, why: "tide" };
  return { ok: true };
}
__name(canPlay, "canPlay");
function play(st, side, x, { target = null, mark = null } = {}) {
  const c = canPlay(st, side, x);
  if (!c.ok) return c;
  const p = P(st, side), en = P(st, other(side));
  const need = needsTarget(st, x);
  if (need && !target) return { ok: false, why: "needTarget", who: need };
  p.tide -= costOf(st, side, x);
  p.hand.splice(p.hand.indexOf(x), 1);
  const ctx = { target, mark };
  if (x.card.kind === "squid") {
    x.sick = true;
    x.attacked = false;
    x.skipNext = false;
    x.skipThis = false;
    p.front[p.front.indexOf(null)] = x;
    p.summoned = true;
    settle(st, x);
    say(st, `${x.card.name}\u3092\u51FA\u3057\u305F`);
    run(st, side, effectsOf(st, x.no).filter((e) => e.when === "enter"), ctx);
    fireTraps(st, other(side), "enemySquidEnter", { entered: x });
  } else if (x.card.kind === "tech") {
    p.techUsed += 1;
    say(st, `${x.card.name}\uFF01`);
    fireTraps(st, other(side), "enemyTech", ctx);
    if (ctx.negated) {
      say(st, `${x.card.name}\u306F\u7121\u52B9\u306B\u306A\u3063\u305F`);
      p.grave.push(x);
      return { ok: true, negated: true };
    }
    run(st, side, effectsOf(st, x.no).filter((e) => e.when === "play"), ctx);
    p.grave.push(x);
  } else {
    x.faceDown = true;
    p.back[p.back.indexOf(null)] = x;
    say(st, "\u30AB\u30FC\u30C9\u3092\u4F0F\u305B\u305F");
  }
  check(st);
  return { ok: true };
}
__name(play, "play");
function canShakuri(st, side, x) {
  const p = P(st, side);
  if (st.active !== side || st.winner) return { ok: false, why: "notYourTurn" };
  if (!p.front.includes(x)) return { ok: false, why: "notOnField" };
  if (x.shakuri) return { ok: false, why: "shakuried" };
  if (p.tide < SHAKURI_COST) return { ok: false, why: "tide" };
  return { ok: true };
}
__name(canShakuri, "canShakuri");
function shakuri(st, side, x) {
  const c = canShakuri(st, side, x);
  if (!c.ok) return c;
  P(st, side).tide -= SHAKURI_COST;
  x.shakuri = true;
  buff(st, x, "atk", SHAKURI_ATK, "turnEnd");
  say(st, `${x.card.name}\u3092\u6F6E\u3067\u3057\u3083\u304F\u3063\u305F\uFF08\u653B\u6483+${SHAKURI_ATK}\uFF09`);
  return { ok: true };
}
__name(shakuri, "shakuri");
function canAttack(st, side, x) {
  const p = P(st, side);
  if (st.active !== side || st.winner) return { ok: false, why: "notYourTurn" };
  if (!p.front.includes(x)) return { ok: false, why: "notOnField" };
  if (p.noAttack) return { ok: false, why: "noAttack" };
  if (x.attacked) return { ok: false, why: "attacked" };
  if (x.sick && !passive(st, x, "haste")) return { ok: false, why: "sick" };
  if (x.skipThis) return { ok: false, why: "tired" };
  return { ok: true };
}
__name(canAttack, "canAttack");
function attack(st, side, x, target = null) {
  const c = canAttack(st, side, x);
  if (!c.ok) return c;
  const en = P(st, other(side));
  const enemies = en.front.filter(Boolean);
  if (enemies.length && (!target || !enemies.includes(target))) return { ok: false, why: "mustTargetSquid" };
  if (!enemies.length && target) return { ok: false, why: "noTarget" };
  if (target && target.shield) return { ok: false, why: "shielded" };
  x.attacked = true;
  const ctx = { attacker: x, defender: target };
  const ignore = passive(st, x, "ignoreTrapOnAttack") || x.flags.ignoreTrap != null;
  say(st, `${x.card.name}\u306E\u653B\u6483\uFF01`);
  if (!ignore) fireTraps(st, other(side), "enemyAttack", ctx);
  if (ctx.blocked) {
    say(st, "\u653B\u6483\u306F\u6B62\u3081\u3089\u308C\u305F");
    check(st);
    return { ok: true, result: "trapped", trap: ctx.trap };
  }
  run(st, side, effectsOf(st, x.no).filter((e) => e.when === "attack"), { target });
  if (!target) {
    en.egi -= 1;
    say(st, `\u30C0\u30A4\u30EC\u30AF\u30C8\u30A2\u30BF\u30C3\u30AF\uFF01 \u30A8\u30AE\u30921\u500B\u596A\u3063\u305F\uFF08\u6B8B\u308A${en.egi}\uFF09`);
    if (en.egi <= 0) {
      finish(st, side);
      return { ok: true, result: "direct", win: true };
    }
    draw(st, other(side), 1);
    check(st);
    return { ok: true, result: "direct", trap: ctx.trap };
  }
  const A = statOf(st, x, "atk"), D = statOf(st, target, "def");
  const tieWins = passive(st, x, "tieWins") || x.flags.tieWins != null;
  let result;
  if (A > D || A === D && tieWins) {
    caught(st, other(side), target, side);
    result = "catch";
  } else if (A === D) {
    say(st, "\u4E92\u89D2\uFF01 \u3069\u3061\u3089\u3082\u6B8B\u3063\u305F");
    result = "tie";
  } else {
    say(st, `${target.card.name}\u306B\u5F3E\u304B\u308C\u305F`);
    if (!passive(st, x, "noTiredWhenBlocked")) x.skipNext = true;
    buff(st, target, "def", -WEAR_DEF, "forever");
    result = "blocked";
  }
  check(st);
  return { ok: true, result, A, D, trap: ctx.trap };
}
__name(attack, "attack");
function check(st) {
  if (st.winner) return;
  for (const s of ["me", "cpu"]) {
    const p = P(st, s);
    if (p.egi <= 0 || p.lost) {
      finish(st, other(s));
      return;
    }
  }
}
__name(check, "check");

// src/match.js
var TURN_MS = 6e4;
var LEAVE_MS = 3e4;
var SIDE = { a: "me", b: "cpu" };
var otherSeat = /* @__PURE__ */ __name((seat) => seat === "a" ? "b" : "a", "otherSeat");
var BIG = 1e9;
var num = /* @__PURE__ */ __name((v) => v === Infinity ? BIG : v, "num");
var serCard = /* @__PURE__ */ __name((x) => {
  if (!x) return null;
  const { card, ...rest } = x;
  return { ...rest, buffs: x.buffs.map((b) => ({ ...b, expires: num(b.expires), starts: num(b.starts ?? 0) })), flags: Object.fromEntries(Object.entries(x.flags).map(([k, v]) => [k, num(v)])) };
}, "serCard");
var facedown = /* @__PURE__ */ __name((x) => x ? { uid: x.uid, no: null, hidden: true, card: { kind: "trap", name: "", cost: 0 }, buffs: [], flags: {} } : null, "facedown");
var inHand = /* @__PURE__ */ __name((x) => ({ uid: x.uid, no: null, hidden: true, card: { kind: "hidden", name: "", cost: 0 }, buffs: [], flags: {} }), "inHand");
function createMatch({ cards, effects, deckA = null, deckB = null, seed = `${Date.now()}`, first = null } = {}) {
  const same = starterDeck(cards);
  const myDeck = deckA ?? same, cpuDeck = deckB ?? same;
  for (const [name, d] of [["a", myDeck], ["b", cpuDeck]]) {
    const c = checkDeck(d, cards);
    if (!c.ok) throw new Error(`deck ${name}: ${c.errors.join("\u30FB")}`);
  }
  const st = newGame({ myDeck, cpuDeck, cards, effects, first: first ?? (Math.random() < 0.5 ? "me" : "cpu"), seed });
  const m = { st, deadline: 0 };
  const P2 = /* @__PURE__ */ __name((side) => st.players[side], "P");
  const byUid = /* @__PURE__ */ __name((list, uid) => list.find((x) => x && String(x.uid) === String(uid)) ?? null, "byUid");
  m.viewFor = (seat) => {
    const me = SIDE[seat], op = SIDE[otherSeat(seat)];
    const rel = /* @__PURE__ */ __name((s) => s == null ? null : s === me ? "me" : "cpu", "rel");
    const pub = /* @__PURE__ */ __name((p, mine) => ({
      egi: p.egi,
      tide: p.tide,
      tideMax: p.tideMax,
      tideNext: p.tideNext,
      tailwind: !!p.tailwind,
      summoned: p.summoned,
      techUsed: p.techUsed,
      techLimit: p.techLimit,
      noAttack: p.noAttack,
      lost: p.lost,
      shiodome: !!p.shiodome,
      front: p.front.map(serCard),
      back: p.back.map(mine ? serCard : facedown),
      hand: mine ? p.hand.map(serCard) : p.hand.map(inHand),
      grave: p.grave.map(serCard),
      deck: p.deck.length
    }), "pub");
    return { turn: st.turn, active: rel(st.active), first: rel(st.first), winner: rel(st.winner), rule: st.rule, log: st.log.map((l) => ({ ...l, side: rel(l.side) })), players: { me: pub(P2(me), true), cpu: pub(P2(op), false) }, deadline: m.deadline };
  };
  const slim = /* @__PURE__ */ __name((r) => {
    if (!r) return r;
    const { trap, caught: caught2, ...rest } = r;
    if (trap) rest.trap = { uid: trap.uid, no: trap.no };
    if (caught2) rest.caught = { uid: caught2.uid, no: caught2.no };
    return rest;
  }, "slim");
  m.act = (seat, msg) => {
    const side = SIDE[seat], en = P2(SIDE[otherSeat(seat)]), p = P2(side);
    st.log = [];
    if (st.winner) return { r: { ok: false, why: "over" } };
    if (st.active !== side) return { r: { ok: false, why: "notYourTurn" } };
    switch (msg?.kind) {
      case "play": {
        const x = byUid(p.hand, msg.uid);
        if (!x) return { r: { ok: false, why: "notInHand" } };
        const target = msg.target != null ? byUid(p.front, msg.target) ?? byUid(en.front, msg.target) : null;
        if (msg.target != null && !target) return { r: { ok: false, why: "noTarget" } };
        const r = play(st, side, x, { target, mark: msg.mark ?? null });
        return { r: slim(r), a: r.ok ? { kind: "play", uid: x.uid, no: x.card.kind === "trap" ? null : x.no, cardKind: x.card.kind, target: target?.uid ?? null } : null };
      }
      case "attack": {
        const x = byUid(p.front, msg.uid);
        if (!x) return { r: { ok: false, why: "notOnField" } };
        const target = msg.target != null ? byUid(en.front, msg.target) : null;
        if (msg.target != null && !target) return { r: { ok: false, why: "noTarget" } };
        const r = attack(st, side, x, target);
        if (r.ok && r.result === "catch") r.caught = target;
        return { r: slim(r), a: r.ok ? { kind: "attack", uid: x.uid, target: target?.uid ?? null } : null };
      }
      case "shakuri": {
        const x = byUid(p.front, msg.uid);
        if (!x) return { r: { ok: false, why: "notOnField" } };
        const r = shakuri(st, side, x);
        return { r: slim(r), a: r.ok ? { kind: "shakuri", uid: x.uid } : null };
      }
      case "end": {
        const discard = (msg.discard ?? []).map((u) => byUid(p.hand, u)).filter(Boolean);
        endTurn(st, { discard });
        return { r: { ok: true }, a: { kind: "end" } };
      }
      default:
        return { r: { ok: false, why: "badAction" } };
    }
  };
  m.autoEnd = () => {
    st.log = [];
    if (st.winner) return null;
    endTurn(st);
    return { kind: "end", auto: true };
  };
  m.resign = (seat) => {
    st.log = [];
    if (st.winner) return null;
    st.winner = SIDE[otherSeat(seat)];
    st.log.push({ turn: st.turn, side: st.active, text: "\u76F8\u624B\u304C\u964D\u53C2\u3057\u305F" });
    return { kind: "resign", seat };
  };
  m.activeSeat = () => st.active === "me" ? "a" : "b";
  m.over = () => !!st.winner;
  return m;
}
__name(createMatch, "createMatch");

// ../../src/js/ikabu/games/cards-data.json
var cards_data_default = [
  {
    no: 1,
    name: "\u30B8\u30F3\u30C9\u30A6\u30A4\u30AB\uFF08\u30D2\u30A4\u30AB\uFF09",
    kind: "squid",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: 1,
    effect: "\u51FA\u305F\u6642\u306B1\u679A\u5F15\u304F",
    short: null,
    def: 2
  },
  {
    no: 2,
    name: "\u30B7\u30EA\u30E4\u30B1\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: 2,
    effect: "\u2014",
    short: null,
    def: 2
  },
  {
    no: 3,
    name: "\u30B3\u30A6\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "wave",
    cost: 2,
    atk: 2,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306F\u9632\u5FA1+1",
    short: null,
    def: 4
  },
  {
    no: 4,
    name: "\u30B1\u30F3\u30B5\u30AD\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "sun",
    cost: 2,
    atk: 3,
    effect: "\u591C\u306E\u30C6\u30AF\u30CB\u30C3\u30AF\u304C\u6F6E1\u5B89\u3044",
    short: null,
    def: 3
  },
  {
    no: 5,
    name: "\u30E4\u30EA\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "star",
    cost: 2,
    atk: 4,
    effect: "\u51FA\u305F\u30BF\u30FC\u30F3\u306B\u653B\u6483\u3067\u304D\u308B",
    short: null,
    def: 1
  },
  {
    no: 6,
    name: "\u30B9\u30EB\u30E1\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "anchor",
    cost: 3,
    atk: 4,
    effect: "\u2014",
    short: null,
    def: 4
  },
  {
    no: 7,
    name: "\u30DB\u30BF\u30EB\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "star",
    cost: 1,
    atk: 1,
    effect: "\u91E3\u3089\u308C\u305F\u6642\u3001\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u306E\u653B\u6483-1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 1
  },
  {
    no: 8,
    name: "\u30DF\u30DF\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: 1,
    effect: "\u2014",
    short: null,
    def: 3
  },
  {
    no: 9,
    name: "\u30D2\u30E1\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: 1,
    effect: "\u51FA\u305F\u6642\u3001\u6F6E+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 1
  },
  {
    no: 10,
    name: "\u30C0\u30F3\u30B4\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: 2,
    effect: "\u2014",
    short: null,
    def: 2
  },
  {
    no: 11,
    name: "\u30CF\u30EA\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "wave",
    cost: 2,
    atk: 3,
    effect: "\u2014",
    short: null,
    def: 3
  },
  {
    no: 12,
    name: "\u30C8\u30D3\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "sun",
    cost: 2,
    atk: 4,
    effect: "\u51FA\u305F\u30BF\u30FC\u30F3\u306B\u653B\u6483\u3067\u304D\u308B",
    short: null,
    def: 2
  },
  {
    no: 13,
    name: "\u30AB\u30DF\u30CA\u30EA\u30A4\u30AB\uFF08\u30E2\u30F3\u30B4\u30A6\u30A4\u30AB\uFF09",
    kind: "squid",
    rarity: "R",
    mark: "shell",
    cost: 3,
    atk: 3,
    effect: "\u300C\u30D0\u30E9\u30B7\u300D\u306B\u306A\u3089\u306A\u3044",
    short: null,
    def: 6
  },
  {
    no: 14,
    name: "\u30A2\u30AA\u30EA\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "wave",
    cost: 3,
    atk: 5,
    effect: "\u653B\u6483\u3057\u305F\u6642\u3001\u76F8\u624B\u306E\u6B21\u306E\u30C8\u30E9\u30C3\u30D7\u3092\u7121\u52B9",
    short: null,
    def: 5
  },
  {
    no: 15,
    name: "\u30A2\u30AB\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "sun",
    cost: 4,
    atk: 6,
    effect: "\u51FA\u305F\u6642\u3001\u76F8\u624B\u306E\u30A4\u30AB1\u4F53\u306E\u9632\u5FA1-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 4
  },
  {
    no: 16,
    name: "\u30C9\u30B9\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "anchor",
    cost: 3,
    atk: 4,
    effect: "\u2014",
    short: null,
    def: 5
  },
  {
    no: 17,
    name: "\u30B3\u30D6\u30B7\u30E1",
    kind: "squid",
    rarity: "R",
    mark: "wave",
    cost: 4,
    atk: 5,
    effect: "\u91E3\u3089\u308C\u305F\u6642\u3001\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483-1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 6
  },
  {
    no: 18,
    name: "\u30C6\u30AB\u30AE\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "anchor",
    cost: 3,
    atk: 6,
    effect: "\u653B\u6483\u3057\u305F\u6642\u3001\u76F8\u624B\u306E\u30A4\u30AB\u306E\u9632\u5FA1-1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 3
  },
  {
    no: 19,
    name: "\u30CB\u30E5\u30A6\u30C9\u30A6\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "wave",
    cost: 5,
    atk: 6,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306F\u9632\u5FA1+1",
    short: null,
    def: 8
  },
  {
    no: 20,
    name: "\u30BD\u30C7\u30A4\u30AB",
    kind: "squid",
    rarity: "SSR",
    mark: "anchor",
    cost: 5,
    atk: 8,
    effect: "\u5F3E\u304B\u308C\u3066\u3082\u300C\u30D0\u30E9\u30B7\u300D\u306B\u306A\u3089\u306A\u3044",
    short: null,
    def: 8
  },
  {
    no: 21,
    name: "\u30E8\u30FC\u30ED\u30C3\u30D1\u30B3\u30A6\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "wave",
    cost: 2,
    atk: 3,
    effect: "\u2014",
    short: null,
    def: 4
  },
  {
    no: 22,
    name: "\u30E8\u30FC\u30ED\u30C3\u30D1\u30E4\u30EA\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "star",
    cost: 2,
    atk: 4,
    effect: "\u2014",
    short: null,
    def: 2
  },
  {
    no: 23,
    name: "\u30AB\u30EA\u30D5\u30A9\u30EB\u30CB\u30A2\u30E4\u30EA\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "star",
    cost: 2,
    atk: 3,
    effect: "\u51FA\u305F\u6642\u306B1\u679A\u5F15\u304F",
    short: null,
    def: 3
  },
  {
    no: 24,
    name: "\u30D2\u30E1\u30B3\u30A6\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: 2,
    effect: "\u2014",
    short: null,
    def: 3
  },
  {
    no: 25,
    name: "\u30B9\u30B8\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "sun",
    cost: 2,
    atk: 3,
    effect: "\u2014",
    short: null,
    def: 2
  },
  {
    no: 26,
    name: "\u30DC\u30A6\u30BA\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: 1,
    effect: "\u2014",
    short: null,
    def: 3
  },
  {
    no: 27,
    name: "\u30CF\u30EF\u30A4\u30DF\u30DF\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "shell",
    cost: 2,
    atk: 2,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306F\u9632\u5FA1+1",
    short: null,
    def: 4
  },
  {
    no: 28,
    name: "\u30A2\u30EB\u30BC\u30F3\u30C1\u30F3\u30A4\u30EC\u30C3\u30AF\u30B9",
    kind: "squid",
    rarity: "R",
    mark: "anchor",
    cost: 3,
    atk: 5,
    effect: "\u2014",
    short: null,
    def: 4
  },
  {
    no: 29,
    name: "\u30CB\u30E5\u30FC\u30B8\u30FC\u30E9\u30F3\u30C9\u30B9\u30EB\u30E1\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "anchor",
    cost: 3,
    atk: 5,
    effect: "\u2014",
    short: null,
    def: 4
  },
  {
    no: 30,
    name: "\u30BF\u30B3\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "wave",
    cost: 3,
    atk: 4,
    effect: "\u2014",
    short: null,
    def: 5
  },
  {
    no: 31,
    name: "\u30CF\u30CA\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "sun",
    cost: 3,
    atk: 5,
    effect: "\u51FA\u305F\u6642\u3001\u76F8\u624B\u306E\u30A4\u30AB1\u4F53\u306E\u653B\u6483-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 4
  },
  {
    no: 32,
    name: "\u30D2\u30ED\u30D3\u30EC\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "wave",
    cost: 4,
    atk: 6,
    effect: "\u2014",
    short: null,
    def: 6
  },
  {
    no: 33,
    name: "\u30AA\u30FC\u30B9\u30C8\u30E9\u30EA\u30A2\u30B3\u30A6\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "shell",
    cost: 4,
    atk: 6,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306F\u9632\u5FA1+1",
    short: null,
    def: 7
  },
  {
    no: 34,
    name: "\u30A2\u30E1\u30EA\u30AB\u30AA\u30AA\u30A2\u30AB\u30A4\u30AB",
    kind: "squid",
    rarity: "SSR",
    mark: "sun",
    cost: 5,
    atk: 8,
    effect: "\u653B\u6483\u3057\u305F\u6642\u3001\u76F8\u624B\u306E\u30A4\u30AB\u306E\u9632\u5FA1-1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 7
  },
  {
    no: 35,
    name: "\u30AB\u30AE\u30A4\u30AB",
    kind: "squid",
    rarity: "SSR",
    mark: "anchor",
    cost: 5,
    atk: 7,
    effect: "\u5F3E\u304B\u308C\u3066\u3082\u300C\u30D0\u30E9\u30B7\u300D\u306B\u306A\u3089\u306A\u3044",
    short: null,
    def: 9
  },
  {
    no: 36,
    name: "\u30DB\u30A6\u30BA\u30AD\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "star",
    cost: 1,
    atk: 1,
    effect: "\u2014",
    short: null,
    def: 3
  },
  {
    no: 37,
    name: "\u30AF\u30E9\u30B2\u30A4\u30AB",
    kind: "squid",
    rarity: "N",
    mark: "star",
    cost: 2,
    atk: 2,
    effect: "\u51FA\u305F\u6642\u3001\u6F6E+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 3
  },
  {
    no: 38,
    name: "\u30D2\u30AB\u30EA\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "sun",
    cost: 2,
    atk: 3,
    effect: "\u51FA\u305F\u6642\u306B1\u679A\u5F15\u304F",
    short: null,
    def: 3
  },
  {
    no: 39,
    name: "\u30B5\u30E1\u30CF\u30C0\u30DB\u30A6\u30BA\u30AD\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "wave",
    cost: 3,
    atk: 3,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306F\u9632\u5FA1+1",
    short: null,
    def: 6
  },
  {
    no: 40,
    name: "\u30C4\u30E1\u30A4\u30AB",
    kind: "squid",
    rarity: "R",
    mark: "anchor",
    cost: 3,
    atk: 5,
    effect: "\u2014",
    short: null,
    def: 4
  },
  {
    no: 41,
    name: "\u30E4\u30C4\u30C7\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "wave",
    cost: 4,
    atk: 5,
    effect: "\u2014",
    short: null,
    def: 7
  },
  {
    no: 42,
    name: "\u30E6\u30A6\u30EC\u30A4\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "star",
    cost: 4,
    atk: 6,
    effect: "\u653B\u6483\u3057\u305F\u6642\u3001\u76F8\u624B\u306E\u30A4\u30AB\u306E\u653B\u6483-1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 5
  },
  {
    no: 43,
    name: "\u30DF\u30BA\u30D2\u30AD\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "star",
    cost: 4,
    atk: 5,
    effect: "\u51FA\u305F\u6642\u3001\u76F8\u624B\u306E\u30A4\u30AB1\u4F53\u306E\u653B\u6483-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 7
  },
  {
    no: 44,
    name: "\u30B3\u30A6\u30E2\u30EA\u30C0\u30B3",
    kind: "squid",
    rarity: "SSR",
    mark: "shell",
    cost: 5,
    atk: 7,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306F\u9632\u5FA1+1",
    short: null,
    def: 9
  },
  {
    no: 45,
    name: "\u30C0\u30A4\u30AA\u30A6\u30DB\u30A6\u30BA\u30AD\u30A4\u30AB",
    kind: "squid",
    rarity: "UR",
    mark: "anchor",
    cost: 5,
    atk: 10,
    effect: "\u51FA\u305F\u6642\u3001\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u306E\u653B\u6483-3\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 9
  },
  {
    no: 46,
    name: "\u30C0\u30A4\u30AA\u30A6\u30A4\u30AB",
    kind: "squid",
    rarity: "UR",
    mark: "wave",
    cost: 5,
    atk: 9,
    effect: "\u51FA\u305F\u6642\u3001\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u3092\u624B\u672D\u306B\u623B\u3059",
    short: null,
    def: 10
  },
  {
    no: 47,
    name: "\u65B0\u5B50\uFF08\u30A2\u30AA\u30EA\u306E\u5B50\uFF09",
    kind: "squid",
    rarity: "N",
    mark: "wave",
    cost: 1,
    atk: 1,
    effect: "\u91E3\u3089\u308C\u305F\u6642\u3001\u5C71\u672D\u306E\u30A2\u30AA\u30EA\u30A4\u30AB\u3092\u624B\u672D\u306B",
    short: null,
    def: 1
  },
  {
    no: 48,
    name: "\u30A2\u30AA\u30EA\u30A4\u30AB\uFF08\u6625\u306E\u5927\u7269\uFF09",
    kind: "squid",
    rarity: "SR",
    mark: "wave",
    cost: 4,
    atk: 7,
    effect: "\u653B\u6483\u3057\u305F\u6642\u3001\u76F8\u624B\u306E\u30C8\u30E9\u30C3\u30D7\u304C\u958B\u304B\u306A\u3044",
    short: null,
    def: 6
  },
  {
    no: 49,
    name: "\u30E4\u30EA\u30A4\u30AB\u306E\u7FA4\u308C",
    kind: "squid",
    rarity: "SR",
    mark: "star",
    cost: 4,
    atk: 6,
    effect: "\u51FA\u305F\u6642\u3001\u5C71\u672D\u304B\u3089\u30E4\u30EA\u30A4\u30AB\u30921\u4F53\u624B\u672D\u306B",
    short: null,
    def: 5
  },
  {
    no: 50,
    name: "\u90E8\u9577\u30A2\u30AA\u30EA\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "star",
    cost: 3,
    atk: 5,
    effect: "\u5834\u306B\u3044\u308B\u9593\u3001\u30C6\u30AF\u30CB\u30C3\u30AF\u304C\u5168\u90E8\u6F6E1\u5B89\u3044",
    short: null,
    def: 5
  },
  {
    no: 51,
    name: "\u3057\u3083\u304F\u308A",
    kind: "tech",
    rarity: "N",
    mark: "anchor",
    cost: 1,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+2",
    def: null
  },
  {
    no: 52,
    name: "\u30EF\u30F3\u30D4\u30C3\u30C1\u30B8\u30E3\u30FC\u30AF",
    kind: "tech",
    rarity: "N",
    mark: "anchor",
    cost: 1,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+1\u3001\u9632\u5FA1+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+1\u30FB\u9632\u5FA1+1",
    def: null
  },
  {
    no: 53,
    name: "\u30C0\u30FC\u30C8",
    kind: "tech",
    rarity: "N",
    mark: "sun",
    cost: 1,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306F\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\u653B\u6483\u3055\u308C\u306A\u3044",
    short: "\u56DE\u907F",
    def: null
  },
  {
    no: 54,
    name: "\u30C6\u30F3\u30B7\u30E7\u30F3\u30D5\u30A9\u30FC\u30EB",
    kind: "tech",
    rarity: "N",
    mark: "wave",
    cost: 1,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u9632\u5FA1+2\uFF08\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\uFF09",
    short: "\u9632\u5FA1+2",
    def: null
  },
  {
    no: 55,
    name: "\u30D5\u30EA\u30FC\u30D5\u30A9\u30FC\u30EB",
    kind: "tech",
    rarity: "N",
    mark: "star",
    cost: 1,
    atk: null,
    effect: "1\u679A\u5F15\u304F",
    short: "\u30C9\u30ED\u30FC1",
    def: null
  },
  {
    no: 56,
    name: "\u30AB\u30FC\u30D6\u30D5\u30A9\u30FC\u30EB",
    kind: "tech",
    rarity: "N",
    mark: "wave",
    cost: 1,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u9632\u5FA1+1\uFF08\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\uFF09\u30011\u679A\u5F15\u304F",
    short: "\u9632\u5FA1+1",
    def: null
  },
  {
    no: 57,
    name: "\u30B9\u30C6\u30A4",
    kind: "tech",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306F\u3053\u306E\u30BF\u30FC\u30F3\u653B\u6483\u3057\u306A\u3044\u4EE3\u308F\u308A\u306B\u3001\u6B21\u306E\u30BF\u30FC\u30F3\u653B\u6483+2",
    short: "\u653B\u6483+2",
    def: null
  },
  {
    no: 58,
    name: "\u6F6E\u307E\u308F\u308A",
    kind: "tech",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: null,
    effect: "\u6F6E+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\u3060\u3051\uFF09",
    short: "\u6F6E+1",
    def: null
  },
  {
    no: 59,
    name: "\u30E9\u30F3\u30AC\u30F3",
    kind: "tech",
    rarity: "N",
    mark: "sun",
    cost: 1,
    atk: null,
    effect: "\u5834\u306E\u30A4\u30AB1\u4F53\u3092\u624B\u672D\u306B\u623B\u3057\u3066\u30011\u679A\u5F15\u304F",
    short: "\u30C9\u30ED\u30FC1",
    def: null
  },
  {
    no: 60,
    name: "\u6F6E\u8AAD\u307F",
    kind: "tech",
    rarity: "N",
    mark: "wave",
    cost: 1,
    atk: null,
    effect: "\u5C71\u672D\u306E\u4E0A\u304B\u30892\u679A\u3092\u898B\u3066\u30011\u679A\u3092\u624B\u672D\u306B",
    short: "\u30B5\u30FC\u30C1",
    def: null
  },
  {
    no: 61,
    name: "\u98A8\u88CF\u3092\u63A2\u3059",
    kind: "tech",
    rarity: "N",
    mark: "star",
    cost: 3,
    atk: null,
    effect: "\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u3092\u624B\u672D\u306B\u623B\u3059",
    short: "\u76F8\u624B\u3092\u623B\u3059",
    def: null
  },
  {
    no: 62,
    name: "\u58A8\u8DE1\u30C1\u30A7\u30C3\u30AF",
    kind: "tech",
    rarity: "N",
    mark: "anchor",
    cost: 1,
    atk: null,
    effect: "\u5C71\u672D\u304B\u3089\u30A4\u30AB1\u4F53\u3092\u624B\u672D\u306B\uFF08\u6F6E2\u4EE5\u4E0B\uFF09",
    short: "\u30B5\u30FC\u30C1",
    def: null
  },
  {
    no: 63,
    name: "3.5\u53F7\u30A8\u30AE",
    kind: "tech",
    rarity: "N",
    mark: "anchor",
    cost: 2,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+2\u3001\u9632\u5FA1-1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+2\u30FB\u9632\u5FA1-1",
    def: null
  },
  {
    no: 64,
    name: "\u30C7\u30A3\u30FC\u30D7\u30BF\u30A4\u30D7",
    kind: "tech",
    rarity: "N",
    mark: "wave",
    cost: 2,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+2",
    def: null
  },
  {
    no: 65,
    name: "2\u6BB5\u3057\u3083\u304F\u308A",
    kind: "tech",
    rarity: "R",
    mark: "anchor",
    cost: 2,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+3\u3001\u3055\u3089\u306B1\u679A\u5F15\u304F",
    short: "\u653B\u6483+3",
    def: null
  },
  {
    no: 66,
    name: "3\u6BB5\u3057\u3083\u304F\u308A",
    kind: "tech",
    rarity: "R",
    mark: "anchor",
    cost: 3,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+4\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+4",
    def: null
  },
  {
    no: 67,
    name: "\u30B9\u30E9\u30C3\u30AF\u30B8\u30E3\u30FC\u30AF",
    kind: "tech",
    rarity: "R",
    mark: "star",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u306E\u9632\u5FA1-3\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u76F8\u624B\u9632\u5FA1-3",
    def: null
  },
  {
    no: 68,
    name: "\u5E38\u591C\u706F",
    kind: "tech",
    rarity: "R",
    mark: "sun",
    cost: 2,
    atk: null,
    effect: "2\u679A\u5F15\u304F",
    short: "\u30C9\u30ED\u30FC2",
    def: null
  },
  {
    no: 69,
    name: "\u5915\u30DE\u30BA\u30E1\uFF08\u6642\u5408\u3044\uFF09",
    kind: "tech",
    rarity: "R",
    mark: "sun",
    cost: 3,
    atk: null,
    effect: "\u81EA\u5206\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+1",
    def: null
  },
  {
    no: 70,
    name: "\u671D\u30DE\u30BA\u30E1",
    kind: "tech",
    rarity: "R",
    mark: "sun",
    cost: 2,
    atk: null,
    effect: "\u81EA\u5206\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u306E\u653B\u6483+2\u30011\u679A\u5F15\u304F",
    short: "\u653B\u6483+2",
    def: null
  },
  {
    no: 71,
    name: "\u30CA\u30A4\u30C8\u30A8\u30AE\u30F3\u30B0",
    kind: "tech",
    rarity: "R",
    mark: "star",
    cost: 2,
    atk: null,
    effect: "\u591C\u306E\u30A4\u30AB\uFF08\u30B1\u30F3\u30B5\u30AD\u30FB\u30E4\u30EA\u30FB\u30A2\u30AB\u30FB\u30DB\u30BF\u30EB\uFF09\u306E\u653B\u6483+2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+2",
    def: null
  },
  {
    no: 72,
    name: "\u30B5\u30A4\u30C8\u30A8\u30AE\u30F3\u30B0",
    kind: "tech",
    rarity: "R",
    mark: "sun",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u306E\u3075\u305B\u30AB\u30FC\u30C91\u679A\u3092\u898B\u308B\u3002\u30C8\u30E9\u30C3\u30D7\u306A\u3089\u6368\u3066\u3055\u305B\u308B",
    short: "\u30C8\u30E9\u30C3\u30D7\u9664\u53BB",
    def: null
  },
  {
    no: 73,
    name: "\u30C9\u30EA\u30D5\u30C8",
    kind: "tech",
    rarity: "R",
    mark: "wave",
    cost: 2,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306F\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\u653B\u6483\u3055\u308C\u305A\u3001\u6B21\u306E\u30BF\u30FC\u30F3\u653B\u6483+1",
    short: "\u56DE\u907F\u30FB\u653B\u6483+1",
    def: null
  },
  {
    no: 74,
    name: "\u30A8\u30AE\u306E\u30AB\u30E9\u30FC\u30C1\u30A7\u30F3\u30B8",
    kind: "tech",
    rarity: "R",
    mark: "shell",
    cost: 1,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u30DE\u30FC\u30AF\u3092\u597D\u304D\u306A\u30DE\u30FC\u30AF\u306B\u5909\u3048\u308B",
    short: "\u30DE\u30FC\u30AF\u5909\u66F4",
    def: null
  },
  {
    no: 75,
    name: "\u30B1\u30A4\u30E0\u30E9\u30AB\u30E9\u30FC",
    kind: "tech",
    rarity: "R",
    mark: "sun",
    cost: 2,
    atk: null,
    effect: "\u81EA\u5206\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u9632\u5FA1+1\uFF08\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\uFF09",
    short: "\u9632\u5FA1+1",
    def: null
  },
  {
    no: 76,
    name: "\u591C\u5149\u30A8\u30AE",
    kind: "tech",
    rarity: "R",
    mark: "star",
    cost: 2,
    atk: null,
    effect: "\u591C\u306E\u30A4\u30AB1\u4F53\u306E\u9632\u5FA1+2\uFF08\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\uFF09",
    short: "\u9632\u5FA1+2",
    def: null
  },
  {
    no: 77,
    name: "\u30E9\u30C8\u30EB\u5165\u308A\u30A8\u30AE",
    kind: "tech",
    rarity: "R",
    mark: "anchor",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u306E\u9632\u5FA1-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u76F8\u624B\u9632\u5FA1-2",
    def: null
  },
  {
    no: 78,
    name: "\u65B0\u5B50\u30B7\u30FC\u30BA\u30F3",
    kind: "tech",
    rarity: "R",
    mark: "wave",
    cost: 2,
    atk: null,
    effect: "\u5C71\u672D\u304B\u3089\u6F6E1\u306E\u30A4\u30AB\u30921\u4F53\u5834\u306B\u51FA\u3059",
    short: "\u53EC\u559A",
    def: null
  },
  {
    no: 79,
    name: "PE\u30E9\u30A4\u30F3\u306E\u5F35\u308A",
    kind: "tech",
    rarity: "R",
    mark: "anchor",
    cost: 2,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09\u3002\u3053\u306E\u653B\u6483\u306F\u300C\u30D0\u30E9\u30B7\u300D\u306B\u306A\u3089\u306A\u3044",
    short: "\u653B\u6483+2",
    def: null
  },
  {
    no: 80,
    name: "\u30EA\u30FC\u30C0\u30FC\u7D50\u3073\u76F4\u3057",
    kind: "tech",
    rarity: "R",
    mark: "shell",
    cost: 1,
    atk: null,
    effect: "\u81EA\u5206\u306E\u300C\u30D0\u30E9\u30B7\u300D\u306E\u30A4\u30AB1\u4F53\u3092\u6CBB\u3059",
    short: "\u30D0\u30E9\u30B7\u56DE\u5FA9",
    def: null
  },
  {
    no: 81,
    name: "\u30C9\u30E9\u30B0\u8ABF\u6574",
    kind: "tech",
    rarity: "R",
    mark: "wave",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u306E\u30A4\u30AB1\u4F53\u306E\u653B\u6483-2\uFF08\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\uFF09",
    short: "\u76F8\u624B\u653B\u6483-2",
    def: null
  },
  {
    no: 82,
    name: "\u5C0F\u6F6E",
    kind: "tech",
    rarity: "R",
    mark: "shell",
    cost: 1,
    atk: null,
    effect: "\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483-1\uFF08\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\uFF09",
    short: "\u76F8\u624B\u653B\u6483-1",
    def: null
  },
  {
    no: 83,
    name: "\u5F37\u529B\u306A\u30D5\u30C3\u30AD\u30F3\u30B0",
    kind: "tech",
    rarity: "SR",
    mark: "anchor",
    cost: 3,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+3\u3002\u3053\u306E\u653B\u6483\u3067\u306F\u76F8\u624B\u306E\u30C8\u30E9\u30C3\u30D7\u304C\u958B\u304B\u306A\u3044",
    short: "\u653B\u6483+3",
    def: null
  },
  {
    no: 84,
    name: "\u58A8\u30D5\u30E9\u30C3\u30B7\u30E5",
    kind: "tech",
    rarity: "SR",
    mark: "anchor",
    cost: 3,
    atk: null,
    effect: "\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u9632\u5FA1-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u76F8\u624B\u9632\u5FA1-2",
    def: null
  },
  {
    no: 85,
    name: "\u6E80\u6708\u306E\u591C",
    kind: "tech",
    rarity: "SR",
    mark: "star",
    cost: 3,
    atk: null,
    effect: "\u81EA\u5206\u306E\u30A4\u30AB\u5168\u90E8\u306E\u300C\u30D0\u30E9\u30B7\u300D\u3092\u6CBB\u3057\u3001\u9632\u5FA1+1\uFF08\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\uFF09",
    short: "\u9632\u5FA1+1",
    def: null
  },
  {
    no: 86,
    name: "\u65B0\u6708",
    kind: "tech",
    rarity: "SR",
    mark: "star",
    cost: 3,
    atk: null,
    effect: "\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483-2\uFF08\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\uFF09",
    short: "\u76F8\u624B\u653B\u6483-2",
    def: null
  },
  {
    no: 87,
    name: "\u5927\u6F6E",
    kind: "tech",
    rarity: "SR",
    mark: "wave",
    cost: 2,
    atk: null,
    effect: "\u3053\u306E\u30BF\u30FC\u30F3\u3001\u6F6E\u306E\u4E0A\u9650\u3092\u7121\u8996\u3057\u3066+3",
    short: "\u6F6E+3",
    def: null
  },
  {
    no: 88,
    name: "\u30E4\u30A8\u30F3\u6295\u5165",
    kind: "tech",
    rarity: "SR",
    mark: "shell",
    cost: 4,
    atk: null,
    effect: "\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u3092\u91E3\u308B\uFF08\u9632\u5FA16\u4EE5\u4E0B\uFF09",
    short: "\u91E3\u308A\u4E0A\u3052",
    def: null
  },
  {
    no: 89,
    name: "\u30C6\u30A3\u30C3\u30D7\u30E9\u30F3",
    kind: "tech",
    rarity: "SR",
    mark: "wave",
    cost: 3,
    atk: null,
    effect: "\u81EA\u5206\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483+1\u3001\u9632\u5FA1+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+1\u30FB\u9632\u5FA1+1",
    def: null
  },
  {
    no: 90,
    name: "\u30A4\u30AB\u30E1\u30BF\u30EB",
    kind: "tech",
    rarity: "SR",
    mark: "star",
    cost: 3,
    atk: null,
    effect: "2\u679A\u5F15\u304D\u3001\u591C\u306E\u30A4\u30AB1\u4F53\u306E\u653B\u6483+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+1",
    def: null
  },
  {
    no: 91,
    name: "\u30E9\u30A4\u30C8\u30A8\u30AE\u30F3\u30B0",
    kind: "tech",
    rarity: "SR",
    mark: "shell",
    cost: 2,
    atk: null,
    effect: "\u6F6E1\u4EE5\u4E0B\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483+2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+2",
    def: null
  },
  {
    no: 92,
    name: "\u30DC\u30FC\u30C8\u30A8\u30AE\u30F3\u30B0",
    kind: "tech",
    rarity: "SSR",
    mark: "sun",
    cost: 4,
    atk: null,
    effect: "\u5C71\u672D\u304B\u3089\u30A4\u30AB\u30922\u4F53\u624B\u672D\u306B",
    short: "\u30A4\u30AB2\u679A",
    def: null
  },
  {
    no: 93,
    name: "\u90E8\u9577\u306E\u53F7\u4EE4",
    kind: "tech",
    rarity: "SSR",
    mark: "anchor",
    cost: 4,
    atk: null,
    effect: "\u81EA\u5206\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483+2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+2",
    def: null
  },
  {
    no: 94,
    name: "\u4F1D\u8AAC\u306E\u6642\u5408\u3044",
    kind: "tech",
    rarity: "UR",
    mark: "sun",
    cost: 5,
    atk: null,
    effect: "\u81EA\u5206\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483+3\u3001\u9632\u5FA1+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+3\u30FB\u9632\u5FA1+1",
    def: null
  },
  {
    no: 95,
    name: "\u90E8\u9577\u306E\u79D8\u4F1D\u30A8\u30AE",
    kind: "tech",
    rarity: "UR",
    mark: "anchor",
    cost: 4,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+4\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09\u3002\u3053\u306E\u653B\u6483\u3067\u306F\u76F8\u624B\u306E\u30C8\u30E9\u30C3\u30D7\u304C\u958B\u304B\u306A\u3044",
    short: "\u653B\u6483+4",
    def: null
  },
  {
    no: 96,
    name: "\u6839\u639B\u304B\u308A",
    kind: "trap",
    rarity: "N",
    mark: "wave",
    cost: 1,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u305D\u306E\u653B\u6483\u3092\u6B62\u3081\u308B",
    short: "\u653B\u6483\u505C\u6B62",
    def: null
  },
  {
    no: 97,
    name: "\u6C34\u8349",
    kind: "trap",
    rarity: "N",
    mark: "wave",
    cost: 1,
    atk: null,
    effect: "\u76F8\u624B\u306E\u30A4\u30AB\u304C\u51FA\u305F\u6642 \u2192 \u305D\u306E\u30A4\u30AB\u306F\u6B21\u306E\u30BF\u30FC\u30F3\u653B\u6483\u3067\u304D\u306A\u3044",
    short: "\u653B\u6483\u4E0D\u53EF",
    def: null
  },
  {
    no: 98,
    name: "\u30A4\u30AB\u30D1\u30F3\u30C1",
    kind: "trap",
    rarity: "N",
    mark: "anchor",
    cost: 1,
    atk: null,
    effect: "\u76F8\u624B\u306E\u30A4\u30AB\u304C\u51FA\u305F\u6642 \u2192 \u305D\u306E\u30A4\u30AB\u306F\u653B\u6483-1\uFF08\u305A\u3063\u3068\uFF09",
    short: "\u653B\u6483-1",
    def: null
  },
  {
    no: 99,
    name: "\u6FC1\u308A\u6F6E",
    kind: "trap",
    rarity: "N",
    mark: "shell",
    cost: 1,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u653B\u6483-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483-2",
    def: null
  },
  {
    no: 100,
    name: "\u30D5\u30B1\u308B",
    kind: "trap",
    rarity: "N",
    mark: "star",
    cost: 1,
    atk: null,
    effect: "\u76F8\u624B\u304C\u30C6\u30AF\u30CB\u30C3\u30AF\u3092\u4F7F\u3063\u305F\u6642 \u2192 1\u679A\u5F15\u304F",
    short: "\u30C9\u30ED\u30FC1",
    def: null
  },
  {
    no: 101,
    name: "\u9006\u98A8",
    kind: "trap",
    rarity: "N",
    mark: "sun",
    cost: 1,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u653B\u6483-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483-2",
    def: null
  },
  {
    no: 102,
    name: "\u591C\u5149\u866B",
    kind: "trap",
    rarity: "N",
    mark: "star",
    cost: 1,
    atk: null,
    effect: "\u76F8\u624B\u304C\u591C\u306E\u30A4\u30AB\u3067\u653B\u6483\u3057\u305F\u6642 \u2192 \u305D\u306E\u653B\u6483\u3092\u6B62\u3081\u308B",
    short: "\u653B\u6483\u505C\u6B62",
    def: null
  },
  {
    no: 103,
    name: "\u30D0\u30E9\u30B7",
    kind: "trap",
    rarity: "R",
    mark: "sun",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u305D\u306E\u30A4\u30AB\u3092\u624B\u672D\u306B\u623B\u3059",
    short: "\u624B\u672D\u306B\u623B\u3059",
    def: null
  },
  {
    no: 104,
    name: "\u58A8\u5410\u304D",
    kind: "trap",
    rarity: "R",
    mark: "shell",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u6B62\u3081\u3066\u3001\u76F8\u624B\u306E\u624B\u672D\u30921\u679A\u6368\u3066\u3055\u305B\u308B",
    short: "\u624B\u672D1\u679A\u6368\u3066",
    def: null
  },
  {
    no: 105,
    name: "\u85FB\u5834",
    kind: "trap",
    rarity: "R",
    mark: "wave",
    cost: 2,
    atk: null,
    effect: "\u81EA\u5206\u306E\u30A4\u30AB\u304C\u91E3\u3089\u308C\u308B\u6642 \u2192 \u91E3\u3089\u308C\u305A\u3001\u624B\u672D\u306B\u623B\u308B",
    short: "\u91E3\u3089\u308C\u306A\u3044",
    def: null
  },
  {
    no: 106,
    name: "\u30E9\u30A4\u30F3\u30D6\u30EC\u30A4\u30AF",
    kind: "trap",
    rarity: "R",
    mark: "anchor",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u304C\u30C6\u30AF\u30CB\u30C3\u30AF\u3092\u4F7F\u3063\u305F\u6642 \u2192 \u305D\u308C\u3092\u7121\u52B9",
    short: "\u7121\u52B9",
    def: null
  },
  {
    no: 107,
    name: "\u30B9\u30EC\u305F\u30A4\u30AB",
    kind: "trap",
    rarity: "R",
    mark: "star",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u53D7\u3051\u308B\u30A4\u30AB\u306E\u9632\u5FA1+3\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u9632\u5FA1+3",
    def: null
  },
  {
    no: 108,
    name: "\u30D5\u30B0\u306E\u8972\u6765",
    kind: "trap",
    rarity: "R",
    mark: "sun",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u653B\u6483-3\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483-3",
    def: null
  },
  {
    no: 109,
    name: "\u5916\u9053\u306E\u30AB\u30B5\u30B4",
    kind: "trap",
    rarity: "R",
    mark: "anchor",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u305D\u306E\u653B\u6483\u3092\u6B62\u3081\u308B\u3002\u76F8\u624B\u306F1\u679A\u5F15\u304F",
    short: "\u653B\u6483\u505C\u6B62",
    def: null
  },
  {
    no: 110,
    name: "\u30A8\u30AE\u30ED\u30B9\u30C8",
    kind: "trap",
    rarity: "R",
    mark: "shell",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u304C\u30C6\u30AF\u30CB\u30C3\u30AF\u3092\u4F7F\u3063\u305F\u6642 \u2192 \u76F8\u624B\u306E\u6F6E-1\uFF08\u6B21\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u6F6E-1",
    def: null
  },
  {
    no: 111,
    name: "\u9006\u6F6E",
    kind: "trap",
    rarity: "R",
    mark: "wave",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u653B\u6483-2\u3001\u81EA\u5206\u306E\u30A4\u30AB\u306E\u9632\u5FA1+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483-2",
    def: null
  },
  {
    no: 112,
    name: "\u6FC3\u9727",
    kind: "trap",
    rarity: "R",
    mark: "star",
    cost: 2,
    atk: null,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u59CB\u3081 \u2192 \u76F8\u624B\u306F\u3053\u306E\u30BF\u30FC\u30F3\u3001\u30C6\u30AF\u30CB\u30C3\u30AF\u30921\u679A\u3057\u304B\u4F7F\u3048\u306A\u3044",
    short: "\u30C6\u30AF1\u679A\u307E\u3067",
    def: null
  },
  {
    no: 113,
    name: "\u6F6E\u6B62\u307E\u308A",
    kind: "trap",
    rarity: "SR",
    mark: "shell",
    cost: 3,
    atk: null,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u59CB\u3081 \u2192 \u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483-1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483-1",
    def: null
  },
  {
    no: 114,
    name: "\u8352\u308C\u305F\u5929\u5019\uFF08\u91E3\u884C\u4E2D\u6B62\uFF09",
    kind: "trap",
    rarity: "SR",
    mark: "star",
    cost: 3,
    atk: null,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u59CB\u3081 \u2192 \u76F8\u624B\u306F\u3053\u306E\u30BF\u30FC\u30F3\u653B\u6483\u3067\u304D\u306A\u3044",
    short: "\u653B\u6483\u4E0D\u53EF",
    def: null
  },
  {
    no: 115,
    name: "\u5E72\u6F6E",
    kind: "trap",
    rarity: "SR",
    mark: "wave",
    cost: 3,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483\u30920\u306B\u3059\u308B\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u64830",
    def: null
  },
  {
    no: 116,
    name: "\u6025\u306A\u96F7",
    kind: "trap",
    rarity: "SR",
    mark: "sun",
    cost: 3,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u305D\u306E\u653B\u6483\u3092\u6B62\u3081\u3001\u305D\u306E\u30A4\u30AB\u306F\u653B\u6483-2\uFF08\u305A\u3063\u3068\uFF09",
    short: "\u653B\u6483\u505C\u6B62",
    def: null
  },
  {
    no: 117,
    name: "\u30B5\u30E1\u306E\u5F71",
    kind: "trap",
    rarity: "SR",
    mark: "anchor",
    cost: 3,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u653B\u6483\u3057\u3066\u304D\u305F\u30A4\u30AB\u3092\u624B\u672D\u306B\u623B\u3059",
    short: "\u624B\u672D\u306B\u623B\u3059",
    def: null
  },
  {
    no: 118,
    name: "\u30E4\u30A8\u30F3\u306E\u5947\u8972",
    kind: "trap",
    rarity: "SSR",
    mark: "shell",
    cost: 4,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u653B\u6483\u3057\u3066\u304D\u305F\u30A4\u30AB\u306E\u653B\u6483-4\uFF08\u305A\u3063\u3068\uFF09",
    short: "\u653B\u6483-4",
    def: null
  },
  {
    no: 119,
    name: "\u30C0\u30A4\u30AA\u30A6\u30A4\u30AB\u306E\u5F71",
    kind: "trap",
    rarity: "UR",
    mark: "wave",
    cost: 5,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u305D\u306E\u653B\u6483\u3092\u6B62\u3081\u3001\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u653B\u6483-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483\u505C\u6B62",
    def: null
  },
  {
    no: 120,
    name: "\u4F1D\u8AAC\u306E\u5927\u6F6E",
    kind: "trap",
    rarity: "UR",
    mark: "star",
    cost: 4,
    atk: null,
    effect: "\u76F8\u624B\u304C\u653B\u6483\u3057\u305F\u6642 \u2192 \u305D\u306E\u653B\u6483\u3092\u6B62\u3081\u3001\u81EA\u5206\u306F2\u679A\u5F15\u304F",
    short: "\u653B\u6483\u505C\u6B62",
    def: null
  },
  {
    no: 121,
    name: "\u65B0\u5B50\u306E\u5F3E\u5E55",
    kind: "squid",
    rarity: "SR",
    mark: "shell",
    cost: 2,
    atk: 3,
    effect: "\u51FA\u305F\u6642\u306B1\u679A\u5F15\u304F",
    short: null,
    def: 2,
    limit: {
      fes: "autumn2026"
    }
  },
  {
    no: 122,
    name: "\u79CB\u306E\u6570\u91E3\u308A\u5E2B",
    kind: "tech",
    rarity: "SSR",
    mark: "sun",
    cost: 3,
    atk: null,
    effect: "\u5C71\u672D\u304B\u3089\u30A4\u30AB\u30922\u4F53\u624B\u672D\u306B",
    short: "\u30A4\u30AB2\u679A",
    def: null,
    limit: {
      fes: "autumn2026"
    }
  },
  {
    no: 123,
    name: "\u30A6\u30A7\u30FC\u30D6\u306E\u4E3B",
    kind: "squid",
    rarity: "UR",
    mark: "wave",
    cost: 5,
    atk: 9,
    effect: "\u51FA\u305F\u6642\u3001\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u306E\u653B\u6483-3\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 8,
    limit: {
      fes: "autumn2026"
    }
  },
  {
    no: 124,
    name: "\u307E\u305A\u3081\u306E\u91D1\u8272\u30A4\u30AB",
    kind: "squid",
    rarity: "SSR",
    mark: "sun",
    cost: 4,
    atk: 7,
    effect: "\u51FA\u305F\u30BF\u30FC\u30F3\u306B\u653B\u6483\u3067\u304D\u308B",
    short: null,
    def: 6,
    limit: {
      secret: "mazume"
    }
  },
  {
    no: 125,
    name: "\u6708\u591C\u306E\u30B1\u30F3\u30B5\u30AD",
    kind: "squid",
    rarity: "SR",
    mark: "star",
    cost: 3,
    atk: 4,
    effect: "\u591C\u306E\u30C6\u30AF\u30CB\u30C3\u30AF\u304C\u6F6E1\u5B89\u3044",
    short: null,
    def: 3,
    limit: {
      secret: "night"
    }
  },
  {
    no: 126,
    name: "\u30B9\u30CA\u30A4\u30D7\u30E4\u30EA",
    kind: "squid",
    rarity: "SR",
    mark: "star",
    cost: 2,
    atk: 4,
    effect: "\u51FA\u305F\u30BF\u30FC\u30F3\u306B\u653B\u6483\u3067\u304D\u308B",
    short: null,
    def: 1,
    limit: {
      fes: "winter2026"
    }
  },
  {
    no: 127,
    name: "\u30E4\u30EA\u30A4\u30AB\u306E\u63A5\u5CB8",
    kind: "tech",
    rarity: "SSR",
    mark: "star",
    cost: 3,
    atk: null,
    effect: "2\u679A\u5F15\u304D\u3001\u591C\u306E\u30A4\u30AB1\u4F53\u306E\u653B\u6483+1\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: "\u653B\u6483+1",
    def: null,
    limit: {
      fes: "winter2026"
    }
  },
  {
    no: 128,
    name: "\u771F\u51AC\u306E\u5927\u69CD",
    kind: "squid",
    rarity: "UR",
    mark: "star",
    cost: 5,
    atk: 10,
    effect: "\u653B\u6483\u3057\u305F\u6642\u3001\u76F8\u624B\u306E\u30A4\u30AB\u306E\u9632\u5FA1-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 6,
    limit: {
      fes: "winter2026"
    }
  },
  {
    no: 129,
    name: "\u85FB\u5834\u306E\u89AA\u30A4\u30AB",
    kind: "squid",
    rarity: "SR",
    mark: "anchor",
    cost: 3,
    atk: 5,
    effect: "\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306F\u9632\u5FA1+1",
    short: null,
    def: 4,
    limit: {
      fes: "spring2027"
    }
  },
  {
    no: 130,
    name: "\u30A2\u30DE\u30E2\u306E\u63FA\u308A\u304B\u3054",
    kind: "tech",
    rarity: "SSR",
    mark: "anchor",
    cost: 3,
    atk: null,
    effect: "\u81EA\u5206\u306E\u5834\u306E\u30A4\u30AB\u5168\u90E8\u306E\u9632\u5FA1+1\uFF08\u76F8\u624B\u306E\u30BF\u30FC\u30F3\u306E\u7D42\u308F\u308A\u307E\u3067\uFF09",
    short: "\u9632\u5FA1+1",
    def: null,
    limit: {
      fes: "spring2027"
    }
  },
  {
    no: 131,
    name: "\u6625\u306E\u89AA\u30A4\u30AB",
    kind: "squid",
    rarity: "UR",
    mark: "anchor",
    cost: 5,
    atk: 8,
    effect: "\u5F3E\u304B\u308C\u3066\u3082\u300C\u30D0\u30E9\u30B7\u300D\u306B\u306A\u3089\u306A\u3044",
    short: null,
    def: 10,
    limit: {
      fes: "spring2027"
    }
  },
  {
    no: 132,
    name: "\u6885\u96E8\u306E\u30E2\u30F3\u30B9\u30BF\u30FC",
    kind: "squid",
    rarity: "SR",
    mark: "wave",
    cost: 3,
    atk: 5,
    effect: "\u51FA\u305F\u6642\u3001\u76F8\u624B\u306E\u30A4\u30AB1\u4F53\u306E\u9632\u5FA1-2\uFF08\u3053\u306E\u30BF\u30FC\u30F3\uFF09",
    short: null,
    def: 3,
    limit: {
      fes: "summer2027"
    }
  },
  {
    no: 133,
    name: "BIG\u30D9\u30A4\u30C8",
    kind: "tech",
    rarity: "SSR",
    mark: "wave",
    cost: 3,
    atk: null,
    effect: "\u30A4\u30AB1\u4F53\u306E\u653B\u6483+3\u3001\u3055\u3089\u306B1\u679A\u5F15\u304F",
    short: "\u653B\u6483+3",
    def: null,
    limit: {
      fes: "summer2027"
    }
  },
  {
    no: 134,
    name: "\u521D\u590F\u306EBIG\u30E2\u30F3\u30B9\u30BF\u30FC",
    kind: "squid",
    rarity: "UR",
    mark: "wave",
    cost: 5,
    atk: 10,
    effect: "\u51FA\u305F\u6642\u3001\u76F8\u624B\u306E\u5834\u306E\u30A4\u30AB1\u4F53\u3092\u624B\u672D\u306B\u623B\u3059",
    short: null,
    def: 8,
    limit: {
      fes: "summer2027"
    }
  }
];

// ../../src/js/ikabu/games/cards-effects.json
var cards_effects_default = {
  "1": [
    {
      when: "enter",
      do: "draw",
      n: 1
    }
  ],
  "2": [],
  "3": [
    {
      when: "passive",
      do: "defOnEnemyTurn",
      n: 1
    }
  ],
  "4": [
    {
      when: "passive",
      do: "techCheaper",
      n: 1,
      only: "night"
    },
    {
      when: "tag",
      tag: "night"
    }
  ],
  "5": [
    {
      when: "passive",
      do: "haste"
    },
    {
      when: "tag",
      tag: "night"
    }
  ],
  "6": [],
  "7": [
    {
      when: "caught",
      do: "buff",
      who: "enemyOne",
      stat: "atk",
      n: -1,
      until: "turnEnd"
    },
    {
      when: "tag",
      tag: "night"
    }
  ],
  "8": [],
  "9": [
    {
      when: "enter",
      do: "tide",
      n: 1
    }
  ],
  "10": [],
  "11": [],
  "12": [
    {
      when: "passive",
      do: "haste"
    }
  ],
  "13": [
    {
      when: "passive",
      do: "tieWins"
    }
  ],
  "14": [
    {
      when: "passive",
      do: "ignoreTrapOnAttack"
    }
  ],
  "15": [
    {
      when: "enter",
      do: "buff",
      who: "enemyOne",
      stat: "def",
      n: -2,
      until: "turnEnd"
    },
    {
      when: "tag",
      tag: "night"
    }
  ],
  "16": [],
  "17": [
    {
      when: "caught",
      do: "buff",
      who: "enemyAll",
      stat: "atk",
      n: -1,
      until: "turnEnd"
    }
  ],
  "18": [
    {
      when: "attack",
      do: "buff",
      who: "target",
      stat: "def",
      n: -1,
      until: "turnEnd"
    }
  ],
  "19": [
    {
      when: "passive",
      do: "defOnEnemyTurn",
      n: 1
    }
  ],
  "20": [
    {
      when: "passive",
      do: "noTiredWhenBlocked"
    }
  ],
  "21": [],
  "22": [
    {
      when: "tag",
      tag: "night"
    }
  ],
  "23": [
    {
      when: "enter",
      do: "draw",
      n: 1
    },
    {
      when: "tag",
      tag: "night"
    }
  ],
  "24": [],
  "25": [],
  "26": [],
  "27": [
    {
      when: "passive",
      do: "defOnEnemyTurn",
      n: 1
    }
  ],
  "28": [],
  "29": [],
  "30": [],
  "31": [
    {
      when: "enter",
      do: "buff",
      who: "enemyOne",
      stat: "atk",
      n: -2,
      until: "turnEnd"
    }
  ],
  "32": [],
  "33": [
    {
      when: "passive",
      do: "defOnEnemyTurn",
      n: 1
    }
  ],
  "34": [
    {
      when: "attack",
      do: "buff",
      who: "target",
      stat: "def",
      n: -1,
      until: "turnEnd"
    },
    {
      when: "tag",
      tag: "night"
    }
  ],
  "35": [
    {
      when: "passive",
      do: "noTiredWhenBlocked"
    }
  ],
  "36": [],
  "37": [
    {
      when: "enter",
      do: "tide",
      n: 1
    }
  ],
  "38": [
    {
      when: "enter",
      do: "draw",
      n: 1
    }
  ],
  "39": [
    {
      when: "passive",
      do: "defOnEnemyTurn",
      n: 1
    }
  ],
  "40": [],
  "41": [],
  "42": [
    {
      when: "attack",
      do: "buff",
      who: "target",
      stat: "atk",
      n: -1,
      until: "turnEnd"
    }
  ],
  "43": [
    {
      when: "enter",
      do: "buff",
      who: "enemyOne",
      stat: "atk",
      n: -2,
      until: "turnEnd"
    }
  ],
  "44": [
    {
      when: "passive",
      do: "defOnEnemyTurn",
      n: 1
    }
  ],
  "45": [
    {
      when: "enter",
      do: "buff",
      who: "enemyOne",
      stat: "atk",
      n: -3,
      until: "turnEnd"
    }
  ],
  "46": [
    {
      when: "enter",
      do: "bounce",
      who: "enemyOne"
    }
  ],
  "47": [
    {
      when: "caught",
      do: "tutor",
      name: "\u30A2\u30AA\u30EA\u30A4\u30AB"
    }
  ],
  "48": [
    {
      when: "passive",
      do: "ignoreTrapOnAttack"
    }
  ],
  "49": [
    {
      when: "enter",
      do: "tutor",
      name: "\u30E4\u30EA\u30A4\u30AB"
    },
    {
      when: "tag",
      tag: "night"
    }
  ],
  "50": [
    {
      when: "passive",
      do: "techCheaper",
      n: 1,
      only: "all"
    }
  ],
  "51": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 2,
      until: "turnEnd"
    }
  ],
  "52": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 1,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "buff",
      who: "same",
      stat: "def",
      n: 1,
      until: "turnEnd"
    }
  ],
  "53": [
    {
      when: "play",
      do: "shield",
      who: "ownOne"
    }
  ],
  "54": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "def",
      n: 2,
      until: "oppTurnEnd"
    }
  ],
  "55": [
    {
      when: "play",
      do: "draw",
      n: 1
    }
  ],
  "56": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "def",
      n: 1,
      until: "oppTurnEnd"
    },
    {
      when: "play",
      do: "draw",
      n: 1
    }
  ],
  "57": [
    {
      when: "play",
      do: "rest",
      who: "ownOne",
      thenAtk: 2
    }
  ],
  "58": [
    {
      when: "play",
      do: "tide",
      n: 1
    }
  ],
  "59": [
    {
      when: "play",
      do: "bounce",
      who: "ownOne"
    },
    {
      when: "play",
      do: "draw",
      n: 1
    }
  ],
  "60": [
    {
      when: "play",
      do: "peekPick",
      n: 2
    }
  ],
  "61": [
    {
      when: "play",
      do: "bounce",
      who: "enemyOne"
    }
  ],
  "62": [
    {
      when: "play",
      do: "tutorSquid",
      maxCost: 2
    }
  ],
  "63": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 2,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "buff",
      who: "same",
      stat: "def",
      n: -1,
      until: "turnEnd"
    }
  ],
  "64": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 2,
      until: "turnEnd"
    }
  ],
  "65": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 3,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "draw",
      n: 1
    }
  ],
  "66": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 4,
      until: "turnEnd"
    }
  ],
  "67": [
    {
      when: "play",
      do: "buff",
      who: "enemyOne",
      stat: "def",
      n: -3,
      until: "turnEnd"
    }
  ],
  "68": [
    {
      when: "play",
      do: "draw",
      n: 2
    }
  ],
  "69": [
    {
      when: "play",
      do: "buff",
      who: "ownAll",
      stat: "atk",
      n: 1,
      until: "turnEnd"
    }
  ],
  "70": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 2,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "draw",
      n: 1
    }
  ],
  "71": [
    {
      when: "play",
      do: "buff",
      who: "ownNight",
      stat: "atk",
      n: 2,
      until: "turnEnd"
    }
  ],
  "72": [
    {
      when: "play",
      do: "revealTrap"
    }
  ],
  "73": [
    {
      when: "play",
      do: "shield",
      who: "ownOne"
    },
    {
      when: "play",
      do: "buff",
      who: "same",
      stat: "atk",
      n: 1,
      until: "nextTurn"
    }
  ],
  "74": [
    {
      when: "play",
      do: "changeMark",
      who: "ownOne"
    }
  ],
  "75": [
    {
      when: "play",
      do: "buff",
      who: "ownAll",
      stat: "def",
      n: 1,
      until: "oppTurnEnd"
    }
  ],
  "76": [
    {
      when: "play",
      do: "buff",
      who: "ownNightOne",
      stat: "def",
      n: 2,
      until: "oppTurnEnd"
    }
  ],
  "77": [
    {
      when: "play",
      do: "buff",
      who: "enemyOne",
      stat: "def",
      n: -2,
      until: "turnEnd"
    }
  ],
  "78": [
    {
      when: "play",
      do: "summonFromDeck",
      maxCost: 1
    }
  ],
  "79": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 2,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "flag",
      who: "same",
      flag: "tieWins",
      until: "turnEnd"
    }
  ],
  "80": [
    {
      when: "play",
      do: "heal",
      who: "ownTiredOne"
    }
  ],
  "81": [
    {
      when: "play",
      do: "buff",
      who: "enemyOne",
      stat: "atk",
      n: -2,
      until: "oppTurnEnd"
    }
  ],
  "82": [
    {
      when: "play",
      do: "buff",
      who: "enemyAll",
      stat: "atk",
      n: -1,
      until: "oppTurnEnd"
    }
  ],
  "83": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 3,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "flag",
      who: "same",
      flag: "ignoreTrap",
      until: "turnEnd"
    }
  ],
  "84": [
    {
      when: "play",
      do: "buff",
      who: "enemyAll",
      stat: "def",
      n: -2,
      until: "turnEnd"
    }
  ],
  "85": [
    {
      when: "play",
      do: "heal",
      who: "ownAll"
    },
    {
      when: "play",
      do: "buff",
      who: "ownAll",
      stat: "def",
      n: 1,
      until: "oppTurnEnd"
    }
  ],
  "86": [
    {
      when: "play",
      do: "buff",
      who: "enemyAll",
      stat: "atk",
      n: -2,
      until: "oppTurnEnd"
    }
  ],
  "87": [
    {
      when: "play",
      do: "tide",
      n: 3,
      ignoreCap: true
    }
  ],
  "88": [
    {
      when: "play",
      do: "catch",
      who: "enemyOne",
      maxDef: 6
    }
  ],
  "89": [
    {
      when: "play",
      do: "buff",
      who: "ownAll",
      stat: "atk",
      n: 1,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "buff",
      who: "ownAll",
      stat: "def",
      n: 1,
      until: "turnEnd"
    }
  ],
  "90": [
    {
      when: "play",
      do: "draw",
      n: 2
    },
    {
      when: "play",
      do: "buff",
      who: "ownNightOne",
      stat: "atk",
      n: 1,
      until: "turnEnd"
    }
  ],
  "91": [
    {
      when: "play",
      do: "buff",
      who: "ownCheap",
      stat: "atk",
      n: 2,
      until: "turnEnd"
    }
  ],
  "92": [
    {
      when: "play",
      do: "tutorSquid",
      n: 2
    }
  ],
  "93": [
    {
      when: "play",
      do: "buff",
      who: "ownAll",
      stat: "atk",
      n: 2,
      until: "turnEnd"
    }
  ],
  "94": [
    {
      when: "play",
      do: "buff",
      who: "ownAll",
      stat: "atk",
      n: 3,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "buff",
      who: "ownAll",
      stat: "def",
      n: 1,
      until: "turnEnd"
    }
  ],
  "95": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 4,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "flag",
      who: "same",
      flag: "ignoreTrap",
      until: "turnEnd"
    }
  ],
  "96": [
    {
      when: "enemyAttack",
      do: "block"
    }
  ],
  "97": [
    {
      when: "enemySquidEnter",
      do: "tire",
      who: "entered"
    }
  ],
  "98": [
    {
      when: "enemySquidEnter",
      do: "buff",
      who: "entered",
      stat: "atk",
      n: -1,
      until: "forever"
    }
  ],
  "99": [
    {
      when: "enemyAttack",
      do: "buff",
      who: "attacker",
      stat: "atk",
      n: -2,
      until: "turnEnd"
    }
  ],
  "100": [
    {
      when: "enemyTech",
      do: "draw",
      n: 1
    }
  ],
  "101": [
    {
      when: "enemyAttack",
      do: "buff",
      who: "attacker",
      stat: "atk",
      n: -2,
      until: "turnEnd"
    }
  ],
  "102": [
    {
      when: "enemyAttack",
      do: "block",
      onlyNight: true
    }
  ],
  "103": [
    {
      when: "enemyAttack",
      do: "block"
    },
    {
      when: "enemyAttack",
      do: "bounce",
      who: "attacker"
    }
  ],
  "104": [
    {
      when: "enemyAttack",
      do: "block"
    },
    {
      when: "enemyAttack",
      do: "discardEnemy",
      n: 1
    }
  ],
  "105": [
    {
      when: "ownCaught",
      do: "saveToHand"
    }
  ],
  "106": [
    {
      when: "enemyTech",
      do: "negate"
    }
  ],
  "107": [
    {
      when: "enemyAttack",
      do: "buff",
      who: "defender",
      stat: "def",
      n: 3,
      until: "turnEnd"
    }
  ],
  "108": [
    {
      when: "enemyAttack",
      do: "buff",
      who: "attacker",
      stat: "atk",
      n: -3,
      until: "turnEnd"
    }
  ],
  "109": [
    {
      when: "enemyAttack",
      do: "block"
    },
    {
      when: "enemyAttack",
      do: "drawEnemy",
      n: 1
    }
  ],
  "110": [
    {
      when: "enemyTech",
      do: "tideEnemyNext",
      n: -1
    }
  ],
  "111": [
    {
      when: "enemyAttack",
      do: "buff",
      who: "attacker",
      stat: "atk",
      n: -2,
      until: "turnEnd"
    },
    {
      when: "enemyAttack",
      do: "buff",
      who: "ownAll",
      stat: "def",
      n: 1,
      until: "turnEnd"
    }
  ],
  "112": [
    {
      when: "enemyTurnStart",
      do: "limitTech",
      n: 1
    }
  ],
  "113": [
    {
      when: "enemyTurnStart",
      do: "buff",
      who: "enemyAll",
      stat: "atk",
      n: -1,
      until: "turnEnd"
    }
  ],
  "114": [
    {
      when: "enemyTurnStart",
      do: "noAttack"
    }
  ],
  "115": [
    {
      when: "enemyAttack",
      do: "zeroAtk",
      who: "enemyAll",
      until: "turnEnd"
    }
  ],
  "116": [
    {
      when: "enemyAttack",
      do: "block"
    },
    {
      when: "enemyAttack",
      do: "buff",
      who: "attacker",
      stat: "atk",
      n: -2,
      until: "forever"
    }
  ],
  "117": [
    {
      when: "enemyAttack",
      do: "block"
    },
    {
      when: "enemyAttack",
      do: "bounce",
      who: "attacker"
    }
  ],
  "118": [
    {
      when: "enemyAttack",
      do: "buff",
      who: "attacker",
      stat: "atk",
      n: -4,
      until: "forever"
    }
  ],
  "119": [
    {
      when: "enemyAttack",
      do: "block"
    },
    {
      when: "enemyAttack",
      do: "buff",
      who: "enemyAll",
      stat: "atk",
      n: -2,
      until: "turnEnd"
    }
  ],
  "120": [
    {
      when: "enemyAttack",
      do: "block"
    },
    {
      when: "enemyAttack",
      do: "draw",
      n: 2
    }
  ],
  "121": [
    {
      when: "enter",
      do: "draw",
      n: 1
    }
  ],
  "122": [
    {
      when: "play",
      do: "tutorSquid",
      n: 2
    }
  ],
  "123": [
    {
      when: "enter",
      do: "buff",
      who: "enemyOne",
      stat: "atk",
      n: -3,
      until: "turnEnd"
    }
  ],
  "124": [
    {
      when: "passive",
      do: "haste"
    }
  ],
  "125": [
    {
      when: "passive",
      do: "techCheaper",
      n: 1,
      only: "night"
    },
    {
      when: "tag",
      tag: "night"
    }
  ],
  "126": [
    {
      when: "passive",
      do: "haste"
    },
    {
      when: "tag",
      tag: "night"
    }
  ],
  "127": [
    {
      when: "play",
      do: "draw",
      n: 2
    },
    {
      when: "play",
      do: "buff",
      who: "ownNightOne",
      stat: "atk",
      n: 1,
      until: "turnEnd"
    }
  ],
  "128": [
    {
      when: "attack",
      do: "buff",
      who: "target",
      stat: "def",
      n: -2,
      until: "turnEnd"
    }
  ],
  "129": [
    {
      when: "passive",
      do: "defOnEnemyTurn",
      n: 1
    }
  ],
  "130": [
    {
      when: "play",
      do: "buff",
      who: "ownAll",
      stat: "def",
      n: 1,
      until: "oppTurnEnd"
    }
  ],
  "131": [
    {
      when: "passive",
      do: "noTiredWhenBlocked"
    }
  ],
  "132": [
    {
      when: "enter",
      do: "buff",
      who: "enemyOne",
      stat: "def",
      n: -2,
      until: "turnEnd"
    }
  ],
  "133": [
    {
      when: "play",
      do: "buff",
      who: "ownOne",
      stat: "atk",
      n: 3,
      until: "turnEnd"
    },
    {
      when: "play",
      do: "draw",
      n: 1
    }
  ],
  "134": [
    {
      when: "enter",
      do: "bounce",
      who: "enemyOne"
    }
  ]
};

// src/room.js
var IDLE_MS = 20 * 6e4;
var tokenOf = /* @__PURE__ */ __name(() => crypto.randomUUID(), "tokenOf");
var BattleRoom = class {
  static {
    __name(this, "BattleRoom");
  }
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.reset();
  }
  reset() {
    for (const s of ["a", "b"]) {
      try {
        this.seats?.[s]?.ws?.close(1e3, "reset");
      } catch {
      }
    }
    this.seats = { a: null, b: null };
    this.match = null;
    this.turnTimer = null;
    this.leaveTimers = {};
    this.touched = Date.now();
    this.code = null;
  }
  busy() {
    return !!this.match && !this.match.over() && Date.now() - this.touched < IDLE_MS;
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/claim")) {
      if (this.busy() || this.seats.a && !this.match && Date.now() - this.touched < 5 * 6e4) return new Response("busy", { status: 409 });
      this.reset();
      this.code = url.searchParams.get("code");
      return new Response("ok");
    }
    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    let seat = null;
    server.addEventListener("message", (e) => {
      try {
        seat = this.onMessage(server, seat, JSON.parse(e.data));
      } catch (err) {
        this.send(server, { t: "err", msg: String(err?.message ?? err) });
      }
    });
    server.addEventListener("close", () => this.onClose(server, seat));
    server.addEventListener("error", () => this.onClose(server, seat));
    return new Response(null, { status: 101, webSocket: client });
  }
  send(ws, m) {
    try {
      ws?.send(JSON.stringify(m));
    } catch {
    }
  }
  toSeat(s, m) {
    const st = this.seats[s];
    if (st?.online) this.send(st.ws, m);
  }
  other(s) {
    return s === "a" ? "b" : "a";
  }
  onMessage(ws, seat, m) {
    this.touched = Date.now();
    if (m.t === "ping") {
      this.send(ws, { t: "pong" });
      return seat;
    }
    if (m.t === "hello") {
      const back = ["a", "b"].find((s) => this.seats[s] && m.token && this.seats[s].token === m.token);
      if (back) {
        try {
          this.seats[back].ws?.close(1e3, "replaced");
        } catch {
        }
        this.seats[back] = { ...this.seats[back], ws, online: true };
        clearTimeout(this.leaveTimers[back]);
        this.send(ws, { t: "seat", seat: back, token: m.token, code: this.code, started: !!this.match });
        if (this.match) {
          this.send(ws, { t: "state", state: this.match.viewFor(back), rejoin: true });
          this.toSeat(this.other(back), { t: "opp", status: "back" });
        }
        return back;
      }
      const free = ["a", "b"].find((s) => !this.seats[s]);
      if (!free || this.match) {
        this.send(ws, { t: "err", msg: "full" });
        try {
          ws.close(1e3, "full");
        } catch {
        }
        return null;
      }
      const token = tokenOf();
      this.seats[free] = { token, ws, online: true };
      this.send(ws, { t: "seat", seat: free, token, code: this.code, started: false });
      if (this.seats.a && this.seats.b) this.start();
      return free;
    }
    if (!seat) {
      this.send(ws, { t: "err", msg: "noSeat" });
      return seat;
    }
    if (m.t === "act") {
      if (!this.match) {
        this.send(ws, { t: "res", id: m.id, r: { ok: false, why: "notStarted" } });
        return seat;
      }
      const { r, a } = this.match.act(seat, m);
      if (r.ok && (m.kind === "end" || this.match.over())) this.armTurn();
      this.send(ws, { t: "res", id: m.id, r, state: this.match.viewFor(seat) });
      if (r.ok && a) this.toSeat(this.other(seat), { t: "ev", a, r, state: this.match.viewFor(this.other(seat)) });
      if (this.match.over()) this.finish();
      return seat;
    }
    if (m.t === "leave") {
      if (this.match && !this.match.over()) {
        const a = this.match.resign(seat);
        this.broadcast(a);
        this.finish();
      } else if (!this.match) {
        this.seats[seat] = null;
      }
      return seat;
    }
    return seat;
  }
  start() {
    this.match = createMatch({ cards: cards_data_default, effects: cards_effects_default, seed: `${this.code}:${Date.now()}` });
    for (const s of ["a", "b"]) this.toSeat(s, { t: "start", you: s, state: this.match.viewFor(s) });
    this.armTurn();
  }
  // 持ち時間：次の席の番が始まった時に測り直す
  armTurn() {
    clearTimeout(this.turnTimer);
    if (!this.match || this.match.over()) {
      this.match && (this.match.deadline = 0);
      return;
    }
    this.match.deadline = Date.now() + TURN_MS;
    this.turnTimer = setTimeout(() => {
      const a = this.match?.autoEnd();
      if (!a) return;
      this.broadcast(a);
      if (this.match.over()) this.finish();
      else this.armTurn();
    }, TURN_MS);
  }
  broadcast(a) {
    for (const s of ["a", "b"]) this.toSeat(s, { t: "ev", a, r: { ok: true }, state: this.match.viewFor(s) });
  }
  finish() {
    clearTimeout(this.turnTimer);
    for (const s of ["a", "b"]) clearTimeout(this.leaveTimers[s]);
  }
  onClose(ws, seat) {
    if (!seat || this.seats[seat]?.ws !== ws) return;
    this.seats[seat].online = false;
    if (!this.match) {
      this.seats[seat] = null;
      return;
    }
    if (this.match.over()) return;
    this.toSeat(this.other(seat), { t: "opp", status: "left", wait: LEAVE_MS });
    clearTimeout(this.leaveTimers[seat]);
    this.leaveTimers[seat] = setTimeout(() => {
      if (this.seats[seat]?.online || !this.match || this.match.over()) return;
      const a = this.match.resign(seat);
      if (a) {
        this.broadcast(a);
        this.finish();
      }
    }, LEAVE_MS);
  }
};

// src/index.js
var ALLOWED = ["https://ikabu-trial.hoodhomies.workers.dev", "http://localhost:5180", "http://127.0.0.1:5180", "http://localhost:5173"];
var allowed = /* @__PURE__ */ __name((req) => {
  const o = req.headers.get("Origin");
  return !o || ALLOWED.includes(o) || /^https:\/\/ikabu-preview[\w-]*\.hoodhomies\.workers\.dev$/.test(o);
}, "allowed");
var cors = /* @__PURE__ */ __name((req) => ({ "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Vary": "Origin" }), "cors");
var json = /* @__PURE__ */ __name((req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(req) } }), "json");
var src_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    if (!allowed(req)) return json(req, { error: "origin" }, 403);
    if (url.pathname === "/rooms" && req.method === "POST") {
      for (let i = 0; i < 10; i++) {
        const code = String(Math.floor(Math.random() * 1e4)).padStart(4, "0");
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch(`https://room/claim?code=${code}`, { method: "POST" });
        if (r.ok) return json(req, { code });
      }
      return json(req, { error: "noRoom" }, 503);
    }
    const m = url.pathname.match(/^\/rooms\/(\d{4})\/ws$/);
    if (m && req.headers.get("Upgrade") === "websocket") {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      return stub.fetch(req);
    }
    if (url.pathname === "/") return json(req, { ok: true, service: "ikabu-battle" });
    return json(req, { error: "notFound" }, 404);
  }
};

// C:/Users/my/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/my/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-D5cHtH/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/my/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-D5cHtH/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  BattleRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
