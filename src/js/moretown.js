// More town (2026-11-28, diet: "if we have improved performance capacity, lets add more houses and commercial buildings").
// Everything here is code-built from the materials world.js already has (no new textures or models), merged into the
// same per-material, per-chunk meshes, with box colliders like every other building. world.js calls buildMoreTown(K) after
// buildCountry and hands it its helpers in K; the random sequence is saved round the call so nothing else moves.
//
//   Hwy 9 East (north side, across from the fire station + hospital): Post Office, First Farmers Bank, Dollar Barn
//   County Rd 12 x Hwy 9: The Rusty Spur roadhouse (NE corner), Juniper Motor Inn (SE corner)
//   Hollow Ln, east of Pine Hollow: six country homes
//   Sawyer Farm Rd, north of the school: two farmsteads (farmhouse, barn, silo / grain bins)
import * as THREE from 'three';

export const MORE_TOWN = true;   // flag: false builds none of it

/** Point beside a road: t metres from named node a toward b (curves included), off metres to the side (side +1 = left of
 *  the direction of travel in x/z, -1 = right). Returns [x, z, ry] with ry facing back toward the road. */
function along(K, a, b, t, side, off) {
  const p = K.via(a, b); let A = K.NODES[p[0]], B = K.NODES[p[1]];
  for (let i = 0; i < p.length - 1; i++) {
    A = K.NODES[p[i]]; B = K.NODES[p[i + 1]]; const L = Math.hypot(B.x - A.x, B.z - A.z);
    if (t <= L || i === p.length - 2) break; t -= L;
  }
  const L = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / L, dz = (B.z - A.z) / L, nx = dz * side, nz = -dx * side;
  return [A.x + dx * t + nx * off, A.z + dz * t + nz * off, Math.atan2(-nx, -nz)];
}

/** Parking stall lines (white, in the shared 'lamp' bucket) along local x from x0, n stalls of width sw, nose at lz0, length len. */
function stalls(K, F, x0, n, sw, lz0, len) {
  for (let k = 0; k <= n; k++) F.geo(K.plane(0.12, len), 'lamp', 0xffffff, x0 + k * sw, 0.062, lz0 + len / 2);
}
// ---------------------------------------------------------------------------------------------------------------------
// Hwy 9 East: north side of the highway, x 156..238, facing south. Lot front line z = -8 (12 m highway + shoulder).
function postOffice(K) {
  const F = K.frame(167, -29, 0), BR = 0xc0644a, TR = 0xf0ece2, w = 13, d = 10, h = 4.8;
  F.trim = TR;
  F.flat(0, 14, 15, 14, 'asphalt', 0xd8d8d8, 0.045, '#6a6a70');
  F.flat(0, 6.2, w + 1, 2.4, 'sidewalk', 0xe4e0d8, 0.055, '#b8b4ac');
  stalls(K, F, -7, 5, 2.8, 9.5, 5);
  F.box(0, h / 2, 0, w, h, d, 'brick', BR); F.bld(0, 0, w, d, h + 0.4);
  K.coping(F, 0, 0, w, d, h, TR);
  F.box(0, 0.3, 0, w + 0.16, 0.6, d + 0.16, 'plain', 0x8a8478);
  F.box(0, 3.55, d / 2 + 0.04, w + 0.12, 0.22, 0.1, 'plain', TR);                       // cast-stone band
  // the entrance bay: a little white portico, double glass doors
  K.shopWin(F, -2.2, 1.35, d / 2 + 0.02, 2.2, 2.7, 'door', 0x5a7aa0, { frame: TR, noKick: true });
  F.box(-2.2, 3.2, d / 2 + 1.1, 3.6, 0.2, 2.2, 'plain', TR);
  for (const s of [-1, 1]) { F.geo(new THREE.CylinderGeometry(0.16, 0.18, 3.1, 8), 'plain', TR, -2.2 + s * 1.55, 1.55, d / 2 + 2); F.post(-2.2 + s * 1.55, d / 2 + 2, 0.18, 3.2); }
  F.box(-2.2, 0.1, d / 2 + 1.1, 3.8, 0.2, 2.2, 'plain', 0xb8b0a4); F.floor(-2.2, d / 2 + 1.1, 3.8, 2.2, 0.2);
  for (const x of [1.4, 3.6, 5.6]) F.face(x, 2, d / 2 + 0.02, 1.3, 2, 'window', 0xffffff);
  F.face(-5.4, 2, d / 2 + 0.02, 1.3, 2, 'window', 0xffffff);
  for (const lz of [-2.5, 2]) { F.face(w / 2 + 0.02, 2, lz, 1.3, 2, 'window', 0xffffff, 2); F.face(-w / 2 - 0.02, 2, lz, 1.3, 2, 'window', 0xffffff, 3); }
  F.sign('MAPLE GROVE  POST OFFICE', '#1e3a6a', '#f4f0e0', 9.6, 0.8, 4.25, d / 2 + 0.08, { tw: 512, th: 48 });
  F.light(-2.2, 3, d / 2 + 1.6, 0xfff0d0, 0.8); F.halo(-2.2, 3.1, d / 2 + 1.2, 1.6, 0xfff0d0);
  K.roofUnit(F, 3, h + 0.22, -2, 1); K.roofUnit(F, -3.5, h + 0.22, 1.5, 0.8);
  // loading door + the mail truck round the back
  F.face(3.5, 1.5, -d / 2 - 0.02, 3, 3, 'garage', 0xe8e8e8, 1);
  F.flat(3.5, -d / 2 - 3, 7, 6, 'asphalt', 0xd8d8d8, 0.045);
  { const tx = 3.5, tz = -d / 2 - 3.4;
    F.box(tx, 1.35, tz, 1.9, 2.2, 3.6, 'plain', 0xf4f4f0); F.box(tx, 1.05, tz + 2.05, 1.8, 1.4, 0.6, 'plain', 0xf4f4f0);
    F.box(tx, 1.2, tz, 1.92, 0.22, 3.62, 'plain', 0x2a4a8a); F.box(tx, 1.62, tz + 0.2, 1.93, 0.12, 3.4, 'plain', 0xc03030);
    F.face(tx, 1.95, tz + 1.82, 1.6, 0.6, 'window', 0x9aa0a8);
    for (const s of [-1, 1]) for (const z2 of [tz - 1.2, tz + 1.5]) F.geo(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10).rotateZ(Math.PI / 2), 'plain', 0x1a1a1a, tx + s * 0.92, 0.33, z2);
    F.col(tx, tz + 0.3, 2, 4.4, 2.5); }
  // flagpole on a brick plinth, two blue collection boxes at the curb
  F.box(-5.6, 0.3, 8.2, 1.2, 0.6, 1.2, 'brick', 0xb85a42); F.col(-5.6, 8.2, 1.2, 1.2, 0.6);
  F.box(-5.6, 4.8, 8.2, 0.12, 9, 0.12, 'plain', 0xdddddd); F.post(-5.6, 8.2, 0.12, 9.3, K.sgn(0xdddddd, 0.12, [0.8, 8.4, 0, 1.6, 1, 0.04, 0x2a4a8a]));
  F.geo(new THREE.SphereGeometry(0.12, 6, 4), 'metal', 0xe0c060, -5.6, 9.35, 8.2);
  F.box(-4.8, 8.4, 8.2, 1.6, 1, 0.04, 'plain', 0x2a4a8a);
  for (const x of [3.2, 4.3]) {
    F.box(x, 0.65, 7.9, 0.8, 1.0, 0.75, 'plain', 0x2a4a8a); F.geo(new THREE.CylinderGeometry(0.38, 0.38, 0.8, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), 'plain', 0x2a4a8a, x, 1.15, 7.9);
    for (const s of [-1, 1]) F.box(x + s * 0.32, 0.08, 7.9, 0.08, 0.16, 0.7, 'plain', 0x1a1a1a);
    F.col(x, 7.9, 0.85, 0.8, 1.5);
  }
  K.bench(F, 1, 6.8, Math.PI);
  K.trashCan(...F.at(5.6, 7), 0x2a4a8a);
  K.places.postOffice = (([x, z]) => ({ x, z, name: 'Post Office' }))(F.at(-2.2, 10));
}

