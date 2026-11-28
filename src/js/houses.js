// Maple Grove Estates houses + the entrance sign, modelled in Tracebench (tools/tracebench/scripts/houses) and packed by
// gamepack.cjs into one indexed mesh (Int16 mm positions, Uint16 uv) + one webp atlas + collider rectangles each.
// Local frame: metres, front faces +z, ground at y 0. world.js places them as ordinary world geometry (merged, terrain-lifted).
import * as THREE from 'three';
import META from '../models/houses/meta.json';
import B_ashford from '../models/houses/ashford.bin';
import T_ashford from '../models/houses/ashford.webp';
import B_sevilla from '../models/houses/sevilla.bin';
import T_sevilla from '../models/houses/sevilla.webp';
import B_beaumont from '../models/houses/beaumont.bin';
import T_beaumont from '../models/houses/beaumont.webp';
import B_harlow from '../models/houses/harlow.bin';
import T_harlow from '../models/houses/harlow.webp';
import B_linden from '../models/houses/linden.bin';
import T_linden from '../models/houses/linden.webp';
import B_kingsley from '../models/houses/kingsley.bin';
import T_kingsley from '../models/houses/kingsley.webp';
import B_whitmore from '../models/houses/whitmore.bin';
import T_whitmore from '../models/houses/whitmore.webp';
import B_hartwell from '../models/houses/hartwell.bin';
import T_hartwell from '../models/houses/hartwell.webp';
import B_avery from '../models/houses/avery.bin';
import T_avery from '../models/houses/avery.webp';
import B_sign from '../models/houses/sign.bin';
import T_sign from '../models/houses/sign.webp';
import H_ashford from '../models/houses/ashford.half.webp';
import H_sevilla from '../models/houses/sevilla.half.webp';
import H_beaumont from '../models/houses/beaumont.half.webp';
import H_harlow from '../models/houses/harlow.half.webp';
import H_linden from '../models/houses/linden.half.webp';
import H_kingsley from '../models/houses/kingsley.half.webp';
import H_whitmore from '../models/houses/whitmore.half.webp';
import H_hartwell from '../models/houses/hartwell.half.webp';
import H_avery from '../models/houses/avery.half.webp';
import H_sign from '../models/houses/sign.half.webp';
const HALF = { ashford: H_ashford, sevilla: H_sevilla, beaumont: H_beaumont, harlow: H_harlow, linden: H_linden, kingsley: H_kingsley, whitmore: H_whitmore, hartwell: H_hartwell, avery: H_avery, sign: H_sign };   // half-size atlases (tools/house-atlas-half.py)
const BIN = { ashford: B_ashford, sevilla: B_sevilla, beaumont: B_beaumont, harlow: B_harlow, linden: B_linden, kingsley: B_kingsley, whitmore: B_whitmore, hartwell: B_hartwell, avery: B_avery, sign: B_sign };
const TEX = { ashford: T_ashford, sevilla: T_sevilla, beaumont: T_beaumont, harlow: T_harlow, linden: T_linden, kingsley: T_kingsley, whitmore: T_whitmore, hartwell: T_hartwell, avery: T_avery, sign: T_sign };

// door: where a visitor stands at the front door; drive: [x, z] where the driveway starts (garage door, or a side pad)
export const HOUSES = {
  ashford: { door: [-4.0, 6.0], drive: [-10.3, 1.0], pool: true },
  sevilla: { door: [0.95, 3.0], drive: [5.8, 1.9], pool: true },
  beaumont: { door: [0.3, 5.2], drive: [7.05, 2.6], pool: true },
  harlow: { door: [0.85, 4.4], drive: [-3.1, 9.0] },
  linden: { door: [-0.4, 6.5], drive: [6.9, 0.5] },
  kingsley: { door: [3.9, 4.0], drive: [-8.6, 0.5], pool: true },
  whitmore: { door: [-2.55, 4.0], drive: [-6.05, 2.0], pool: true },
  hartwell: { door: [3.65, 3.8], drive: [-7.7, 0.5] },
  avery: { door: [-0.1, 3.6], drive: [3.25, 5.5] },
};
for (const id in HOUSES) Object.assign(HOUSES[id], META[id]);
export const SIGN = META.sign;
export const MODEL_IDS = Object.keys(TEX);

