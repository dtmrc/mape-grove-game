// The Ghost of John, remodelled (2026-11-28, diet: more detail, and "rather than the white robe ... a more actual garment
// that he wore in prominent photos", with a reference photo: denim trucker jacket over a dark printed tee, flared jeans,
// round amber-tinted wire glasses, tan suede harness boots with a stacked heel, wavy centre-parted auburn hair).
//
// Legends rulebook (docs/legends-style-rules.md): one torso tube with rings at the real creases (waistband, chest,
// shoulder line, collar), limbs as tapered 6-sided prisms, a flat face plane with its own painted face, hair as big
// overlapping slabs, mitten hands with a thumb, wedge boots; one 256 px nearest-filtered atlas with painted seams,
// stitching, pockets, buttons and 2-3 shade steps. About 560 triangles.
// Cheaper than the robe ghost: 9 draw calls instead of 27 (torso, head, two arms, two legs, rims, lenses, glow) and
// 4 materials. Still a ghost: self-lit, see-through, the legs fade out toward the boots, and he floats.
//
// Same interface as before (cave.js re-exports these; hens.js and haunted.js use them):
//   makeGhost() -> Group with userData { body, head, arms[2], tail1, tail2 (now the legs), mats, glow, face, alpha }
//   animGhost(g, t, mood)   mood: 'float' | 'wave' | 'boo' | 'sad'
//   ghostAlpha(g, k)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lambert, basic, phong } from './gfx.js';

const A = 256;
// atlas rects in pixels [x, y, w, h]
const PX = { jacket: [0, 0, 128, 96], sleeve: [128, 0, 64, 96], jeans: [192, 0, 64, 128], boot: [0, 96, 64, 48], sole: [0, 146, 32, 12], skin: [64, 96, 32, 32], collar: [96, 96, 32, 32], pelvis: [128, 96, 64, 32], hair: [64, 128, 64, 64], face: [0, 160, 64, 84] };
const UV = {}; for (const k in PX) { const [x, y, w, h] = PX[k], e = 0.5; UV[k] = [(x + e) / A, 1 - (y + h - e) / A, (x + w - e) / A, 1 - (y + e) / A]; }

