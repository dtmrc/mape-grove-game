// Shared material table for vehicles. mats(P, o) -> { key: {paint, size, color} }. o.body = paint hex, o.paint = paint() options
// eslint-disable-next-line no-unused-vars
function vMats(P, o = {}) {
  const c = o.body ?? '#c8ccd0';
  const M = {
    Paint: { paint: P.paint({ base: c, ...(o.paint || {}) }), size: o.paintSize ?? 1024, color: c },
    Paint2: { paint: P.paint({ base: o.body2 ?? '#f2f2f2', ...(o.paint || {}) }), size: 512, color: o.body2 ?? '#f2f2f2' },
    Under: { paint: P.plain('#151618'), size: 64, color: '#151618' },
    Well: { paint: P.plain('#0c0c0d'), size: 32, color: '#0c0c0d' },
    Glass: { paint: P.glass(o.glass), size: 512, color: '#1c2530' },
    GlassFlat: { paint: P.glass({ ...(o.glass || {}), t: o.glassT ?? 0.5 }), size: 512, color: '#1c2530' },
    Trim: { paint: P.plain(o.trim ?? '#18191b', 0.06), size: 128, color: o.trim ?? '#18191b' },
    Plastic: { paint: P.plain(o.plastic ?? '#2c2d30', 0.12), size: 256, color: o.plastic ?? '#2c2d30' },
    Chrome: { paint: P.chrome(), size: 128, color: '#d8dce0' },
    Grille: { paint: P.plain('#0e0f10', 0.1), size: 64, color: '#0e0f10' },
    Head: { paint: P.headlight(o.head), size: 128, color: '#e8ecf0' },
    Tail: { paint: P.taillight(o.tail), size: 128, color: '#b0141a' },
    Amber: { paint: P.plain('#e08a1c', 0.08), size: 32, color: '#e08a1c' },
    Clear: { paint: P.plain('#e9edf0', 0.05), size: 32, color: '#e9edf0' },
    Tyre: { paint: P.tyre(), size: 256, color: '#202022' },
    Rim: { paint: P.plain(o.rim ?? '#b9bec4', 0.06), size: 128, color: o.rim ?? '#b9bec4' },
    RimIn: { paint: P.plain('#26272a'), size: 32, color: '#26272a' },
    Steel: { paint: P.plain(o.steel ?? '#9a9fa5', 0.06), size: 64, color: o.steel ?? '#9a9fa5' },
    Plate: { paint: P.plateTex(), size: 64, color: '#f2f0e6' },
    Mirror: { paint: P.plain('#9fb3c6'), size: 16, color: '#9fb3c6' },
    LightRed: { paint: P.plain('#e01c22', 0.05), size: 32, color: '#e01c22' },
    LightBlue: { paint: P.plain('#1f5cff', 0.05), size: 32, color: '#1f5cff' },
    LightWhite: { paint: P.plain('#f4f6ff', 0.05), size: 32, color: '#f4f6ff' },
    LightAmber: { paint: P.plain('#ff9a1a', 0.05), size: 32, color: '#ff9a1a' },
    Bedliner: { paint: P.plain('#1b1c1e', 0.14), size: 256, color: '#1b1c1e' },
    // v3 shared keys: grille inserts, badges, geometry skins (two-tone, cladding, liveries)
    Honeycomb: { paint: (p) => ((Math.floor(p.x * 30 + (Math.floor(p.y * 26) & 1) * 0.5) + Math.floor(p.y * 26)) % 2 ? [16, 17, 19] : [70, 73, 78]), size: 128, color: '#1a1b1d' },
    Mesh: { paint: (p) => ((Math.floor(p.x * 45) + Math.floor(p.y * 45)) % 2 ? [14, 15, 16] : [52, 54, 58]), size: 128, color: '#18191b' },
    Badge: { paint: P.plain(o.badge ?? '#c9ced4', 0.05), size: 16, color: o.badge ?? '#c9ced4' },
    Gold: { paint: P.plain('#c9a23a', 0.06), size: 16, color: '#c9a23a' },
    Stripe: { paint: P.plain(o.stripe ?? '#e8e6de', 0.04), size: 64, color: o.stripe ?? '#e8e6de' },
    Pin: { paint: P.plain(o.pin ?? '#9aa0a8', 0.04), size: 16, color: o.pin ?? '#9aa0a8' },
    Clad: { paint: P.plain(o.clad ?? '#26272a', 0.16), size: 256, color: o.clad ?? '#26272a' },
    Gloss: { paint: P.paint({ base: '#0c0d0f', gloss: 1, belt: 1 }), size: 256, color: '#0c0d0f' },
    Skin: { paint: P.paint({ base: o.skin ?? '#f2f2f2', ...(o.paint || {}), lines: undefined, decal: o.skinDecal }), size: o.skinSize ?? 512, color: o.skin ?? '#f2f2f2' },
    Skin2: { paint: P.paint({ base: o.skin2 ?? '#1f4fb0', ...(o.paint || {}), lines: undefined, decal: undefined, gloss: 0 }), size: 256, color: o.skin2 ?? '#1f4fb0' },
    Interior: { paint: P.plain(o.interior ?? '#2a2a2c', 0.1), size: 64, color: o.interior ?? '#2a2a2c' },
  };
  return Object.assign(M, o.extra || {});
}