const geoCache = {};
/** Non-indexed geometry (flat normals) in the model's local frame; mirror flips it left-right. */
export function houseGeo(id, mirror = false) {
  const key = id + (mirror ? '~m' : '');
  if (geoCache[key]) return geoCache[key];
  const u8 = BIN[id], buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  const [nv, ni, big] = new Uint32Array(buf, 0, 3);
  let o = 16;
  const P = new Int16Array(buf, o, nv * 3); o += nv * 6; o += (4 - (o % 4)) % 4;
  const U = new Uint16Array(buf, o, nv * 2); o += nv * 4;
  const I = big ? new Uint32Array(buf, o, ni) : new Uint16Array(buf, o, ni);
  const pos = new Float32Array(ni * 3), uv = new Float32Array(ni * 2), sx = mirror ? -0.001 : 0.001;
  for (let t = 0; t < ni; t += 3) for (let c = 0; c < 3; c++) {
    const s = I[t + (mirror ? (3 - c) % 3 : c)], d = t + c;   // mirrored: reverse the winding so faces still face out
    pos[d * 3] = P[s * 3] * sx; pos[d * 3 + 1] = P[s * 3 + 1] * 0.001; pos[d * 3 + 2] = P[s * 3 + 2] * 0.001;
    uv[d * 2] = U[s * 2] / 65535; uv[d * 2 + 1] = U[s * 2 + 1] / 65535;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return (geoCache[key] = g);
}

// ---- atlases: half size for everything, full size only for the models near the player (2026-11-27) ----
// Each full atlas is 2048 x 2048 = 21 MB on the GPU with its mip chain; ten of them were 60% of all texture memory,
// and most of the time no Estates house is anywhere near. Every model always has its half-size atlas (5 MB). When
// the player comes within NEAR metres of a house of that model its full atlas is decoded off the main thread and
// swapped in (one at a time), and dropped again past FAR. Beyond NEAR the GPU samples the smaller mip levels anyway,
// which are the same pixels as the half-size atlas, so the picture doesn't change.
const NEAR = 85, FAR = 110;
const LOD = {};   // id -> { t (half atlas, always loaded), hi (full atlas Texture | null), mats, state: 'lo' | 'loading' | 'hi', spots: [[x, z]] }
/** world.js: a house of this model stands at (x, z). */
export function houseSpot(id, x, z) { (LOD[id] || (LOD[id] = { spots: [] })).spots.push([x, z]); }
/** The model's atlas as a texture (decodes async; three uploads it once the image is in). */
export function houseTex(id, aniso = 4) {
  const img = new Image(), t = new THREE.Texture(img);
  img.onload = () => { t.needsUpdate = true; };
  img.src = HALF[id];
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  Object.assign(LOD[id] || (LOD[id] = { spots: [] }), { t, hi: null, mats: [], state: 'lo' });
  return t;
}
/** world.js: `m` draws this model, so its map is the one switched between the half and the full atlas. */
export function houseMat(id, m) { if (LOD[id] && LOD[id].mats) LOD[id].mats.push(m); return m; }
// The full atlas is its own Texture and the materials' `map` is switched between the two. (Changing `source` on one
// Texture does not work: three keeps one fixed-size GPU texture per Texture, the 2048 upload into the 1024 one fails.)
// The half atlas stays on the GPU the whole time, so going back to it costs nothing.
let busy = false;
const setMap = (L, tex) => { for (const m of L.mats) m.map = tex; };
const drop = (tex) => { tex.onUpdate = null; tex.dispose(); const d = tex.image; if (d) { if (d.close) d.close(); else d.src = ''; } };
function toLow(L) { if (L.state === 'lo') return; setMap(L, L.t); if (L.hi) drop(L.hi); L.hi = null; L.state = 'lo'; }
/** Tests / photo mode: MODE.force = 'full' | 'half' pins every model to one atlas, null = by distance. */
export const MODE = { force: null, near: NEAR, far: FAR, bitmap: true };
/** Call a few times a second with the player's position: swaps full / half atlases by distance. */
export function updateHouseTex(x, z) {
  for (const id in LOD) {
    const L = LOD[id]; if (!L.t) continue;
    let d = 1e9; for (const [sx, sz] of L.spots) d = Math.min(d, Math.hypot(sx - x, sz - z));
    if (MODE.force) d = MODE.force === 'full' ? 0 : 1e9;
    if (L.state === 'lo' && d < MODE.near && !busy) {
      busy = true; L.state = 'loading';
      const img = new Image(); img.src = TEX[id];
      const done = (data) => {
        busy = false;
        if (L.state !== 'loading' || !data) { if (L.state === 'loading') L.state = 'lo'; if (data && data.close) data.close(); return; }
        const h = new THREE.Texture(data); h.colorSpace = L.t.colorSpace; h.anisotropy = L.t.anisotropy; h.flipY = data === img;   // a bitmap is flipped when it is made
        h.onUpdate = () => { h.onUpdate = null; if (data.close) data.close(); else data.src = ''; };   // uploaded: the decoded copy (16 MB) can go, the GPU has it
        h.needsUpdate = true; L.hi = h; L.state = 'hi'; setMap(L, h); if (MODE.note) MODE.note('house');
      };
      // Decode off the main thread, then make an ImageBitmap: its upload is a plain copy, while uploading an <img>
      // can decode or convert again inside the frame (a visible hitch for 2048 x 2048).
      const viaBitmap = () => (MODE.bitmap && typeof createImageBitmap === 'function'
        ? createImageBitmap(img, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }).then((b) => { img.src = ''; return b; }, () => img)
        : img);
      if (img.decode) img.decode().then(viaBitmap).then(done, () => done(null)); else { img.onload = () => done(img); img.onerror = () => done(null); }
    } else if (L.state !== 'lo' && d > MODE.far) toLow(L);
  }
}
/** After a lost WebGL context every texture is uploaded again from its image: go back to the half atlases (always in memory). */
export function houseTexReset() { for (const id in LOD) if (LOD[id].t) toLow(LOD[id]); }
/** Tests: distance from (x, z) to the nearest Estates house. */
MODE.dist = (x, z) => { let d = 1e9; for (const id in LOD) for (const [sx, sz] of LOD[id].spots) d = Math.min(d, Math.hypot(sx - x, sz - z)); return d; };
export const houseTexState = () => Object.fromEntries(Object.entries(LOD).filter(([, L]) => L.t).map(([id, L]) => [id, L.state]));
