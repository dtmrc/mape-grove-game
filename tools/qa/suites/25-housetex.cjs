// Estates house atlases (src/js/houses.js): half size everywhere, the full 2048 x 2048 one only for models near the player.
module.exports = {
  name: 'housetex', desc: 'house atlases are half size far away, full size near the house, and drop back when you leave',
  async run({ S, check, log }) {
    const r = await S.js(async () => {
      const QA = window.QA, G = window.__G;
      const settle = async (ok) => { for (let i = 0; i < 200; i++) { QA.step(10, { render: false }); QA.step(1, { render: true }); await new Promise((q) => setTimeout(q, 25)); if (ok(G.houseTexState())) return true; } return false; };
      const count = (st, v) => Object.values(st).filter((s) => s === v).length;
      // watch the GPU side too: the swap once failed silently (texStorage2D at a new size into the old texture)
      const P = WebGL2RenderingContext.prototype, st0 = P.texStorage2D, sizes = [], errs = [];
      P.texStorage2D = function (t, l, f, w, h) { while (this.getError()) { /* clear */ } st0.call(this, t, l, f, w, h); const e = this.getError(); sizes.push(w); if (e) errs.push(e); };
      await QA.tp('dock', { settle: 10, render: false });
      const far = await settle((st) => count(st, 'lo') === Object.keys(st).length), stFar = G.houseTexState();
      await QA.tp('gary', { settle: 10, render: false });
      const near = await settle((st) => st.beaumont === 'hi'), stNear = G.houseTexState();
      await QA.tp('dock', { settle: 10, render: false });
      const back = await settle((st) => count(st, 'lo') === Object.keys(st).length);
      P.texStorage2D = st0;
      return { far, near, back, big: sizes.includes(2048), errs, models: Object.keys(stFar).length, fullNear: count(stNear, 'hi') + count(stNear, 'loading') };
    });
    log(`${r.models} house models; ${r.fullNear} full-size at Gary's house, 0 at the dock`);
    check('at the dock every house atlas is the half-size one', r.far, r);
    check("at Gary's house his model's full atlas is loaded", r.near, r);
    check('the full 2048 atlas really reaches the GPU', r.big, r);
    check('no graphics errors while swapping', r.errs.length === 0, r);
    check('back at the dock the full atlases are dropped again', r.back, r);
  },
};
