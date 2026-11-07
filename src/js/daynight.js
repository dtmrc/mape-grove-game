// Day/night sky: the sun and a phased moon travel real arcs across the dome, the star field turns with
// the hour, sunrise/sunset light up the horizon and clouds near the sun, and an 8-day lunar cycle
// advances every in-game midnight. Also draws the little 12-hour HUD clock.
// It runs after game.js updateSky (which advances G.clock and sets the base sky colours / light levels).
import * as THREE from 'three';

const KEY = 'maple-grove-offleash-sky';
export const LUNAR_DAYS = 8;
const PHASE0 = 2;   // day 1 at 21:30 is a full moon
export const PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];

const FRAG = `
  uniform vec3 uTop, uHor, uCloud, uMoon, uSunDir, uGlow;
  uniform float uStars, uTime, uCover, uStarAng, uSunVis, uMoonVis, uMoonGlow, uSun;
  varying vec3 vDir;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=n(p)*a; p*=2.03; a*=0.5; } return s; }
  void main(){
    vec3 d = normalize(vDir);
    float y = max(d.y, 0.0);
    vec3 col = mix(uHor, uTop, pow(y, 0.55));
    col = mix(col, uHor * 0.55, smoothstep(0.0, -0.3, d.y));
    // sunrise / sunset: warm band hugging the horizon on the sun's side, plus a wide halo round the sun
    float sd = max(dot(d, uSunDir), 0.0);
    float band = exp(-abs(d.y - 0.02) * 7.0);
    col += uGlow * (pow(sd, 3.0) * band * 0.9 + pow(sd, 24.0) * 0.5);
    // stars, turning about the celestial pole with the hour
    float ca = cos(uStarAng), sa = sin(uStarAng);
    vec3 r = vec3(ca * d.x + sa * d.y, -sa * d.x + ca * d.y, d.z);
    vec3 cell = floor(r * 150.0);
    float rnd = h3(cell);
    float st = step(0.985, rnd) * smoothstep(0.02, 0.3, d.y);
    vec3 fp = fract(r * 150.0) - 0.5;
    st *= smoothstep(0.32, 0.0, length(fp)) * (0.5 + 0.5 * sin(uTime * (2.0 + rnd * 4.0) + rnd * 60.0));
    st *= 0.55 + 0.9 * fract(rnd * 71.0);
    float hide = 1.0 - min(1.0, uCover * 1.15);
    col += vec3(st) * vec3(0.9, 0.95, 1.1) * uStars * hide;
    // sun disc
    col += vec3(1.6, 1.4, 1.1) * smoothstep(0.99935, 0.99965, sd) * uSunVis * (1.0 - uCover * 0.9);
    // moon: a lit sphere, so its phase comes from where the sun is
    float md = dot(d, uMoon);
    const float R = 0.055;
    if (md > 0.99) {
      vec3 rt = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
      vec3 up = cross(rt, uMoon);
      vec2 q = vec2(dot(d, rt), dot(d, up)) / R;
      float rr = dot(q, q);
      if (rr < 1.0) {
        vec3 nrm = q.x * rt + q.y * up - sqrt(1.0 - rr) * uMoon;
        float lit = smoothstep(-0.04, 0.06, dot(nrm, uSunDir));
        float mare = 0.78 + 0.22 * fbm(q * 2.2 + 3.0) - 0.12 * smoothstep(0.55, 0.7, n(q * 3.0 + 9.0));
        vec3 surf = vec3(1.05, 1.02, 0.92) * mare * (0.75 + 0.25 * sqrt(1.0 - rr));
        vec3 dark = col * 0.82 + vec3(0.02, 0.025, 0.04) * uStars;   // earthshine, hides the stars behind it
        vec3 mc = mix(dark, surf * 1.25, lit);
        col = mix(col, mc, smoothstep(1.0, 0.86, rr) * uMoonVis);
      }
    }
    col += vec3(0.32, 0.32, 0.48) * pow(max(md, 0.0), 260.0) * uMoonGlow + vec3(0.06, 0.06, 0.1) * pow(max(md, 0.0), 24.0) * uMoonGlow;
    // clouds, lit warm on the sun's side at dawn and dusk
    vec2 cp = d.xz / (d.y + 0.15) * 1.6 + vec2(uTime * 0.01, 0.0);
    float c = smoothstep(0.45 - uCover * 0.42, 0.85 - uCover * 0.3, fbm(cp)) * smoothstep(0.0, 0.25, d.y);
    vec3 cc = uCloud + uGlow * pow(sd, 2.0) * 0.8 * (1.0 - uCover * 0.6);
    col = mix(col, cc, c * (0.8 + uCover * 0.2));
    gl_FragColor = vec4(col, 1.0);
  }`;

