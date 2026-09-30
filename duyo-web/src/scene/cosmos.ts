/**
 * The deep space every section happens in — and the one part of the page
 * that answers the visitor's hand.
 *
 * nebula: one full-screen pass on the far plane, domain-warped noise read
 * from a small baked volume, in the brand's blues and violet with a rare warm
 * knot. far: ~6.6k stars at infinity. world: ~3.9k stars in a shell around the
 * whole set, which parallax as the camera flies between stations. dust: ~480
 * motes wrapped around the camera. meteor: one shooting star at a time, near
 * the top or bottom edge. Sky contents are in cosmosSky.ts, shaders in
 * cosmosShaders.ts; this file only assembles them and writes uniforms.
 *
 * web: a few hundred faint stars that light up near the visitor's hand and
 * join into a small constellation (cosmosWeb.ts). halo: a pool of deep blue
 * and violet behind DUYO, drawn by the nebula pass.
 *
 * INTERACTION. Stars near the pointer brighten and spread as under a soft
 * lens, and the web gathers round it, trailing a fading wake of links; a
 * lagging point draws a short wake behind a moving pointer. A pulse sends a
 * ring of light through the stars and the gas, and a spark down every link.
 * All but the web's choice of links is screen space in the shaders, so a
 * frame is a few uniform writes and one small instanced buffer.
 *
 * MOTION. `t` drives twinkle, drift and the rings; `dt` drives the pointer's
 * easing. Under reduced motion (dt 0, t still) the sky holds perfectly still:
 * no twinkle, no drift, no shooting stars, no rings. The pointer still
 * brightens the stars it is over and shows its web, as a plain hover would,
 * but moves nothing.
 *
 * COMPOSITING. Every layer adds light and leaves destination alpha alone, as
 * galaxy.ts does. The group draws first among transparent objects, so the
 * stage's shadow catcher, which writes depth, can never hide the sky; the
 * robot and phone are opaque and hide it through the depth test.
 */

import * as THREE from 'three';
import type { Cosmos, CosmosInput } from './contract';
import { C, FRONT, bakeNoiseVolume, buildDust, buildFarStars, buildWorldStars, rng } from './cosmosSky';
import type { StarLayer } from './cosmosSky';
import { METEOR_FRAG, METEOR_VERT, NEBULA_FRAG, NEBULA_VERT, PULSES, STAR_FRAG, starVertex } from './cosmosShaders';
import type { Placement } from './cosmosShaders';
import { ROBOT_POS, ROBOT_SCALE } from './director';

/** Colour adds as light; destination alpha (the CSS ground showing through) is left alone. */
const ADD_LIGHT = {
  transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
} as const;

/** Shooting stars: seconds from one start to the next, and how long each burns. */
const METEOR_GAP = [6, 12] as const;
const METEOR_LIFE = [0.75, 1.1] as const;
/** Seconds of `t` before the first one: long enough that the page has settled. */
const FIRST_METEOR = [3.5, 6] as const;
/** Length of a streak, in viewport heights. */
const METEOR_LENGTH = [0.2, 0.32] as const;

/** Star core widths, as 1 / (2σ²) with σ in CSS px: a star is a pinpoint, a mote is soft. */
const STAR_CORE_K = 1 / (2 * 0.6 ** 2);
const DUST_CORE_K = 1 / (2 * 0.85 ** 2);
/** Dust: the wrapped box's side, how far ahead its centre sits, and the nearest a mote may be. */
const DUST_BOX = 26;
const DUST_AHEAD = 21;
/** Beyond both subjects at every station, so no mote ever crosses the robot or the phone. */
const DUST_CLEAR = 12;

/**
 * Linear peak of the gas, and of the soft light the pointer carries. The gas
 * is judged on the opaque space-colour clear: the top and bottom of the frame
 * read as deep cloud, while the sky between clouds stays the ground's own
 * black and the band behind the copy barely moves.
 */
