// Quest log + tracked quest for Maple Grove: Off Leash.
// - L (or PAUSE > QUESTS, or the QUESTS touch button) opens the log: every story mission, side job and Earl's
//   "Catch of the Day", grouped In progress / Available / Locked / Done. Pick one to TRACK it.
// - The tracked quest drives the HUD: the objective line (with the quest's name above it), the on-screen waypoint,
//   the red beacon, the minimap "!" and the town map "!". A quest you haven't started points at whoever gives it.
// - Nothing else changes how missions run. game.js objective() now only stores the raw text in G.objRaw and this
//   module is the one writer of #objective; G.check stays the mission's own target and readers ask quests.check()
//   for what to show. The beacon (checkMark) is swapped to the tracked target only around the render.
// - Starting a mission tracks it; when it ends, tracking goes back to what you had before. Talking to Earl tracks
//   his quest unless a mission is running. Jailbreak always shows its own HUD.
// Wired by tools/questlog-hooks.mjs (game.js, ui.js, fishing.js). Own save key. Debug: window.__G.quests (.S, .list(), .track(id)).
import { setText, setHTML, setStyle, setClass } from './dom.js';

const KEY = 'maple-grove-offleash-quests-v1';
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const QUESTS = [
  { id: 'nana', kind: 'story', title: 'Casserole Run', giver: 'Nana', where: "Nana's porch", reward: 150, blurb: "Nana's hip won't do stairs. Drive her wagon and drop a casserole at three houses without wrecking it." },
  { id: 'kids', kind: 'story', title: 'Slurpee Sprint', giver: 'the Quik Stop Kids', where: 'the Quik Stop', reward: 250, blurb: "Race the Quik Stop Kids around town. Hit every checkpoint. Loser buys Slurpees for a month." },
  { id: 'ricky', kind: 'story', title: 'Trash Panda Heist', giver: 'Big Ricky', where: 'Lakeside Park', reward: 200, blurb: 'The HOA locked every bin. Grab six bags of the good trash and bring them to the raccoons in the park.' },
  { id: 'gary', kind: 'story', title: 'Final Notice', giver: 'Gary', where: "Gary's house", reward: 500, needs: ['nana', 'kids', 'ricky'], blurb: "Gary is filing the eviction himself. Wreck his golf cart before the paperwork goes through." },
  { id: 'catch', kind: 'fishing', title: 'Catch of the Day', giver: 'Earl', where: 'Bait & Tackle', reward: 75, blurb: "Buy a rod and bait from Earl, catch a fish off the dock, cook it at the shore firepit and eat it. Earl pays for the story." },
  { id: 'fish', kind: 'side', title: 'Fish Order', giver: 'Rosie', where: "Rosie's Diner", reward: 90, blurb: "Rosie's fish guy quit. Bring her 3 bass or 1 catfish. Repeatable." },
  { id: 'repo', kind: 'side', title: 'Repo Man', giver: 'Nana', where: "Nana's lawn", reward: 120, needs: ['nana'], blurb: "Gary towed Nana's gnome. Borrow the HOA golf cart from their lot and park it at the RV. Repeatable." },
  { id: 'signs', kind: 'side', title: 'Sign Language', giver: 'the Quik Stop Kids', where: 'the Quik Stop forecourt', reward: 150, needs: ['kids'], blurb: 'Paw six HOA lawn signs flat in the Estates within three minutes. Repeatable.' },
];
const BY = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
const GROUPS = [['active', 'IN PROGRESS'], ['open', 'AVAILABLE'], ['locked', 'LOCKED'], ['done', 'DONE']];

const S = { track: null, prev: null, open: false, sel: 0, rows: [], lastMission: null, lastCatch: null, view: null, swapped: null };
let A = null;   // the context from init()

function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && (s.track === null || BY[s.track])) S.track = s.track; else if (s && s.track) S.pendingTrack = s.track; } catch (e) { /* storage blocked */ } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify({ track: S.track })); } catch (e) { /* ignore */ } }

