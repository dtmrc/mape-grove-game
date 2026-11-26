// Goobles' voice for Maple Grove: Off Leash. Watches the player state (no edits to the movement code) and meows:
//   jump effort ('hup', double jump 'mew', triple jump 'yowl'), hopping up onto a raised platform or step ('mrrp'),
//   falling into water ('hiss' + splash), grumbling while swimming, a 'pff' when he climbs out, and random
//   chatter on foot every 14-38 s ('meow', 'mrow', 'mrrp', 'chirp', 'mew', sometimes two in a row).
// Wired into game.js by tools/meows-hooks.mjs. Debug: window.__MEOW (.say(kind), .count)
import { Sfx } from './sfx.js';

export function makeMeows({ P, G }) {
  let jumps = P.jumps || 0, swim = !!P.swim, fl = P.fl || 0, air = false, groundFl = fl, last = -9, swimT = 3, count = 0, lastKind = '';
  const say = (kind, pitch, gap = 0) => {
    const t = G.time || 0;
    if (t - last < gap) return;
    last = t; count++; lastKind = kind;
    try { Sfx.meow(kind, pitch); } catch (e) { /* audio off */ }
  };
  // random chatter: every so often, on foot and out of the water, he just says something
  const IDLE = [['meow', 5], ['mrow', 3], ['mrrp', 2], ['chirp', 2], ['mew', 2]], IDLE_SUM = IDLE.reduce((n, k) => n + k[1], 0);
  const idleGap = () => 14 + Math.random() * 24;
  let idleT = 6 + Math.random() * 10;
  function idle(dt) {
    if (G.dialog || P.down > 0 || (idleT -= dt) > 0) return;
    idleT = idleGap();
    if ((G.time || 0) - last < 2.5) return;               // he just made a noise: skip this one
    let r = Math.random() * IDLE_SUM, kind = IDLE[0][0];
    for (const [k, w] of IDLE) { if ((r -= w) < 0) { kind = k; break; } }
    const pitch = 0.92 + Math.random() * 0.2;
    say(kind, pitch);
    if (Math.random() < 0.22) { try { Sfx.meow(Math.random() < 0.5 ? kind : 'mew', pitch * 1.06, 0.45 + Math.random() * 0.25); } catch (e) { /* audio off */ } }
  }
  function update(dt) {
    if (!dt || P.car || G.paused) { jumps = P.jumps || 0; swim = !!P.swim; fl = P.fl || 0; return; }
    const j = P.jumps || 0, f = P.fl || 0, onGround = P.y <= f + 0.02, s = !!P.swim;
    // jumps: a fresh jump, the double and the triple each get a louder, higher effort sound
    if (j > jumps && P.vy > 0) say(j >= 3 ? 'yowl' : j === 2 ? 'mew' : 'hup', 1 + (j - 1) * 0.08);
    // water
    if (s && !swim) { Sfx.splash(); say('hiss', 1); swimT = 3 + Math.random() * 3; }
    else if (!s && swim) say('pff', 1, 0.5);
    else if (s && (swimT -= dt) <= 0) { say('grumble', 0.9 + Math.random() * 0.2); swimT = 4 + Math.random() * 4; }
    // up onto something: a step up while walking, or landing on a platform higher than where he took off
    if (onGround && !s) {
      if (air && f - groundFl > 0.25) say('mrrp', 1, 0.8);
      else if (!air && f - fl > 0.12) say('mrrp', 1.05, 1.2);
      groundFl = f;
    }
    if (!s) idle(dt);
    air = !onGround && !s;
    jumps = j; swim = s; fl = f;
  }
  const api = { update, say: (k, p) => say(k, p), sfx: Sfx, get count() { return count; }, get last() { return lastKind; } };
  window.__MEOW = api;
  return api;
}
