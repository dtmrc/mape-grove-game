// Teleports to every named place: catches spawn points inside walls, under terrain, or NaN after landing.
module.exports = {
  name: 'places', desc: 'teleport to every place, settle 2 s, check grounded + sane + no errors',
  async run({ S, check }) {
    const names = await S.js(() => Object.keys(window.QA.places()));
    const bad = [];
    for (const n of names) {
      const r = await S.js(async ([n]) => {
        const QA = window.QA; await QA.tp(n, { settle: 40, render: false });
        const st = QA.state(); return { st, san: QA.sanity() };
      }, [n]);
      if (r.san.length || r.st.y > 6 || r.st.y < -1) bad.push(`${n}: y ${r.st.y} ${r.san.join('; ')}`);
    }
    check(`all ${names.length} places are standable`, !bad.length, bad);
  },
};
