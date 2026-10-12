import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = process.env.ANATOMY_SKILL ?? join(homedir(), ".claude/skills/anatomy");
const load = (file) => import(pathToFileURL(join(SKILL, file)).href);
const k = await load("kit/iso-kit.mjs");
const G = await load("kit/lathe.mjs");
const { tubePieces, tubeSvg } = await load("kit/tube.mjs");
const { glCamera } = await load("kit/gl.mjs");
const { kitScript, glScript } = await load("scripts/inline-kit.mjs");
const { makeScene } = await import("./scene.mjs");
const { SERVICES, ZONES } = await import("./services.mjs");

const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 960;
const HEIGHT = 580;
const AZIMUTH = 58;

const PLATE = { x: -252, y: -136, w: 504, d: 272, r: 10 };
const PLATE_H = 12;
const FOOT_H = 5;
const BUILD = { x: -242, y: -124, w: 144, d: 222, r: 6 };
const MANAGE = { x: 118, y: -124, w: 124, d: 222, r: 6 };
const ZB = 5;

const ring = (r, z) => Array.from({ length: 36 }, (_, i) => [15 + r * Math.cos((i / 36) * Math.PI * 2), r * Math.sin((i / 36) * Math.PI * 2), z]);
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-90, -44, 184], [-90, 44, 184], [-168, 10, 132], [15, 0, 160], ...ring(118, 168)],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: AZIMUTH },
);
const Z = makeScene(k, G, P);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const tag = (svc, svg) => `<g data-svc="${svc}">${svg}</g>`;
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const faceRect = (x0, x1, y, z0, z1) => `M${at([x0, y, z0]).join(" ")}L${at([x0, y, z1]).join(" ")}L${at([x1, y, z1]).join(" ")}L${at([x1, y, z0]).join(" ")}Z`;
const faceRectX = (x, y0, y1, z0, z1) => `M${at([x, y0, z0]).join(" ")}L${at([x, y0, z1]).join(" ")}L${at([x, y1, z1]).join(" ")}L${at([x, y1, z0]).join(" ")}Z`;
const screws = (plan, z, inset = 3) => Dt(k.corners(plan, inset).map(([x, y]) => at([x, y, z])), { size: 0.45 });
const tube = (route, r, tone = "mid") => tubePieces(G.fillet(route, Math.max(3, r * 2.6), 7, { P, tube: r }), r, P, { maxLength: 400 }).map((piece) => tubeSvg(piece, { tone })).join("");

const ground = [];
const items = [];
const put = (point, svg, svc) => items.push({ at: point, svg: svc ? tag(svc, svg) : svg });