function bank(K) {
  const F = K.frame(189, -29, 0), ST = 0xe8e2d2, TR = 0xf4f2ea, w = 14, d = 11, h = 5.4;
  F.trim = TR;
  F.flat(-1, 14.5, 18, 13, 'asphalt', 0xd8d8d8, 0.045, '#6a6a70');
  stalls(K, F, -9.5, 6, 2.7, 10, 5);
  F.box(0, h / 2, 0, w, h, d, 'brick', ST); F.bld(0, 0, w, d, h + 0.6);
  K.coping(F, 0, 0, w, d, h, TR, 0.4);
  F.box(0, 0.35, 0, w + 0.2, 0.7, d + 0.2, 'plain', 0xb0aa9c);
  // classical front: steps, four columns, entablature, pediment
  for (let k = 0; k < 3; k++) { F.box(0, 0.12 + k * 0.24, d / 2 + 2.9 - k * 0.4, 9.2, 0.24, 1.2 + k * 0.4, 'plain', 0xd8d2c4); }
  F.floor(0, d / 2 + 2.3, 9.2, 2, 0.72); F.ramp(0, d / 2 + 3.3, 9.2, 0.8, 0.72, 0.05);
  for (const x of [-3.6, -1.2, 1.2, 3.6]) { F.geo(new THREE.CylinderGeometry(0.3, 0.34, 4.2, 10), 'plain', TR, x, 2.82, d / 2 + 1.9); F.post(x, d / 2 + 1.9, 0.34, 5); }
  F.box(0, 5.15, d / 2 + 1.6, 9.4, 0.7, 2.6, 'plain', TR);
  F.geo(K.gable(2.6, 1.4, 9.8).rotateY(Math.PI / 2), 'plain', TR, 0, 5.5, d / 2 + 1.6);
  K.shopWin(F, 0, 1.75, d / 2 + 0.02, 2.2, 2.8, 'door', 0x3a4a5a, { frame: 0x8a6a2a, noKick: true });
  for (const x of [-5.2, 5.2]) F.face(x, 2.6, d / 2 + 0.02, 1.5, 2.6, 'window', 0xffffff);
  F.sign('FIRST FARMERS BANK', '#f4f2ea', '#1e4a2e', 7.6, 0.62, 5.15, d / 2 + 2.92, { tw: 512, th: 44 });
  F.light(0, 4.4, d / 2 + 2.2, 0xfff0d0, 0.9); F.halo(0, 4.6, d / 2 + 1.8, 2, 0xfff0d0);
  // drive-thru on the east side (local +x): a lane, a canopy on posts, the teller window and a tube station
  F.flat(w / 2 + 3.4, 1.5, 6.4, d + 9, 'asphalt', 0xd8d8d8, 0.045, '#6a6a70');
  F.box(w / 2 + 3, 3.6, 0, 6.6, 0.4, 7, 'plain', TR); F.box(w / 2 + 3, 3.85, 0, 6.8, 0.12, 7.2, 'plain', 0x1e4a2e);
  for (const z of [-3.2, 3.2]) { F.box(w / 2 + 5.9, 1.7, z, 0.3, 3.4, 0.3, 'brick', ST); F.post(w / 2 + 5.9, z, 0.2, 3.6); }
  F.face(w / 2 + 0.02, 1.6, 0, 1.6, 1.2, 'storeWin', 0xffffff, 2);
  F.box(w / 2 + 3.2, 0.55, 0, 0.8, 1.1, 0.8, 'brick', ST); F.box(w / 2 + 3.2, 1.35, 0, 0.5, 0.6, 0.5, 'metal', 0xc8ccd0); F.col(w / 2 + 3.2, 0, 0.8, 0.8, 1.6);
  F.light(w / 2 + 3, 3.3, 0, 0xf0f4ff, 0.7);
  F.sign('DRIVE-UP', '#1e4a2e', '#f4f2ea', 2.4, 0.4, 3.6, 3.56, { tw: 256, th: 40, lx: w / 2 + 3 });
  // ATM in the west wall, a time + temperature sign by the highway
  F.box(-w / 2 - 0.15, 1.2, 1.5, 0.3, 2.4, 1.2, 'plain', 0x3a3c42); F.face(-w / 2 - 0.31, 1.4, 1.5, 0.6, 0.5, 'storeWin', 0x80c0ff, 3);
  F.col(-w / 2 - 0.15, 1.5, 0.4, 1.2, 2.4);
  K.hydrant(...F.at(8.6, 19));
  K.places.bank = (([x, z]) => ({ x, z, name: 'First Farmers Bank' }))(F.at(0, 10.5));
}