const mission = () => (A ? A.mission() : null);
const catchStage = () => (A && A.fishing ? A.fishing.S.quest || 'none' : 'none');
function status(q) {
  if (q.status) return q.status();   // quests.add(): a module's own quest
  const G = A.G, m = mission();
  if (q.id === 'catch') { const st = catchStage(); return st === 'done' ? 'done' : st === 'none' ? 'open' : 'active'; }
  if (m && m.id === q.id) return 'active';
  if (q.kind === 'side' && G.sideDone && G.sideDone[q.id]) return 'done';   // jobs.js: done for today
  if (q.needs && !q.needs.every((n) => G.done[n])) return 'locked';
  if (q.kind === 'story' && G.done[q.id]) return 'done';
  return 'open';
}
function giverSpot(q) {
  if (q.id === 'catch') { const s = A.fishing.SHOP; return s ? s.mark : null; }
  const mk = A.giverMarks[q.id]; return mk ? { x: mk.position.x, z: mk.position.z } : null;
}
const near = (p, r) => Math.hypot(A.px() - p.x, A.pz() - p.z) < r;
/** What the HUD should show for quest q right now: { obj, check } (check may be null). */
function guide(q) {
  if (q.guide) return q.guide();   // quests.add(): a module's own quest
  const st = status(q), m = mission();
  if (q.id === 'catch' && st === 'active') {
    const f = A.fishing.QUEST && A.fishing.QUEST[catchStage()];
    if (!f) return { obj: '', check: null };
    return { obj: f.obj, check: f.at && !near(f.at, 6) ? { x: f.at.x, z: f.at.z, r: 2.5, label: f.label } : null };
  }
  if (st === 'active') return { obj: A.G.objRaw || '', check: A.G.check };   // the running mission
  if (st === 'locked') return { obj: `Locked: finish ${q.needs.filter((n) => !A.G.done[n]).map((n) => BY[n].title).join(', ')} first.`, check: null };
  const at = giverSpot(q), who = q.giver.replace(/^the /, '');
  if (st === 'done' && q.kind === 'side') return { obj: `Done for today. ${q.giver[0].toUpperCase() + q.giver.slice(1)} may have another one tomorrow morning.`, check: null };
  const verb = st === 'done' ? `Replay for half pay: talk to ${q.giver} at ${q.where}.` : `Talk to ${q.giver} at ${q.where} to start.`;
  const obj = m ? `${verb} (finish ${m.title || 'the current job'} first)` : verb;
  return { obj, check: at && !near(at, 3.5) ? { x: at.x, z: at.z, r: 2.5, label: who[0].toUpperCase() + who.slice(1), col: '#ffd23f' } : null };
}

/** null = show the game's own HUD state (raw objective + G.check), else the tracked quest's guide. */
function computeView() {
  const G = A.G, m = mission();
  if (A.jail && A.jail.active()) return null;
  const q = S.track && BY[S.track];
  if (!q) return null;
  if (m && m.id === q.id) return null;
  if (q.id === 'catch' && !m && status(q) === 'active') return null;   // fishing.js already draws it
  if (status(q) === 'done' && q.kind !== 'story') return null;
  const g = guide(q);
  g.title = q.title;
  if (m) g.sub = `${m.title || 'Job'} still running`;
  return g;
}
function nativeTitle() {
  const m = mission(); if (A.jail && A.jail.active()) return 'Jailbreak';
  if (m) return m.title || '';
  if (catchStage() !== 'none' && catchStage() !== 'done' && A.G.objRaw) return 'Catch of the Day';
  return '';
}

function setTrack(id, quiet) {
  if (id && !BY[id]) return;
  S.track = id || null; persist(); S.lastObjHTML = null;
  if (!quiet) { A.toast(id ? `Tracking: ${BY[id].title}` : 'Quest tracking off.', 2.5); A.Sfx && A.Sfx.blip(id ? 760 : 330); }
  if (S.open) render();
}
// auto tracking: a started mission takes over, an ended one hands back; Earl's quest tracks itself when picked up
function autoTrack() {
  const m = mission(), mid = m ? m.id : null;
  if (mid !== S.lastMission) {
    if (mid && BY[mid]) { if (S.track !== mid) S.prev = S.track; setTrack(mid, true); }
    else if (!mid && S.lastMission && S.track === S.lastMission) { const p = S.prev && BY[S.prev] && status(BY[S.prev]) !== 'done' ? S.prev : null; S.prev = null; setTrack(p, true); }
    S.lastMission = mid;
  }
  const cs = catchStage();
  if (cs !== S.lastCatch) {
    if (S.lastCatch === 'none' && cs !== 'none' && cs !== 'done' && !m) setTrack('catch', true);
    if (cs === 'done' && S.track === 'catch') setTrack(null, true);
    S.lastCatch = cs;
  }
  if (S.track && BY[S.track] && BY[S.track].kind === 'story' && status(BY[S.track]) === 'done' && S.lastDoneCheck !== S.track) { /* keep: replays are trackable */ }
}

