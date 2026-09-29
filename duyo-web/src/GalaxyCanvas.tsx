/**
 * The 3D background: a spiral galaxy raymarched in a fragment shader.
 *
 * Why a shader and not a video. The brief this page was built from pointed at
 * a hosted .mp4 belonging to someone else's product. DUYO has just been
 * rejected from Google Play under the Impersonation policy for using
 * third-party assets, so shipping another one would repeat the exact mistake.
 * Everything drawn here is computed on the device from the code below — no
 * request leaves the page, nothing is anyone else's, and it is genuinely 3D
 * and interactive rather than a looping clip.
 *
 * It is also the same galaxy the app draws behind the brain map, so the site
 * and the product look like one thing.
 *
 * No library. Raw WebGL is about sixty lines of setup for a fullscreen
 * fragment shader, and three.js would be ~150 KB for geometry this page never
 * uses.
 */

import { useEffect, useRef } from 'react';

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * Raymarched volume. The disc is a squashed sphere; the arms are the standard
 * log-spiral `cos(arms*theta - wind*log(r))`, broken up by fbm so they read as
 * clouds of stars rather than painted ribbons.
 */
const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uPointer;   // -1..1, smoothed on the JS side
uniform float uMotion;    // 0 when the visitor asked for reduced motion

const vec3 DEEP   = vec3(0.027, 0.043, 0.102);  // #070B1A, the page ground
const vec3 BLUE   = vec3(0.145, 0.388, 0.922);  // #2563EB, DUYO blue
const vec3 VIOLET = vec3(0.545, 0.361, 0.965);  // #8B5CF6
const vec3 WARM   = vec3(1.000, 0.780, 0.000);  // #FFC700, the brand yellow

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);              // smoothstep, cheaper inline
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

/** Galaxy density at a point in local space. */
float density(vec3 p, float t) {
  vec3 q = vec3(p.x, p.y * 2.6, p.z);        // squash: a disc, not a ball
  float r = length(q);
  if (r > 2.2) return 0.0;                   // outside the halo, skip the maths

  float theta = atan(q.z, q.x) + t * 0.05;   // the whole disc turns, slowly
  float arms  = cos(2.0 * theta - 4.4 * log(max(r, 0.08)));
  // Power 4.2, not 2.6. Lower exponents leave so much density between the
  // arms that the march integrates them into one smooth blob — the spiral
  // has to be mostly empty for the eye to find the shape.
  arms = pow(clamp(arms * 0.5 + 0.5, 0.0, 1.0), 4.2);

  // Confined to the plane as well as the radius. Without this the arms are a
  // thick shell and every ray passes through several of them.
  float plane = exp(-abs(p.y) * 9.0);

  float core = exp(-r * r * 46.0);          // the bulge, nearly spherical
  float disc = exp(-r * 2.4) * plane;
  float band = arms * exp(-r * 1.35) * smoothstep(0.05, 0.32, r) * plane;
  float clouds = fbm(p * 3.1 + vec3(0.0, t * 0.02, 0.0));

  return (band * (0.55 + 0.75 * clouds) + disc * 0.10 + core * 0.85)
         * smoothstep(2.2, 1.0, r);
}

/** A field of stars, sampled on the ray direction — cheap and stable. */
float stars(vec3 dir) {
  vec3 c = dir * 240.0;
  vec3 i = floor(c);
  float h = hash(i);
  if (h < 0.992) return 0.0;                 // sparse: most cells hold nothing
  float d = length(fract(c) - 0.5);
  return smoothstep(0.42, 0.0, d) * (h - 0.992) * 125.0;
}

mat3 orbit(float yaw, float pitch) {
  float cy = cos(yaw),   sy = sin(yaw);
  float cp = cos(pitch), sp = sin(pitch);
  return mat3(cy, 0.0, -sy, sy * sp, cp, cy * sp, sy * cp, -sp, cy * cp);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - vec2(0.63, 0.615) * uRes) / uRes.y;
  float t = uTime * uMotion;

  // The pointer orbits the camera. Small angles on purpose: this is a
  // backdrop behind readable text, not a toy to be spun.
  float yaw   = uPointer.x * 0.42 + t * 0.012;
  float pitch = 0.62 + uPointer.y * 0.18;
  mat3 cam = orbit(yaw, pitch);

  vec3 ro = cam * vec3(0.0, 0.0, 3.40);
  vec3 rd = normalize(cam * vec3(uv, -1.35));

  vec3 col = DEEP;
  col += vec3(0.62, 0.74, 1.0) * stars(rd) * 0.9;

  // March the volume front to back, accumulating emission.
  float acc = 0.0;
  vec3  lit = vec3(0.0);
  for (int i = 0; i < 72; i++) {
    if (acc > 0.96) break;
    // Start where the halo does, not at the camera. The volume spans roughly
    // 1.2 to 5.6 units out; marching from zero spent a third of the steps on
    // empty space and then stopped short of the disc entirely.
    float s = 1.05 + float(i) * 0.063;
    vec3 p = ro + rd * s;
    float d = density(p, t);
    if (d > 0.001) {
      float r = length(vec3(p.x, p.y * 2.6, p.z));
      vec3 tint = mix(VIOLET, BLUE, clamp(r * 0.8, 0.0, 1.0));
      tint = mix(WARM, tint, smoothstep(0.0, 0.26, r));   // warm core
      float a = d * 0.20 * (1.0 - acc);
      lit += tint * a;
      acc += a;
    }
  }
  col += lit * 2.4;

  // Vignette, so the corners stay near the page ground and the headline the
  // text sits on never fights the picture.
  col = mix(DEEP, col, 1.0 - 0.55 * dot(uv, uv));

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function GalaxyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // `failIfMajorPerformanceCaveat` keeps this off software rasterisers,
    // where a per-pixel raymarch turns a hero section into a slideshow. The
    // CSS gradient underneath is what those visitors get.
    const gl =
      (canvas.getContext('webgl', {
        antialias: false,
        alpha: false,
        failIfMajorPerformanceCaveat: true,
      }) as WebGLRenderingContext | null) ?? null;
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // One triangle covering the viewport — no index buffer, no quad seam.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uPointer = gl.getUniformLocation(prog, 'uPointer');
    const uMotion = gl.getUniformLocation(prog, 'uMotion');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let motion = reduced.matches ? 0 : 1;
    const onReduced = () => {
      motion = reduced.matches ? 0 : 1;
    };
    reduced.addEventListener('change', onReduced);

    // Target and current are separate so the camera eases toward the pointer
    // instead of snapping to it — a hard follow reads as jitter.
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    // Phones have no pointer, so the tilt drives it there instead.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      targetX = Math.max(-1, Math.min(1, e.gamma / 45));
      targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt);

    const resize = () => {
      // Capped at 2: beyond that a fullscreen raymarch costs more than it
      // shows, and phones are where that bites.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let raf = 0;
    let running = true;
    const start = performance.now();

    const frame = () => {
      if (!running) return;
      curX += (targetX - curX) * 0.045;
      curY += (targetY - curY) * 0.045;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.uniform2f(uPointer, curX, curY);
      gl.uniform1f(uMotion, motion);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // A hidden tab should not hold a GPU loop open.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      reduced.removeEventListener('change', onReduced);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full block"
    />
  );
}
