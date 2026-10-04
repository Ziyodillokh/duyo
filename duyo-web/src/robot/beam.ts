/**
 * DUYO's projector: a cone of light from the palm of its raised hand to the
 * hologram, and the lens glowing in the palm.
 *
 * Light only. Both add colour and write no depth, so they lie over the
 * cosmos and the galaxy without hiding either, and DUYO's own body (which
 * does write depth) still stands in front of them. The cone is brightest
 * where it faces the eye and fades to nothing at its silhouette, so it
 * reads as lit air, not a solid; slow rays turn in it and motes ride out
 * along it.
 */

import * as THREE from 'three';
import { PALETTE, hex } from '../scene/contract';

/** The cone's radius at the lens and at the hologram, in world units. */
const LENS_RADIUS = 0.07;
const FAR_RADIUS = 2.1;
/** The lens glow's size at full power. */
const LENS_GLOW = 0.75;

const VERT = /* glsl */ `
  varying float vAlong, vAround; varying vec3 vNormal, vView;
  void main() {
    vAlong = uv.y; vAround = uv.x; // 0 at the lens, 1 at the hologram; once round
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz; vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uPower, uTime; uniform vec3 uColor, uCore;
  varying float vAlong, vAround; varying vec3 vNormal, vView;
  void main() {
    float body = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.5);
    // Brightest at the lens, thinning outward; eased in at the lens and out at the far end.
    float fall = pow(1.0 - vAlong, 1.3) * smoothstep(0.0, 0.05, vAlong) * (0.4 + 0.6 * smoothstep(1.0, 0.8, vAlong));
    float rays = 0.62 + 0.38 * sin(vAround * 43.98 + uTime * 0.55) * sin(vAround * 18.85 - uTime * 0.35);
    float motes = 0.45 * smoothstep(0.93, 1.0, sin(vAlong * 46.0 - uTime * 2.6 + sin(vAround * 31.4) * 3.0));
    vec3 c = mix(uColor, uCore, pow(1.0 - vAlong, 3.0));
    gl_FragColor = vec4(c * uPower * body * fall * (rays + motes) * 0.34, 1.0);
    #include <colorspace_fragment>
  }
`;

/** A soft round glow, drawn once: the lens in DUYO's palm. */
function glowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(200,228,255,0.85)');
    g.addColorStop(0.45, 'rgba(96,165,250,0.32)');
    g.addColorStop(1, 'rgba(37,99,235,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface Beam {
  readonly root: THREE.Group;
  /** From the lens to the hologram's centre, in world space; power 0..1. */
  update: (from: THREE.Vector3, to: THREE.Vector3, power: number, t: number) => void;
  dispose: () => void;
}

export function buildBeam(): Beam {
  // Lens at the bottom (y 0), the hologram at the top (y 1): the cone is
  // stretched to the distance each frame and turned to point at it.
  const geometry = new THREE.CylinderGeometry(FAR_RADIUS, LENS_RADIUS, 1, 64, 1, true).translate(0, 0.5, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPower: { value: 0 },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(hex(PALETTE.blueBright)).lerp(new THREE.Color(hex(PALETTE.sky)), 0.5) },
      uCore: { value: new THREE.Color(hex(PALETTE.white)) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const cone = Object.assign(new THREE.Mesh(geometry, material), { name: 'beam', frustumCulled: false });

  const glowMap = glowTexture();
  const lens = Object.assign(
    new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
    { name: 'lens' },
  );

  const root = Object.assign(new THREE.Group(), { name: 'projector' });
  root.add(cone, lens);
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();

  return {
    root,
    update(from, to, power, t) {
      root.visible = power > 0.002;
      if (!root.visible) return;
      dir.subVectors(to, from);
      const reach = dir.length();
      cone.position.copy(from);
      cone.quaternion.setFromUnitVectors(up, dir.divideScalar(Math.max(reach, 1e-6)));
      cone.scale.set(1, reach, 1);
      material.uniforms.uPower.value = power;
      material.uniforms.uTime.value = t;
      lens.position.copy(from);
      const pulse = 1 + 0.06 * Math.sin(t * 3.1);
      lens.scale.setScalar(LENS_GLOW * power * pulse);
      lens.material.opacity = Math.min(1, power * 1.2);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      glowMap.dispose();
      lens.material.dispose();
      root.removeFromParent();
    },
  };
}