function phaseIcon(g, x, y, r, phase) {
  // draw the moon's lit shape for a phase in [0,1): 0 new, 0.5 full
  g.save(); g.translate(x, y);
  g.fillStyle = '#2a2c3a'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  const k = Math.cos(phase * Math.PI * 2);      // terminator ellipse x-scale: 1 new .. -1 full
  const right = phase < 0.5;                     // waxing: lit on the right
  g.fillStyle = '#f2ead0'; g.beginPath();
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, !right);
  g.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === right);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  g.restore();
}

export function makeDayNight(o) {
  const { sky, sun, moon, hemi, G } = o;
  let day = 1, lastClock = G.clock;
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.day > 0) day = s.day | 0; } catch (e) { /* storage blocked */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ day })); } catch (e) { /* ignore */ } };

  // swap in our sky shader; keep the existing uniforms object so game.js keeps writing the base colours
  const u = sky.u;
  Object.assign(u, {
    uSunDir: { value: new THREE.Vector3(0, -1, 0) }, uGlow: { value: new THREE.Color() }, uCover: u.uCover || { value: 0 },
    uStarAng: { value: 0 }, uSunVis: { value: 0 }, uMoonVis: { value: 1 }, uMoonGlow: { value: 1 },
  });
  sky.mesh.material.fragmentShader = FRAG; sky.mesh.material.needsUpdate = true;

  // ---- HUD: little 12-hour clock with a dial, a sun/moon marker, the date and the moon phase ----
  const css = document.createElement('style');
  css.textContent = `#clock{display:none!important}
    #skyclock{display:flex;align-items:center;gap:8px;padding:3px 8px 3px 4px;background:rgba(10,12,20,.55);border:2px solid #000;border-radius:4px}
    #skyclock canvas{display:block;image-rendering:pixelated}
    #skyclock .t{font-size:26px;line-height:.9;text-align:right}
    #skyclock .t b{font-weight:normal;font-size:17px;margin-left:3px;opacity:.85}
    #skyclock .s{font-size:14px;line-height:1;opacity:.75;letter-spacing:.5px;text-align:right;white-space:nowrap}
    @media (max-width:700px){#skyclock .t{font-size:22px}#skyclock .s{font-size:12px}}`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'skyclock';
  box.innerHTML = '<canvas width="72" height="72" style="width:36px;height:36px"></canvas><div><div class="t"></div><div class="s"></div></div><canvas width="40" height="40" style="width:20px;height:20px"></canvas>';
  const clockEl = document.getElementById('clock');
  (clockEl?.parentNode || document.body).insertBefore(box, clockEl || null);
  const [dial, moonC] = box.querySelectorAll('canvas'), tEl = box.querySelector('.t'), sEl = box.querySelector('.s');
  const dg = dial.getContext('2d'), mg = moonC.getContext('2d');
  let lastMin = -1, lastPhaseIdx = -1;
  function drawHud(h, phase) {
    const min = Math.floor(h * 60);
    if (min === lastMin) return; lastMin = min;
    const hr = Math.floor(h), mm = min % 60, ampm = hr < 12 ? 'AM' : 'PM', h12 = hr % 12 || 12;
    tEl.innerHTML = `${h12}:${String(mm).padStart(2, '0')}<b>${ampm}</b>`;
    const pi = Math.floor(phase * 8 + 0.5) % 8;
    sEl.textContent = `DAY ${day} · ${PHASES[pi].toUpperCase()}`;
    // dial: sky-coloured face (day blue / dusk orange / night navy), hour + minute hands
    const g = dg, c = 36, R = 32, dayK = Math.max(0, Math.sin((h - 6) / 12 * Math.PI));
    const dusk = Math.abs(h - 18.7) < 1.1 || Math.abs(h - 6.1) < 0.9 ? 1 : 0;
    g.clearRect(0, 0, 72, 72);
    g.fillStyle = dusk > 0.05 ? '#c8683a' : dayK > 0.05 ? '#4a86c8' : '#1a1e3c';
    g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
    g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke();
    g.fillStyle = '#f4efe0';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(c + Math.sin(a) * (R - 7) - 2, c - Math.cos(a) * (R - 7) - 2, i % 3 ? 3 : 5, i % 3 ? 3 : 5); }
    const hand = (a, len, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(a) * len, c - Math.cos(a) * len); g.stroke(); };
    hand(((h % 12) / 12) * Math.PI * 2, R - 15, 5, '#f4efe0');
    hand((mm / 60) * Math.PI * 2, R - 8, 3, '#ffd23f');
    g.fillStyle = '#000'; g.beginPath(); g.arc(c, c, 3, 0, Math.PI * 2); g.fill();
    if (pi !== lastPhaseIdx) { lastPhaseIdx = pi; mg.clearRect(0, 0, 40, 40); phaseIcon(mg, 20, 20, 16, pi / 8); }
  }

  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), warm = new THREE.Color(), pale = new THREE.Color(0xffe8c8);
  const api = {
    get day() { return day; },
    get phase() { return ((day + PHASE0 + G.clock / 24) / LUNAR_DAYS) % 1; },
    setDay(d) { day = Math.max(1, d | 0); persist(); lastMin = -1; lastPhaseIdx = -1; },
    jump(h) { lastClock = h; lastMin = -1; },
    sunDir, moonDir,
    update(nightK) {
      const h = G.clock;
      if (h < lastClock - 12) { day++; persist(); }
      lastClock = h;
      const phase = api.phase;
      // sun: rises due east (+x) at 06:00, highest at noon, sets west at 18:00; tilted a little south
      const th = (h - 6) / 12 * Math.PI;
      sunDir.set(Math.cos(th), Math.sin(th), 0.38).normalize();
      // moon: lags the sun by its phase (full moon rises at sunset, new moon travels with the sun)
      const tm = th - phase * Math.PI * 2;
      moonDir.set(Math.cos(tm), Math.sin(tm), -0.22).normalize();
      u.uSunDir.value.copy(sunDir); u.uMoon.value.copy(moonDir);
      u.uStarAng.value = (h / 24) * Math.PI * 2;
      const e = sunDir.y;
      u.uSunVis.value = THREE.MathUtils.smoothstep(e, -0.06, 0.02);
      // glow colour: deep orange-pink at the horizon, fading to a faint pale haze high in the sky
      const low = 1 - THREE.MathUtils.smoothstep(e, 0.0, 0.45);
      const k = THREE.MathUtils.smoothstep(e, -0.22, 0.0);
      warm.setRGB(1.0, 0.42, 0.18).lerp(pale, 1 - low);
      u.uGlow.value.copy(warm).multiplyScalar(k * (0.25 + low * 0.85));
      const lit = (1 - Math.cos(phase * Math.PI * 2)) / 2;          // illuminated fraction
      const mUp = THREE.MathUtils.smoothstep(moonDir.y, -0.05, 0.08);
      u.uMoonVis.value = (0.35 + 0.65 * nightK);
      u.uMoonGlow.value = nightK * lit * mUp;
      // lights follow the bodies
      sun.position.copy(sunDir).multiplyScalar(100); sun.position.y = Math.max(8, sun.position.y);
      sun.color.lerp(warm.setRGB(1, 0.6, 0.38), low * 0.6);
      moon.position.copy(moonDir).multiplyScalar(100); moon.position.y = Math.max(6, moon.position.y);
      moon.intensity = nightK * (0.12 + 0.55 * lit * mUp);
      hemi.intensity *= 1 - nightK * 0.25 * (1 - lit * mUp);
      // dawn/dusk tint on the ambient light
      hemi.color.lerp(warm.setRGB(1.0, 0.62, 0.5), u.uGlow.value.r * low * 0.35);
      drawHud(h, phase);
    },
  };
  return api;
}

