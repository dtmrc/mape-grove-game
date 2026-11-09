// Off Leash NPC Creator: UI around src/js/npcgen.js. Bundled by tools/npc-creator/build.mjs into dist/npc-creator.html.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildNPC, defaultRecipe, randomRecipe, normalizeRecipe, OPTIONS, LABELS, SKINS, HAIR_COLORS, CLOTH_COLORS } from '../../src/js/npcgen.js';

const $ = (s, el = document) => el.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ---------------------------------------------------------------- state
let recipe = defaultRecipe('male');
let npc = null, currentId = null, dirty = false;
let clipName = 'Idle', spinning = true;
let db = null, downloads = null;

// ---------------------------------------------------------------- three
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
const pivot = new THREE.Group(); scene.add(pivot);
const orbit = { yaw: 0.55, pitch: 0.12, dist: 3.6, target: 0.9 };
const floor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 0.92, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; scene.add(ring);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

function rebuild() {
  const old = npc;
  npc = buildNPC(recipe); recipe = npc.recipe;
  if (old) { pivot.remove(old.root); old.dispose(); }
  pivot.add(npc.root);
  npc.play(clipName); npc.update(0.001);
  orbit.target = npc.height * 0.52; orbit.dist = 2.1 + npc.height * 0.9;
  $('#stats').textContent = `${npc.tris} tris · ${npc.height.toFixed(2)} m`;
  syncControls();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (npc) npc.update(dt);
  if (spinning && !drag.on) orbit.yaw += dt * 0.5;
  const cp = Math.cos(orbit.pitch);
  cam.position.set(Math.sin(orbit.yaw) * cp * orbit.dist, orbit.target + Math.sin(orbit.pitch) * orbit.dist, Math.cos(orbit.yaw) * cp * orbit.dist);
  cam.lookAt(0, orbit.target, 0);
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// drag to orbit, wheel / pinch to zoom
const drag = { on: false, x: 0, y: 0, pinch: 0 };
stage.addEventListener('pointerdown', (e) => { if (e.target !== renderer.domElement) return; drag.on = true; drag.x = e.clientX; drag.y = e.clientY; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', (e) => { if (!drag.on) return; orbit.yaw += (e.clientX - drag.x) * 0.01; orbit.pitch = Math.max(-0.3, Math.min(1.2, orbit.pitch + (e.clientY - drag.y) * 0.006)); drag.x = e.clientX; drag.y = e.clientY; });
stage.addEventListener('pointerup', () => (drag.on = false)); stage.addEventListener('pointercancel', () => (drag.on = false));
stage.addEventListener('wheel', (e) => { e.preventDefault(); orbit.dist = Math.max(1.2, Math.min(8, orbit.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
stage.addEventListener('touchmove', (e) => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (drag.pinch) orbit.dist = Math.max(1.2, Math.min(8, orbit.dist * drag.pinch / d)); drag.pinch = d; drag.on = false; } }, { passive: true });
stage.addEventListener('touchend', () => (drag.pinch = 0));

// ---------------------------------------------------------------- controls
const SECTIONS = [
  { title: 'Body', rows: [
    { key: 'sex', label: 'Preset', kind: 'chips' },
    { key: 'build', label: 'Build', kind: 'chips', note: 'Built is male only' },
    { key: 'height', label: 'Height', kind: 'range', min: 0.85, max: 1.12, step: 0.01 },
  ] },
  { title: 'Head', rows: [
    { key: 'face', label: 'Face shape', kind: 'chips' },
    { key: 'nose', label: 'Nose', kind: 'chips' },
    { key: 'skin', label: 'Skin', kind: 'swatch', colors: SKINS },
    { key: 'hair', label: 'Hairstyle', kind: 'chips' },
    { key: 'hairColor', label: 'Hair colour', kind: 'swatch', colors: HAIR_COLORS },
    { key: 'facialHair', label: 'Facial hair', kind: 'chips', maleOnly: true },
  ] },
  { title: 'Outfit', rows: [
    { key: 'shirt', label: 'Shirt', kind: 'chips' },
    { key: 'shirtColor', label: 'Shirt colour', kind: 'swatch', colors: CLOTH_COLORS },
    { key: 'pants', label: 'Pants', kind: 'chips' },
    { key: 'pantsColor', label: 'Pants colour', kind: 'swatch', colors: CLOTH_COLORS },
    { key: 'jacket', label: 'Jacket', kind: 'chips' },
    { key: 'jacketColor', label: 'Jacket colour', kind: 'swatch', colors: CLOTH_COLORS },
    { key: 'shoeColor', label: 'Shoes', kind: 'swatch', colors: ['#1c1c1c', '#5a3a22', '#e8e8e8', '#8a2a2a', '#3a3a5a', '#c8b48a'] },
  ] },
];
const controls = $('#controls');
const rowEls = {};
for (const sec of SECTIONS) {
  const s = el('section', 'sec'); s.appendChild(el('h2', null, sec.title));
  for (const row of sec.rows) {
    const r = el('div', 'row'); r.dataset.key = row.key;
    const lab = el('div', 'lab'); lab.appendChild(el('span', null, row.label)); if (row.note) lab.appendChild(el('small', null, row.note)); r.appendChild(lab);
    const body = el('div', 'opts'); r.appendChild(body);
    if (row.kind === 'chips') {
      for (const v of OPTIONS[row.key]) { const b = el('button', 'chip', LABELS[row.key][v]); b.type = 'button'; b.dataset.v = v; b.addEventListener('click', () => set(row.key, v)); body.appendChild(b); }
    } else if (row.kind === 'swatch') {
      for (const c of row.colors) { const b = el('button', 'sw'); b.type = 'button'; b.dataset.v = c; b.style.background = c; b.title = c; b.setAttribute('aria-label', c); b.addEventListener('click', () => set(row.key, c)); body.appendChild(b); }
      const custom = el('label', 'sw custom'); custom.title = 'Pick any colour';
      const inp = document.createElement('input'); inp.type = 'color'; inp.id = 'pick-' + row.key; inp.addEventListener('input', () => set(row.key, inp.value)); custom.appendChild(inp); body.appendChild(custom);
    } else if (row.kind === 'range') {
      const inp = document.createElement('input'); inp.type = 'range'; inp.id = 'range-' + row.key; inp.min = row.min; inp.max = row.max; inp.step = row.step;
      inp.addEventListener('input', () => set(row.key, +inp.value, true)); body.appendChild(inp);
      const out = el('output'); out.id = 'out-' + row.key; body.appendChild(out);
    }
    s.appendChild(r); rowEls[row.key] = { row, elm: r };
  }
  controls.appendChild(s);
}
let pending = 0;
function set(key, v, throttle = false) {
  if (key === 'sex') { const keepName = recipe.name; recipe = { ...defaultRecipe(v), name: keepName, skin: recipe.skin, hairColor: recipe.hairColor, height: recipe.height }; }
  else recipe = { ...recipe, [key]: v };
  recipe = normalizeRecipe(recipe); dirty = true;
  if (throttle) { if (pending) return; pending = requestAnimationFrame(() => { pending = 0; rebuild(); }); } else rebuild();
  markDirty();
}
function syncControls() {
  for (const k in rowEls) {
    const { row, elm } = rowEls[k];
    elm.hidden = !!row.maleOnly && recipe.sex !== 'male';
    if (row.kind === 'chips') for (const b of elm.querySelectorAll('.chip')) { b.classList.toggle('on', b.dataset.v === recipe[k]); b.disabled = (k === 'build' && b.dataset.v === 'built' && recipe.sex === 'female') || (k === 'pants' && b.dataset.v === 'skirt' && false); }
    if (row.kind === 'swatch') { let hit = false; for (const b of elm.querySelectorAll('.sw:not(.custom)')) { const on = b.dataset.v.toLowerCase() === String(recipe[k]).toLowerCase(); b.classList.toggle('on', on); hit ||= on; } const c = elm.querySelector('.custom'); c.classList.toggle('on', !hit); c.style.background = hit ? '' : recipe[k]; $('#pick-' + k).value = recipe[k]; }
    if (row.kind === 'range') { $('#range-' + k).value = recipe[k]; $('#out-' + k).textContent = (npc ? npc.height : 1.78 * recipe.height).toFixed(2) + ' m'; }
  }
  $('#name').value = recipe.name || '';
}
$('#name').addEventListener('input', () => { recipe.name = $('#name').value; dirty = true; markDirty(); });
function markDirty() { $('#save').textContent = currentId ? (dirty ? 'Save changes' : 'Saved') : 'Save to library'; }

// animation + spin
for (const b of $('#clips').querySelectorAll('button')) b.addEventListener('click', () => { clipName = b.dataset.clip; npc.play(clipName); for (const o of $('#clips').querySelectorAll('button')) o.classList.toggle('on', o === b); });
$('#spin').addEventListener('click', () => { spinning = !spinning; $('#spin').classList.toggle('on', spinning); });

// presets / random
$('#random').addEventListener('click', () => { recipe = randomRecipe(Math.random, recipe.sex); recipe.name = $('#name').value; currentId = null; dirty = true; rebuild(); markDirty(); toast('Rolled a new townsperson'); });
$('#random-any').addEventListener('click', () => { recipe = randomRecipe(); recipe.name = ''; currentId = null; dirty = true; rebuild(); markDirty(); });
$('#reset').addEventListener('click', () => { recipe = defaultRecipe(recipe.sex); currentId = null; dirty = true; rebuild(); markDirty(); });

// ---------------------------------------------------------------- toast
let toastT = 0;
function toast(msg, bad = false) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', bad); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }

// ---------------------------------------------------------------- export
function thumb(size = 96) {
  const c = document.createElement('canvas'); c.width = size; c.height = Math.round(size * 1.5);
  const r2 = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true, canvas: c });
  const sc = new THREE.Scene(); const n2 = buildNPC(recipe); n2.play('Idle'); n2.update(0.01); sc.add(n2.root);
  const oc = new THREE.OrthographicCamera(-0.55, 0.55, 0.9 + 0.825 * 2 - 0.9, -0.9 + 0.9, 0.1, 20);
  oc.left = -0.6; oc.right = 0.6; oc.top = n2.height / 2 + 0.95; oc.bottom = n2.height / 2 - 0.95; oc.updateProjectionMatrix();
  oc.position.set(2.5, n2.height / 2 + 0.6, 6); oc.lookAt(0, n2.height / 2, 0);
  r2.setSize(c.width, c.height, false); r2.render(sc, oc);
  const url = c.toDataURL('image/png'); n2.dispose(); r2.dispose(); return url;
}
$('#glb').addEventListener('click', async () => {
  if (!downloads) return toast('Downloads are not available in this view', true);
  const name = (recipe.name || 'npc').replace(/[^\w-]+/g, '_');
  // export a clean copy in rest pose (the exporter keeps the skeleton + clips)
  const copy = buildNPC(recipe);
  new GLTFExporter().parse(copy.root, async (buf) => {
    copy.dispose();
    try { await downloads.save({ filename: name + '.glb', data: buf }); toast('Saved ' + name + '.glb'); } catch (e) { toast(e?.code === 'declined' ? 'Download cancelled' : 'Could not save: ' + (e?.message || e), e?.code !== 'declined'); }
  }, (e) => { copy.dispose(); toast('Export failed: ' + (e?.message || e), true); }, { binary: true, animations: copy.clips });
});
$('#json').addEventListener('click', async () => {
  const text = JSON.stringify(recipe, null, 2);
  try { await navigator.clipboard.writeText(text); toast('Recipe copied'); } catch (e) { $('#paste').value = text; $('#paste').hidden = false; $('#paste').select(); toast('Copy the recipe from the box'); }
});
$('#import').addEventListener('click', () => { const p = $('#paste'); if (p.hidden) { p.hidden = false; p.value = ''; p.placeholder = 'Paste a recipe JSON here, then press Import again'; p.focus(); return; } try { const r = JSON.parse(p.value); recipe = normalizeRecipe(r); currentId = null; dirty = true; rebuild(); markDirty(); p.hidden = true; toast('Recipe loaded'); } catch (e) { toast('That is not a recipe JSON', true); } });

// ---------------------------------------------------------------- library (artifact db)
const list = $('#library');
let unsub = null;
function renderLib(docs) {
  list.replaceChildren();
  if (!docs.length) { list.appendChild(el('p', 'empty', 'Nothing saved yet. Dress someone up and press Save to library; they will show up here for every visit.')); return; }
  for (const d of docs) {
    const data = d.data(); const card = el('button', 'card'); card.type = 'button';
    const img = document.createElement('img'); img.alt = ''; img.src = data.thumb || ''; img.width = 48; img.height = 72; card.appendChild(img);
    const meta = el('div', 'meta'); meta.appendChild(el('strong', null, data.name || 'Unnamed')); const r = data.recipe || {};
    meta.appendChild(el('span', null, [LABELS.sex[r.sex] || '', LABELS.build[r.build] || '', LABELS.hair[r.hair] || ''].filter(Boolean).join(' · '))); card.appendChild(meta);
    card.classList.toggle('on', d.id === currentId);
    card.addEventListener('click', () => { recipe = normalizeRecipe(data.recipe || {}); recipe.name = data.name || ''; currentId = d.id; dirty = false; rebuild(); markDirty(); for (const c of list.querySelectorAll('.card')) c.classList.toggle('on', c === card); });
    const del = el('button', 'del', 'Delete'); del.type = 'button'; del.title = 'Delete ' + (data.name || 'this NPC');
    del.addEventListener('click', async (e) => { e.stopPropagation(); if (del.dataset.arm) { try { await db.collection('npcs').doc(d.id).delete(); if (currentId === d.id) { currentId = null; dirty = true; markDirty(); } toast('Deleted'); } catch (err) { toast('Could not delete: ' + (err?.message || err), true); } } else { del.dataset.arm = '1'; del.textContent = 'Sure?'; setTimeout(() => { delete del.dataset.arm; del.textContent = 'Delete'; }, 2500); } });
    card.appendChild(del); list.appendChild(card);
  }
}
$('#save').addEventListener('click', async () => {
  if (!db) return toast('Saving needs a signed-in view of this page', true);
  const name = ($('#name').value || '').trim(); if (!name) { $('#name').focus(); return toast('Give them a name first', true); }
  recipe.name = name;
  const doc = { name, recipe, thumb: thumb(), updatedAt: new Date().toISOString() };
  try {
    if (currentId) await db.collection('npcs').doc(currentId).update(doc);
    else { doc.createdAt = doc.updatedAt; const ref = await db.collection('npcs').add(doc); currentId = ref.id; }
    dirty = false; markDirty(); toast('Saved ' + name);
  } catch (e) { toast('Could not save: ' + (e?.message || e), true); }
});
$('#dup').addEventListener('click', () => { currentId = null; dirty = true; recipe.name = (recipe.name || 'npc') + ' copy'; syncControls(); markDirty(); toast('Now a new NPC; save to keep it'); });

// ---------------------------------------------------------------- boot
function start(saved) {
  if (saved && saved.recipe) { recipe = normalizeRecipe(saved.recipe); currentId = saved.currentId || null; dirty = !!saved.dirty; }
  resize(); rebuild(); markDirty();
  try { window.claude?.hot?.snapshot?.(() => ({ recipe, currentId, dirty })); } catch (e) { /* no hot module */ }
  (async () => {
    try { db = window.claude?.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
    if (db) {
      const timer = setTimeout(() => { if (!list.children.length) renderLib([]); }, 10000);
      unsub = db.collection('npcs').orderBy('updatedAt', 'desc').onSnapshot((snap) => { clearTimeout(timer); renderLib(snap.docs); }, (e) => { clearTimeout(timer); list.replaceChildren(el('p', 'empty', 'Library unavailable: ' + (e?.message || e))); });
    } else { list.replaceChildren(el('p', 'empty', 'Sign in to keep a library of saved NPCs. You can still build, randomise and export.')); $('#save').disabled = true; }
    try { downloads = window.claude?.use ? await window.claude.use('downloads') : null; } catch (e) { downloads = null; }
    if (!downloads) { $('#glb').disabled = true; $('#glb').title = 'GLB download is not available in this view'; }
  })();
}
if (window.claude?.hot?.ready) window.claude.hot.ready(start); else start(window.claude?.hot?.data ?? {});
