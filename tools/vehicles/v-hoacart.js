// Maple Grove Estates HOA patrol cart (counterpart: a Club Car Precedent style two-seat golf cart fitted out for security).
// White moulded body: rounded front cowl with arch cut-outs and twin round headlamps, footwell, bench seat with a back,
// rear body with a bag-well cargo box. Navy canopy on four black struts, folding windshield, amber/blue roof light bar,
// small 8" mag wheels on 18" tyres. 2.42 x 1.22 x 1.86 m (to the bar), wheelbase 1.66 m.
// The game adds the HOA door lettering (vehicles.js label) and flashes the bar.
// eslint-disable-next-line no-unused-vars
function build_hoacart(K, P) {
  const T = K.T, r = 0.23, zf = 0.8, zr = -0.86, W = 0.6;   // W: half width of the body
  const fa = { z: zf, r: r + 0.04, cy: r }, ra = { z: zr, r: r + 0.04, cy: r };
  // chassis + floor
  K.bx('Under', -0.5, 0.14, -1.12, 0.5, 0.22, 1.0);
  K.bx('Trim', -0.52, 0.22, -0.05, 0.52, 0.27, 0.58);                       // footwell mat
  // front cowl: side profile with the arch cut out, extruded across the car, then the rounded nose cap
  K.sideExtrude('Paint', K.archPoly(0.42, 1.08, 0.24, 0.62, [fa]).map(([z, y]) => [z, y]), -W, W, 0.05);
  K.sideExtrude('Paint', [[0.42, 0.62], [1.08, 0.62], [1.17, 0.58], [1.21, 0.48], [1.2, 0.34], [1.13, 0.24], [1.08, 0.24]], -W + 0.04, W - 0.04, 0.06);
  K.sideExtrude('Paint', [[0.42, 0.62], [0.42, 0.86], [0.6, 0.86], [0.92, 0.7], [1.08, 0.62]], -W + 0.03, W - 0.03, 0.05);   // cowl top / dash hump
  K.bx('Plastic', -W + 0.05, 0.22, 1.06, W - 0.05, 0.3, 1.24);              // front bumper
  K.sbox('Plastic', W - 0.02, 0.26, zf + 0.33, 0.06, 0.08, 0.16);
  for (const s of [-1, 1]) {
    const hl = new T.CylinderGeometry(0.075, 0.075, 0.03, 14); hl.rotateX(Math.PI / 2);
    K.put('Head', hl, [s * 0.36, 0.5, 1.2]);
    const rg = new T.TorusGeometry(0.08, 0.012, 6, 16); K.put('Chrome', rg, [s * 0.36, 0.5, 1.205]);
    K.box('Amber', s * 0.5, 0.36, 1.19, 0.08, 0.04, 0.02);
  }
  K.box('Plate', 0, 0.36, 1.23, 0.3, 0.1, 0.012);
  // dash: glovebox shelf + steering column and wheel
  K.bx('Plastic', -W + 0.05, 0.72, 0.36, W - 0.05, 0.86, 0.46);
  K.rod('Trim', [0.28, 0.72, 0.42], [0.28, 1.02, 0.18], 0.022, 6);
  { const sw = new T.TorusGeometry(0.16, 0.018, 6, 18); K.put('Trim', sw, [0.28, 1.03, 0.17], [-1.05, 0, 0]); K.box('Trim', 0.28, 1.03, 0.17, 0.3, 0.025, 0.03, [-1.05, 0, 0]); }
  K.box('Trim', -0.18, 0.66, 0.3, 0.12, 0.1, 0.02);                          // cup holder / key panel
  // rocker / side step boards between the arches
  K.sbox('Plastic', W - 0.03, 0.26, -0.03, 0.08, 0.06, 0.94);
  // seat pod: base, cushion, back with a grab handle
  K.bx('Paint', -W + 0.02, 0.27, -0.42, W - 0.02, 0.6, 0.02);
  K.rbx('Interior', -0.56, 0.6, -0.44, 0.56, 0.71, 0.06, 0.04);
  K.put('Interior', (() => { const g = new T.BoxGeometry(1.1, 0.42, 0.1); return g; })(), [0, 0.98, -0.48], [-0.16, 0, 0]);
  K.srod('Trim', [0.53, 0.72, -0.5], [0.53, 1.05, -0.55], 0.014, 6);
  // rear body with arches + bag well / cargo box
  K.sideExtrude('Paint', K.archPoly(-1.16, -0.42, 0.24, 0.62, [ra]), -W, W, 0.05);
  K.sideExtrude('Paint', [[-1.16, 0.24], [-1.16, 0.62], [-1.22, 0.56], [-1.24, 0.4], [-1.2, 0.26]], -W + 0.04, W - 0.04, 0.05);
  K.bx('Plastic', -W + 0.05, 0.2, -1.26, W - 0.05, 0.3, -1.14);              // rear bumper
  K.bx('Plastic', -0.5, 0.62, -1.12, 0.5, 0.8, -0.6);                        // cargo box
  K.bx('Trim', -0.52, 0.8, -1.14, 0.52, 0.83, -0.58);                        // its lid rim
  K.bx('Steel', -0.12, 0.83, -0.9, 0.12, 0.86, -0.82);                       // lid handle
  for (const s of [-1, 1]) { K.box('Tail', s * 0.42, 0.5, -1.235, 0.14, 0.07, 0.02); K.box('Amber', s * 0.42, 0.42, -1.235, 0.14, 0.04, 0.02); }
  K.box('Plate', 0, 0.42, -1.25, 0.3, 0.1, 0.012);
  // canopy: four black struts, navy top with a lip, folding windshield
  const top = 1.74;
  K.srod('Trim', [0.55, 0.84, 0.46], [0.56, top, 0.66], 0.022, 6);
  K.srod('Trim', [0.55, 0.62, -0.6], [0.56, top, -0.74], 0.022, 6);
  K.srod('Trim', [0.55, 1.2, 0.55], [0.55, 1.2, -0.66], 0.014, 5);          // side grab rails
  K.rbx('Canopy', -0.66, top, -0.86, 0.66, top + 0.07, 0.86, 0.035);
  K.rbx('Canopy', -0.6, top - 0.03, -0.8, 0.6, top, 0.8, 0.02);
  // open front (tinted glass reads as a black slab at game distance): just the windshield frame rails
  K.srod('Trim', [0.53, 1.06, 0.512], [0.53, 1.7, 0.66], 0.012, 5);
  K.box('Trim', 0, 1.06, 0.512, 1.08, 0.025, 0.02, [0.25, 0, 0]);          // windshield fold hinge
  K.box('Trim', 0, 1.7, 0.66, 1.1, 0.03, 0.03, [0.25, 0, 0]);
  K.box('Trim', 0, 1.6, 0.6, 0.2, 0.06, 0.03, [0.25, 0, 0]);                 // rear-view mirror
  // roof light bar (game recolours and flashes it): amber left, blue right
  K.lightbar(top + 0.07, 0.15, 0.9, { segs: 4, keys: ['LightRed', 'LightRed', 'LightBlue', 'LightBlue'] });
  // HOA shield on the cowl nose
  K.box('Badge', 0, 0.68, 1.12, 0.12, 0.1, 0.012, [-0.6, 0, 0]);
  K.wheels([zf, zr], { x: 0.49, r, w: 0.2, rim: 0.55, style: 'spoke', spokes: 6, spokeW: 0.18, rimKey: 'Rim' });
  return vMats(P, { body: '#f3f3ef', interior: '#1d2638', plastic: '#232427', paint: { seams: [], belt: 0.5 },
    extra: { Canopy: { paint: P.plain('#263a66', 0.1), size: 128, color: '#263a66' } } });
}
