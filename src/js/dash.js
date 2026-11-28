// Car dash (diet 2026-11-28): speedometer + radio on/off, volume and station buttons while driving.
// Desktop: bottom right, clickable (keys: R station, Shift+R on/off, - / + volume).
// Touch: placed by the touch layout block in src/style.css (#dash), checked by QA suite 21-touchui.
export const DASH_ENABLED = true;

export function makeDash({ P, radio }) {
  const el = document.createElement('div'); el.id = 'dash';
  el.innerHTML = '<div id="speedo"><b>0</b><i>MPH</i></div><div id="radioctl">'
    + '<button id="radiopwr" title="Radio on/off (Shift+R)">ON</button>'
    + '<button id="radiovdn" title="Volume down (-)">-</button>'
    + '<button id="radiovup" title="Volume up (+)">+</button>'
    + '<button id="radiobtn" title="Next station (R)">RADIO</button></div>';
  document.body.append(el);
  const num = el.querySelector('#speedo b'), pwr = el.querySelector('#radiopwr');
  const act = { radiopwr: () => radio.power(), radiovdn: () => radio.volume(-1), radiovup: () => radio.volume(1), radiobtn: () => radio.tap() };
  for (const id in act) {
    el.querySelector('#' + id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); radio.unlock(); act[id](); });
  }
  // keep taps on the dash away from the camera / pointer lock
  for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'click']) el.addEventListener(ev, (e) => e.stopPropagation());
  let shown = false, mph = -1, onShown = null;
  const api = {
    el,
    get mph() { return mph; },
    update() {
      const c = DASH_ENABLED && P.car && !P.car.dead ? P.car : null;
      if (!!c !== shown) { shown = !!c; el.style.display = shown ? '' : 'none'; }
      if (!c) return;
      const v = Math.round(Math.hypot(c.vx || 0, c.vz || 0) * 2.237); // m/s -> mph
      if (v !== mph) { mph = v; num.textContent = v; }
      const on = radio.on;
      if (on !== onShown) { onShown = on; pwr.textContent = on ? 'ON' : 'OFF'; pwr.classList.toggle('off', !on); }
    },
  };
  el.style.display = 'none';
  window.__DASH = api;
  return api;
}
