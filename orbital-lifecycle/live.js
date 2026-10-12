const P = DATA.P;
const Z = SCENE(K, G, P);
const stage = document.querySelector(".ol-stage");
const svg = stage.querySelector("svg");
const scene = svg.querySelector(".ol-scene");
const readout = document.querySelector("[data-readout]");
const legend = document.querySelector(".ol-legend");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = DATA.theme === "light" ? 1 : 0;
const SERVICE = Object.fromEntries(DATA.services.map((s) => [s.id, s]));
const ZONE_NAME = { build: "Build", deploy: "Deploy", manage: "Manage" };
const TARGETS = ["cloudinfra", "edgeplatform", "chinainfra", "instruments"];
const NAMES = { cloudinfra: "Cloud Infrastructure", edgeplatform: "Application Platform (Edge)", chinainfra: "China Infra", instruments: "OS for Instruments" };
const HALF = { cloudinfra: 7, edgeplatform: 4.5, chinainfra: 7.8, instruments: 3.4 };

// ---------------------------------------------------------------- sorted scene
const dyn = {};
scene.querySelectorAll("[data-dyn]").forEach((el) => (dyn[el.dataset.dyn] = el));
const statics = [...scene.children].filter((el) => !el.dataset.dyn).map((el) => ({ el, key: Number(el.dataset.k) }));
const keys = new Map();
function setDyn(name, at, html) {
  const el = dyn[name];
  if (html !== undefined && el.__html !== html) {
    el.innerHTML = html;
    el.__html = html;
    if (highlight) mark(el, highlight);
  }
  keys.set(el, depthOf(at, P));
}
function reorder() {
  const movers = [...keys].map(([el, key]) => ({ el, key }));
  const desired = [...statics, ...movers].sort((a, b) => a.key - b.key).map((item) => item.el);
  const children = scene.children;
  for (let i = 0; i < desired.length; i++) if (children[i] !== desired[i]) scene.insertBefore(desired[i], children[i]);
}

// ---------------------------------------------------------------- vectors and curves
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const mix = (a, b, t) => add(a, mul(sub(b, a), t));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => t * t * (3 - 2 * t);

function spline(points) {
  // Centripetal-free Catmull-Rom, resampled by arc length.
  const pts = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    for (let j = 0; j < 16; j++) {
      const t = j / 16;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(points[points.length - 1]);
  const acc = [0];
  for (let i = 1; i < out.length; i++) acc.push(acc[i - 1] + len(sub(out[i], out[i - 1])));
  return { points: out, acc, length: acc[acc.length - 1] };
}
function along(path, s) {
  const target = clamp(s, 0, path.length);
  let i = 1;
  while (i < path.acc.length - 1 && path.acc[i] < target) i++;
  const span = path.acc[i] - path.acc[i - 1] || 1;
  const t = (target - path.acc[i - 1]) / span;
  return { at: mix(path.points[i - 1], path.points[i], t), dir: unit(sub(path.points[i], path.points[i - 1])) };
}

// ---------------------------------------------------------------- the flight
const C = [Z.C[0], Z.C[1]];
const HALF_LEN = Z.ROCKET_LEN / 2;
const PAD_C = [Z.PAD[0], Z.PAD[1], Z.PAD_TOP + HALF_LEN];
const TOP = [Z.PAD[0], Z.PAD[1], 132];
const GATE = [Z.GATE_X, 0, 148];
const ARC_R = 116;
const INNER_R = 68;
const CRUISE_Z = 162;
const SPEED = 78;
const orbitOf = (id) => Z.ORBITS.find((o) => o.id === id);
const outward = (id, t) => { const a = Z.angleOf(orbitOf(id), t); return [Math.cos(a), Math.sin(a), 0]; };
const standoff = (id, t) => add(Z.bodyAt(orbitOf(id), t), mul(outward(id, t), HALF[id] + 3 + HALF_LEN));
function arcPoints(a0, a1, z0, z1, r0, r1) {
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const n = Math.max(2, Math.ceil(Math.abs(d) / 0.35));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const a = a0 + d * t;
    const r = r0 + (r1 - r0) * t;
    return [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a), z0 + (z1 - z0) * t];
  });
}
function outboundPath(id, t0) {
  let arrive = t0 + 5;
  let path;
  for (let pass = 0; pass < 3; pass++) {
    const a = Z.angleOf(orbitOf(id), arrive);
    const D = standoff(id, arrive);
    const W = add(D, add(mul(outward(id, arrive), 26), [0, 0, 22]));
    path = spline([TOP, add(TOP, [22, -3, 12]), GATE, ...arcPoints(Math.PI, a, CRUISE_Z, W[2] + 8, INNER_R, ARC_R), W, D]);
    arrive = t0 + path.length / SPEED;
  }
  return path;
}
function returnPath(id, t0) {
  const a = Z.angleOf(orbitOf(id), t0);
  const D = standoff(id, t0);
  const W = add(D, add(mul(outward(id, t0), 26), [0, 0, 22]));
  return spline([D, W, ...arcPoints(a, Math.PI, W[2] + 8, CRUISE_Z - 4, ARC_R, INNER_R), add(GATE, [0, 0, 4]), add(TOP, [22, -3, 16]), TOP]);
}