function dollarBarn(K) {
  const F = K.frame(222.5, -30.5, 0), WALL = 0xe8d8b0, RED = 0x9a2a22, w = 23, d = 15, h = 5.4;
  F.trim = 0xf4f0e4;
  F.flat(0, 15, 25, 14, 'asphalt', 0xd8d8d8, 0.045, '#6a6a70');
  stalls(K, F, -11.5, 4, 2.7, 11, 5); stalls(K, F, 1.3, 4, 2.7, 11, 5);
  F.box(0, h / 2, 0, w, h, d, 'siding', WALL); F.bld(0, 0, w, d, h + 2.6);
  F.box(0, 0.25, 0, w + 0.12, 0.5, d + 0.12, 'plain', 0x8a8478);
  K.coping(F, 0, 0, w, d, h, 0x5a5650);
  // a barn-red false front with a gambrel top, white trim, the name in yellow on black
  F.box(0, h + 1.1, d / 2 + 0.1, w + 0.4, 2.2, 0.25, 'siding', RED);
  for (const s of [-1, 1]) F.geo(new THREE.BoxGeometry(4.4, 0.25, 0.25).rotateZ(s * -0.5), 'siding', RED, s * 6.2, h + 2.75, d / 2 + 0.1);
  F.box(0, h + 3.3, d / 2 + 0.1, 8.4, 0.9, 0.25, 'siding', RED);
  F.box(0, h + 3.8, d / 2 + 0.13, 8.6, 0.12, 0.3, 'plain', 0xf4f0e4);
  F.box(0, h + 0.02, d / 2 + 0.25, w + 0.5, 0.14, 0.12, 'plain', 0xf4f0e4);
  F.sign('DOLLAR BARN', '#111111', '#ffd23f', 11, 1.5, h + 1.45, d / 2 + 0.25, { tw: 512, th: 72, glow: true });
  F.sign('EVERYTHING $1  (MOSTLY)', '#ffd23f', '#111111', 6.6, 0.5, h + 3.3, d / 2 + 0.25, { tw: 512, th: 40 });
  // glass entry vestibule, two store windows with posters
  K.shopWin(F, 0, 1.4, d / 2 + 0.02, 4.4, 2.8, 'door', 0x9ac0d8, { noKick: true });
  F.box(0, 3.05, d / 2 + 0.9, 5.4, 0.3, 1.8, 'plain', RED);
  for (const x of [-7, 7]) K.shopWin(F, x, 1.8, d / 2 + 0.02, 5, 2.2, 'storeWin', 0xfff4d8);
  F.face(-8.6, 1.9, d / 2 + 0.05, 1, 1.4, 'posterCat', 0xffffff);
  F.light(0, 3, d / 2 + 2, 0xfff4e0, 0.9); F.halo(0, 3.1, d / 2 + 1.5, 2.2, 0xfff4e0);
  for (const [x, z] of [[-6, -3], [0, 2], [7, -2]]) K.roofUnit(F, x, h + 0.22, z, 1.1);
  // cart corral + a stack of carts, an ice chest, propane exchange, the dumpster round the side
  { const cx = 6.5, cz = 13.5;
    for (const s of [-1, 1]) F.box(cx, 0.55, cz + s * 0.7, 3.6, 0.05, 0.05, 'metal', 0xc0c4c8);
    for (const x of [cx - 1.8, cx + 1.8]) for (const s of [-1, 1]) F.box(x, 0.5, cz + s * 0.7, 0.06, 1, 0.06, 'metal', 0xc0c4c8);
    for (let k = 0; k < 4; k++) { F.box(cx - 1.2 + k * 0.42, 0.75, cz, 0.55, 0.45, 0.8, 'metal', 0x9a2a22); F.box(cx - 1.2 + k * 0.42, 0.35, cz, 0.5, 0.05, 0.75, 'metal', 0x888888); }
    F.col(cx, cz, 3.8, 1.6, 1.1); }
  F.box(-4.2, 0.55, d / 2 + 0.8, 1.6, 1.1, 0.8, 'plain', 0xf4f4f4); F.box(-4.2, 0.75, d / 2 + 1.21, 1.2, 0.35, 0.02, 'plain', 0x2a6ab0); F.col(-4.2, d / 2 + 0.8, 1.6, 0.8, 1.1);
  F.box(4.3, 0.8, d / 2 + 0.8, 1.6, 1.6, 0.9, 'metal', 0xb8bcc4); F.col(4.3, d / 2 + 0.8, 1.6, 0.9, 1.6);
  for (let k = 0; k < 3; k++) F.geo(new THREE.CylinderGeometry(0.17, 0.17, 0.6, 8), 'plain', 0x3a6ab0, 3.8 + k * 0.5, 0.45, d / 2 + 0.85);
  F.box(-w / 2 - 1.4, 0.75, -4, 1.8, 1.5, 3, 'metal', 0x2a5a3a); F.col(-w / 2 - 1.4, -4, 1.8, 3, 1.5);
  K.places.dollar = (([x, z]) => ({ x, z, name: 'Dollar Barn' }))(F.at(0, 11));
}

