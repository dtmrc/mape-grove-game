// Gamepad (standard mapping) polled once a frame by game.js before ui.update / updatePlayer. Everything is
// translated into what the rest of the game already reads: the left stick drives the touch stick axes, buttons
// go through keys/pressed exactly like a key press (down adds to both, up removes from keys, pressed is cleared by
// game.js at the end of the frame), the right stick calls the look hook. A/B/X/Y = Cross/Circle/Square/Triangle.
export function makeGamepad(o) {
  const { keys, pressed, touch, P, ui, toast, look } = o;
  const BTN = { 0: ' ', 2: 'punch', 3: 'e', 4: 'q', 5: 'h', 12: 'arrowup', 13: 'arrowdown', 14: 'arrowleft', 15: 'arrowright' };
  const DEAD = 0.18, dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
  let seen = false, drove = false;
  const held = {}, was = [];
  const release = () => { for (const i in held) { keys.delete(held[i]); delete held[i]; } was.length = 0; if (drove) { drove = false; touch.active = false; touch.x = touch.y = 0; } };
  addEventListener('gamepaddisconnected', release);
  return {
    get active() { return seen; },
    update(dt) {
      let gp = null;
      try { for (const g of navigator.getGamepads ? navigator.getGamepads() : []) if (g && g.connected) { gp = g; break; } } catch (e) { /* no gamepad API */ }
      if (!gp) { if (was.length || drove) release(); return; }
      if (!seen) { seen = true; toast('Gamepad connected', 3); }
      const ax = gp.axes || [], bt = gp.buttons || [];
      // left stick -> the touch stick's axes (the player/car update already reads touch.x/touch.y), unless a finger owns it
      const lx = dz(ax[0] || 0), ly = dz(ax[1] || 0);
      if ((lx || ly) && (!touch.active || drove)) { touch.x = lx; touch.y = ly; touch.active = true; drove = true; }
      else if (drove && !lx && !ly) { drove = false; touch.active = false; touch.x = touch.y = 0; }
      // right stick -> camera
      const rx = dz(ax[2] || 0), ry = dz(ax[3] || 0);
      if ((rx || ry) && !ui.open) look(rx * 2.6 * dt, ry * 1.8 * dt);
      for (let i = 0; i < 16; i++) {
        const b = bt[i], down = !!b && (b.pressed || b.value > 0.5);
        if (down && !was[i]) {
          if (i === 9) ui.togglePause();
          else if (i === 8) ui.toggleMap();
          else {
            const k = i === 1 ? (ui.open ? 'escape' : P.car ? 'b' : 'shift') : BTN[i];
            if (k) { keys.add(k); pressed.add(k); held[i] = k; }
          }
        } else if (!down && was[i] && held[i]) { keys.delete(held[i]); delete held[i]; }
        was[i] = down;
      }
    },
  };
}