// ---------- debug menu: set the time, freeze or speed up the cycle, step the moon ----------
// Toggle with the ` key, or tap the HUD clock.
export function makeTimeDebug(G, dn) {
  const st = { frozen: false, at: G.clock, speed: 1, open: false };
  const css = document.createElement('style');
  css.textContent = `#skyclock{pointer-events:auto;cursor:pointer}
    #tdbg{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:50;width:min(390px,calc(100% - 32px));display:none;
      background:rgba(10,12,20,.92);border:2px solid #44506a;color:#f4efe0;font-family:'VT323',ui-monospace,monospace;padding:10px 12px 12px;text-shadow:none;touch-action:auto}
    #tdbg.open{display:block}
    #tdbg h3{margin:0 0 6px;font-weight:normal;font-size:20px;color:#ffd23f;display:flex;justify-content:space-between;align-items:center}
    #tdbg .big{font-size:34px;text-align:center;line-height:1}
    #tdbg input[type=range]{width:100%;margin:8px 0 6px;accent-color:#ffd23f}
    #tdbg .row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;align-items:center}
    #tdbg button{font:inherit;font-size:18px;background:#1c2236;color:#f4efe0;border:2px solid #44506a;padding:2px 9px;cursor:pointer;min-height:32px}
    #tdbg button.on{background:#ffd23f;color:#1a1408;border-color:#ffd23f}
    #tdbg label{font-size:20px;display:flex;align-items:center;gap:8px;cursor:pointer}
    #tdbg input[type=checkbox]{width:20px;height:20px;accent-color:#ffd23f}
    #tdbg .lbl{opacity:.7;font-size:17px;min-width:54px}
    #tdbg .moon{flex:1;text-align:center;font-size:18px}`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'tdbg';
  el.innerHTML = `<h3>DEBUG · TIME OF DAY <button data-a="close">X</button></h3>
    <div class="big" data-v="time"></div>
    <input type="range" min="0" max="23.95" step="0.05" data-v="slider">
    <div class="row"><span class="lbl">Jump</span>
      <button data-h="0">12 AM</button><button data-h="6">Dawn</button><button data-h="12">Noon</button><button data-h="18.5">Dusk</button><button data-h="21.5">Night</button></div>
    <div class="row"><label><input type="checkbox" data-v="freeze"> Freeze the day/night cycle</label></div>
    <div class="row"><span class="lbl">Speed</span><button data-s="1">1x</button><button data-s="10">10x</button><button data-s="60">60x</button><button data-s="240">240x</button></div>
    <div class="row"><span class="lbl">Moon</span><button data-a="dprev">&lt;</button><span class="moon" data-v="moon"></span><button data-a="dnext">&gt;</button></div>
    <div class="row"><span class="lbl">Sky</span><button data-a="plane">Send a plane</button><button data-a="chem">Chemtrail day</button></div>`;
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  const slider = q('[data-v=slider]'), freeze = q('[data-v=freeze]');
  for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
  function setTime(h) { G.clock = ((h % 24) + 24) % 24; st.at = G.clock; dn.jump(G.clock); refresh(); }
  function toggle(open = !st.open) {
    st.open = open; el.classList.toggle('open', open);
    if (open) { try { document.exitPointerLock?.(); } catch (e) { /* ignore */ } refresh(); }
  }
  function refresh() {
    const h = G.clock, hr = Math.floor(h), mm = Math.floor((h % 1) * 60);
    q('[data-v=time]').textContent = `${hr % 12 || 12}:${String(mm).padStart(2, '0')} ${hr < 12 ? 'AM' : 'PM'}${st.frozen ? '  (frozen)' : ''}`;
    if (document.activeElement !== slider) slider.value = h.toFixed(2);
    freeze.checked = st.frozen;
    el.querySelectorAll('[data-s]').forEach((b) => b.classList.toggle('on', +b.dataset.s === st.speed && !st.frozen));
    q('[data-v=moon]').textContent = `Day ${dn.day} · ${PHASES[Math.floor(dn.phase * 8 + 0.5) % 8]}`;
  }
  slider.addEventListener('input', () => setTime(+slider.value));
  freeze.addEventListener('change', () => { st.frozen = freeze.checked; st.at = G.clock; refresh(); });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.h) setTime(+b.dataset.h);
    if (b.dataset.s) { st.speed = +b.dataset.s; st.frozen = false; }
    if (b.dataset.a === 'close') toggle(false);
    if (b.dataset.a === 'dprev') dn.setDay(dn.day - 1);
    if (b.dataset.a === 'dnext') dn.setDay(dn.day + 1);
    if (b.dataset.a === 'plane' || b.dataset.a === 'chem') dispatchEvent(new CustomEvent('fx:plane', { detail: b.dataset.a }));
    b.blur(); refresh();
  });
  document.getElementById('skyclock')?.addEventListener('click', () => toggle());
  addEventListener('keydown', (e) => { if (e.key === '`' || e.key === '~' || e.code === 'Backquote') toggle(); });
  const tbl = document.querySelector('#title table');
  if (tbl) { const r = tbl.insertRow(-1); r.insertCell(0).textContent = '`'; r.insertCell(1).textContent = 'time-of-day debug menu'; }
  let rt = 0;
  return {
    st, toggle,
    // called each frame after game.js has advanced G.clock by dt/60
    apply(dt) {
      if (st.frozen) G.clock = st.at;
      else if (st.speed !== 1) G.clock = (G.clock + (st.speed - 1) * dt / 60) % 24;
      if (st.open && (rt -= dt) <= 0) { rt = 0.2; refresh(); }
    },
  };
}