const PHASES = { pad: 2.2, retract: 1.1, ignite: 0.9, ascent: 2.2, dock: 2.2, land: 2.6, attach: 1.1 };
const R = {
  phase: "pad", time: 0, clock: 0, deploys: 0, target: 0, path: null, travel: 0,
  centre: PAD_C.slice(), axis: [0, 0, 1], swing: 0, thrust: { x: 0, v: 0 }, flash: 0, stamp: { x: 0, v: 0 }, lit: false,
};
const targetId = () => TARGETS[R.target % TARGETS.length];
function enter(phase) {
  R.phase = phase;
  R.time = 0;
  if (phase === "cruise") { R.path = outboundPath(targetId(), R.clock); R.travel = 0; }
  if (phase === "depart") { R.path = returnPath(targetId(), R.clock); R.travel = 0; }
  if (phase === "dock") { R.deploys += 1; R.flash = 1; count(); }
  if (phase === "attach") R.target += 1;
}
const NEXT = { pad: "retract", retract: "ignite", ignite: "ascent", ascent: "cruise", cruise: "dock", dock: "depart", depart: "land", land: "attach", attach: "pad" };

function stepFlight(dt) {
  R.time += dt;
  const id = targetId();
  let want = [0, 0, 1];
  let thrust = 0;
  const share = PHASES[R.phase] ? clamp(R.time / PHASES[R.phase], 0, 1) : 0;
  switch (R.phase) {
    case "pad": R.centre = PAD_C.slice(); break;
    case "retract": R.swing = ease(share); break;
    case "ignite": thrust = 0.7 * ease(share); break;
    case "ascent": {
      const s = share * share;
      R.centre = mix(PAD_C, TOP, s);
      thrust = 1;
      break;
    }
    case "cruise":
    case "depart": {
      const total = R.path.length;
      const duration = total / SPEED;
      const u = clamp(R.time / duration, 0, 1);
      const warped = R.phase === "cruise" ? u * u * (3 - 2 * u) * 0.35 + u * 0.65 : ease(u);
      const point = along(R.path, warped * total);
      R.centre = point.at;
      want = point.dir;
      thrust = R.phase === "cruise" ? 0.65 * (1 - ease(clamp((u - 0.7) / 0.3, 0, 1))) + 0.05 : 0.25 + 0.35 * ease(clamp(u / 0.2, 0, 1));
      if (R.phase === "depart" && u > 0.85) want = unit(mix(want, [0, 0, 1], ease((u - 0.85) / 0.15)));
      if (u >= 1) enter(R.phase === "cruise" ? "dock" : "land");
      break;
    }
    case "dock": {
      const D = standoff(id, R.clock);
      R.centre = mix(R.centre, D, 1 - Math.exp(-dt / 0.25));
      want = mul(outward(id, R.clock), -1);
      break;
    }
    case "land": {
      const s = 1 - (1 - share) * (1 - share);
      R.centre = mix(TOP, PAD_C, s);
      thrust = share < 0.96 ? 0.35 + 0.6 * ease(share) : 0;
      break;
    }
    case "attach": R.swing = 1 - ease(share); break;
  }
  if (R.phase === "land" || R.phase === "ascent" || R.phase === "ignite" || R.phase === "pad" || R.phase === "attach" || R.phase === "retract") want = [0, 0, 1];
  R.axis = unit(mix(R.axis, want, 1 - Math.exp(-dt / 0.3)));
  if (PHASES[R.phase] && R.time >= PHASES[R.phase]) enter(NEXT[R.phase]);
  settle(R.thrust, thrust, dt, 0.18, false);
  R.flash *= Math.exp(-dt / 0.5);
  // Code Signing presses its stamp as the rocket passes the gate on the way out.
  const passing = R.phase === "cruise" && Math.abs(R.centre[0] - Z.GATE_X) < 16 ? 1 : 0;
  settle(R.stamp, passing, dt, 0.12, false);
}

