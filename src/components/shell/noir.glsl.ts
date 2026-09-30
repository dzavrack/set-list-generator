/**
 * Fragment shader: a rainy night street off Broadway.
 * Red smoke rolling up from a sign off-frame, two steady neon tubes that light the smoke,
 * tungsten and red bokeh down the block, fine rain, a wet reflection, grain and vignette.
 * Nothing flickers: neon and bokeh hold a constant brightness and the grain is static.
 * All layout is in CSS pixels (uScale converts), with y measured from the top.
 */
export const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = `
precision highp float;
uniform vec2 uRes;      // canvas size in device px
uniform float uScale;   // device px per CSS px
uniform float uTime;
uniform float uTubeX;   // CSS px x of the first tube (negative = no tubes)

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float n) { return fract(sin(n) * 43758.5453123); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main() {
  vec2 css = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale; // y down, CSS px
  vec2 size = uRes / uScale;
  vec2 uv = css / size;
  float t = uTime;

  vec3 col = vec3(0.022, 0.013, 0.016);

  // ---- smoke: domain-warped fbm drifting up and to the right, wisps with dark gaps ----
  vec2 sp = css / 360.0;
  sp.y += t * 0.035;
  sp.x -= t * 0.012;
  vec2 warp = vec2(fbm(sp + vec2(0.0, t * 0.02)), fbm(sp + vec2(5.2, 1.3) - t * 0.015));
  float smoke = fbm(sp * 1.1 + warp * 1.8);
  float fine = fbm(sp * 3.2 + warp * 2.5 - vec2(0.0, t * 0.05));
  smoke = smoothstep(0.42, 0.92, smoke) * (0.55 + 0.75 * smoothstep(0.3, 0.8, fine));
  smoke = pow(smoke, 1.35);

  // where the smoke lives: heaviest top-left (the sign), a bank along the sidebar, thin elsewhere
  float srcA = exp(-length((uv - vec2(0.05, -0.05)) * vec2(1.4, 1.1)) * 2.2);
  float srcB = exp(-pow(max(css.x - 40.0, 0.0) / 320.0, 2.0)) * (0.35 + 0.65 * smoothstep(1.1, 0.2, uv.y));
  // keep it thinner through the middle of the nav so labels stay crisp
  float navCalm = 1.0 - 0.45 * smoothstep(60.0, 0.0, abs(css.x - 110.0) - 70.0) * smoothstep(0.15, 0.3, uv.y) * smoothstep(0.75, 0.55, uv.y);
  float density = smoke * clamp(srcA * 1.35 + srcB * 0.75 + 0.06, 0.0, 1.5) * navCalm;

  // ---- neon tubes (steady) ----
  float tubeLight = 0.0;
  vec3 tubeCol = vec3(0.0);
  if (uTubeX >= 0.0) {
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float x = uTubeX + fi * 7.0;
      float top = size.y * mix(0.07, 0.12, fi);
      float bot = size.y * mix(0.59, 0.42, fi);
      float f = mix(1.0, 0.65, fi);
      float dy = max(max(top - css.y, css.y - bot), 0.0);
      float dx = abs(css.x - x);
      float d = length(vec2(dx, dy));
      float core = exp(-d * d / 1.3);
      float bloom = exp(-d / 5.0) * 0.55 + exp(-d / 26.0) * 0.28 + exp(-d / 110.0) * 0.16;
      tubeCol += f * (vec3(1.0, 0.86, 0.88) * core + vec3(1.0, 0.1, 0.2) * bloom);
      tubeLight += f * exp(-d / 150.0); // the tubes light the smoke around them
    }
  }

  // smoke colour: deep crimson in shadow, hot red where the neon hits it
  vec3 smokeCol = mix(vec3(0.38, 0.03, 0.07), vec3(1.0, 0.16, 0.24), clamp(tubeLight * 0.9 + srcA * 0.5, 0.0, 1.0));
  col += smokeCol * density * (0.42 + tubeLight * 0.9);

  // sign glow bleeding in from off-frame (top-left)
  col += vec3(1.0, 0.1, 0.18) * 0.22 * exp(-length((uv - vec2(-0.05, -0.1)) * vec2(1.2, 1.0)) * 3.0);

  col += tubeCol;

  // ---- bokeh: lamps and signs down the block (steady brightness, slow drift) ----
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float hx = hash1(fi * 7.13 + 1.0), hy = hash1(fi * 3.71 + 4.0), hr = hash1(fi * 5.37 + 9.0), hc = hash1(fi * 2.19 + 3.0);
    float spanX = uTubeX >= 0.0 ? 250.0 : size.x;
    vec2 c = vec2(hx * spanX - 10.0, size.y * mix(0.62, 1.03, hy));
    c.x += sin(t * 0.07 + fi) * 6.0;
    c.y += cos(t * 0.05 + fi * 1.3) * 4.0;
    float r = mix(5.0, 34.0, hr * hr);
    float d = length(css - c);
    float disc = smoothstep(r, r * 0.72, d);
    float rim = smoothstep(r * 0.62, r * 0.92, d) * disc * 0.35; // lens edge
    vec3 bc = hc < 0.62 ? vec3(1.0, 0.6, 0.3) : vec3(1.0, 0.16, 0.24);
    float a = mix(0.42, 0.14, hr) * 0.9;
    col += bc * (disc * 0.55 + rim) * a;
    col += bc * exp(-d / (r * 1.6)) * a * 0.18; // haze around each light
  }

  // ---- wet street: reflection of the tubes below them, rippling slowly ----
  if (uTubeX >= 0.0) {
    float refl = smoothstep(size.y * 0.7, size.y, css.y);
    float ripple = 0.75 + 0.25 * sin(css.y * 0.3 + t * 0.6);
    float dx = abs(css.x - uTubeX - 3.0 + (noise(vec2(css.y * 0.04, t * 0.25)) - 0.5) * 8.0);
    col += vec3(1.0, 0.12, 0.2) * refl * exp(-dx / 9.0) * ripple * 0.35;
  }

  // ---- rain: dim, and kept off the neon so nothing strobes ----
  vec2 rp = vec2(css.x + css.y * 0.2, css.y);
  float lane = floor(rp.x / 9.0);
  float speed = 700.0 + hash1(lane) * 500.0;
  float yy = fract((rp.y + t * speed + hash1(lane * 3.1) * 999.0) / 260.0);
  float streak = smoothstep(0.0, 0.02, yy) * smoothstep(0.1, 0.02, yy) * step(0.72, hash1(lane * 1.7));
  float laneX = abs(fract(rp.x / 9.0) - 0.5);
  float awayFromTubes = uTubeX >= 0.0 ? smoothstep(10.0, 60.0, abs(css.x - uTubeX - 3.0)) : 1.0;
  col += vec3(0.9, 0.75, 0.75) * streak * smoothstep(0.08, 0.0, laneX) * 0.05 * (0.4 + density) * awayFromTubes;

  // ---- film: vignette + static grain ----
  float vig = smoothstep(1.25, 0.25, length((uv - vec2(0.3, 0.45)) * vec2(1.0, 1.15)));
  col *= mix(0.35, 1.0, vig);
  col += (hash(floor(css)) - 0.5) * 0.025;

  // soft tonemap so the neon clips gracefully
  col = 1.0 - exp(-col * 1.35);
  gl_FragColor = vec4(col, 1.0);
}
`;