// ---------- DOM ----------
let root, list, detail, hint, btn, objTitle, objText, objSub;
function buildDom() {
  const css = document.createElement('style');
  css.textContent = `
#questlog { position: fixed; inset: 0; display: none; place-items: center; padding: 12px; z-index: 61; text-shadow: none;
  background: radial-gradient(ellipse at center, rgba(20, 16, 40, 0.55), rgba(0, 0, 0, 0.85)); }
#questlog.open { display: grid; }
#questlog .qcard { width: min(860px, 100%); max-height: calc(100vh - 24px); display: flex; flex-direction: column; background: var(--panel); border: 3px solid #c8c0a0; box-shadow: 6px 6px 0 #000; padding: 10px 14px 10px; }
#questlog h1 { margin: 0 0 6px; font-weight: normal; font-size: clamp(30px, 6vw, 44px); line-height: 0.9; color: var(--gold); text-shadow: 3px 3px 0 #6a2a10, 6px 6px 0 #000; text-align: center; }
#questlog .qbody { display: flex; gap: 14px; min-height: 0; flex: 1; }
#questlog .qlist { flex: 1 1 52%; overflow-y: auto; min-height: 0; padding-right: 4px; }
#questlog .qdetail { flex: 1 1 48%; overflow-y: auto; min-height: 0; border-left: 2px solid #44506a; padding-left: 14px; font-size: 21px; line-height: 1.1; }
#questlog h2 { font-weight: normal; font-size: 19px; color: #ff8ab0; letter-spacing: 3px; margin: 8px 0 2px; }
#questlog .q { display: flex; align-items: center; gap: 8px; padding: 3px 8px; margin: 3px 0; font-size: 23px; line-height: 1.05; border: 2px solid #44506a; background: rgba(255,255,255,0.04); cursor: pointer; }
#questlog .q b { font-weight: normal; flex: 1; }
#questlog .q small { font-size: 18px; color: var(--cash); white-space: nowrap; }
#questlog .q i { font-style: normal; width: 18px; text-align: center; color: var(--gold); }
#questlog .q.sel { border-color: var(--gold); background: #2a2f44; }
#questlog .q.trk { background: rgba(255, 210, 63, 0.18); }
#questlog .q.trk b { color: var(--gold); }
#questlog .q.locked, #questlog .q.done { opacity: 0.55; }
#questlog .qdetail h3 { margin: 4px 0 2px; font-weight: normal; font-size: 30px; color: var(--gold); }
#questlog .qdetail .meta { color: #9fb0d0; font-size: 19px; margin-bottom: 6px; }
#questlog .qdetail .step { margin: 8px 0; padding: 6px 8px; border: 2px dashed #44506a; }
#questlog .qdetail .step span { display: block; font-size: 17px; color: #ff8ab0; letter-spacing: 2px; }
#questlog .qbtns { display: flex; gap: 10px; justify-content: center; margin-top: 8px; flex-wrap: wrap; }
#questlog .qbtns div { font-size: 24px; padding: 2px 18px; background: var(--gold); color: #1a1408; border: 3px solid #000; box-shadow: 4px 4px 0 #000; cursor: pointer; }
#questlog .qbtns div.off { background: #8a8470; }
#questlog .hint { font-size: 17px; opacity: 0.7; margin-top: 6px; text-align: center; }
#objective small.qt { display: block; font-size: 0.68em; letter-spacing: 3px; color: var(--gold); opacity: 0.9; }
#objective small.qs { display: block; font-size: 0.62em; color: #ff8ab0; margin-top: 2px; }
@media (max-width: 720px), (max-height: 480px) {
  #questlog .qbody { flex-direction: column; }
  #questlog .qdetail { border-left: none; border-top: 2px solid #44506a; padding: 6px 0 0; flex: 0 0 auto; max-height: 38vh; }
  #questlog .q { font-size: 20px; }
  #questlog h1 { font-size: 28px; }
}
@media (max-height: 480px) and (min-width: 600px) { #questlog .qbody { flex-direction: row; } #questlog .qdetail { border-top: none; border-left: 2px solid #44506a; padding: 0 0 0 12px; max-height: none; flex: 1 1 46%; } }
body.menu #questbtn { display: none !important; }
`;
  document.head.appendChild(css);
  root = document.createElement('div'); root.id = 'questlog';
  root.innerHTML = `<div class="qcard"><h1>QUEST LOG</h1><div class="qbody"><div class="qlist"></div><div class="qdetail"></div></div><div class="qbtns"><div data-a="track">TRACK</div><div data-a="close">CLOSE</div></div><div class="hint"></div></div>`;
  document.body.appendChild(root);
  list = root.querySelector('.qlist'); detail = root.querySelector('.qdetail'); hint = root.querySelector('.hint');
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  list.addEventListener('click', (e) => { const r = e.target.closest('.q'); if (!r) return; const i = +r.dataset.i; if (i === S.sel) toggleSel(); else { S.sel = i; render(); A.Sfx && A.Sfx.blip(440); } });
  root.querySelector('.qbtns').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'close') close(); else toggleSel(); });
  // objective line: quest name, then the step, then a note when another job is still running
  const o = A.hud.obj; o.textContent = '';
  objTitle = document.createElement('small'); objTitle.className = 'qt';
  objText = document.createElement('span');
  objSub = document.createElement('small'); objSub.className = 'qs';
  o.append(objTitle, objText, objSub);
  // touch: QUESTS button next to PAUSE / MAP
  const mb = document.getElementById('menubtns');
  if (mb) { btn = document.createElement('button'); btn.id = 'questbtn'; btn.textContent = 'QUEST'; mb.appendChild(btn); btn.addEventListener('click', () => (S.open ? close() : open())); }
}