// ---------------------------------------------------------------- drawing the moving parts
const lampEls = [...svg.querySelectorAll(".ol-lamp")];
const scanEls = [...svg.querySelectorAll(".ol-scan")];
const tpmEl = svg.querySelector(".ol-tpm");
const keyEl = svg.querySelector(".ol-key");
const alarmEl = svg.querySelector(".ol-alarm");
const countEl = svg.querySelector('[data-part="count"]');
function count() { countEl.textContent = String(R.deploys).padStart(4, "0"); }
const toggle = (el, on) => (on ? el.setAttribute("data-on", "") : el.removeAttribute("data-on"));
const stampVec = axisVector(P, [0, 10, 0]);
let dishAim = [Z.PAD[0], Z.PAD[1], 60];
let lampAngle = -2.4;

function draw(t, dt) {
  const id = targetId();
  for (const orbit of Z.ORBITS) {
    const docked = R.phase === "dock" && orbit.id === id;
    const arm = Z.armSvg(orbit, t, false);
    setDyn(`arm-${orbit.id}`, arm.at, arm.svg);
    const body = Z.bodySvg(orbit, t, docked);
    setDyn(`body-${orbit.id}`, body.at, body.svg);
  }
  const flying = !["pad", "retract", "attach"].includes(R.phase);
  const nozzle = sub(R.centre, mul(R.axis, HALF_LEN));
  setDyn("rocket", R.centre, Z.rocketSvg(nozzle, R.axis, flying ? { appcloud: true, appedge: true } : {}));
  Z.ARM_Z.forEach((_, i) => {
    const arm = Z.towerArmSvg(i, R.swing, false);
    setDyn(`tower-${i}`, arm.at, arm.svg);
  });
  dishAim = mix(dishAim, R.centre, 1 - Math.exp(-dt / 0.35));
  setDyn("dish", [Z.DISH[0], Z.DISH[1], Z.DISH_Z], Z.dishSvg(dishAim, R.phase === "dock" || R.phase === "depart"));
  const drill = R.deploys > 0 && R.deploys % 3 === 0 && (R.phase === "dock" || R.phase === "depart");
  const aim = drill ? Math.atan2(Z.bodyAt(orbitOf(id), t)[1] - Z.LAMP[1], Z.bodyAt(orbitOf(id), t)[0] - Z.LAMP[0]) : -2.2 + Math.sin(t * 0.35) * 1.1;
  lampAngle += (aim - lampAngle) * (1 - Math.exp(-dt / 0.6));
  setDyn("lamp", [Z.LAMP[0], Z.LAMP[1], Z.LAMP_Z + 7], Z.lampSvg(lampAngle, 0.3, drill));
  toggle(alarmEl, drill && Math.sin(t * 9) > 0);
  const press = R.stamp.x;
  dyn.stamp.setAttribute("transform", `translate(${(stampVec[0] * press).toFixed(2)} ${(stampVec[1] * press).toFixed(2)})`);
  keys.set(dyn.stamp, depthOf([Z.GATE_X, -Z.GATE_Y + 15 + press * 10, 146], P));
  setDyn("needle", [Z.COMPASS[0], Z.COMPASS[1], Z.COMPASS_Z + 1], `<path class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d="${Z.needleSvg(R.centre)}"/>`);
  // Gate lamps follow the rocket's x on the way out.
  const out = R.phase === "cruise";
  const x = R.centre[0];
  toggle(keyEl, out && x > -150 && x < -60);
  scanEls.forEach((el, i) => toggle(el, out && Math.abs(x - (-118 + i * 8)) < 9));
  toggle(tpmEl, out && x > Z.GATE_X - 6 && x < -40);
  // Status board: which zone holds the release now.
  const zone = ["pad", "retract", "ignite", "land", "attach"].includes(R.phase) ? "build" : R.phase === "dock" ? "manage" : "deploy";
  lampEls.forEach((el) => toggle(el, el.dataset.zone === zone || (zone === "manage" && el.dataset.zone === "deploy")));
  reorder();
  if (!highlight) say(phaseText());
  if (layer) drawGl(t, nozzle);
}