let ATLAS = null, GLOW = null;
function atlas() {
  if (ATLAS) return ATLAS;
  const c = document.createElement('canvas'); c.width = c.height = A; const g = c.getContext('2d');
  let sd = 1971; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const weave = (x, y, w, h, cols, n) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(rr() * cols.length) | 0]; g.fillRect(x + (rr() * w | 0), y + (rr() * (h - 1) | 0), 1, 2); } };
  const stitch = (x0, y0, x1, y1, col = '#d2aa66') => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); g.fillStyle = col; for (let i = 0; i <= n; i++) if (i % 3 !== 2) g.fillRect(Math.round(x0 + (x1 - x0) * i / (n || 1)), Math.round(y0 + (y1 - y0) * i / (n || 1)), 1, 1); };
  const DEN = '#3f6fae', DEN_D = '#2f5890', DEN_DD = '#244676', DEN_L = '#5c8cc6', BTN = '#d8a060';
  // ---- jacket: 128 x 96, wraps the torso; front centre at x = 32, back centre at x = 96, sides at 0 / 64 / 128 ----
  { const [x, y, w, h] = PX.jacket;
    R(DEN, x, y, w, h); weave(x, y, w, h, [DEN_D, DEN_L, '#4a7ab8', '#386499'], 900);
    for (const sx of [0, 60, 124]) R(DEN_D, x + sx, y + 22, 4, h - 22);                     // shade under the arms
    R(DEN_L, x + 8, y + 30, 14, 3); R(DEN_L, x + 42, y + 30, 14, 3);                         // worn highlights on the chest
    // the open front: dark tee with a pale block print, jacket edges falling away toward the hem
    g.fillStyle = '#1d1d24'; g.beginPath(); g.moveTo(x + 25, y + 4); g.lineTo(x + 39, y + 4); g.lineTo(x + 44, y + h); g.lineTo(x + 20, y + h); g.closePath(); g.fill();
    R('#2a2a34', x + 31, y + 4, 2, h - 4);
    R('#e8e4d8', x + 26, y + 40, 12, 3); R('#e8e4d8', x + 26, y + 45, 5, 9); R('#e8e4d8', x + 33, y + 45, 5, 9); R('#e8e4d8', x + 27, y + 57, 10, 3); R('#b8b4a8', x + 26, y + 62, 12, 2);   // the tee print
    R('#3a2a1c', x + 21, y + 86, 22, 4); R('#c8a850', x + 30, y + 86, 4, 4);                // belt and buckle showing below the tee
    // plackets with copper buttons, the collar wings
    for (const s of [-1, 1]) { const ex = (yy) => x + 32 + s * (7 + (yy - 4) * 5 / 92);
      for (let yy = 4; yy < h; yy++) { R(DEN_L, Math.round(ex(yy)) + (s > 0 ? 0 : -1), y + yy, 2, 1); R(DEN_DD, Math.round(ex(yy)) + (s > 0 ? 2 : -2), y + yy, 1, 1); }
      for (let yy = 26; yy < h - 8; yy += 14) R(BTN, Math.round(ex(yy)) + (s > 0 ? 3 : -5), y + yy, 2, 2);
      g.fillStyle = DEN_L; g.beginPath(); g.moveTo(x + 32 + s * 6, y); g.lineTo(x + 32 + s * 22, y); g.lineTo(x + 32 + s * 20, y + 14); g.lineTo(x + 32 + s * 9, y + 22); g.closePath(); g.fill();
      stitch(x + 32 + s * 21, y + 2, x + 32 + s * 19, y + 13); stitch(x + 32 + s * 19, y + 13, x + 32 + s * 10, y + 20);
      // chest pocket: pointed flap, button, the two seams running down from it to the waistband
      const px = x + 32 + s * 21;
      R(DEN_D, px - 8, y + 34, 16, 1); g.fillStyle = DEN_L; g.beginPath(); g.moveTo(px - 8, y + 35); g.lineTo(px + 8, y + 35); g.lineTo(px + 8, y + 41); g.lineTo(px, y + 45); g.lineTo(px - 8, y + 41); g.closePath(); g.fill();
      stitch(px - 7, y + 36, px - 7, y + 41); stitch(px + 7, y + 36, px + 7, y + 41); stitch(px - 7, y + 41, px, y + 44); stitch(px + 7, y + 41, px, y + 44); R(BTN, px - 1, y + 39, 2, 2);
      stitch(px - 6, y + 46, px - 3 - s * 2, y + 85); stitch(px + 6, y + 46, px + 3 - s * 2, y + 85); R(DEN_DD, px - 8, y + 33, 16, 1);
    }
    // back: yoke seam, two long seams, a fade between the shoulder blades
    R(DEN_L, x + 84, y + 34, 24, 26); weave(x + 84, y + 34, 24, 26, [DEN, DEN_L], 120);
    stitch(x + 68, y + 28, x + 124, y + 28); stitch(x + 68, y + 30, x + 124, y + 30); R(DEN_DD, x + 68, y + 31, 57, 1);
    stitch(x + 82, y + 32, x + 86, y + 85); stitch(x + 110, y + 32, x + 106, y + 85);
    // waistband with adjuster tabs
    R(DEN_D, x, y + 86, 20, 10); R(DEN_D, x + 44, y + 86, 84, 10); stitch(x, y + 87, x + 19, y + 87); stitch(x + 45, y + 87, x + 127, y + 87); stitch(x, y + 94, x + 19, y + 94); stitch(x + 45, y + 94, x + 127, y + 94);
    R(BTN, x + 70, y + 90, 2, 2); R(BTN, x + 120, y + 90, 2, 2); R(BTN, x + 46, y + 90, 2, 2);
    R(DEN_DD, x, y, 8, 3); R(DEN_DD, x + 56, y, 72, 3);                                       // collar stand shadow
  }
  // ---- sleeve: 64 x 96, cuff at the bottom ----
  { const [x, y, w, h] = PX.sleeve;
    R(DEN, x, y, w, h); weave(x, y, w, h, [DEN_D, DEN_L, '#4a7ab8'], 420);
    R(DEN_D, x, y, 5, h); R(DEN_D, x + w - 5, y, 5, h); stitch(x + 30, y, x + 30, y + 80); stitch(x + 33, y, x + 33, y + 80);
    for (const yy of [38, 44, 52]) { R(DEN_DD, x + 8, y + yy, 18, 1); R(DEN_L, x + 8, y + yy + 1, 18, 1); R(DEN_DD, x + 40, y + yy + 3, 14, 1); }   // elbow creases
    R(DEN_D, x, y + 82, w, 14); stitch(x, y + 83, x + w - 1, y + 83); stitch(x, y + 94, x + w - 1, y + 94); R(BTN, x + 14, y + 87, 3, 3); R(DEN_DD, x, y + 81, w, 1);
    R(DEN_L, x + 10, y + 6, 14, 3);
  }
  // ---- jeans leg: 64 x 128, hem at the bottom; a touch darker than the jacket, faded knee ----
  { const [x, y, w, h] = PX.jeans, J = '#345f9c', JD = '#284c82', JL = '#5482bc';
    R(J, x, y, w, h); weave(x, y, w, h, [JD, JL, '#3c68a6'], 700);
    R(JD, x, y, 5, h); R(JD, x + w - 5, y, 5, h);
    R(JL, x + 22, y + 50, 20, 22); weave(x + 22, y + 50, 20, 22, [J, JL, '#6a94c8'], 90);     // knee fade
    for (const yy of [44, 76]) { R(JD, x + 18, y + yy, 28, 1); R(JL, x + 18, y + yy + 1, 28, 1); }
    stitch(x + 8, y, x + 8, y + h - 8); stitch(x + 11, y, x + 11, y + h - 8); stitch(x + 54, y, x + 54, y + h - 8);   // side seams
    R(JD, x, y + h - 7, w, 7); stitch(x, y + h - 6, x + w - 1, y + h - 6); R('#22406c', x, y + h - 1, w, 1);          // the flared hem
  }
  // ---- pelvis: 64 x 32, belt at the top, front centre at x = 16 ----
  { const [x, y, w, h] = PX.pelvis, J = '#345f9c', JD = '#284c82';
    R(J, x, y, w, h); weave(x, y, w, h, [JD, '#5482bc'], 160);
    R('#3a2a1c', x, y, w, 7); R('#5a4028', x, y + 1, w, 1); R('#c8a850', x + 13, y, 7, 7); R('#3a2a1c', x + 15, y + 2, 3, 3);
    stitch(x + 16, y + 8, x + 16, y + 26); stitch(x + 19, y + 8, x + 19, y + 22);                                       // the fly
    for (const s of [-1, 1]) { stitch(x + 16 + s * 6, y + 8, x + 16 + s * 13, y + 16); stitch(x + 16 + s * 13, y + 16, x + 16 + s * 15, y + 8); }   // front pocket curves
    for (const bx of [40, 56]) { stitch(x + bx - 5, y + 10, x + bx + 5, y + 10); stitch(x + bx - 5, y + 10, x + bx - 4, y + 22); stitch(x + bx + 5, y + 10, x + bx + 4, y + 22); stitch(x + bx - 4, y + 22, x + bx, y + 25); stitch(x + bx + 4, y + 22, x + bx, y + 25); }   // back pockets
  }
  // ---- boot: 64 x 48 tan suede, harness strap and brass ring, stitched welt, dark stacked sole ----
  { const [x, y, w, h] = PX.boot, T1 = '#c0905a', T2 = '#a87a48', T3 = '#d6aa74';
    R(T1, x, y, w, h); weave(x, y, w, h, [T2, T3, '#b88852'], 330);
    R(T3, x + 30, y + 22, 26, 4); R(T2, x, y + 30, w, 6);
    R('#5a3a24', x, y + 12, w, 5); R('#7a5234', x, y + 12, w, 1); R('#5a3a24', x + 14, y + 12, 5, 28);                 // strap round the ankle and under the heel
    g.strokeStyle = '#e0bc68'; g.lineWidth = 2; g.beginPath(); g.arc(x + 16.5, y + 14.5, 4.5, 0, 7); g.stroke(); R('#8a6a2a', x + 15, y + 13, 3, 3);
    stitch(x, y + 39, x + w - 1, y + 39, '#e8d2a0'); R('#4a3020', x, y + 41, w, 7); R('#2e1c12', x, y + 45, w, 3);
  }
  { const [x, y, w, h] = PX.sole; R('#4a3020', x, y, w, h); R('#2e1c12', x, y + 6, w, 6); for (let k = 0; k < 4; k++) R('#5c3e2a', x, y + 1 + k * 3, w, 1); }
  // ---- skin (hands, neck, head sides) and the lighter collar denim ----
  { const [x, y, w, h] = PX.skin; R('#e6c4a6', x, y, w, h); R('#d2ac8e', x, y + 22, w, 10); R('#f0d4b8', x + 6, y + 4, 12, 6); for (let k = 1; k < 4; k++) R('#c89e80', x + k * 8, y + 12, 1, 9); }
  { const [x, y, w, h] = PX.collar; R(DEN_L, x, y, w, h); weave(x, y, w, h, [DEN, '#6e9ad0'], 90); stitch(x + 2, y + 2, x + w - 3, y + 2); stitch(x + 2, y + h - 3, x + w - 3, y + h - 3); stitch(x + 2, y + 2, x + 2, y + h - 3); stitch(x + w - 3, y + 2, x + w - 3, y + h - 3); }
  // ---- hair: 64 x 64 auburn, long wavy strands ----
  { const [x, y, w, h] = PX.hair, H = '#8a5a34';
    R(H, x, y, w, h);
    for (let k = 0; k < 16; k++) { const bx = x + k * 4 + (rr() * 2 | 0), ph = rr() * 6, col = ['#a8774a', '#6a4326', '#9a6a3e', '#5a3820'][k % 4];
      for (let yy = 0; yy < h; yy++) R(col, bx + Math.round(Math.sin(yy * 0.3 + ph) * 1.6), y + yy, k % 4 === 0 ? 2 : 1, 1); }
    R('#6a4326', x, y + h - 4, w, 4);
  }
  // ---- face: 64 x 84. Long face, centre part, sideburns, long nose, a small pleased mouth; the eyes sit behind the lenses ----
  { const [x, y, w, h] = PX.face, SK = '#ecccae', SK_D = '#d8b092', SK_DD = '#bf9478', HA = '#7c5030', HA_L = '#a06e42';
    R(SK, x, y, w, h);
    R(SK_D, x, y, 6, h); R(SK_D, x + w - 6, y, 6, h);                                                                    // cheek planes turning away
    g.fillStyle = SK_DD; g.beginPath(); g.moveTo(x, y + 58); g.lineTo(x + 14, y + h); g.lineTo(x, y + h); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x + w, y + 58); g.lineTo(x + w - 14, y + h); g.lineTo(x + w, y + h); g.closePath(); g.fill();   // jaw narrowing to the chin
    // hair falling from a centre part
    g.fillStyle = HA; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y); g.lineTo(x + 22, y + 9); g.lineTo(x + 9, y + 17); g.lineTo(x + 4, y + 30); g.lineTo(x, y + 30); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + 34, y); g.lineTo(x + 42, y + 9); g.lineTo(x + 55, y + 17); g.lineTo(x + 60, y + 30); g.lineTo(x + w, y + 30); g.closePath(); g.fill();
    for (const [ax, ay, bx, by] of [[26, 2, 12, 12], [20, 2, 6, 16], [38, 2, 52, 12], [44, 2, 58, 16]]) { g.strokeStyle = HA_L; g.lineWidth = 1; g.beginPath(); g.moveTo(x + ax, y + ay); g.lineTo(x + bx, y + by); g.stroke(); }
    R(HA, x, y + 30, 4, 34); R(HA, x + w - 4, y + 30, 4, 34); R(HA_L, x + 1, y + 34, 1, 26); R(HA_L, x + w - 2, y + 34, 1, 26);   // sideburns
    // brows, eyes (lens centres are at x = 17.6 and 46.4, y = 38)
    R('#6a4428', x + 11, y + 29, 13, 2); R('#6a4428', x + 40, y + 29, 13, 2);
    for (const ex of [13, 42]) { R('#f4efe6', x + ex, y + 36, 9, 5); R('#3a3028', x + ex + 3, y + 36, 4, 5); R('#101014', x + ex + 4, y + 37, 2, 3); R(SK_D, x + ex, y + 35, 9, 1); R(SK_DD, x + ex, y + 41, 9, 1); }
    // the long nose with one lit side, nostrils
    R(SK_D, x + 33, y + 36, 3, 22); R('#f6dcc0', x + 29, y + 38, 3, 19); R(SK_DD, x + 27, y + 57, 10, 2); R('#a87a62', x + 27, y + 58, 2, 1); R('#a87a62', x + 35, y + 58, 2, 1);
    // mouth: thin, turned up at the corners
    R('#a05a50', x + 24, y + 66, 16, 2); R('#a05a50', x + 22, y + 65, 2, 1); R('#a05a50', x + 40, y + 65, 2, 1); R('#dcb69a', x + 27, y + 69, 10, 1); R(SK_D, x + 26, y + 74, 12, 1);
    R(SK_D, x + 8, y + 50, 5, 1); R(SK_D, x + 51, y + 50, 5, 1);                                                          // cheekbones
  }
  ATLAS = new THREE.CanvasTexture(c); ATLAS.colorSpace = THREE.SRGBColorSpace;
  ATLAS.magFilter = THREE.NearestFilter; ATLAS.minFilter = THREE.NearestFilter; ATLAS.generateMipmaps = false;
  return ATLAS;
}
function glowTex() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  GLOW = new THREE.CanvasTexture(c); GLOW.colorSpace = THREE.SRGBColorSpace; return GLOW;
}