// ---------------------------------------------------------------- bench
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = [...k.corners(PLATE, 26), [0, PLATE.y + 26], [0, PLATE.y + PLATE.d - 26]];
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -4, P), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const corners = k.corners(PLATE, 12);
  out.push(L(corners.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }), Dt(corners.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Ruler strip along the front edge.
  const strip = { x: -232, y: PLATE.y + PLATE.d - 16, w: 300, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(Dt([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // Label plate with three rule lines and one engraved word.
  const label = { x: 116, y: PLATE.y + PLATE.d - 24, w: 92, d: 15, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 5, label.y + 6.4], 0.8, P, "x"), "LIFECYCLE ORRERY", { size: 3.6, tone: "mid" }));
  out.push(L(k.lineOnTop([label.x + 5, label.y + 9.6], [label.x + 62, label.y + 9.6], 0.8, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([label.x + 5, label.y + 11.8], [label.x + 44, label.y + 11.8], 0.8, P), { tone: "lo", free: true }));
  out.push(Dt([at([label.x + label.w - 4, label.y + 4, 0.8]), at([label.x + label.w - 4, label.y + label.d - 4, 0.8])], { size: 0.45 }));
  // Zone plinths.
  for (const plan of [BUILD, MANAGE]) {
    out.push(`<path class="iso-halo" style="filter:blur(4px)" d="${k.haloOf(plan, 0, 0.1, P)}"/>`);
    out.push(S(k.slabOf(plan, 0, ZB, P, 6, 0.8), { tone: "mid" }));
    out.push(L(k.planOutline(k.insetPlan(plan, 4), ZB, P), { tone: "faint" }));
    out.push(screws(plan, ZB, 8));
  }
  // The orrery plinth: a two-step turned base with orbit grooves and degree ticks.
  const [cx, cy] = Z.C;
  out.push(`<path class="iso-halo" style="filter:blur(5px)" d="${k.cylinder(cx, cy, Z.PLINTH_R, 0, 0.1, P, 96).fill}"/>`);
  out.push(S(k.cylinder(cx, cy, Z.PLINTH_R, 0, 3, P, 120, 0.8), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, Z.PLINTH_R - 3, 3, 4, P, 120, 0.8), { tone: "mid" }));
  const top = 7;
  out.push(L(k.ring(cx, cy, Z.PLINTH_R - 6, top, P, 120), { tone: "lo" }));
  const t = k.radialTicks(cx, cy, Z.PLINTH_R - 6, 72, 6, top, [1.4, 3], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  for (const orbit of Z.ORBITS) {
    if (orbit.id === "chinainfra") {
      out.push(L(k.ring(cx, cy, orbit.R - 2.4, top, P, 120) + k.ring(cx, cy, orbit.R + 2.4, top, P, 120), { tone: "lo" }));
      out.push(Dt(Array.from({ length: 24 }, (_, i) => at([cx + orbit.R * Math.cos((i / 24) * Math.PI * 2), cy + orbit.R * Math.sin((i / 24) * Math.PI * 2), top])), { size: 0.45, tone: "lo" }));
    } else out.push(L(k.ring(cx, cy, orbit.R, top, P, 96), { tone: "faint" }));
  }
  return out.join("");
}

// ---------------------------------------------------------------- build zone
function buildZone() {
  // Studio: the assembly hall with its tall door.
  {
    const hall = { x: -236, y: -120, w: 46, d: 38, r: 1.5 };
    const face = hall.y + hall.d;
    const door = `M${at([-226, face, ZB]).join(" ")}L${at([-226, face, 66]).join(" ")}L${at([-202, face, 66]).join(" ")}L${at([-202, face, ZB]).join(" ")}`;
    const panels = [20, 35, 50].map((z) => k.segment([-226, face, z], [-202, face, z], P)).join("") + k.segment([-214, face, ZB], [-214, face, 66], P);
    const side = [24, 44, 64].map((z) => k.segment([hall.x + hall.w, hall.y, z], [hall.x + hall.w, face, z], P)).join("");
    let svg = S(k.slabOf(hall, ZB, 79, P, 3, 0.8), { tone: "mid", inner: L(door, { tone: "mid" }) + L(panels, { tone: "lo" }) + L(side, { tone: "faint" }) });
    const hvac = { x: -230, y: -114, w: 15, d: 11, r: 1 };
    svg += S(k.slabOf(hvac, 84, 4, P, 2, 0.4), { tone: "mid", inner: L([1, 2, 3, 4].map((i) => k.segment([hvac.x + hvac.w, hvac.y + i * 2.2, 84.6], [hvac.x + hvac.w, hvac.y + i * 2.2, 87.4], P)).join(""), { tone: "lo" }) });
    svg += S(k.cylinder(-200, -112, 2.4, 84, 3, P, 16), { tone: "mid" }) + screws(hall, 84, 3);
    put([hall.x + hall.w / 2, hall.y + hall.d / 2, 40], svg, "studio");
  }
  // Platform Console: a desk with three monitors and keyboards.
  {
    const desk = { x: -184, y: -118, w: 28, d: 14, r: 1.5 };
    let svg = S(k.slabOf(desk, ZB, 12, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(desk, 12, P, 3), { tone: "faint" }) });
    for (const x of [-181, -173.5, -166]) {
      const mon = { x, y: -114, w: 7, d: 1.6, r: 0.4 };
      svg += S(k.slabOf({ x: x + 2.6, y: -113.6, w: 1.8, d: 0.8, r: 0.3 }, 17, 2, P, 2), { tone: "mid", crease: "none" });
      svg += S(k.slabOf(mon, 19, 6, P, 2, 0.3), { tone: "hi", inner: L(faceRect(x + 0.8, x + 6.2, -112.4, 19.8, 24.2), { tone: "lo" }) });
      svg += L(k.planOutline({ x: x + 0.6, y: -108.6, w: 5.8, d: 2.4, r: 0.4 }, 17, P, 2), { tone: "lo" });
    }
    put([desk.x + 14, desk.y + 7, 12], svg, "console");
  }
  // Discovery and Catalog: a chest of drawers.
  {
    const chest = { x: -150, y: -120, w: 20, d: 15, r: 1 };
    const face = chest.y + chest.d;
    const seams = [12, 19, 26].map((z) => k.sideSeam(chest, z, P, 2)).join("");
    let svg = S(k.slabOf(chest, ZB, 28, P, 2, 0.6), { tone: "mid", inner: L(seams, { tone: "lo" }) });
    for (const z of [8.5, 15.5, 22.5, 29.5]) svg += S(k.slabOf({ x: chest.x + 7.5, y: face, w: 5, d: 1.2, r: 0.4 }, z - 0.6, 1.2, P, 2), { tone: "hi", crease: "none" });
    svg += screws(chest, ZB + 28, 2.5);
    put([chest.x + 10, chest.y + 7, 18], svg, "catalog");
  }
  // Self-Service: a dispenser with a hose on its holster.
  {
    const body = { x: -124, y: 70, w: 12, d: 10, r: 1 };
    const f = body.y + body.d;
    let svg = S(k.slabOf(body, ZB, 26, P, 2, 0.6), { tone: "mid", inner: L(faceRect(-121.5, -114.5, f, 22, 28), { tone: "mid" }) + L(k.segment([-124, f, 14], [-112, f, 14], P), { tone: "faint" }) });
    svg += S(k.slabOf({ x: -126, y: 68, w: 16, d: 14, r: 1.2 }, 31, 2.4, P, 2, 0.4), { tone: "mid" });
    svg += S(k.slabOf({ x: -112, y: 76, w: 2.4, d: 4, r: 0.4 }, 12, 6, P, 2), { tone: "mid" });
    svg += tube([[-112, 73.4, 26], [-105.5, 73.4, 26], [-105.5, 73.4, 19.5], [-109.6, 78, 18.6]], 0.9, "mid");
    svg += Dt([at([-118, f, 30])], { size: 0.5, tone: "hi" });
    put([-118, 75, 16], svg, "selfservice");
  }
  // Reporting and Analytics: a panel of three dial gauges.
  {
    const panel = { x: -228, y: -72, w: 36, d: 4, r: 0.8 };
    let svg = "";
    for (const x of [-222, -198]) svg += S(k.cylinder(x, -70, 1.6, ZB, 9, P, 14), { tone: "mid", crease: "none" });
    let inner = "";
    const face = panel.y + panel.d;
    svg += S(k.slabOf(panel, 14, 24, P, 2, 0.5), { tone: "mid", inner: L(k.sideSeam(panel, 18, P, 2), { tone: "faint" }) });
    for (const [i, x] of [-221, -210, -199].entries()) {
      const F = G.frameAlong([x, face, 26], [0, 1, 0]);
      inner += S(G.disc(0, 1.4, 4.8, F, P, { steps: 32 }), { tone: "hi", inner: L(G.circleOf(F, 1.4, 4, P), { tone: "lo" }) });
      const ang = -0.9 + i * 0.8;
      inner += L(k.segment([x, face + 1.4, 26], [x + Math.sin(ang) * 3.4, face + 1.4, 26 + Math.cos(ang) * 3.4], P), { tone: "hi", free: "end" });
      inner += Dt([at([x, face + 1.4, 26])], { size: 0.45, tone: "hi" });
    }
    svg += inner;
    put([panel.x + 18, panel.y + 2, 22], svg, "reporting");
  }
  // Roche ID: a gate booth with a barrier boom.
  {
    const booth = { x: -126, y: -10, w: 10, d: 10, r: 1 };
    let svg = S(k.slabOf(booth, ZB, 19, P, 2, 0.5), { tone: "mid", inner: L(faceRect(-124, -118, 0, 15, 21), { tone: "mid" }) + L(faceRectX(-116, -8, -2, 15, 21), { tone: "lo" }) });
    svg += S(k.slabOf({ x: -128, y: -12, w: 14, d: 14, r: 1.2 }, 24, 2, P, 2, 0.4), { tone: "mid" });
    svg += S(k.cylinder(-112, 2, 1.8, ZB, 13, P, 16), { tone: "mid" });
    const boom = { x: -113.2, y: 4, w: 2.4, d: 34, r: 0.6 };
    const stripes = [0, 1, 2, 3, 4, 5].map((i) => k.lineOnTop([boom.x, boom.y + 4 + i * 5], [boom.x + boom.w, boom.y + 6.5 + i * 5], 17.6, P)).join("");
    svg += S(k.slabOf(boom, 15.2, 2.4, P, 2, 0.3), { tone: "hi", inner: L(stripes, { tone: "mid" }) });
    svg += S(k.cylinder(-112, 39, 1.2, ZB, 10.2, P, 12), { tone: "mid" }) + S(k.slabOf({ x: -114.4, y: 37.6, w: 4.8, d: 2.8, r: 0.6 }, 13.2, 2, P, 2), { tone: "mid" });
    svg += Dt([at([-121, 0, 23])], { size: 0.6, tone: "hi" });
    put([-118, 10, 12], svg, "rocheid");
  }
  // The launch pad: slab, flame trench, mount ring and hold-downs.
  {
    const pad = { x: -196, y: -18, w: 56, d: 56, r: 3 };
    let svg = `<path class="iso-halo" style="filter:blur(3px)" d="${k.haloOf(pad, ZB, 0.1, P)}"/>`;
    svg += S(k.slabOf(pad, ZB, 6, P, 4, 1), { tone: "mid", inner: L(k.sideSeam(pad, 8, P, 4), { tone: "faint" }) });
    svg += L(k.planOutline(k.insetPlan(pad, 4), 11, P, 4), { tone: "faint" });
    svg += L(k.planOutline({ x: -176, y: 3, w: 32, d: 14, r: 2 }, 11, P, 3), { tone: "lo" });
    svg += L(k.corners(pad, 7).map(([x, y]) => k.ring(x, y, 2, 11, P, 14)).join(""), { tone: "lo" }) + Dt(k.corners(pad, 7).map(([x, y]) => at([x, y, 11])), { size: 0.5 });
    const [px, py] = Z.PAD;
    svg += S(k.cylinder(px, py, 9.5, 11, 4, P, 40, 0.5), { tone: "mid", inner: L(k.sideArc(px, py, 9.5, 13, P, 20), { tone: "faint" }) });
    svg += L(k.ring(px, py, 5.2, 15, P, 32), { tone: "lo" });
    for (const a of [0.25, 0.75, 1.25, 1.75].map((q) => q * Math.PI)) {
      const cx = px + Math.cos(a) * 11.4;
      const cy = py + Math.sin(a) * 11.4;
      svg += S(Z.turnedBox(cx, cy, 11, 6, 4, 3, a, 0.3), { tone: "mid" });
    }
    put([px, py, 6], svg);
    // Umbilical junction box.
    const box = { x: -206, y: -6, w: 9, d: 12, r: 1 };
    put([-201.5, 0, 9], S(k.slabOf(box, ZB, 8, P, 2, 0.4), { tone: "mid" }) + screws(box, ZB + 8, 2), "connectivity");
  }
  // aSDLC: the service tower with its lattice and lightning mast.
  {
    const base = { x: -180, y: -44, w: 24, d: 24, r: 1.5 };
    put([-168, -32, 7], S(k.slabOf(base, ZB, 4, P, 3, 0.6), { tone: "lo" }) + screws(base, ZB + 4, 3), "asdlc");
    const T = Z.TOWER;
    let inner = "";
    for (let z = 9; z < Z.TOWER_TOP - 1; z += 13.5) {
      const z1 = Math.min(z + 13.5, Z.TOWER_TOP);
      const xf = T.x + T.w;
      const yf = T.y + T.d;
      inner += k.segment([xf, T.y, z], [xf, yf, z1], P) + k.segment([xf, yf, z], [xf, T.y, z1], P) + k.segment([xf, T.y, z1], [xf, yf, z1], P);
      inner += k.segment([T.x, yf, z], [xf, yf, z1], P) + k.segment([xf, yf, z], [T.x, yf, z1], P) + k.segment([T.x, yf, z1], [xf, yf, z1], P);
    }
    let svg = S(k.slabOf(T, 9, Z.TOWER_TOP - 9, P, 2, 0.4), { tone: "mid", inner: L(inner, { tone: "lo" }) });
    const deck = { x: -178, y: -42, w: 20, d: 20, r: 1 };
    svg += S(k.slabOf(deck, Z.TOWER_TOP, 3, P, 2, 0.5), { tone: "mid" }) + screws(deck, Z.TOWER_TOP + 3, 2.5);
    for (const [x, y] of byDepth(k.corners(deck, 1.6))) svg += L(k.rise([x, y], Z.TOWER_TOP + 3, Z.TOWER_TOP + 9, P), { tone: "mid" }) + Dt([at([x, y, Z.TOWER_TOP + 3])], { size: 0.5 });
    const rail = k.corners(deck, 1.6);
    svg += L(k.onTop([rail[0], rail[1], rail[2], rail[3]], Z.TOWER_TOP + 9, P, true), { tone: "mid" });
    svg += S(k.cylinder(-168, -32, 0.9, Z.TOWER_TOP + 3, 22, P, 10), { tone: "mid", crease: "none" }) + Dt([at([-168, -32, Z.TOWER_TOP + 25])], { size: 0.7, tone: "hi" });
    put([-168, -32, 50], svg, "asdlc");
  }
  // Connectivity: a cable reel feeding the umbilical box.
  {
    const F = G.frameOf([-218, 34, 22], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    const cheek = (y) => S(k.slabOf({ x: -224, y, w: 12, d: 2.4, r: 0.6 }, ZB, 18, P, 2, 0.3), { tone: "mid" }) + Dt([at([-218, y + 2.4, 22])], { size: 0.5 });
    put([-218, 31, 14], cheek(30.4), "connectivity");
    const wraps = [3, 4.6, 6.2, 7.8, 9.4, 11, 12.6].map((s) => G.arcOf(F, s, 8.4, P)).join("");
    let drum = S(G.disc(0, 1.6, 13, F, P), { tone: "mid" });
    drum += S(G.disc(1.6, 14.4, 8.4, F, P), { tone: "hi", inner: L(wraps, { tone: "lo" }) });
    drum += S(G.disc(14.4, 16, 13, F, P), { tone: "mid", inner: L(G.circleOf(F, 16, 4, P), { tone: "faint" }) });
    drum += Dt(G.dotsOf(F, 16, 10, 6, P, { all: true }), { size: 0.45 });
    drum += tube([[-218, 42, 13.6], [-218, 42, 6.4], [-202, 42, 6.4], [-202, 6, 6.4]], 1, "mid");
    put([-218, 42, 22], drum, "connectivity");
    put([-218, 53, 14], cheek(51.4), "connectivity");
  }
  // User Experience: a stack of module trays.
  {
    let svg = "";
    for (const [i, z] of [ZB, ZB + 6.4, ZB + 12.8].entries()) {
      const tray = { x: -196 + i, y: 66 + i, w: 30 - 2 * i, d: 22 - 2 * i, r: 1.2 };
      svg += S(k.slabOf(tray, z, 6, P, 3, 0.5), { tone: i === 2 ? "hi" : "mid" });
      svg += S(k.slabOf({ x: tray.x + tray.w / 2 - 4, y: tray.y + tray.d, w: 8, d: 1.2, r: 0.4 }, z + 2, 2, P, 2), { tone: "mid", crease: "none" });
    }
    const lid = { x: -190, y: 72, w: 20, d: 12, r: 0.8 };
    svg += L(k.planOutline(lid, ZB + 18.8, P, 2), { tone: "faint" });
    svg += L(k.lineOnTop([lid.x + 3, lid.y + 4], [lid.x + 15, lid.y + 4], ZB + 18.8, P) + k.lineOnTop([lid.x + 3, lid.y + 7.5], [lid.x + 11, lid.y + 7.5], ZB + 18.8, P), { tone: "lo", free: true });
    put([-181, 77, 14], svg, "ux");
  }
}

// ---------------------------------------------------------------- the gate
function gate() {
  const X = Z.GATE_X;
  const postH = Z.GATE_TOP - 8;
  for (const side of [-1, 1]) {
    const y = side * Z.GATE_Y;
    const post = { x: X - 4, y: y - 4, w: 8, d: 8, r: 0.8 };
    const foot = { x: X - 7, y: y - 7, w: 14, d: 14, r: 1 };
    let inner = "";
    for (let z = 4; z < postH - 1; z += 14) {
      const z1 = Math.min(z + 14, postH);
      inner += k.segment([X + 4, y - 4, z], [X + 4, y + 4, z1], P) + k.segment([X + 4, y - 4, z1], [X + 4, y + 4, z1], P);
      inner += k.segment([X - 4, y + 4, z], [X + 4, y + 4, z1], P) + k.segment([X - 4, y + 4, z1], [X + 4, y + 4, z1], P);
    }
    const svg = S(k.slabOf(foot, 0, 4, P, 2, 0.5), { tone: "lo" }) + screws(foot, 4, 2.4) + S(k.slabOf(post, 4, postH - 4, P, 2, 0.4), { tone: "mid", inner: L(inner, { tone: "lo" }) });
    put([X, y, 160], svg);
  }
  const lintel = { x: X - 5, y: -Z.GATE_Y - 8, w: 10, d: Z.GATE_Y * 2 + 16, r: 1 };
  put([X, 0, Z.GATE_TOP - 4], S(k.slabOf(lintel, postH, 8, P, 2, 0.6), { tone: "mid", inner: L(k.sideSeam(lintel, postH + 4, P, 2), { tone: "faint" }) }) + screws(lintel, Z.GATE_TOP, 2.6));
  // Certify: a scanner bar under the lintel with a row of lamps on its face.
  const bar = { x: X - 3, y: -16, w: 6, d: 32, r: 0.8 };
  const lamps = Array.from({ length: 7 }, (_, i) => at([X + 3, -12 + i * 4, postH - 3]));
  put([X, 0, postH - 3], S(k.slabOf(bar, postH - 6, 6, P, 2, 0.4), { tone: "hi" }) + lamps.map(([x, y], i) => `<circle class="ol-scan" data-scan="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1"/>`).join(""), "certify");
  // Code Signing: a stamp cylinder on the far post, its plunger moves.
  const F = G.frameOf([X, -Z.GATE_Y + 4, 146], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  put([X, -Z.GATE_Y + 9, 146], S(G.disc(0, 10, 3.6, F, P), { tone: "hi", inner: L(G.arcOf(F, 5, 3.6, P), { tone: "faint" }) }) + S(G.disc(10, 11.4, 4.4, F, P), { tone: "mid" }), "codesign");
  // TPM Toolkit: a lockbox on the near post with a keypad.
  const lock = { x: X - 5, y: Z.GATE_Y + 4, w: 10, d: 6, r: 0.8 };
  const keys = k.dotGrid(X - 2.4, Z.GATE_Y + 5.6, 3, 2, 2.4, 134, P);
  put([X, Z.GATE_Y + 7, 127], S(k.slabOf(lock, 120, 14, P, 2, 0.5), { tone: "hi", inner: L(k.sideSeam(lock, 124, P, 2), { tone: "faint" }) }) + Dt(keys, { size: 0.45, tone: "mid" }) + `<circle class="ol-tpm" cx="${at([X + 5, Z.GATE_Y + 8, 130])[0].toFixed(1)}" cy="${at([X + 5, Z.GATE_Y + 8, 130])[1].toFixed(1)}" r="1.1"/>`, "tpm");
  // Certman: a key cabinet beside the far post.
  const cab = { x: X - 10, y: -Z.GATE_Y - 26, w: 16, d: 10, r: 1 };
  const face = cab.y + cab.d;
  const hooks = [];
  for (const z of [12, 20]) for (let i = 0; i < 5; i++) hooks.push(at([cab.x + 3 + i * 2.5, face, z]));
  put([cab.x + 8, cab.y + 5, 14], S(k.slabOf(cab, 0, 28, P, 2, 0.5), { tone: "mid", inner: L(k.segment([cab.x + cab.w / 2, face, 0.4], [cab.x + cab.w / 2, face, 27.6], P), { tone: "lo" }) }) + Dt(hooks, { size: 0.55, tone: "hi" }) + `<circle class="ol-key" cx="${at([cab.x + cab.w, cab.y + 5, 24])[0].toFixed(1)}" cy="${at([cab.x + cab.w, cab.y + 5, 24])[1].toFixed(1)}" r="1.1"/>`, "certman");
}

// ---------------------------------------------------------------- deploy zone
function deployZone() {
  const [cx, cy] = Z.C;
  // Transit Gateway: the gearbox at the hub that drives every arm.
  let gear = S(k.cylinder(cx, cy, 18, 7, 12, P, 72, 0.6), { tone: "hi", inner: L(k.knurl(cx, cy, 18, 7, 19, 64, P), { tone: "lo" }) });
  gear += S(k.cylinder(cx, cy, 13, 19, 4, P, 56, 0.5), { tone: "mid", inner: L(k.knurl(cx, cy, 13, 19, 23, 40, P), { tone: "faint" }) });
  gear += Dt(Array.from({ length: 8 }, (_, i) => at([cx + 9 * Math.cos((i / 8) * Math.PI * 2), cy + 9 * Math.sin((i / 8) * Math.PI * 2), 23])), { size: 0.45 });
  put([cx, cy, 15], gear, "transit");
  // The central column with a collar under each arm.
  let column = S(k.cylinder(cx, cy, 4, 23, Z.PLANET[2] - Z.PLANET_R - 21, P, 24), { tone: "mid", crease: "none" });
  for (const orbit of Z.ORBITS) column += S(k.cylinder(cx, cy, 6, orbit.arm - 1.6, 1.6, P, 28, 0.3), { tone: "mid" });
  put([cx, cy, 50], column, "transit");
  // Infrastructure Services: the planet, with latitudes and meridians.
  const F = G.frameOf(Z.PLANET, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const R = Z.PLANET_R;
  const lat = [-21, -11, 0, 11, 21].map((s) => G.arcOf(F, s, Math.sqrt(R * R - s * s), P, { slope: -s / Math.sqrt(R * R - s * s) })).join("");
  const V = G.viewOf(P);
  let meridians = "";
  for (let m = 0; m < 6; m++) {
    const lon = (m / 6) * Math.PI;
    let run = [];
    const flush = () => { if (run.length > 1) meridians += `M${run.map((p) => p.join(" ")).join("L")}`; run = []; };
    for (let i = 0; i <= 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const n = [Math.cos(th) * Math.cos(lon), Math.cos(th) * Math.sin(lon), Math.sin(th)];
      if (G.dot3(n, V) > 0.03) run.push(at(G.add3(Z.PLANET, G.mul3(n, R))).map((v) => Math.round(v * 10) / 10));
      else flush();
    }
    flush();
  }
  put(Z.PLANET, S(G.sphereOf(Z.PLANET, R, P, { steps: 96 }), { tone: "hi", inner: L(lat, { tone: "lo" }) + L(meridians, { tone: "faint" }) }), "infraservices");
  // Hosted Zone: a beacon lamp on the planet's pole.
  const pole = Z.PLANET[2] + R;
  const [px, py] = [Z.PLANET[0], Z.PLANET[1]];
  let beacon = S(k.cylinder(px, py, 4, pole - 1.4, 2.6, P, 24, 0.3), { tone: "mid" });
  beacon += S(k.cylinder(px, py, 1, pole + 1.2, 7.6, P, 12), { tone: "mid", crease: "none" });
  beacon += S(k.cylinder(px, py, 3, pole + 8.8, 4, P, 24), { tone: "hi", className: "ol-beacon" });
  beacon += S(k.cylinder(px, py, 1.6, pole + 12.8, 1.6, P, 16), { tone: "mid" });
  put([px, py, pole + 6], beacon, "hostedzone");
}

// ---------------------------------------------------------------- manage zone
function manageZone() {
  // SRE: the radar pedestal (the dish itself moves).
  {
    const base = { x: Z.DISH[0] - 10, y: Z.DISH[1] - 10, w: 20, d: 20, r: 1.5 };
    let svg = S(k.slabOf(base, ZB, 4, P, 3, 0.6), { tone: "lo" }) + screws(base, ZB + 4, 3);
    svg += S(k.cylinder(Z.DISH[0], Z.DISH[1], 5, ZB + 4, 9, P, 28), { tone: "mid", inner: L(k.sideArc(Z.DISH[0], Z.DISH[1], 5, 13, P, 16), { tone: "faint" }) });
    svg += S(k.cylinder(Z.DISH[0], Z.DISH[1], 9, 18, 2, P, 40, 0.4), { tone: "mid", inner: L(k.knurl(Z.DISH[0], Z.DISH[1], 9, 18, 20, 48, P, 0.2), { tone: "faint" }) });
    put([Z.DISH[0], Z.DISH[1], 12], svg, "sre");
  }
  // A junction box that gathers the station's cables.
  {
    const box = { x: 184, y: -92, w: 10, d: 12, r: 1 };
    let svg = S(k.slabOf(box, ZB, 7, P, 2, 0.4), { tone: "mid" }) + screws(box, ZB + 7, 2);
    svg += tube([[160, -86, 6.4], [184, -86, 6.4]], 0.7);
    svg += tube([[210, -58, 6.4], [210, -70, 6.4], [189, -70, 6.4], [189, -80, 6.4]], 0.7);
    svg += tube([[189, -92, 6.4], [189, -100, 6.4], [202, -100, 6.4], [202, -106.3, 6.4]], 0.7);
    put([189, -86, 6], svg, "status");
  }
  // Status Page: a board with three zone lamps and a row of service lamps.
  {
    const board = { x: 198, y: -110, w: 32, d: 4, r: 0.8 };
    const face = board.y + board.d;
    let svg = "";
    for (const x of [202, 226]) svg += S(k.cylinder(x, -108, 1.6, ZB, 9, P, 14), { tone: "mid", crease: "none" });
    let inner = L(k.sideSeam(board, 22, P, 2), { tone: "faint" });
    ["build", "deploy", "manage"].forEach((zone, i) => {
      const x = 205 + i * 9;
      inner += `<path class="ol-lamp" data-zone="${zone}" d="${k.sideRing([x, face, 30], 2.8, "y", P, 24)}"/>`;
      inner += L(k.sideRing([x, face, 30], 3.6, "y", P, 24), { tone: "lo" });
    });
    inner += Dt(Array.from({ length: 9 }, (_, i) => at([201.5 + i * 3.4, face, 17])), { size: 0.55, tone: "mid", pulse: true });
    svg += S(k.slabOf(board, 14, 24, P, 2, 0.5), { tone: "mid", inner });
    put([214, -108, 26], svg, "status");
  }
  // Billing Platform (FinOps): a deploy counter with a crank.
  {
    const box = { x: 202, y: -58, w: 24, d: 14, r: 1.2 };
    const face = box.y + box.d;
    const win = faceRect(205, 223, face, 9.6, 17.4);
    let svg = S(k.slabOf(box, ZB, 16, P, 3, 0.6), { tone: "mid", inner: L(win, { tone: "lo" }) + [209.5, 214, 218.5].map((x) => L(k.segment([x, face, 9.6], [x, face, 17.4], P), { tone: "faint" })).join("") });
    svg += `<text class="ol-count" data-part="count" transform="${k.sideMatrix([205.4, face], 10.8, P, "left")}" font-size="6.2" textLength="17.2" lengthAdjust="spacingAndGlyphs">0000</text>`;
    svg += L(k.planOutline({ x: 210, y: -54, w: 8, d: 1.6, r: 0.6 }, ZB + 16, P, 2), { tone: "lo" });
    const F = G.frameAlong([226, -51, 13], [1, 0, 0]);
    svg += S(G.disc(0, 2, 3.4, F, P), { tone: "mid" }) + S(k.slabOf({ x: 228, y: -51.8, w: 1.6, d: 1.6, r: 0.4 }, 13, 7, P, 2), { tone: "mid", crease: "none" }) + S(k.cylinder(228.8, -51, 1.4, 20, 3.4, P, 14), { tone: "hi" });
    put([214, -51, 12], svg, "finops");
  }
  // Security: the searchlight mast (the head moves).
  {
    const [x, y] = Z.LAMP;
    const base = { x: x - 7, y: y - 7, w: 14, d: 14, r: 1.2 };
    let svg = S(k.slabOf(base, ZB, 4, P, 3, 0.5), { tone: "lo" }) + screws(base, ZB + 4, 2.4);
    svg += S(k.cylinder(x, y, 2, ZB + 4, Z.LAMP_Z - ZB - 7, P, 18), { tone: "mid", crease: "none", inner: L([26, 46].map((z) => k.sideArc(x, y, 2, z, P, 12)).join(""), { tone: "faint" }) });
    svg += S(k.cylinder(x, y, 6, Z.LAMP_Z - 3, 3, P, 32, 0.4), { tone: "mid" });
    svg += `<circle class="ol-alarm" cx="${at([x + 5.2, y, Z.LAMP_Z])[0].toFixed(1)}" cy="${at([x + 5.2, y, Z.LAMP_Z])[1].toFixed(1)}" r="1.2"/>`;
    put([x, y, 40], svg, "security");
  }
  // Controls Inheritance and Support: three tiers, each standing on the last.
  {
    let svg = "";
    [[196, 4, 32, 8], [200, 8, 24, 8], [204, 12, 16, 8]].forEach(([x, y, w, h], i) => {
      const plan = { x, y, w, d: w, r: 1 };
      const z = ZB + i * 8;
      svg += S(k.slabOf(plan, z, h, P, 2, 0.5), { tone: i === 2 ? "hi" : "mid", inner: L(k.sideSeam(plan, z + 4, P, 2), { tone: "faint" }) });
      svg += screws(plan, z + h, 2.2);
    });
    put([212, 20, 16], svg, "controls");
  }
  // naviGate: a gate frame around a compass on a pedestal.
  {
    const [x, y] = Z.COMPASS;
    for (const side of [-1, 1]) {
      const post = { x: x + side * 22 - 2, y: y - 2, w: 4, d: 4, r: 0.6 };
      put([x + side * 22, y, 24], S(k.slabOf(post, ZB, 40, P, 2, 0.3), { tone: "mid" }), "navigate");
    }
    const lintel = { x: x - 26, y: y - 2.4, w: 52, d: 4.8, r: 0.8 };
    put([x, y, 47], S(k.slabOf(lintel, 45, 4, P, 2, 0.4), { tone: "mid" }) + screws(lintel, 49, 1.6), "navigate");
    let svg = S(k.cylinder(x, y, 7, ZB, 2, P, 32, 0.3), { tone: "lo" });
    svg += S(k.cylinder(x, y, 3.4, ZB + 2, Z.COMPASS_Z - ZB - 5, P, 20), { tone: "mid", crease: "none" });
    svg += S(k.cylinder(x, y, 13, Z.COMPASS_Z - 3, 3, P, 64, 0.6), { tone: "hi", inner: L(k.knurl(x, y, 13, Z.COMPASS_Z - 3, Z.COMPASS_Z, 60, P, 0.3), { tone: "faint" }) });
    svg += L(k.ring(x, y, 12, Z.COMPASS_Z, P, 64), { tone: "lo" });
    const t = k.radialTicks(x, y, 12, 32, 8, Z.COMPASS_Z, [1.2, 2.6], P);
    svg += L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(k.ring(x, y, 1.4, Z.COMPASS_Z, P, 16), { tone: "mid" });
    put([x, y, 18], svg, "navigate");
  }
}

ground.push(bench());
buildZone();
gate();
deployZone();
manageZone();

// Moving parts get a slot in the same sorted list; the page re-sorts them each frame.
const dyn = [];
const putDyn = (name, item) => dyn.push({ name, ...item });
const T0 = 0;
for (const orbit of Z.ORBITS) {
  putDyn(`arm-${orbit.id}`, Z.armSvg(orbit, T0, false));
  putDyn(`body-${orbit.id}`, Z.bodySvg(orbit, T0, false));
}
const ROCKET_AT = [Z.PAD[0], Z.PAD[1], Z.PAD_TOP];
putDyn("rocket", { at: [Z.PAD[0], Z.PAD[1], Z.PAD_TOP + 37], svg: Z.rocketSvg(ROCKET_AT, [0, 0, 1]) });
Z.ARM_Z.forEach((_, i) => putDyn(`tower-${i}`, Z.towerArmSvg(i, 0, false)));
putDyn("dish", { at: [Z.DISH[0], Z.DISH[1], Z.DISH_Z], svg: Z.dishSvg([-168, 10, 60], false) });
putDyn("lamp", { at: [Z.LAMP[0], Z.LAMP[1], Z.LAMP_Z + 7], svg: Z.lampSvg(-2.4, 0.3, false) });
putDyn("stamp", { at: [Z.GATE_X, -Z.GATE_Y + 15, 146], svg: "" });
putDyn("needle", { at: [Z.COMPASS[0], Z.COMPASS[1], Z.COMPASS_Z + 1], svg: `<path class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d="${Z.needleSvg([-168, 10, 0])}"/>` });

// The stamp plunger is built once along its own axis and slid with a transform.
{
  const F = G.frameOf([Z.GATE_X, -Z.GATE_Y + 4, 146], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const svg = S(G.disc(4, 21, 1.4, F, P), { tone: "hi", crease: "none" }) + S(G.disc(21, 25, 3, F, P), { tone: "mid", inner: L(G.circleOf(F, 25, 2, P), { tone: "faint" }) });
  dyn.find((d) => d.name === "stamp").svg = `<g data-svc="codesign">${svg}</g>`;
}

const keyed = [
  ...items.map((item) => ({ key: k.depthOf(item.at, P), svg: item.svg })),
  ...dyn.map((item) => ({ key: k.depthOf(item.at, P), svg: item.svg, name: item.name })),
].sort((a, b) => a.key - b.key);
const sceneSvg = keyed.map((item) => (item.name ? `<g data-dyn="${item.name}" data-k="${item.key.toFixed(2)}">${item.svg}</g>` : `<g data-k="${item.key.toFixed(2)}">${item.svg}</g>`)).join("");

const LABEL = "A tabletop orrery that maps a delivery platform. On the left a launch complex builds and fuels a rocket; in the middle a planet on a geared column carries four hosting stations on orbit arms; on the right a tracking station watches, bills and governs. The rocket launches, passes a trust gate, delivers to a station, and returns to its pad.";
const backSvg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: [`<g class="ol-ground">${ground.join("")}</g>`, `<g class="ol-scene">${sceneSvg}</g>`], className: "ol-back" });
const stage = `<div class="ol-stage" tabindex="0" role="group" aria-label="Lifecycle orrery. Hover or tab through the legend to name each part. Space launches the next rocket.">${backSvg}<canvas class="ol-layer ol-gl" aria-hidden="true"></canvas></div>`;

const legend = `<div class="ol-legend">${ZONES.map((zone) => `<section class="ol-zone" data-zone="${zone.id}"><h3>${zone.name}<span>${zone.object}</span></h3>${zone.groups.map((group) => `<div class="ol-group"><h4>${group}</h4><ul>${SERVICES.filter((s) => s.zone === zone.id && s.group === group).map((s) => `<li><button type="button" data-svc="${s.id}"><b>${s.name}</b><i>${s.object}</i></button></li>`).join("")}</ul></div>`).join("")}</section>`).join("")}</div>`;
const caption = "Build, Deploy and Manage as one machine. The rocket is an application release: it is assembled in the launch complex, cleared by the Digital Trust gate, delivered to one of four hosting orbits, and watched by the tracking station before it returns for the next release.";

const body = `<style>${readFileSync(join(HERE, "style.css"), "utf8")}</style>` + k.plateHtml({ fig: "Fig 1", title: "Platform lifecycle · orrery", hint: "Hover or tap a part · space to launch", readout: "on pad · next: Cloud Infrastructure", caption, body: stage }).replace("</figure>", `${legend}</figure>`);

const DATA = { P, W: WIDTH, H: HEIGHT, camera: glCamera(P), services: SERVICES, theme };
const strip = (source) => source.replace(/^export /gm, "").replace(/^import .*$/gm, "");
const latheSource = strip(readFileSync(join(SKILL, "kit/lathe.mjs"), "utf8"));
const latheNames = [...readFileSync(join(SKILL, "kit/lathe.mjs"), "utf8").matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
const sceneSource = strip(readFileSync(join(HERE, "scene.mjs"), "utf8"));
const kitNames = [...readFileSync(join(SKILL, "kit/iso-kit.mjs"), "utf8").matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
const script = [
  kitScript(),
  glScript(),
  `const G = (() => { ${latheSource}\n return { ${latheNames.join(", ")} }; })();`,
  `const K = { ${kitNames.join(", ")} };`,
  `const SCENE = (() => { ${sceneSource}\n return makeScene; })();`,
  `const DATA = ${JSON.stringify(DATA)};`,
  readFileSync(join(HERE, "live.js"), "utf8"),
].join("\n");

const name = theme === "light" ? "orbital-lifecycle-light.html" : "orbital-lifecycle.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Platform lifecycle orrery", theme, body, script, width: 1000 }));
console.log("wrote", name, `${items.length} static items, ${dyn.length} moving`);