function phaseText() {
  const name = NAMES[targetId()];
  const n = String(R.deploys + (R.phase === "dock" || R.phase === "depart" || R.phase === "land" || R.phase === "attach" ? 0 : 1)).padStart(4, "0");
  switch (R.phase) {
    case "pad": return `release ${n} on pad · next: ${name}`;
    case "retract": return `release ${n} · tower arms swing clear`;
    case "ignite": return `release ${n} · ignition`;
    case "ascent": return `release ${n} · launch`;
    case "cruise": return Math.abs(R.centre[0] - Z.GATE_X) < 30 ? `release ${n} · Digital Trust: certify, sign, seal` : `release ${n} · to ${name}`;
    case "dock": return `release ${n} delivered · ${name}`;
    case "depart": return R.deploys % 3 === 0 ? `release ${n} · incident drill · booster returns` : `release ${n} · booster returns`;
    case "land": return `release ${n} · landing burn`;
    default: return `release ${n} · tower arms lock on`;
  }
}
function say(text) { if (readout.textContent !== text) readout.textContent = text; }

// ---------------------------------------------------------------- the shader: exhaust, landing splash, delivery flash
const FRAGMENT = `
uniform vec3 uNoz;
uniform vec3 uDir;
uniform vec3 uNose;
uniform float uThrust;
uniform float uGround;
uniform vec4 uFlash;
uniform float uLight;
float segment(vec2 p, vec2 a, vec2 b, out float h){vec2 pa=p-a,ba=b-a;h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-4),0.,1.);return length(pa-ba*h);}
vec4 inkFor(vec3 seen,float cover){vec3 absorbed=1.-seen;float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);return vec4(vec3(a)-absorbed,a);}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float body=0.,core=0.,flash=0.;
  if(uThrust>.003){
    float Lp=8.+44.*uThrust;
    vec3 tip=uNoz+uDir*Lp;
    float h;
    float d=segment(vb,project(uNoz),project(tip),h)/uK;
    vec3 c=uNoz+uDir*(h*Lp);
    float above=smoothstep(uGround-.5,uGround+2.5,c.z);
    float r=2.2+h*Lp*.2;
    float flick=.85+.3*noise2(vec2(h*9.-uTime*14.,uTime*3.));
    float fall=pow(1.-h,1.4)*smoothstep(0.,.04,h+.02);
    body=exp(-d*d/(r*r))*fall*above*uThrust*flick;
    core=exp(-d*d/(r*r*.18))*exp(-h*4.)*above*uThrust;
    // Splash on the surface below when the nozzle is close to it.
    float height=max(uNoz.z-uGround,0.);
    float near=(1.-smoothstep(4.,46.,height))*uThrust;
    if(near>.002){
      vec3 q=onFloor(vb,uGround);
      float rs=6.+18.*near;
      float g=length(q.xy-uNoz.xy);
      float ring=exp(-pow(g/rs,2.))*(.6+.4*noise2(q.xy*.3+uTime*2.));
      float hb;
      float shade=smoothstep(4.,6.5,segment(vb,project(uNoz),project(uNose),hb)/uK);
      body+=ring*near*.9*shade;
    }
  }
  if(uFlash.w>.003){
    float d=length(vb-project(uFlash.xyz))/uK;
    flash=exp(-d*d/(14.*14.))*uFlash.w;
  }
  vec4 dark;
  {
    vec3 col=vec3(1.,.48,.14)*body*1.4+vec3(1.,.9,.7)*core*1.6+vec3(.45,.65,1.)*flash*.9;
    col=tonemap(col,1.15);
    float m=max(col.r,max(col.g,col.b));
    dark=vec4(col,m);
  }
  vec4 light;
  {
    float e=1.-exp(-2.2*(body+core*1.4));
    vec3 seen=mix(vec3(1.),vec3(.98,.5,.12),smoothstep(.02,.5,e));
    seen=mix(seen,vec3(1.,.93,.72),smoothstep(.55,.95,e)*smoothstep(.2,.6,core));
    vec4 fire=inkFor(seen,.9*smoothstep(.6,.95,e));
    float fe=1.-exp(-1.6*flash);
    vec4 glow=inkFor(mix(vec3(1.),vec3(.35,.55,.95),fe*.7),0.);
    light=fire+glow*(1.-fire.a);
  }
  vec4 col=mix(dark,light,uLight);
  float n=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  col=max(col+vec4(n)*smoothstep(0.,1.5/255.,col.a),0.);
  col.rgb=min(col.rgb,vec3(col.a));
  gl_FragColor=col;
}`;
const layer = glLayer({ canvas: stage.querySelector(".ol-gl"), fragment: FRAGMENT, view: [DATA.W, DATA.H], camera: DATA.camera, uniforms: ["uNoz", "uDir", "uNose", "uThrust", "uGround", "uFlash"], fixed: { uLight: LIGHT } });
if (layer) stage.setAttribute("data-gl", "");
function groundUnder(p) {
  const onPad = p[0] > -196 && p[0] < -140 && p[1] > -18 && p[1] < 38;
  if (onPad) return Math.hypot(p[0] - Z.PAD[0], p[1] - Z.PAD[1]) < 9.5 ? 15 : 11;
  if (Math.hypot(p[0] - C[0], p[1] - C[1]) < Z.PLINTH_R - 3) return 7;
  return 0;
}
function drawGl(t, nozzle) {
  const thrust = R.thrust.x;
  const flash = R.flash;
  if (thrust < 0.003 && flash < 0.003) { layer.clear(); return; }
  const target = Z.bodyAt(orbitOf(targetId()), t);
  layer.draw({ uNoz: nozzle, uDir: mul(R.axis, -1), uNose: add(nozzle, mul(R.axis, Z.ROCKET_LEN)), uThrust: thrust, uGround: groundUnder(nozzle), uFlash: [...target, flash] }, t);
}

