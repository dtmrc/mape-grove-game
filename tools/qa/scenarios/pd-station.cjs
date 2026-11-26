// Police station interior (pdstation.js): walk in the front door, shots of every area, climb the stairs, holding.
// node tools/qa/qa.cjs run tools/qa/scenarios/pd-station.cjs
module.exports = async ({ S, check, shot }) => {
  const at = (id, x, z, yaw, pitch = 0.3) => S.js(async ([id, x, z, yaw, pitch]) => {
    const I = window.__INT; const was = I.current(); if (was !== id) await window.QA.enter(id);
    const R = I.room; if (!R) return { err: 'not inside', was, now: I.current(), st: I.state.fading };
    const P = window.__G.P; P.x = R.origin.x + x; P.z = R.origin.z + z; P.y = 0; P.vx = P.vz = 0; P.yaw = yaw + Math.PI;
    window.QA.cam(yaw, pitch); window.QA.step(12); return { room: I.current() };
  }, [id, x, z, yaw, pitch]);
  await S.js(() => { window.QA.start(); window.QA.time(21, { freeze: true }); });
  // front door
  const door = await S.js(() => { const Q = window.QA; Q.tp('-68,19.8', { yaw: 0 }); Q.step(10); const near = window.__INT.state.near; Q.key('e'); Q.step(30); return { near, inside: window.__INT.current() }; });
  check('front door enters the PD', door.inside === 'pd', door);
  await at('pd', 0, 3.7, 0, 0.28); await shot('pd-lobby', { hud: false });
  await at('pd', -3.4, -1.9, 0.7, 0.35); await shot('pd-bullpen', { hud: false });
  await at('pd', 4.0, -3.2, -Math.PI / 2, 0.3); await shot('pd-chief', { hud: false });
  await at('pd', 4.0, -0.1, -Math.PI / 2, 0.3); await shot('pd-interview', { hud: false });
  await at('pd', -5.6, 0.6, Math.PI / 2 + 0.5, 0.3); await shot('pd-stairs', { hud: false });
  // climb the stairs
  const up = await S.js(() => {
    const Q = window.QA, I = window.__INT, R = I.room, P = window.__G.P;
    P.x = R.origin.x - 7.37; P.z = R.origin.z + 0.75; P.yaw = Math.PI; Q.cam(0, 0.3);
    let maxY = 0; for (let i = 0; i < 80 && I.current() === 'pd'; i++) { Q.hold(['w'], 2); maxY = Math.max(maxY, P.y); }
    Q.step(30); return { room: I.current(), maxY, fading: I.state.fading };
  });
  check('stairs lead upstairs', up.room === 'pd2', up);
  await shot('pd2-arrive', { hud: true });
  await at('pd2', -0.6, 0.2, 0, 0.22); await shot('pd2-cells', { hud: false });
  await at('pd2', -0.6, -2.6, 0.3, 0.3); await shot('pd2-cell2', { hud: false });
  await at('pd2', 4.3, 0.4, -Math.PI / 2 - 0.3, 0.3); await shot('pd2-pruitt', { hud: false });
  await at('pd2', -5.0, 2.4, Math.PI / 2 - 0.3, 0.3); await shot('pd2-booking', { hud: false });
  // back down
  const down = await S.js(() => {
    const Q = window.QA, I = window.__INT, R = I.room, P = window.__G.P;
    P.x = R.origin.x - 7.37; P.z = R.origin.z - 4.5; P.yaw = 0; Q.cam(Math.PI, 0.3);
    for (let i = 0; i < 40 && I.current() === 'pd2'; i++) Q.hold(['w'], 2);
    Q.step(30); return { room: I.current() };
  });
  check('stairs lead back down', down.room === 'pd', down);
  // leave by the front door
  const out = await S.js(() => { const Q = window.QA, I = window.__INT, R = I.room, P = window.__G.P; P.x = R.origin.x; P.z = R.origin.z + 3.6; Q.cam(Math.PI, 0.3); for (let i = 0; i < 40 && I.current(); i++) Q.hold(['w'], 2); Q.step(20); return { room: I.current(), x: P.x, z: P.z }; });
  check('front door leads out', out.room === null, out);
  return S.state();
};