// ---------------------------------------------------------------------------------------------------------------------
// County Rd 12 x Hwy 9: a roadhouse on the north-east corner, a motel on the south-east corner
function rustySpur(K) {
  const F = K.frame(273, -29, 0), WOOD = 0x8a5e3e, ROOF = 0x8a4a2a, TR = 0xe8d8b8, w = 16, d = 11, h = 4.4;
  F.trim = TR;
  F.flat(-1, 13.5, 34, 15, 'dirt', 0xc8c0b0, 0.04, '#8a8478');
  F.box(0, h / 2, 0, w, h, d, 'siding', WOOD); F.bld(0, 0, w, d, h + 2.6);
  F.geo(K.gable(w + 0.8, 2, d + 0.8), 'metal', ROOF, 0, h + 0.05, 0);
  F.geo(K.gableEnds(w, 2 * d / (d + 0.8), d), 'siding', WOOD, 0, h, 0);
  F.box(0, 0.2, 0, w + 0.1, 0.4, d + 0.1, 'plain', 0x6a6458);
  // western false front, tall over the porch roof
  F.box(0, (h + 2.6) / 2, d / 2 + 0.12, w + 0.3, h + 2.6, 0.25, 'siding', 0x7a4e32);
  F.box(0, h + 2.68, d / 2 + 0.12, w + 0.6, 0.16, 0.4, 'plain', TR);
  F.sign('THE RUSTY SPUR', '#2a1a10', '#ff7a30', 10.5, 1.3, h + 1.4, d / 2 + 0.27, { tw: 512, th: 64, glow: true });
  // porch: plank deck, posts, a shed roof, a hitching rail
  F.box(0, 0.25, d / 2 + 1.6, w, 0.5, 3, 'wood', 0xb89a78); F.floor(0, d / 2 + 1.6, w, 3, 0.5);
  F.geo(new THREE.BoxGeometry(w + 0.4, 0.12, 3.4).rotateX(0.16), 'metal', ROOF, 0, 3.55, d / 2 + 1.6);
  for (let x = -w / 2 + 0.2; x <= w / 2; x += (w - 0.4) / 4) { F.box(x, 1.85, d / 2 + 2.95, 0.2, 3.3, 0.2, 'wood', 0x9a7a58); F.post(x, d / 2 + 2.95, 0.12, 3.4); }
  F.face(0, 1.6, d / 2 + 0.27, 1.6, 2.2, 'door', 0x5a3a22);
  for (const x of [-4.8, 4.8]) F.face(x, 2.1, d / 2 + 0.27, 2, 1.2, 'storeWin', 0xffd8a0);
  F.sign('COLD BEER', '#1a1a1a', '#ff3040', 1.8, 0.45, 2.1, d / 2 + 0.33, { tw: 256, th: 48, lx: -4.8, glow: true });
  F.sign('LIVE MUSIC SAT', '#1a1a1a', '#40c0ff', 2, 0.4, 2.1, d / 2 + 0.33, { tw: 256, th: 40, lx: 4.8, glow: true });
  { const rz = d / 2 + 4.4; F.box(0, 0.95, rz, 5, 0.12, 0.12, 'wood', 0x9a7a58); for (const s of [-1, 1]) F.box(s * 2.4, 0.5, rz, 0.15, 1, 0.15, 'wood', 0x9a7a58); F.col(0, rz, 5.1, 0.3, 1.1); }
  F.light(0, 3.2, d / 2 + 2, 0xffb070, 0.9); F.halo(-4.8, 2.1, d / 2 + 0.6, 1.4, 0xff4050); F.halo(4.8, 2.1, d / 2 + 0.6, 1.4, 0x40c0ff);
  F.light(0, h + 1.4, d / 2 + 1.5, 0xff8a40, 0.6, { always: true }); F.halo(0, h + 1.4, d / 2 + 0.7, 3.2, 0xff8a40);
  // side patio: picnic tables, a smoker made of an oil drum, barrels
  for (const z of [-2, 2]) K.picnic(...F.at(w / 2 + 3.5, z), Math.PI / 2);
  F.geo(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 10).rotateZ(Math.PI / 2), 'metal', 0x2a2a2a, w / 2 + 3.5, 1.1, 5.2);
  F.box(w / 2 + 3.5, 0.4, 5.2, 1.2, 0.8, 0.7, 'metal', 0x3a3a3a); F.box(w / 2 + 4.3, 1.9, 5.2, 0.15, 1.4, 0.15, 'metal', 0x2a2a2a); F.col(w / 2 + 3.5, 5.2, 1.6, 1, 1.4);
  for (const [x, z] of [[-w / 2 - 1, 4], [-w / 2 - 1, 5]]) K.barrel(...F.at(x, z), 0x6a4a2a);
  // the roadside sign: two log posts, a board, a set of steer horns on top
  { const sx = -10.5, sz = 19.3;
    for (const s of [-1, 1]) { F.geo(new THREE.CylinderGeometry(0.2, 0.24, 5.6, 7), 'bark', 0xc8b8a0, sx + s * 2.2, 2.8, sz); F.post(sx + s * 2.2, sz, 0.22, 5.6, K.sgn(0xc8b8a0, 0.4)); }
    F.box(sx, 4, sz, 5, 1.6, 0.22, 'wood', 0x7a5236);
    F.sign('BBQ & BEER', '#7a5236', '#f4e0b0', 4.6, 1.2, 4, sz + 0.13, { tw: 512, th: 96, lx: sx });
    F.geo(new THREE.SphereGeometry(0.4, 8, 6).scale(1, 0.8, 1.1), 'plain', 0xe8e0d0, sx, 5.3, sz);
    for (const s of [-1, 1]) {   // long horns: out sideways, tips curling up
      F.geo(new THREE.ConeGeometry(0.13, 1.3, 6).rotateZ(-s * (Math.PI / 2 - 0.12)), 'plain', 0xf0e8d0, sx + s * 0.95, 5.35, sz);
      F.geo(new THREE.ConeGeometry(0.07, 0.5, 5).rotateZ(-s * 0.5), 'plain', 0xf0e8d0, sx + s * 1.68, 5.55, sz);
    } }
  K.places.roadhouse = (([x, z]) => ({ x, z, name: 'The Rusty Spur' }))(F.at(0, 9.5));
}

