// Shops and food for Maple Grove: Off Leash (plan M3 + M7): things to spend cash on, every food hotspot feeds the BELLY meter.
// Quik Stop counter and Rosie's "the usual" open a menu in the fishing shop's look (fishing.menu); the RV kibble bowl, the
// RV bed and Nana's casserole are handled on the interiors 'interact' event (returning true replaces the flavour toast);
// Suds N Paws repairs or resprays the car you drive in with at 0 stars (E while in the wash bay; the heat branch in
// game.js updateHeat still clears stars for free). Wired by game.js: makeShops(...) + shops.update(dt) before updatePlayer.
// Debug: window.__G.shops.buy('quik', 'tuna'), .use('rv', 'bowl'), .S
import * as INTR from './interiors.js';
import { inZone } from './world.js';

const PAINT = [0xc0392b, 0x2e6fbf, 0xe8e8e8, 0x2a2a2e, 0x3a8f5a, 0xe0b030, 0x8e5bb0, 0xa04020, 0x6a8090, 0xd86a9a, 0xff7a00, 0x20c0c0];
const HOUR = 60;   // real seconds per game hour (game.js: one game hour per real minute)
const MENUS = {
  quik: {
    title: 'Quik Stop',
    items: [
      { id: 'tuna', label: 'Tuna can', price: 5, blurb: 'Dolphin-safe. Cat-approved. +35 health, +20 belly.' },
      { id: 'slurpee', label: 'Blue Slurpee', price: 3, blurb: 'Flavour: blue. +15 belly and ten seconds of zoomies.' },
      { id: 'jerky', label: 'Gas station jerky', price: 4, blurb: 'Best before: a date that has been scratched off. +25 belly.' },
      { id: 'lotto', label: 'Lotto scratcher', price: 2, blurb: '"Maple Grove Millionaire". Scratch it with a claw. Could be $20. Could be $500.' },
    ],
  },
  diner: {
    title: "Rosie's Diner",
    items: [
      { id: 'melt', label: 'Tuna melt', price: 8, blurb: 'The usual. Rosie adds extra tuna when nobody is looking. +45 belly, +20 health.' },
      { id: 'pie', label: 'Slice of pie', price: 4, blurb: "Today's pie is whatever was in the fridge. +20 belly." },
      { id: 'coffee', label: 'Coffee', price: 2, blurb: 'Bottomless. You sit and watch the road for an hour. +5 belly, time passes.' },
    ],
  },
};