function toggleSel() {
  const q = S.rows[S.sel]; if (!q) return;
  if (status(q) === 'locked') { A.toast(`${q.title} is locked. ${guide(q).obj.replace(/^Locked: /, '')}`, 3); A.Sfx && A.Sfx.blip(200); return; }
  setTrack(S.track === q.id ? null : q.id);
}
function render() {
  const rows = [];
  let h = '';
  for (const [st, label] of GROUPS) {
    const qs = QUESTS.filter((q) => status(q) === st);
    if (!qs.length) continue;
    h += `<h2>${label}</h2>`;
    for (const q of qs) {
      const i = rows.length; rows.push(q);
      const trk = S.track === q.id;
      h += `<div class="q ${st}${trk ? ' trk' : ''}${i === S.sel ? ' sel' : ''}" data-i="${i}"><i>${trk ? '&#9670;' : st === 'done' ? '&#10003;' : st === 'locked' ? '&#215;' : ''}</i><b>${esc(q.title)}</b><small>$${q.reward}${q.kind === 'side' ? ' · side' : ''}</small></div>`;
    }
  }
  S.rows = rows; S.sel = Math.max(0, Math.min(rows.length - 1, S.sel));
  list.innerHTML = h;
  const q = rows[S.sel];
  if (q) {
    const st = status(q), g = guide(q);
    detail.innerHTML = `<h3>${esc(q.title)}</h3><div class="meta">${esc(q.giver[0].toUpperCase() + q.giver.slice(1))} · ${esc(q.where)} · $${q.reward}${q.kind === 'side' ? ' · side job' : ''}</div><div>${esc(q.blurb)}</div>`
      + (g.obj ? `<div class="step"><span>${st === 'active' ? 'CURRENT STEP' : st === 'locked' ? 'LOCKED' : st === 'done' ? 'DONE' : 'TO START'}</span>${esc(g.obj)}</div>` : '')
      + (S.track === q.id ? '<div style="color:var(--gold)">&#9670; Tracked: the HUD and waypoint follow this quest.</div>' : '');
    const tb = root.querySelector('[data-a="track"]');
    tb.textContent = S.track === q.id ? 'UNTRACK' : 'TRACK'; tb.classList.toggle('off', st === 'locked');
  } else detail.innerHTML = '';
  hint.textContent = A.isTouch ? 'Tap a quest, tap TRACK to follow it' : 'W/S choose · E or Enter track / untrack · L or Esc close';
  const sel = list.querySelector('.q.sel'); if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
}
function canOpen() {
  const G = A.G;
  return !document.body.classList.contains('titled') && !G.dialog && !(A.ui && A.ui.open) && !(A.fishing && A.fishing.menuOpen()) && !(A.dev && A.dev().editing) && !(A.jail && A.jail.active());
}
function open() {
  if (S.open || !canOpen()) return;
  S.open = true; A.G.paused = true; root.classList.add('open'); document.body.classList.add('menu');
  try { document.exitPointerLock?.(); } catch (e) { /* ignore */ }
  const i = QUESTS.filter((q) => true); S.rows = []; render();
  const t = S.rows.findIndex((q) => q.id === S.track); S.sel = t >= 0 ? t : 0; render();
  A.Sfx && A.Sfx.blip(520);
}
function close() {
  if (!S.open) return;
  S.open = false; A.G.paused = false; root.classList.remove('open');
  if (!(A.ui && A.ui.open)) document.body.classList.remove('menu');
  A.P.lock = Math.max(A.P.lock || 0, 0.3); A.Sfx && A.Sfx.blip(440);
}

