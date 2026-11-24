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

/** The model's atlas as a texture (decodes async; three uploads it once the image is in). */
export function houseTex(id, aniso = 4) {
  const img = new Image(), t = new THREE.Texture(img);
  img.onload = () => { t.needsUpdate = true; };
  img.src = TEX[id];
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}