function motel(K) {
  // local frame faces north (ry = PI): world x = 273 - lx, world z = 27 - lz. Lot lx -20..20, lz -19..19.
  const F = K.frame(273, 27, Math.PI), WALL = 0xf0e2c4, TR = 0x2a7a7a, ROOF = 0x7a4a3a, DOORS = [0x2a7a7a, 0xd8742a];
  F.trim = 0xf4f0e4;
  F.flat(2, 3.5, 32, 26, 'asphalt', 0xd8d8d8, 0.045, '#6a6a70');
  // main wing along the back: 7 rooms; the office at its west end (local +x)
  const wing = (lx, lz, w, d, h, ryL) => { F.box(lx, h / 2, lz, w, h, d, 'siding', WALL, ryL); F.box(lx, 0.2, lz, w + 0.1, 0.4, d + 0.1, 'plain', 0x8a8478, ryL); };
  wing(-4, -14, 28, 7, 3.2, 0); F.bld(-4, -14, 28, 7, 4.6);
  F.geo(K.gable(28.6, 1.3, 7.6), 'shingle', ROOF, -4, 3.25, -14);
  F.geo(K.gableEnds(28, 1.3 * 7 / 7.6, 7), 'siding', WALL, -4, 3.2, -14);
  // the short wing on the east side (local -x), rooms facing the lot
  wing(-14.5, -1.5, 7, 18, 3.2, 0); F.bld(-14.5, -1.5, 7, 18, 4.6);
  F.geo(K.gable(18.6, 1.3, 7.6).rotateY(Math.PI / 2), 'shingle', ROOF, -14.5, 3.25, -1.5);
  F.geo(K.gableEnds(18, 1.3 * 7 / 7.6, 7).rotateY(Math.PI / 2), 'siding', WALL, -14.5, 3.2, -1.5);
  // covered walkways on posts in front of the rooms
  F.box(-4, 2.95, -9.4, 28, 0.15, 2.4, 'plain', TR); F.box(-4, 0.1, -9.4, 28, 0.2, 2.4, 'plain', 0xd0ccc4); F.floor(-4, -9.4, 28, 2.4, 0.2);
  F.box(-9.9, 2.95, 1, 2.4, 0.15, 14, 'plain', TR); F.box(-9.9, 0.1, 1, 2.4, 0.2, 14, 'plain', 0xd0ccc4); F.floor(-9.9, 1, 2.4, 14, 0.2);
  for (let x = -16; x <= 10; x += 4.3) { F.box(x, 1.45, -8.35, 0.12, 2.9, 0.12, 'metal', 0xe8e8e8); F.post(x, -8.35, 0.08, 2.9); }
  for (let z = -5; z <= 8; z += 4.3) { F.box(-8.85, 1.45, z, 0.12, 2.9, 0.12, 'metal', 0xe8e8e8); F.post(-8.85, z, 0.08, 2.9); }
  for (let k = 0; k < 7; k++) { const x = -15.5 + k * 3.9; F.face(x, 1.05, -10.47, 0.95, 2.1, 'door', DOORS[k % 2]); F.face(x + 1.5, 1.6, -10.47, 1.4, 1, 'window', 0xffffff); }
  for (let k = 0; k < 4; k++) { const z = -6.5 + k * 3.9; F.face(-10.97, 1.05, z, 0.95, 2.1, 'door', DOORS[(k + 1) % 2], 2); F.face(-10.97, 1.6, z + 1.5, 1.4, 1, 'window', 0xffffff, 2); }
  // office: a little taller, glass front, OFFICE sign, the ice machine by the door
  F.box(14.5, 2, -13, 7, 4, 9, 'siding', 0xf4ead4); F.bld(14.5, -13, 7, 9, 4.4); F.box(14.5, 0.2, -13, 7.1, 0.4, 9.1, 'plain', 0x8a8478);
  F.box(14.5, 4.1, -13, 7.6, 0.25, 9.6, 'plain', TR);
  K.shopWin(F, 14.5, 1.5, -8.47, 4.6, 2.4, 'storeWin', 0xfff0d0);
  F.face(12.6, 1.05, -8.4, 0.9, 2.1, 'door', 0x9ac0d8);
  F.sign('OFFICE', '#2a7a7a', '#f4f0e4', 2.4, 0.5, 3.4, -8.44, { tw: 128, th: 28, lx: 14.5 });
  F.box(10.7, 0.8, -9.4, 1.2, 1.6, 0.9, 'plain', 0xf4f4f4); F.sign('ICE', '#f4f4f4', '#2a6ab0', 0.9, 0.35, 1.3, -8.93, { tw: 64, th: 24, lx: 10.7 }); F.col(10.7, -9.4, 1.2, 0.9, 1.6);
  F.light(14.5, 3.2, -7.5, 0xfff0d0, 0.8); F.light(-4, 2.6, -9, 0xffe0b0, 0.7); F.light(-10, 2.6, 1, 0xffe0b0, 0.6);
  for (const x of [-12, -2, 8]) F.halo(x, 2.8, -9.3, 1.1, 0xffe0b0);
  stalls(K, F, -7.5, 7, 2.9, -7, 5);
  // pool by the highway, chain-link round it
  { const px = 8, pz = 9, pw = 9, pd = 5.5;
    F.box(px, 0.1, pz, pw + 2.4, 0.2, pd + 2.4, 'plain', 0xe0dcd2); F.floor(px, pz, pw + 2.4, pd + 2.4, 0.2);
    F.geo(K.plane(pw, pd), 'plain', 0x58b4e4, px, 0.22, pz);
    F.box(px - pw / 2 + 0.6, 0.6, pz, 0.08, 1, 0.08, 'metal', 0xd8d8d8);
    for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, 0.2]]) {
      const [a, b] = F.at(px + ax * (pw / 2 + 1.4), pz + az * (pd / 2 + 1.4)), [c, e] = F.at(px + bx * (pw / 2 + 1.4), pz + bz * (pd / 2 + 1.4)); K.fenceRun(a, b, c, e, 'chain');
    }
    for (const x of [px - 2, px + 1]) { F.box(x, 0.35, pz + 3.5, 0.7, 0.12, 1.8, 'plain', 0xf4f4f4); F.geo(new THREE.BoxGeometry(0.7, 0.1, 0.8).rotateX(-0.6), 'plain', 0xf4f4f4, x, 0.6, pz + 2.6); }
    K.places.motelPool = (([x, z]) => ({ x, z }))(F.at(px, pz + 3.6)); }
  // the tall pole sign at the corner: name, a neon VACANCY, an arrow
  { const sx = -6, sz = 17.5, H = 6.5;
    for (const s of [-1, 1]) { F.box(sx + s * 1.6, H / 2, sz, 0.22, H, 0.22, 'metal', 0xd8d8d8); F.post(sx + s * 1.6, sz, 0.16, H, K.sgn(0xd8d8d8, 0.22)); }
    F.box(sx, H + 0.8, sz, 5, 1.9, 0.4, 'plain', TR);
    for (const s of [1, -1]) F.sign('JUNIPER MOTOR INN', '#2a7a7a', '#f4f0e4', 4.7, 1.6, H + 0.8, sz + s * 0.21, { tw: 512, th: 128, lx: sx, rr: s > 0 ? 0 : Math.PI });
    F.box(sx, H - 0.9, sz, 3.4, 0.8, 0.3, 'plain', 0x1a1a1a);
    for (const s of [1, -1]) F.sign('VACANCY', '#1a1a1a', '#ff4aa0', 3.2, 0.7, H - 0.9, sz + s * 0.16, { tw: 256, th: 48, lx: sx, glow: true, rr: s > 0 ? 0 : Math.PI });
    F.box(sx, H - 2, sz, 3, 0.6, 0.25, 'plain', 0xf4f0e4);
    F.sign('COLOR TV  A/C', '#f4f0e4', '#2a7a7a', 2.8, 0.5, H - 2, sz - 0.14, { tw: 256, th: 40, lx: sx, rr: Math.PI });
    F.light(sx, H - 0.9, sz + 1, 0xff4aa0, 0.6, { always: true }); F.halo(sx, H - 0.9, sz, 2.4, 0xff4aa0); }
  K.places.motel = (([x, z]) => ({ x, z, name: 'Juniper Motor Inn' }))(F.at(10, -4));
}

