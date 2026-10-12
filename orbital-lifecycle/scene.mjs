// Shared geometry for the orbital lifecycle figure. build.mjs imports it in Node,
// and the page inlines it, so the parts that move are rebuilt from the same numbers.
export function makeScene(k, G, P) {
  const TAU = Math.PI * 2;
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const at = (p) => k.iso(p, P);
  const depth = (p) => k.depthOf(p, P);
  const tag = (svc, svg) => `<g data-svc="${svc}">${svg}</g>`;
  const sorted = (list) => list.sort((a, b) => depth(a.at) - depth(b.at)).map((item) => item.svg).join("");

  // World layout: x across the bench, y towards the viewer, z up. One unit is about a pixel.
  const PAD = [-168, 10];
  const PAD_TOP = 15;
  const TOWER = { x: -174, y: -38, w: 12, d: 12, r: 1 };
  const TOWER_TOP = 104;
  const ARM_Z = [52, 80];
  const ROCKET_LEN = 74;
  const C = [15, 0];
  const PLINTH_R = 96;
  const HUB_TOP = 26;
  const PLANET = [15, 0, 112];
  const PLANET_R = 30;
  const BEACON_TOP = PLANET[2] + PLANET_R + 16;
  const GATE_X = -90;
  const GATE_Y = 36;
  const GATE_TOP = 182;
  const ORBITS = [
    { id: "chinainfra", R: 88, arm: 30, body: 74, speed: 0.07, phase: 2.4 },
    { id: "cloudinfra", R: 71, arm: 38, body: 96, speed: 0.1, phase: 0.6 },
    { id: "edgeplatform", R: 53, arm: 46, body: 84, speed: 0.15, phase: 4.1 },
    { id: "instruments", R: 35, arm: 54, body: 66, speed: 0.22, phase: 1.3 },
  ];
  const DISH = [150, -84];
  const DISH_Z = 34;
  const LAMP = [136, 72];
  const LAMP_Z = 70;
  const COMPASS = [178, 72];
  const COMPASS_Z = 30;

  const angleOf = (orbit, t) => orbit.phase + orbit.speed * t;
  const bodyAt = (orbit, t) => {
    const a = angleOf(orbit, t);
    return [C[0] + orbit.R * Math.cos(a), C[1] + orbit.R * Math.sin(a), orbit.body];
  };

  // A box turned about z: a ring of four corners, extruded.
  const turnedRing = (cx, cy, w, d, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c]);
  };
  const turnedBox = (cx, cy, z, h, w, d, angle, bevel = 0) => k.extrude(turnedRing(cx, cy, w, d, angle), z, h, P, { bevel });
  const local = (cx, cy, angle) => (u, v) => [cx + u * Math.cos(angle) - v * Math.sin(angle), cy + u * Math.sin(angle) + v * Math.cos(angle)];

  // One arm of the orrery: a flat bar from the column to the orbit, turned by the angle.
  function armSvg(orbit, t, lit) {
    const a = angleOf(orbit, t);
    const from = 5.5;
    const to = orbit.R + 2.2;
    const mid = (from + to) / 2;
    const cx = C[0] + Math.cos(a) * mid;
    const cy = C[1] + Math.sin(a) * mid;
    const bar = turnedBox(cx, cy, orbit.arm, 2.4, to - from, 3.2, a, 0.4);
    const p = local(C[0], C[1], a);
    const rivets = [from + 4, to - 5].map((r) => at([...p(r, 0), orbit.arm + 2.4]));
    return { at: [cx, cy, orbit.arm + 1.2], svg: tag(orbit.id, S(bar, { tone: "mid", lit }) + D(rivets, { size: 0.45 })) };
  }

  function stemParts(orbit, x, y, top) {
    const z0 = orbit.arm + 2.4;
    return [
      { at: [x, y, z0 + 1], svg: S(k.cylinder(x, y, 2.6, z0, 2, P, 18), { tone: "mid" }) },
      { at: [x, y, (z0 + top) / 2], svg: S(k.cylinder(x, y, 1.3, z0 + 2, top - z0 - 2, P, 14), { tone: "mid", crease: "none" }) },
    ];
  }

  // The four hosting bodies. Each returns parts that sort among themselves.
  function cloudStation(x, y, z, a, lit) {
    const parts = [];
    const tangent = a + Math.PI / 2;
    const p = local(x, y, tangent);
    for (const side of [-1, 1]) {
      const cx = p(side * 13.5, 0);
      const wing = turnedBox(cx[0], cx[1], z - 0.4, 0.8, 15, 9, tangent);
      const grid = [];
      for (let i = 1; i < 5; i++) grid.push(k.lineOnTop(p(side * (6 + i * 3), -4.5), p(side * (6 + i * 3), 4.5), z + 0.4, P));
      grid.push(k.lineOnTop(p(side * 6, 0), p(side * 21, 0), z + 0.4, P));
      parts.push({ at: [cx[0], cx[1], z], svg: S(wing, { tone: "mid", lit, inner: L(grid.join(""), { tone: "lo" }) }) });
      const strut = p(side * 5.6, 0);
      parts.push({ at: [strut[0], strut[1], z], svg: S(turnedBox(strut[0], strut[1], z - 0.6, 1.2, 1.6, 1.6, tangent), { tone: "mid" }) });
    }
    const core = k.cylinder(x, y, 5, z - 7, 14, P, 28, 0.5);
    const seams = [z - 2.5, z + 2.5].map((h) => k.sideArc(x, y, 5, h, P, 18)).join("");
    parts.push({ at: [x, y, z], svg: S(core, { tone: "hi", lit, inner: L(seams, { tone: "faint" }) }) });
    parts.push({ at: [x, y, z + 8], svg: S(k.cylinder(x, y, 2.6, z + 7, 2.2, P, 20), { tone: "mid", lit }) + D([at([x, y, z + 9.2])], { size: 0.5, tone: "hi" }) });
    return parts;
  }

  function edgeSatellite(x, y, z, a, lit) {
    const parts = [];
    const box = turnedBox(x, y, z - 4, 8, 9, 9, a, 0.5);
    const seam = k.ringSeam(turnedRing(x, y, 9, 9, a), z, P);
    const p = local(x, y, a);
    const vents = [-2, 0, 2].map((v) => k.lineOnTop(p(-4.5, v), p(4.5, v), z + 4, P)).join("");
    parts.push({ at: [x, y, z], svg: S(box, { tone: "hi", lit, inner: L(seam, { tone: "faint" }) + L(vents, { tone: "faint" }) }) });
    const dish = p(2, 2);
    parts.push({ at: [dish[0], dish[1], z + 5], svg: S(k.cylinder(dish[0], dish[1], 3.2, z + 4, 1, P, 22), { tone: "mid", lit }) + L(k.rise([dish[0], dish[1]], z + 5, z + 10, P), { tone: "mid" }) + D([at([dish[0], dish[1], z + 10])], { size: 0.6, tone: "hi" }) });
    return parts;
  }

  function chinaStation(x, y, z, a, lit) {
    const parts = [];
    const box = turnedBox(x, y, z - 5.5, 11, 11, 11, a + Math.PI / 4, 0.6);
    const ring = turnedRing(x, y, 11, 11, a + Math.PI / 4);
    const seams = [z - 2, z + 2].map((h) => k.ringSeam(ring, h, P)).join("");
    parts.push({ at: [x, y, z], svg: S(box, { tone: "hi", lit, inner: L(seams, { tone: "faint" }) }) });
    const p = local(x, y, a + Math.PI / 4);
    const lid = turnedBox(x, y, z + 5.5, 1.4, 7, 7, a + Math.PI / 4, 0.3);
    parts.push({ at: [x, y, z + 6.2], svg: S(lid, { tone: "mid", lit }) + D([p(-2.4, -2.4), p(2.4, -2.4), p(2.4, 2.4), p(-2.4, 2.4)].map(([u, v]) => at([u, v, z + 6.9])), { size: 0.4 }) });
    return parts;
  }

  function probe(x, y, z, a, lit) {
    const parts = [];
    const seam = k.sideArc(x, y, 3.4, z, P, 16);
    parts.push({ at: [x, y, z], svg: S(k.cylinder(x, y, 3.4, z - 3, 6, P, 22, 0.4), { tone: "hi", lit, inner: L(seam, { tone: "faint" }) }) });
    const p = local(x, y, a);
    const tips = [p(8, 0), p(-3, 7)];
    const rods = tips.map(([u, v]) => k.segment([x, y, z + 3], [u, v, z + 7], P)).join("");
    parts.push({ at: [x, y, z + 4], svg: L(rods, { tone: "mid" }) + D(tips.map(([u, v]) => at([u, v, z + 7])), { size: 0.6, tone: "hi" }) + S(k.cylinder(x, y, 2, z + 3, 0.8, P, 16), { tone: "mid", lit }) });
    return parts;
  }

  const BODIES = { cloudinfra: cloudStation, edgeplatform: edgeSatellite, chinainfra: chinaStation, instruments: probe };
  const BODY_HALF = { cloudinfra: 7, edgeplatform: 4, chinainfra: 5.5, instruments: 3 };

  function bodySvg(orbit, t, lit) {
    const a = angleOf(orbit, t);
    const [x, y, z] = bodyAt(orbit, t);
    const parts = [...stemParts(orbit, x, y, z - BODY_HALF[orbit.id]), ...BODIES[orbit.id](x, y, z, a, lit)];
    return { at: [x, y, z], svg: tag(orbit.id, sorted(parts)) };
  }

  // The rocket, turned along any axis. `o` is the nozzle exit, `axis` points to the nose.
  const ROCKET = {
    nozzle: [[0, 3.4], [1.4, 2.9, 1], [3.2, 2.1]],
    booster: [3.2, 41, 4.6],
    inter: [[41, 4.6], [44.5, 4.2]],
    upper: [44.5, 60, 4.2],
    fairing: [[60, 4.5], [63, 4.5], [66, 4.1, 1], [69, 3.2, 1], [72, 1.8, 1], [74, 0]],
  };
  function rocketSvg(o, axis, lit = {}) {
    const F = G.frameAlong(o, axis);
    const V = G.viewOf(P);
    const parts = [];
    const mid = (s) => G.pointOf(F, s, 0, 0);
    const turned = (profile, s, svc, tone, options = {}) => parts.push({ at: mid(s), svg: tag(svc, S(G.solidOf(profile, F, P, { smooth: false, steps: 28, ...options }), { tone, lit: lit[svc], inner: options.inner ?? "" })) });
    turned(ROCKET.nozzle, 1.6, "appcloud", "mid");
    const seams = [12, 24, 34].map((s) => G.arcOf(F, s, ROCKET.booster[2], P)).join("");
    const band = G.disc(ROCKET.booster[0], ROCKET.booster[1], ROCKET.booster[2], F, P, { steps: 28 });
    parts.push({ at: mid(22), svg: tag("appcloud", S(band, { tone: "hi", lit: lit.appcloud, inner: L(seams, { tone: "faint" }) })) });
    turned(ROCKET.inter, 42.7, "appedge", "mid");
    const upperSeam = G.arcOf(F, 52, ROCKET.upper[2], P);
    parts.push({ at: mid(52), svg: tag("appedge", S(G.disc(ROCKET.upper[0], ROCKET.upper[1], ROCKET.upper[2], F, P, { steps: 28 }), { tone: "hi", lit: lit.appedge, inner: L(upperSeam, { tone: "faint" }) })) });
    turned(ROCKET.fairing, 66, "appedge", "hi", { smooth: true });
    // Four fins, thin plates in planes through the axis.
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i * Math.PI) / 2;
      const radial = G.radialOf(F, angle);
      const tangent = G.tangentOf(F, angle);
      const FF = G.frameOf(o, tangent, F.a, radial);
      const fin = G.prismOf(FF, [[3.4, 4.4], [16, 4.4], [9, 9.2], [2.4, 9.2]], -0.45, 0.45, P);
      const centre = G.add3(mid(8), G.mul3(radial, 6.5));
      parts.push({ at: G.add3(centre, G.mul3(V, 0)), svg: tag("appcloud", S(fin, { tone: "mid", lit: lit.appcloud })) });
    }
    const out = parts.sort((a, b) => G.dot3(a.at, V) - G.dot3(b.at, V)).map((part) => part.svg).join("");
    return out;
  }

  // A tower arm swings from the tower face to the rocket skin about a pin on the tower.
  function towerArmSvg(index, swing, lit) {
    const z = ARM_Z[index];
    const pin = [TOWER.x + TOWER.w / 2, TOWER.y + TOWER.d];
    const reach = PAD[1] - 4.6 - pin[1];
    const a = Math.PI / 2 - swing * (Math.PI / 2) * (index ? 1 : -1);
    const p = local(pin[0], pin[1], a);
    const centre = p(reach / 2, 0);
    const bar = turnedBox(centre[0], centre[1], z, 3.4, reach, 5, a, 0.4);
    const pad = p(reach - 1, 0);
    const rail = k.lineOnTop(p(1.5, -1.4), p(reach - 1.5, -1.4), z + 3.4, P) + k.lineOnTop(p(1.5, 1.4), p(reach - 1.5, 1.4), z + 3.4, P);
    const knuckle = S(k.cylinder(pin[0], pin[1], 3.2, z - 1, 5.4, P, 20), { tone: "mid", lit });
    return { at: [centre[0], centre[1], z], svg: tag("asdlc", knuckle + S(bar, { tone: "mid", lit, inner: L(rail, { tone: "faint" }) }) + D([at([pad[0], pad[1], z + 3.4])], { size: 0.5 })) };
  }

  // Tracking radar: a dish on a yoke that turns to the target.
  function dishSvg(target, lit) {
    const base = [DISH[0], DISH[1], DISH_Z];
    const dir = G.unit3(G.sub3(target, base));
    const flat = G.unit3([dir[0], dir[1], 0]);
    const yaw = Math.atan2(flat[1], flat[0]);
    const parts = [];
    const p = local(DISH[0], DISH[1], yaw);
    for (const side of [-1, 1]) {
      const [cx, cy] = p(0, side * 9);
      parts.push({ at: [cx, cy, DISH_Z - 4], svg: S(turnedBox(cx, cy, DISH_Z - 12, 14, 5, 2, yaw, 0.3), { tone: "mid", lit }) });
    }
    parts.push({ at: [DISH[0], DISH[1], DISH_Z - 12], svg: S(turnedBox(DISH[0], DISH[1], DISH_Z - 14, 2.4, 6, 20, yaw, 0.4), { tone: "mid", lit }) });
    const F = G.frameAlong(base, dir);
    const bowl = G.lathe([[-1, 0], [-1, 2], [0, 6, 1], [1.4, 9.5, 1], [3, 12], [3.6, 12], [2.2, 8, 1], [1.4, 3, 1], [1, 0]], F, P, { steps: 40 });
    parts.push({ at: G.pointOf(F, 1, 0, 0), svg: S(bowl, { tone: "hi", lit }) });
    const feed = G.pointOf(F, 13, 0, 0);
    const legs = [0, TAU / 3, (2 * TAU) / 3].map((angle) => k.segment(G.pointOf(F, 3.2, 11.6, angle), feed, P)).join("");
    parts.push({ at: G.pointOf(F, 8, 0, 0), svg: L(legs, { tone: "mid" }) + S(G.disc(12.4, 15, 1.3, F, P, { steps: 16 }), { tone: "mid", lit }) });
    return tag("sre", sorted(parts));
  }

  // Searchlight head on the security mast.
  function lampSvg(angle, tilt, lit) {
    const base = [LAMP[0], LAMP[1], LAMP_Z + 7];
    const dir = [Math.cos(angle) * Math.cos(tilt), Math.sin(angle) * Math.cos(tilt), Math.sin(tilt)];
    const F = G.frameAlong(base, dir);
    const head = G.solidOf([[-6, 3.2], [-2, 4.6, 1], [4, 5.2], [5, 5.6], [6, 5.6]], F, P, { steps: 32 });
    const lens = G.circleOf(F, 6, 4.4, P);
    const parts = [
      { at: [LAMP[0], LAMP[1], LAMP_Z + 3], svg: S(k.cylinder(LAMP[0], LAMP[1], 3, LAMP_Z, 3.6, P, 20), { tone: "mid" }) },
      { at: base, svg: S(head, { tone: "hi", lit, inner: G.dot3(dir, G.viewOf(P)) > 0.05 ? L(lens, { tone: "mid" }) : "" }) },
    ];
    return tag("security", sorted(parts));
  }

  // The naviGate compass needle points at the rocket.
  function needleSvg(target) {
    const angle = Math.atan2(target[1] - COMPASS[1], target[0] - COMPASS[0]);
    const r = 11;
    const tip = [COMPASS[0] + Math.cos(angle) * r, COMPASS[1] + Math.sin(angle) * r];
    const tail = [COMPASS[0] - Math.cos(angle) * 4, COMPASS[1] - Math.sin(angle) * 4];
    return k.lineOnTop(tail, tip, COMPASS_Z + 0.2, P);
  }

  return {
    TAU, PAD, PAD_TOP, TOWER, TOWER_TOP, ARM_Z, ROCKET_LEN, C, PLINTH_R, HUB_TOP, PLANET, PLANET_R, BEACON_TOP,
    GATE_X, GATE_Y, GATE_TOP, ORBITS, DISH, DISH_Z, LAMP, LAMP_Z, COMPASS, COMPASS_Z,
    angleOf, bodyAt, turnedBox, turnedRing, local, tag, sorted,
    armSvg, bodySvg, rocketSvg, towerArmSvg, dishSvg, lampSvg, needleSvg,
  };
}