// ---------- geometry (flat-shaded triangle soups, uvs into the atlas) ----------
const flat = (g) => (g.index ? g.toNonIndexed() : g);
/** A THREE geometry with its 0..1 uvs moved into one atlas rect (or, for a box, one rect per face: +x -x +y -y +z -z). */
function part(geo, rect, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const uv = geo.attributes.uv, per = Array.isArray(rect[0]);
  for (let i = 0; i < uv.count; i++) { const r = per ? rect[(i / 4) | 0] : rect; uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1])); }
  const g = flat(geo); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); g.computeVertexNormals();
  return g;
}
/** Tube through rings [y, rx, rz, cx, cz] listed bottom to top, n sides. u runs left to right across the FRONT as the
 *  viewer sees it (u = 0 at -x, 0.25 at +z, 0.5 at +x, 0.75 at the back), v by height, so painted detail is not mirrored. */
function tube(rings, n, rect, phase = 0) {
  const pos = [], uv = [], y0 = rings[0][0], y1 = rings[rings.length - 1][0];
  const pt = (r, i) => { const a = (i / n) * Math.PI * 2 + phase; return [(r[3] || 0) - Math.cos(a) * r[1], r[0], (r[4] || 0) + Math.sin(a) * r[2]]; };
  const U = (i) => rect[0] + (i / n) * (rect[2] - rect[0]), V = (r) => rect[1] + ((r[0] - y0) / (y1 - y0)) * (rect[3] - rect[1]);
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) {
    const r0 = rings[k], r1 = rings[k + 1], a = pt(r0, i), b = pt(r0, i + 1), c = pt(r1, i), d = pt(r1, i + 1);
    pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    uv.push(U(i), V(r0), U(i + 1), V(r0), U(i), V(r1), U(i + 1), V(r0), U(i + 1), V(r1), U(i), V(r1));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const join = (list, mat) => new THREE.Mesh(mergeGeometries(list, false), mat);

export function makeGhost() {
  const AT = atlas();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mats = [];
  const keep = (m, op) => { m.userData.op = op; m.opacity = op; mats.push(m); return m; };
  // self-lit (a ghost glows; torch and fire light only tint him), a cool cast over the real colours
  const skinOf = (op) => keep(lambert({ map: AT, emissiveMap: AT, color: 0x565e70, emissive: 0xb6c2de, transparent: true, side: THREE.DoubleSide }), op);
  const bodyM = skinOf(0.9), legM = skinOf(0.66);
  const rimM = keep(phong({ color: 0xd8c890, shininess: 90, specular: 0xffffff, transparent: true }), 1);
  const lensM = keep(basic({ color: 0xc8742a, transparent: true, side: THREE.DoubleSide }), 0.5);

  // ---- torso: the jacket tube (waistband, chest, shoulder line, collar), the pelvis, the neck, two collar points ----
  const J = UV.jacket, torso = [
    tube([[0.955, 0.168, 0.112], [1.0, 0.174, 0.117], [1.2, 0.2, 0.136], [1.385, 0.216, 0.138], [1.47, 0.122, 0.1], [1.525, 0.066, 0.062]], 8, J),
    tube([[0.83, 0.145, 0.105], [0.9, 0.166, 0.114], [0.985, 0.162, 0.11]], 8, UV.pelvis),
    tube([[0.8, 0.02, 0.02], [0.83, 0.145, 0.105]], 8, [UV.pelvis[0], UV.pelvis[1], UV.pelvis[2], UV.pelvis[1] + 0.01]),   // underside
    tube([[1.5, 0.045, 0.045], [1.63, 0.042, 0.045]], 6, UV.skin),
  ];
  for (const s of [-1, 1]) torso.push(part(box(0.085, 0.016, 0.075), UV.collar, s * 0.062, 1.508, 0.07, 0.5, s * 0.5, -s * 0.35));
  body.add(join(torso, bodyM));

  // ---- head: faceted block, flat face plane, centre-parted wavy hair to the shoulders, sideburns ----
  const head = new THREE.Group(); head.position.y = 1.6; body.add(head);
  const H = UV.hair, hp = [
    tube([[0, 0.058, 0.066], [0.05, 0.086, 0.09], [0.15, 0.096, 0.099], [0.235, 0.092, 0.096], [0.275, 0.05, 0.056]], 6, UV.skin, Math.PI / 6),
    tube([[0.19, 0.106, 0.108], [0.262, 0.1, 0.105], [0.298, 0.062, 0.07], [0.306, 0.004, 0.004]], 6, H, Math.PI / 6),   // cap
    part(box(0.21, 0.37, 0.06), H, 0, 0.05, -0.088),                                                                    // back curtain
  ];
  for (const s of [-1, 1]) {
    hp.push(part(box(0.05, 0.34, 0.17), H, s * 0.104, 0.065, -0.012, 0, 0, s * 0.1));                                   // side curtain
    hp.push(part(box(0.06, 0.11, 0.16), H, s * 0.132, -0.105, -0.016, 0, 0, s * 0.55));                                 // the flick out at the shoulder
    hp.push(part(box(0.05, 0.1, 0.05), H, s * 0.1, -0.1, -0.1, 0.3, 0, s * 0.3));                                       // a curl at the back corner
    hp.push(part(box(0.09, 0.04, 0.05), H, s * 0.052, 0.243, 0.082, 0, 0, -s * 0.4));                                   // fringe swept off the part
    hp.push(part(box(0.03, 0.14, 0.05), H, s * 0.094, 0.165, 0.078, 0, 0, s * 0.12));                                   // temple lock
    hp.push(part(box(0.014, 0.075, 0.03), H, s * 0.084, 0.07, 0.086));                                                  // sideburn
  }
  hp.push(part(new THREE.PlaneGeometry(0.16, 0.21), UV.face, 0, 0.115, 0.1005));
  const headMesh = join(hp, bodyM); head.add(headMesh);
  // round wire glasses, amber lenses
  const rims = [], lenses = [];
  for (const s of [-1, 1]) {
    rims.push(flat(new THREE.TorusGeometry(0.031, 0.0045, 4, 12)).translate(s * 0.036, 0.124, 0.112));
    rims.push(flat(box(0.004, 0.004, 0.105)).rotateY(s * 0.16).translate(s * 0.076, 0.126, 0.062));
    lenses.push(flat(new THREE.CircleGeometry(0.029, 12)).translate(s * 0.036, 0.124, 0.1115));
  }
  rims.push(flat(box(0.014, 0.004, 0.004)).translate(0, 0.13, 0.113));
  const rimMesh = join(rims, rimM), lensMesh = join(lenses, lensM); rimMesh.renderOrder = 2; lensMesh.renderOrder = 1; head.add(lensMesh, rimMesh);

  // ---- arms: sleeve prism with a cuff, mitten hand with a thumb ----
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.222, 1.4, 0); body.add(sh);
    const g = [
      tube([[-0.45, 0.046, 0.046], [-0.39, 0.05, 0.052], [-0.2, 0.052, 0.056], [0.0, 0.064, 0.066], [0.05, 0.03, 0.035]], 6, UV.sleeve),
      part(box(0.05, 0.09, 0.04), UV.skin, 0, -0.495, 0),
      part(box(0.02, 0.04, 0.026), UV.skin, -s * 0.012, -0.475, 0.03),
    ];
    sh.add(join(g, bodyM)); sh.rotation.z = s * 0.25; arms.push(sh);
  }

  // ---- legs: flared jeans over tan harness boots (wedge toe, stacked heel) ----
  const legs = [];
  for (const s of [-1, 1]) {
    const lg = new THREE.Group(); lg.position.set(s * 0.086, 0.9, 0); body.add(lg);
    const foot = box(0.1, 0.095, 0.26), fp = foot.attributes.position;
    for (let i = 0; i < fp.count; i++) if (fp.getZ(i) > 0 && fp.getY(i) > 0) fp.setY(i, -0.012);                         // the toe tapers down
    const B = UV.boot, Bt = [B[0], B[1] + (B[3] - B[1]) * 0.3, B[2], B[1] + (B[3] - B[1]) * 0.55];                         // plain suede for the top / ends
    const g = [
      tube([[-0.8, 0.1, 0.112], [-0.6, 0.071, 0.076], [-0.4, 0.066, 0.071], [-0.1, 0.081, 0.088], [0.03, 0.084, 0.09]], 6, UV.jeans),
      part(foot, [B, B, Bt, UV.sole, Bt, Bt], 0, -0.835, 0.05),
      part(box(0.086, 0.04, 0.085), UV.sole, 0, -0.9, -0.03),
    ];
    lg.add(join(g, legM)); legs.push(lg);
  }

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x9fb8ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.position.y = 1.05; glow.scale.set(2.3, 3.0, 1); glow.renderOrder = -1; root.add(glow);
  root.userData = { body, head, arms, legs, tail1: legs[0], tail2: legs[1], mats, glow, face: headMesh, alpha: 1 };
  root.traverse((o) => { o.userData.noLift = true; });
  return root;
}