// ---------------------------------------------------------------------------------------------------------------------
// Barns and grain storage for the farmsteads
/** Gambrel-roofed barn in its own frame (front = local +z): walls h, roof breaks at 62% of the half width. */
function barn(K, x, z, ry, o) {
  const F = K.frame(x, z, ry), w = o.w ?? 11, d = o.d ?? 15, h = o.h ?? 4.2, hw = w / 2, col = o.col, roof = o.roof, TR = o.trim ?? 0xf4f0e4;
  const P = [[-hw - 0.3, h - 0.15], [-hw * 0.6, h + 2.4], [0, h + 3.5], [hw * 0.6, h + 2.4], [hw + 0.3, h - 0.15]];
  F.box(0, h / 2, 0, w, h, d, 'siding', col); F.bld(0, 0, w, d, h + 3.4);
  F.box(0, 0.2, 0, w + 0.1, 0.4, d + 0.1, 'plain', 0x7a7468);
  for (let k = 0; k < 4; k++) {   // the four roof planes
    const [ax, ay] = P[k], [bx, by] = P[k + 1], L = Math.hypot(bx - ax, by - ay) + 0.06;
    F.geo(new THREE.BoxGeometry(L, 0.14, d + 0.7).rotateZ(Math.atan2(by - ay, bx - ax)), 'metal', roof, (ax + bx) / 2, (ay + by) / 2 + 0.07, 0);
  }
  // gable ends in the wall colour (shape of the gambrel above the eaves)
  const sh = new THREE.Shape(); sh.moveTo(-hw, h); sh.lineTo(-hw * 0.6, h + 2.4); sh.lineTo(0, h + 3.45); sh.lineTo(hw * 0.6, h + 2.4); sh.lineTo(hw, h);
  for (const s of [1, -1]) {
    const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
    if (s < 0) g.rotateY(Math.PI); F.geo(g, 'siding', col, 0, 0, s * (d / 2 + 0.01));
  }
  // big doors with white X bracing, a hayloft door, a hay hood, a cupola on the ridge
  for (const s of [1, -1]) {
    const fz = s * (d / 2 + 0.03), dr = s > 0 ? 0 : Math.PI;
    F.geo(new THREE.BoxGeometry(4, 3.4, 0.08), 'wood', o.door ?? col, 0, 1.7, fz, dr);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) F.geo(new THREE.BoxGeometry(2.3, 0.16, 0.06).rotateZ(sy * Math.atan2(3.2, 1.9)), 'plain', TR, sx * 1, 1.7, fz + s * 0.05, dr);
      F.geo(new THREE.BoxGeometry(0.16, 3.4, 0.06), 'plain', TR, sx * 1.95, 1.7, fz + s * 0.05, dr);
    }
    F.geo(new THREE.BoxGeometry(4.1, 0.16, 0.06), 'plain', TR, 0, 3.45, fz + s * 0.05, dr);
    F.geo(new THREE.BoxGeometry(1.8, 1.6, 0.08), 'wood', o.door ?? col, 0, h + 1.4, fz, dr);
    F.geo(new THREE.BoxGeometry(2, 0.12, 0.06), 'plain', TR, 0, h + 2.25, fz + s * 0.05, dr);
    F.geo(new THREE.BoxGeometry(2, 0.12, 0.06), 'plain', TR, 0, h + 0.55, fz + s * 0.05, dr);
  }
  F.box(0, h + 3.05, d / 2 + 0.7, 0.2, 0.2, 1.6, 'wood', 0x6a5a48);
  F.box(0, h + 3.95, 0, 1.4, 1, 1.4, 'siding', col); F.geo(new THREE.ConeGeometry(1.15, 0.9, 4).rotateY(Math.PI / 4), 'metal', roof, 0, h + 4.9, 0);
  F.geo(new THREE.BoxGeometry(0.05, 0.9, 0.05), 'metal', 0x2a2a2a, 0, h + 5.7, 0);
  F.geo(new THREE.BoxGeometry(0.8, 0.05, 0.05), 'metal', 0x2a2a2a, 0, h + 5.9, 0);
  for (const s of [-1, 1]) F.face(s * (hw + 0.02), 2.2, 2.5, 1.1, 1, 'window', 0xffffff, s > 0 ? 2 : 3);
  K.shadow(x, z, w + 4, d + 4, ry, true);
  F.flat(0, d / 2 + 3, 6, 6, 'dirt', 0xc8c0b0, 0.04);
  F.light(0, 3.8, d / 2 + 0.6, 0xffd8a0, 0.6); F.halo(0, 3.9, d / 2 + 0.3, 1.2, 0xffd8a0);
  return F;
}
function silo(K, x, z, s = 1) {
  K.addS(new THREE.CylinderGeometry(2.2 * s, 2.2 * s, 12 * s, 14), 'brick', 0xe0d0c0, x, 6 * s, z);
  K.addS(new THREE.SphereGeometry(2.25 * s, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', 0xb8bcc0, x, 12 * s, z);
  for (let k = 1; k < 5; k++) K.addS(new THREE.CylinderGeometry(2.24 * s, 2.24 * s, 0.12, 14, 1, true), 'metal', 0x9a9a9a, x, k * 2.4 * s, z);
  K.colliders.push({ cx: x, cz: z, r: 2.2 * s, h: 12 * s, bld: true });
}
function grainBin(K, x, z, r = 2.6, h = 4.6) {
  K.addS(new THREE.CylinderGeometry(r, r, h, 16), 'metal', 0xffffff, x, h / 2, z);
  K.addS(new THREE.ConeGeometry(r + 0.15, 1.7, 16), 'metal', 0xf0f2f4, x, h + 0.85, z);
  for (let k = 1; k < 4; k++) K.addS(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.1, 16, 1, true), 'metal', 0x9aa0a8, x, k * h / 4, z);
  K.addS(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8), 'metal', 0x9aa0a8, x, h + 1.8, z);
  K.colliders.push({ cx: x, cz: z, r, h: h + 1.7, bld: true });
}