export const quests = {
  S, QUESTS,
  /** A module's own quest: { id, kind, title, giver, where, reward, blurb, status() -> 'open'|'active'|'done', guide() -> { obj, check } }. */
  add(q) { if (!BY[q.id]) { QUESTS.push(q); BY[q.id] = q; } },
  init(ctx) { A = ctx; if (A.G.objRaw === undefined) A.G.objRaw = ''; load(); S.lastMission = mission() ? mission().id : null; S.lastCatch = catchStage(); buildDom(); },
  open, close, get isOpen() { return S.open; },
  /** Add a quest owned by another module: { id, kind, title, giver, where, reward, blurb, status() -> 'hidden'|'open'|'active'|'locked'|'done', guide() -> { obj, check } }. */
  register(def) { if (!def || BY[def.id]) return; quests.add(def); if (S.pendingTrack === def.id) { S.track = def.id; S.pendingTrack = null; } },
  track: (id) => setTrack(id, true),
  list: () => QUESTS.map((q) => ({ id: q.id, title: q.title, status: status(q), tracked: S.track === q.id, step: guide(q).obj })),
  view: () => S.view,
  /** The target the HUD shows: the tracked quest's, or the game's own G.check. */
  check() { if (!A) return null; return S.view ? S.view.check : A.G.check; },
  /** Keys: before ui.update every frame. */
  input() {
    if (!A) return;
    const { hit, pressed } = A;
    if (!S.open) { if (hit('l') && canOpen()) { open(); pressed.delete('l'); } return; }
    if (A.G.dialog || (A.ui && A.ui.paused)) return close();
    if (hit('l', 'escape', 'q', 'tab', 'shift')) close();
    else if (hit('w', 'arrowup')) { S.sel = (S.sel - 1 + S.rows.length) % S.rows.length; render(); A.Sfx && A.Sfx.blip(440); }
    else if (hit('s', 'arrowdown')) { S.sel = (S.sel + 1) % S.rows.length; render(); A.Sfx && A.Sfx.blip(440); }
    else if (hit('e', 'f', 'enter', ' ', 'punch')) toggleSel();
    for (const k of ['l', 'escape', 'q', 'tab', 'shift', 'e', 'f', 'enter', ' ', 'punch', 'w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']) pressed.delete(k);
    A.G.paused = true;
  },
  /** Every frame, before the render: decide what the HUD follows, write #objective, put the beacon on that target. */
  swapIn() {
    if (!A) return;
    autoTrack();
    const v = S.view = computeView();
    const title = v ? v.title : nativeTitle(), text = v ? v.obj : A.G.objRaw, sub = v ? v.sub || '' : '';
    setText(objTitle, text ? title.toUpperCase() : ''); setStyle(objTitle, 'display', text && title ? 'block' : 'none');
    setText(objText, text || '');
    setText(objSub, text ? sub : ''); setStyle(objSub, 'display', text && sub ? 'block' : 'none');
    setStyle(A.hud.obj, 'display', text ? 'block' : 'none');
    if (v) {
      const cm = A.checkMark, c = v.check;
      S.swapped = { vis: cm.visible, x: cm.position.x, z: cm.position.z, sx: cm.scale.x, sz: cm.scale.z };
      cm.visible = !!c && !c.blipOnly;
      if (c) { cm.position.set(c.x, cm.position.y, c.z); const k = (c.r || 2.5) / 2.5; cm.scale.set(k, 1, k); }
    }
    if (btn) setClass(btn, 'on', S.open);
  },
  swapOut() {
    const w = S.swapped; if (!w) return; S.swapped = null;
    const cm = A.checkMark; cm.visible = w.vis; cm.position.set(w.x, cm.position.y, w.z); cm.scale.set(w.sx, 1, w.sz);
  },
};
