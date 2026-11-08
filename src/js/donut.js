// Engine: The Donut Hole, where the only accepted currency is fish (diet's pick). The counter opens a menu in the fishing
// shop's look (fishing.menu); each fish in your bag is worth "fish points" (bluegill 1, bass 2, catfish 3, trout 4,
// raccoon meat 2, boots 0) and the shop takes the smallest fish first. No change is given. Donuts fill the BELLY meter.
// Wired by tools/engine-hooks.mjs: DONUT.init({ G, fishing, toast, Sfx }) once fishing exists.
// Debug: window.__G.donut.buy('glazed'), .S
import * as INTR from './interiors.js';

const VALUE = { bluegill: 1, bass: 2, raccoon: 2, catfish: 3, trout: 4 };
const MENU = [   // matches the menu board in rooms.js (donut room)
  { id: 'glazed', label: 'Glazed', price: 1, belly: 20, hp: 0, blurb: 'The classic. Still warm. Shiny enough to see your whiskers in. +20 belly.' },
  { id: 'sprinkle', label: 'Pink Sprinkle', price: 1, belly: 18, hp: 0, blurb: 'Pink frosting, rainbow sprinkles, zero nutrition. +18 belly.' },
  { id: 'choc', label: 'Chocolate', price: 1, belly: 22, hp: 0, blurb: 'Chocolate frosting. Do not tell the vet. +22 belly.' },
  { id: 'maple', label: 'Maple Bar', price: 2, belly: 40, hp: 15, blurb: 'The Maple Grove special. A whole bar of maple frosting. +40 belly, +15 health.' },
  { id: 'dozen', label: "Baker's Dozen", price: 2, belly: 100, hp: 30, blurb: 'Thirteen donuts for one bass. Dot does not understand economics. Belly to full, +30 health.' },
  { id: 'dayold', label: 'Day-Old Donut', price: 0, boot: true, belly: 10, hp: 0, blurb: 'Hard as a hockey puck. The one thing here you can buy with an old boot. +10 belly.' },
];

let A = null;
const S = { bought: {}, spent: 0 };

function points() {
  let n = 0; for (const id in VALUE) n += A.fishing.countFish(id) * VALUE[id]; return n;
}
function pay(price) {
  // smallest fish first; no change
  const order = Object.keys(VALUE).sort((a, b) => VALUE[a] - VALUE[b]);
  let paid = 0; const used = {};
  for (const id of order) {
    while (paid < price && A.fishing.countFish(id) > 0) { A.fishing.removeFish(id, 1); paid += VALUE[id]; used[id] = (used[id] || 0) + 1; }
  }
  return { paid, used };
}
const fishWord = (n) => n + ' fish';
const usedText = (u) => Object.entries(u).map(([id, n]) => `${n} ${id === 'raccoon' ? 'raccoon meat' : id}`).join(', ');

export function buy(id) {
  if (!A) return false;
  const it = MENU.find((m) => m.id === id); if (!it) return false;
  if (it.boot) {
    if (A.fishing.countFish('boot') < 1) { A.Sfx.blip && A.Sfx.blip(180); A.toast('Dot: "Day-olds are one old boot. Bring me a boot, sweetie. I have a collection."', 4); return false; }
    A.fishing.removeFish('boot', 1); S.bought[id] = (S.bought[id] || 0) + 1;
    A.fishing.feed(it.belly); A.Sfx.pickup && A.Sfx.pickup();
    A.toast('Day-old donut, paid with one old boot. Dot hangs the boot on a nail behind the counter. +10 belly.', 4); return true;
  }
  const have = points();
  if (have < it.price) {
    A.Sfx.blip && A.Sfx.blip(180);
    if (A.fishing.countFish('boot') > 0 && have === 0) A.toast('Dot points at the sign. "WE ACCEPT FISH. NO BOOTS." Then, quieter: "...except for the day-olds."', 4);
    else if (have === 0) A.toast('Dot: "No fish, no donut, sweetie. The dock\'s right down the hill."', 4);
    else A.toast(`Dot: "That's ${fishWord(it.price)} worth. You've got ${fishWord(have)} worth."`, 3.5);
    return false;
  }
  const { paid, used } = pay(it.price);
  S.bought[id] = (S.bought[id] || 0) + 1; S.spent += paid;
  A.fishing.feed(it.belly);
  if (it.hp) A.G.hp = Math.min(100, A.G.hp + it.hp);
  A.Sfx.pickup && A.Sfx.pickup();
  const over = paid > it.price ? ' Dot keeps the change. "Tip jar\'s for fish too, hon."' : '';
  A.toast(`${it.label}! Paid ${usedText(used)}. +${it.belly} belly${it.hp ? `, +${it.hp} health` : ''}.${over}`, 4);
  return true;
}

function openMenu() {
  return A.fishing.menu({
    title: 'The Donut Hole  (fish only)',
    items: () => [
      ...MENU.map((m) => ({ id: m.id, label: m.label, price: m.boot ? '1 boot' : '\u{1F41F}x' + m.price, blurb: m.blurb, dim: m.boot ? A.fishing.countFish('boot') < 1 : points() < m.price })),
    ],
    pick: (it) => buy(it.id),
  });
}

/** Call once after fishing exists. a = { G, fishing, toast, Sfx } */
export function init(a) {
  A = a;
  INTR.on('interact', (room, spot) => {
    if (room !== 'donut') return false;
    if (spot === 'counter' || spot === 'case' || spot === 'menu') {
      if (!openMenu()) return false;
      if (!S.greeted) { S.greeted = true; A.toast(`Dot: "Fish only. Bluegill's one, bass two, catfish three, trout four. Boots buy day-olds only."`, 4.5); }
      return true;
    }
    if (spot === 'bell') { A.Sfx.blip && A.Sfx.blip(880); A.toast('DING. Dot, from the back: "I SEE you, cat."'); return true; }
    if (spot === 'scale') { A.toast(`You weigh yourself on the fish scale. ${fishWord(points())} worth of fish in your bag. You: priceless.`, 3.5); return true; }
    return false;
  });
  window.__G && (window.__G.donut = { S, buy, points, MENU, VALUE });
}