// ---------------------------------------------------------------------------------------------------------------------
// Homes (world.js home(): each spec its own household). setback 13 = road half width + driveway + half the house depth.
const HOLLOW = [
  // south side of Hollow Ln (facing north)
  ['P4', 'PE', 26, -1, 13.5, { style: 'farm', wall: 0xeee4c8, roof: 0x2f4a3a, w: 10, drive: 5, gravel: true, mail: 0x2f6fbf, extras: ['coop', 'garden', 'windchime'], fence: 'rail' }],
  ['P4', 'PE', 45, -1, 12, { style: 'mobile', wall: 0xf0d8c0, roof: 0x9a9a90, trim: 0x7a4a2a, awning: 0x4a7a4a, drive: 5, mail: 0x222222, extras: ['dish', 'woodpile', 'flamingos'], fence: 'chain' }],
  ['PE', 'CE2', 20, -1, 13, { style: 'brick', wall: 0xe0a080, roof: 0x3a3a3a, w: 10.5, drive: 5, mail: 0xbf3030, extras: ['swing', 'hoop', 'lawnsigns'], fence: 'picket' }],
  ['PE', 'CE2', 40, -1, 12.5, { style: 'cottage', wall: 0xa8c8a8, roof: 0x6a3a2a, drive: 4.5, mail: 0xeeeeee, extras: ['pickets', 'gnomes', 'chimney'] }],
  // north side (facing south)
  ['P4', 'PE', 40, 1, 14, { style: 'two', wall: 0xf4f4f0, roof: 0x2a2a30, porch: true, shutters: 0x2a4a6a, w: 10, drive: 5.5, mail: 0x3a8f3a, extras: ['tramp', 'xmas', 'flag'], flag: 0xc03030, fence: 'picket' }],
  ['PE', 'CE2', 34, 1, 13.5, { style: 'ranch', wall: 0x9ab0c8, roof: 0x4a4a4a, w: 11, drive: 5, mail: 0xe0b030, extras: ['boat', 'shed', 'dish'], shedCol: 0x8a3a2a, fence: 'chain' }],
];
function hollowLane(K) {
  for (const [a, b, t, side, off, spec] of HOLLOW) { const [x, z, ry] = along(K, a, b, t, side, off); K.home(x, z, ry, spec); }
}
function farmsteads(K) {
  // east of Sawyer Farm Rd: a white farmhouse, red barn behind it, a concrete silo, round bales
  {
    const [x, z, ry] = along(K, 'S2', 'SN', 30, -1, 14);
    K.home(x, z, ry, { style: 'farm', wall: 0xffffff, roof: 0x3a3a3a, w: 10, drive: 6, gravel: true, mail: 0xbf3030, extras: ['tractor', 'woodpile', 'flag'], flag: 0x2a5a2a, fence: 'rail' });
    const F = K.frame(x, z, ry);
    const [bx, bz] = F.at(-16, -14); barn(K, bx, bz, ry - Math.PI / 2, { col: 0xb0302a, roof: 0x5a5a5a });
    const [sx, sz] = F.at(-16, -26); silo(K, sx, sz);
    for (const [lx, lz] of [[-28, -4], [-30, -7.5], [-26.5, -8]]) K.hay(...F.at(lx, lz), 0.6);
    K.places.farmEast = (([px, pz]) => ({ x: px, z: pz, name: 'Sawyer Farm' }))(F.at(-8, -14));
  }
  // west of the road: a yellow farmhouse, a weathered grey barn, two grain bins
  {
    const [x, z, ry] = along(K, 'S2', 'SN', 48, 1, 14);
    K.home(x, z, ry, { style: 'farm', wall: 0xf0d890, roof: 0x6a2a2a, w: 9.5, drive: 6, gravel: true, mail: 0x2f6fbf, extras: ['coop', 'scarecrow', 'garden'], fence: 'rail' });
    const F = K.frame(x, z, ry);
    const [bx, bz] = F.at(17, -12); barn(K, bx, bz, ry + Math.PI / 2, { col: 0x8a857a, roof: 0x7a3a2a, door: 0x6a655a, w: 10, d: 13 });
    for (const lx of [10, 16.5]) { const [gx, gz] = F.at(lx, -27); grainBin(K, gx, gz); }
    K.places.farmWest = (([px, pz]) => ({ x: px, z: pz, name: 'Miller Farm' }))(F.at(8, -14));
  }
}

/** Build it all. K: world.js helpers (frame, home, gable, gableEnds, plane, addS, shadow, hay, picnic, barrel, bench, trashCan,
 *  hydrant, fenceRun, shopWin, roofUnit, coping, sgn, via, NODES, colliders, places). */
export function buildMoreTown(K) {
  if (!MORE_TOWN) return;
  postOffice(K); bank(K); dollarBarn(K);
  rustySpur(K); motel(K);
  hollowLane(K);
  farmsteads(K);
}