export function makeShops(A) {
  const { G, P, cars, places, fishing, INT, toast, addCash, save, Sfx, pressed, hit, collide } = A;
  const S = { bowlT: -1e9, casseroleT: -1e9, boost: 0, washT: 0, bought: {}, last: '' };
  const since = (t) => G.time - t;
  const hpUp = (n) => { G.hp = Math.min(100, G.hp + n); };

  // ---------- counter menus ----------
  function openShop(kind) {
    const M = MENUS[kind];
    return fishing.menu({
      title: M.title,
      items: () => M.items.map((it) => ({ id: it.id, label: it.label, price: '$' + it.price, blurb: it.blurb, dim: G.cash < it.price })),
      pick: (it) => buy(kind, it.id),
    });
  }
  function buy(kind, id) {
    const it = (MENUS[kind] || { items: [] }).items.find((x) => x.id === id); if (!it) return false;
    if (G.cash < it.price) { Sfx.blip(180); toast(kind === 'quik' ? 'Clerk: "Cash only, cat. And you have none."' : 'Rosie: "On the house? Hon, this is a business."'); return false; }
    addCash(-it.price); S.bought[id] = (S.bought[id] || 0) + 1; Sfx.pickup();
    if (id === 'tuna') { hpUp(35); fishing.feed(20); toast('Tuna can. +35 health, +20 belly.'); }
    else if (id === 'slurpee') { fishing.feed(15); S.boost = 10; toast('BRAIN FREEZE. Zoomies for 10 seconds! +15 belly', 3.5); }
    else if (id === 'jerky') { fishing.feed(25); toast('Jerky. Chewy. Possibly beef. +25 belly'); }
    else if (id === 'lotto') {
      const r = Math.random();
      if (r < 0.01) { addCash(500); Sfx.jingle(); toast('SCRATCHER: $500 WINNER! The clerk asks for ID. You have none. He pays anyway.', 5); }
      else if (r < 0.135) { addCash(20); toast('Scratcher: $20 winner! Beginner\'s claws.'); }
      else toast(['Scratcher: two cherries and a lawn mower. Nothing.', 'Scratcher: "Better luck next time." The lie of the land.', 'Scratcher: nothing. The clerk nods like he knew.'][(Math.random() * 3) | 0]);
    }
    else if (id === 'melt') { fishing.feed(45); hpUp(20); toast('Tuna melt. Rosie: "Eat slow, hon." +45 belly, +20 health', 3.5); }
    else if (id === 'pie') { fishing.feed(20); toast('Pie. It was apple. Probably. +20 belly'); }
    else if (id === 'coffee') { fishing.feed(5); G.clock = (G.clock + 1) % 24; toast('Coffee. You watch the road for an hour. The road does nothing. +5 belly', 3.5); }
    return true;
  }

  // ---------- interior hotspots ----------
  function use(room, spot) {
    if (room === 'quik' && spot === 'counter') return openShop('quik');
    if (room === 'diner' && spot === 'counter') return openShop('diner');
    if (room === 'rv' && spot === 'bowl') {
      const left = 2 * HOUR - since(S.bowlT);
      if (left > 0) { toast(`The bowl is empty. You licked it clean. Refills in ${Math.ceil(left / HOUR * 60)} min.`); Sfx.blip(220); return true; }
      S.bowlT = G.time; fishing.feed(25); Sfx.pickup(); toast('Crunch crunch. Kibble, the breakfast of tactical cats. +25 belly', 3.5); return true;
    }
    if (room === 'rv' && /bed|nap|sleep/.test(spot)) {
      if (G.heat > 0) return false;   // interiors says its line
      const night = G.clock >= 19 || G.clock < 6;
      if (night) G.clock = 7;
      G.hp = 100; save(); Sfx.jingle();
      toast(night ? 'Slept till morning. 7:00, game saved, health restored.' : 'Napped in the RV. Game saved, health restored.', 3.5);
      return true;
    }
    if (room === 'nana' && spot === 'casserole') {
      if (since(S.casseroleT) < 24 * HOUR) { toast('Nana: "You cleaned that dish already, sweetie. Tomorrow. Growing cats need to pace themselves."', 4); Sfx.blip(440); return true; }
      S.casseroleT = G.time; fishing.feed(60); hpUp(30); Sfx.pickup();
      toast('Nana: "Eat, eat. There\'s another one in the freezer for emergencies." +60 belly, +30 health', 4.5);
      return true;
    }
    return false;
  }
  INTR.on('interact', (room, spot) => use(room, spot));

  // ---------- Suds N Paws: repair / respray at 0 stars ----------
  function wash(dt) {
    const c = P.car;
    const m = A.mission && A.mission();
    if (!c || c.dead || G.heat > 0 || (m && m.id === 'gary') || !inZone('wash', c.x, c.z)) { S.washT = 0; return; }
    const repair = c.hp < 100, price = repair ? 30 : 20, label = repair ? 'Repair $30' : 'Respray $20';
    if ((S.washT -= dt) <= 0) { S.washT = 2.5; toast(`Suds N Paws: E = ${label}${G.cash < price ? ' (need $' + price + ')' : ''}`, 2.6); }
    if (hit('e', 'f', 'enter') && !(P.lock > 0) && G.cash >= price) {
      pressed.delete('e'); pressed.delete('f'); pressed.delete('enter');   // not an exit
      addCash(-price); Sfx.pickup(); S.washT = 0.1;
      if (repair) { c.hp = 100; c.fire = 0; toast('Suds N Paws: buffed, bolted, good as new. -$30', 3); }
      else respray(c);
    }
  }
  function respray(c) {
    const pm = c.mesh.userData.paint; if (!pm || !pm.color) { toast('Suds N Paws: "We don\'t do... whatever that is."'); return false; }
    const cur = pm.color.getHex(), i = PAINT.indexOf(cur), col = PAINT[(i + 1) % PAINT.length];
    pm.color.setHex(col); c.paint = col;
    for (const q of c.mesh.userData.paintMats || []) if (q && q.color) q.color.setHex(col);   // merged copies, when a build has them
    toast('Suds N Paws: fresh coat. The HOA will never recognise it. -$20', 3); return true;
  }

  function update(dt) {
    if (G.paused) return;
    wash(dt);
    if (S.boost > 0) {   // Slurpee zoomies: extra ground speed on foot
      S.boost -= dt;
      if (!P.car && P.down <= 0 && (Math.abs(P.vx) + Math.abs(P.vz)) > 0.2) {
        const q = (INT.inside ? INT.collide : collide)(P.x + P.vx * dt * 0.6, P.z + P.vz * dt * 0.6, 0.22, P.y); P.x = q.x; P.z = q.z;
      }
      if (S.boost <= 0) toast('The zoomies pass. The blue remains on your tongue.');
    }
  }

  return { S, update, use, buy, openShop, respray, MENUS };
}
