// vfree.js: give the vertex arrays of big static meshes back once the GPU has them (2026-11-27).
// three.js keeps every vertex array in JS memory after uploading it. For the merged world chunks that is about
// 54 MB nothing reads again: they are never raycast, edited or re-merged (terrain lift and editor moves happen in
// the shader through textures). freeAfterUpload() drops each array right after its upload.
//
// The one thing those arrays were good for is a lost WebGL context: three re-uploads everything from them. Without
// them that can't work, so vfreeGuard() saves the game when the context is lost and reloads the page when it comes
// back (the save holds position, cash and progress; the player lands on the title screen and continues).
export const VFREE = { on: true, bytes: 0, count: 0, lost: false };
if (typeof window !== 'undefined') { window.__VFREE = VFREE; if (/[?&]vfree=0\b/.test(location.search)) VFREE.on = false; }

function release() { if (!VFREE.on || !this.array) return; VFREE.bytes += this.array.byteLength; VFREE.count++; this.array = null; }
/** Free this geometry's arrays after upload. Only for geometry nothing on the CPU reads again; set its bounds first. */
export function freeAfterUpload(g) {
  if (!VFREE.on || !g || !g.attributes) return g;
  if (!g.boundingSphere) g.computeBoundingSphere();
  if (!g.boundingBox) g.computeBoundingBox();
  for (const k in g.attributes) { const a = g.attributes[k]; if (a && !a.isInterleavedBufferAttribute) a.onUpload(release); }
  if (g.index) g.index.onUpload(release);
  return g;
}
/** Lost context: save now, reload when it is restored (three can't rebuild the freed buffers). */
export function vfreeGuard({ canvas, renderer, save }) {
  canvas.addEventListener('webglcontextlost', () => { if (!VFREE.count) return; VFREE.lost = true; try { save(); } catch (e) { /* storage blocked */ } });
  canvas.addEventListener('webglcontextrestored', () => {
    if (!VFREE.lost) return;
    renderer.render = () => {};   // nothing may draw from the freed arrays while the page reloads
    try { location.reload(); } catch (e) { /* stays on a still frame */ }
  });
}