const NEBULA_GAIN = 0.08;
const GLOW_GAIN = 0.02;
/** Linear peak of the thin ring of light a pulse sends through the gas. */
const RING_GAIN = 0.05;
/** Linear light the lens and a ring add to each star they pass, before the star's own variation. */
const REVEAL = 0.15;

/**
 * The halo: a little behind DUYO and a touch above its middle, so from the
 * hero's camera (off to the robot's left) it lands behind the robot, not
 * beside it towards the copy. 1σ in world units, and its linear peak.
 */
const HALO_AT = new THREE.Vector3(...ROBOT_POS).add(new THREE.Vector3(0.3, 0.4, -2));
const HALO_SIZE = 2.4 * ROBOT_SCALE;
const HALO_GAIN = 0.055;

export interface CosmosOptions {
  /** Seconds of `t` before the first shooting star (the harness uses it to catch one on camera). */
  firstMeteorAt?: number;
}

const between = (r: { next: () => number }, [lo, hi]: readonly [number, number]) => lo + (hi - lo) * r.next();

export function buildCosmos(options: CosmosOptions = {}): Cosmos {
  const u = <T,>(value: T) => ({ value });
  // The shaders can still bend and light stars under a pointer and run a
  // ring from a click (uLens, uWake, uPulse), but nothing drives them: the
  // owner found cursor effects childish, so the sky answers the hand only
  // through the camera's parallax (runtime.ts). At zero they cost nothing
  // visible and a few ALU ops.
  const shared = {
    uTime: u(0), uDpr: u(1), uPointCap: u(511), uViewport: u(new THREE.Vector2(1, 1)),
    uLens: u(new THREE.Vector4()), uWake: u(new THREE.Vector2()),
    uPulse: u(Array.from({ length: PULSES }, () => new THREE.Vector4(0, 0, -1e4, 0))),
  };

  const stars = (kind: Placement, data: StarLayer, extra: Record<string, THREE.IUniform> = {}) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(data.color, 3));
    g.setAttribute('aStar', new THREE.BufferAttribute(data.star, 2));
    const uniforms = { ...shared, uGain: u(1), uTwinkle: u(1), uReveal: u(REVEAL), uCoreK: u(STAR_CORE_K), ...extra };
    return new THREE.Points(g, new THREE.ShaderMaterial({ uniforms, vertexShader: starVertex(kind), fragmentShader: STAR_FRAG, ...ADD_LIGHT }));
  };

  const noise = bakeNoiseVolume();
  const nebula = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: {
      ...shared, uNoise: u(noise), uFront: u(FRONT.clone()), uGain: u(NEBULA_GAIN), uGlowGain: u(GLOW_GAIN),
      uRingGain: u(RING_GAIN), uHaloAt: u(HALO_AT), uHaloSize: u(HALO_SIZE), uHaloGain: u(HALO_GAIN),
      uDeep: u(C.blue.clone()), uViolet: u(C.violet.clone()), uSky: u(C.sky.clone()), uAmber: u(C.amber.clone()),
      uGlow: u(C.sky.clone().lerp(C.blueBright, 0.5)),
    },
    vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG, ...ADD_LIGHT,
  }));

  const dustData = buildDust();
  const dust = stars('dust', dustData, {
    uCoreK: u(DUST_CORE_K), uTwinkle: u(0), uReveal: u(REVEAL * 0.5), uBox: u(DUST_BOX), uAhead: u(DUST_AHEAD), uClear: u(DUST_CLEAR),
  });
  dust.geometry.setAttribute('aVel', new THREE.BufferAttribute(dustData.velocity, 3));

  // The streak's quad: corners as (along, across), built into place by the shader.
  const meteorGeometry = new THREE.BufferGeometry();
  meteorGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  meteorGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  const meteorUniforms = {
    uTime: shared.uTime, uDpr: shared.uDpr, uViewport: shared.uViewport,
    uFrom: u(new THREE.Vector3()), uTo: u(new THREE.Vector3()), uMeteor: u(new THREE.Vector3()),
    uHead: u(C.white.clone().lerp(C.sky, 0.25)), uTail: u(C.sky.clone().lerp(C.blueBright, 0.4)),
  };
  const meteor = new THREE.Mesh(meteorGeometry, new THREE.ShaderMaterial({
    uniforms: meteorUniforms, vertexShader: METEOR_VERT, fragmentShader: METEOR_FRAG, ...ADD_LIGHT,
    side: THREE.DoubleSide, // the quad is wound by the streak's direction on screen, either way round
  }));

  const layers = [nebula, stars('far', buildFarStars()), stars('world', buildWorldStars()), dust, meteor];
  // Named for the harness's bench, which times them apart, and for anyone reading the scene in devtools.
  const names = ['nebula', 'far', 'world', 'dust', 'meteor'];

  // Point sizes and the screen-space lens need the buffer size, the pixel ratio and the GPU's largest point.
  let pointCap = 0;
  const measure: THREE.Object3D['onBeforeRender'] = (renderer) => {
    renderer.getDrawingBufferSize(shared.uViewport.value);
    shared.uDpr.value = renderer.getPixelRatio();
    const gl = renderer.getContext(); // queried once: `||=` skips the call after the first frame
    pointCap ||= shared.uPointCap.value = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] || 64;
  };
  // Drawn first among transparent objects (the group's order outranks its members'), so nothing that
  // writes depth late can hide the sky; the members' own order is free, since light adds in any order.
  const root = Object.assign(new THREE.Group(), { name: 'cosmos', renderOrder: -10 });
  layers.forEach((o, i) => {
    o.name = names[i];
    o.frustumCulled = false; // positions are made in the shaders
    o.renderOrder = i;
    o.onBeforeRender = measure;
    root.add(o);
  });

  // ── Shooting stars: scheduled on `t`, drawn from two directions at infinity ─
  const sky = rng(505);
  let nextMeteor = options.firstMeteorAt ?? between(sky, FIRST_METEOR);
  const [eye, end] = [new THREE.Vector3(), new THREE.Vector3()];
  /** A path in the top or bottom band — clear of the centre and of the copy at mid height — as world directions. */
  const launch = (t: number, camera: THREE.PerspectiveCamera) => {
    const top = sky.next() < 0.72;
    const y0 = top ? 0.72 + 0.2 * sky.next() : -0.6 - 0.08 * sky.next();
    const dy = -(0.04 + 0.1 * sky.next());
    const length = between(sky, METEOR_LENGTH) * (2 / camera.aspect); // viewport heights → NDC x
    const dx = Math.min(1.7, Math.sqrt(Math.max(0, length * length - dy * dy))) * (sky.next() < 0.5 ? -1 : 1);
    // Both ends on screen, with a margin: the start ranges over whatever room the length leaves.
    const lo = Math.max(-0.92, -0.92 - dx);
    const x0 = lo + (Math.min(0.92, 0.92 - dx) - lo) * sky.next();
    eye.setFromMatrixPosition(camera.matrixWorld);
    meteorUniforms.uFrom.value.set(x0, y0, 0.5).unproject(camera).sub(eye).normalize();
    meteorUniforms.uTo.value.copy(end.set(x0 + dx, y0 + dy, 0.5).unproject(camera).sub(eye).normalize());
    meteorUniforms.uMeteor.value.set(t, between(sky, METEOR_LIFE), 0.8 + 0.5 * sky.next());
    nextMeteor = t + between(sky, METEOR_GAP);
  };

  return {
    root,
    update(input: CosmosInput) {
      const { t, dt, camera } = input;
      shared.uTime.value = t;
      // A shooting star is motion: none start under reduced motion (dt 0).
      if (dt > 0 && t >= nextMeteor) launch(t, camera);
    },
    dispose() {
      layers.forEach((o) => (o.geometry.dispose(), o.material.dispose()));
      noise.dispose();
      root.removeFromParent();
    },
  };
}