// ---------------------------------------------------------------- hover and legend
let highlight = null;
function mark(root, id) {
  root.querySelectorAll("[data-svc]").forEach((el) => toggle(el, el.dataset.svc === id));
  if (root.dataset && root.dataset.svc) toggle(root, root.dataset.svc === id);
}
function setHighlight(id) {
  if (id === highlight) return;
  highlight = id;
  svg.querySelectorAll("[data-svc][data-on]").forEach((el) => el.removeAttribute("data-on"));
  legend.querySelectorAll("button[data-on]").forEach((el) => el.removeAttribute("data-on"));
  if (id) {
    const s = SERVICE[id];
    svg.querySelectorAll(`[data-svc="${id}"]`).forEach((el) => el.setAttribute("data-on", ""));
    legend.querySelectorAll(`button[data-svc="${id}"]`).forEach((el) => el.setAttribute("data-on", ""));
    stage.setAttribute("data-hl", s.zone);
    say(`${ZONE_NAME[s.zone]} › ${s.group} › ${s.name}`);
    stage.setAttribute("aria-valuetext", `${s.name}, ${s.group}, ${ZONE_NAME[s.zone]}: the ${s.object}`);
  } else {
    stage.removeAttribute("data-hl");
    say(phaseText());
  }
}
svg.addEventListener("pointerover", (event) => {
  const el = event.target.closest("[data-svc]");
  setHighlight(el ? el.dataset.svc : null);
});
svg.addEventListener("pointerleave", () => setHighlight(null));
legend.addEventListener("pointerover", (event) => { const b = event.target.closest("button[data-svc]"); if (b) setHighlight(b.dataset.svc); });
legend.addEventListener("pointerleave", () => setHighlight(null));
legend.addEventListener("focusin", (event) => { const b = event.target.closest("button[data-svc]"); if (b) setHighlight(b.dataset.svc); });
legend.addEventListener("focusout", () => setHighlight(null));
legend.addEventListener("click", (event) => { const b = event.target.closest("button[data-svc]"); if (b) setHighlight(b.dataset.svc); });
stage.addEventListener("keydown", (event) => {
  if (event.key !== " " && event.key !== "Enter") return;
  event.preventDefault();
  if (R.phase === "pad") enter("retract");
  run();
});

// ---------------------------------------------------------------- loop
let frame = 0, last = 0, visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (!still.matches) {
    R.clock += dt;
    stepFlight(dt);
  }
  draw(R.clock, dt);
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
still.addEventListener("change", run);
count();
draw(0, 1 / 60);
