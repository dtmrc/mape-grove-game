// prewarm.js: pay for shaders and textures behind the title screen instead of in the middle of play (2026-11-27).
// three.js compiles a material's shader and uploads a texture the first time something using it is drawn, which is
// a dropped frame or several the first time you turn towards a shop sign, a car model or an interior. This walks the
// whole scene (hidden things too), hands every shader program to the driver to build in the background, and uploads
// the textures a few milliseconds per frame. It re-scans a few times so things built late (interiors) are covered.
export function makePrewarm({ renderer, scene, camera, budgetMs = 6, scans = 10, every = 1.5 }) {
  const seenTex = new WeakSet(), seenMat = new WeakSet(), queue = [];
  const S = { textures: 0, materials: 0, scansLeft: scans, t: 0, pending: 0, compiling: false };
  const usable = (t) => {
    if (!t || !t.isTexture || t.isRenderTargetTexture || t.isDepthTexture || t.isVideoTexture || t.version === 0) return false;
    const i = t.image; if (!i) return false;
    if (typeof HTMLImageElement !== 'undefined' && i instanceof HTMLImageElement) return i.complete && i.naturalWidth > 0;
    return (i.width || (i[0] && i[0].width) || 0) > 0 || !!i.data;
  };
  function texOf(m, out) {
    for (const k in m) { const v = m[k]; if (v && v.isTexture) out.push(v); }
    if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) out.push(v); }
  }
  function scan() {
    let newMat = 0; const tex = [];
    scene.traverse((o) => {
      const mm = o.material; if (!mm) return;
      if (Array.isArray(mm)) { for (const m of mm) { if (!seenMat.has(m)) { seenMat.add(m); newMat++; } texOf(m, tex); } }
      else { if (!seenMat.has(mm)) { seenMat.add(mm); newMat++; } texOf(mm, tex); }
    });
    for (const t of tex) if (!seenTex.has(t)) { if (usable(t)) { seenTex.add(t); queue.push(t); } }   // not loaded yet: the next scan picks it up
    S.materials += newMat;
    // compile() hands every new shader to the driver without waiting for it: the driver builds them on its own
    // threads while the title screen is up, and the first draw that needs one finds it ready
    if (newMat) { try { renderer.compile(scene, camera); } catch (e) { /* the first draw compiles it instead */ } }
  }
  /** Once a frame. Cheap when there is nothing left to do. */
  function tick(dt) {
    if (S.scansLeft > 0 && (S.t -= dt) <= 0 && !queue.length) { S.t = every; S.scansLeft--; scan(); }
    if (!queue.length) { S.pending = 0; return; }
    const t0 = performance.now(), props = renderer.properties;
    while (queue.length) {
      const t = queue.pop();
      if (props.get(t).__version !== t.version && usable(t)) { try { renderer.initTexture(t); S.textures++; } catch (e) { /* leave it to the first draw */ } }
      const now = performance.now(); if (now - t0 > budgetMs || now < t0) break;
    }
    S.pending = queue.length;
  }
  // ---- rooms and other things built late: draw all of it once, now ----
  // Interiors are built the first time they are entered, long after the scans above. Their textures, shaders and
  // vertex buffers used to arrive one by one as the camera first turned towards each thing (a hitch per shelf).
  // warm(root) switches frustum culling off under `root` for the next two frames, so the first frame drawn (still
  // behind the door fade) uploads everything at once. Once per root.
  const warmed = new WeakSet(); let warming = null;
  function warm(root) {
    if (!root || warmed.has(root)) return false; warmed.add(root);
    const list = []; root.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.frustumCulled) { o.frustumCulled = false; list.push(o); } });
    if (warming) for (const o of warming.list) o.frustumCulled = true;
    warming = { list, frames: 2 }; S.warmed = (S.warmed || 0) + 1;
    return true;
  }
  function warmTick() { if (warming && --warming.frames < 0) { for (const o of warming.list) o.frustumCulled = true; warming = null; } }
  return { tick: (dt) => { warmTick(); tick(dt); }, warm, scan, stats: S, done: () => S.scansLeft <= 0 && !queue.length && !S.compiling };
}