export function animGhost(g, t, mood = 'float') {
  const u = g.userData;
  u.body.position.y = 0.2 + Math.sin(t * 1.7) * 0.07;
  u.body.rotation.x = 0.04 + Math.sin(t * 1.1) * 0.02;
  // legs trail a little behind and drift, toes down: he is not standing on anything
  u.legs[0].rotation.x = 0.2 + Math.sin(t * 1.3) * 0.1; u.legs[1].rotation.x = 0.12 + Math.sin(t * 1.3 + 1.4) * 0.1;
  u.legs[0].rotation.z = -0.03 + Math.sin(t * 0.9) * 0.02; u.legs[1].rotation.z = 0.03 + Math.sin(t * 0.9 + 0.7) * 0.02;
  const boo = mood === 'boo' ? 1 : 0, wave = mood === 'wave';
  u.arms[0].rotation.x = -0.15 + Math.sin(t * 1.9) * 0.1 - boo * 1.3; u.arms[1].rotation.x = -0.15 + Math.sin(t * 1.9 + 1) * 0.1 - boo * 1.3;
  u.arms[0].rotation.z = -0.25 - boo * 0.2; u.arms[1].rotation.z = 0.25 + boo * 0.2 + (wave ? 1.9 + Math.sin(t * 8) * 0.35 : 0);
  u.head.rotation.z = Math.sin(t * 0.9) * 0.08; u.head.rotation.x = mood === 'sad' ? 0.3 : 0;
  u.glow.material.opacity = (0.3 + Math.sin(t * 2.3) * 0.07) * u.alpha;
}
export function ghostAlpha(g, k) {
  const u = g.userData; u.alpha = k;
  for (const m of u.mats) m.opacity = m.userData.op * k;
  g.visible = k > 0.01;
}
