/**
 * DUYO, built from primitives.
 *
 * Every vertex here is authored in this file. That is the point: the mascot
 * that shipped before was an AI-generated photoreal render, and Google Play
 * rejected the store listing under the Impersonation policy in September 2026
 * for third-party assets. A character assembled from rounded boxes and
 * capsules in a file with git history behind it is one whose authorship can be
 * shown rather than argued.
 *
 * It is also what makes the scroll work. The page builds DUYO a piece at a
 * time — head, then body, then limbs — and a flat image cannot come apart.
 * Each part is its own Group with its own pivot, so a section can fade one in
 * without touching the others.
 *
 * Deliberately NOT photoreal. Soft plastic, flat colour, one dark visor and
 * two lit eyes; the charm is in proportion and motion, not in surface detail.
 * A code-built character that reaches for realism lands in the uncanny valley
 * and looks worse than one that never tried.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Brand palette — the same hexes the app and the site already use. */
const SHELL = 0x2f7bf6; //  helmet / chest plate, DUYO blue
const SHELL_DEEP = 0x1d4ed8; // the blue in shadow-facing trim
const WHITE = 0xf6f8fd; //  body plastic, warm enough not to grey out on paper
const VISOR = 0x0b1326; //  the face screen
const EYE = 0x9fd0ff; //    lit glass — deep enough to survive its own emission
const AMBER = 0xffc700; //  brand yellow, used sparingly
const VIOLET = 0x8b5cf6; // the third node on the chest mark

export interface Robot {
  root: THREE.Group;
  /** Pivots at the neck, so it can look around without moving the body. */
  head: THREE.Group;
  body: THREE.Group;
  arms: THREE.Group;
  legs: THREE.Group;
  /** Pivots at its base on the crown, so it can trail the head's turn. */
  antenna: THREE.Group;
  /** The two lit discs, kept for blinking and for reacting to the pointer. */
  eyes: THREE.Mesh[];
  dispose: () => void;
}

/** Soft plastic. Low metalness, mid roughness — reads as a toy, not a phone. */
function plastic(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.04,
    ...opts,
  });
}

export function buildRobot(): Robot {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const matShell = track(plastic(SHELL));
  const matShellDeep = track(plastic(SHELL_DEEP, { roughness: 0.38 }));
  const matWhite = track(plastic(WHITE, { roughness: 0.46 }));
  const matAmber = track(plastic(AMBER, { roughness: 0.34 }));
  const matVisor = track(
    new THREE.MeshStandardMaterial({
      color: VISOR,
      roughness: 0.14, // the one glossy surface, so it catches the rim light
      metalness: 0.1,
    }),
  );
  const matEye = track(
    new THREE.MeshStandardMaterial({
      color: EYE,
      emissive: new THREE.Color(EYE),
      // Lit from inside: on a pale page an unlit eye disappears into the visor.
      emissiveIntensity: 0.5,
      roughness: 0.3,
    }),
  );
  const matViolet = track(plastic(VIOLET));

  const root = new THREE.Group();

  // ── Head ───────────────────────────────────────────────────────────────
  // Wider than tall and deeper than wide: the proportion that reads as a
  // friendly helmet rather than a monitor on a stick.
  const head = new THREE.Group();
  head.position.y = 1.32;

  const skullGeo = track(new RoundedBoxGeometry(2.04, 1.92, 1.8, 6, 0.5));
  const skull = new THREE.Mesh(skullGeo, matShell);
  head.add(skull);

  // The visor sits proud of the face and slightly wider than the opening, so
  // its edge catches light instead of reading as a hole cut in the head.
  const visorGeo = track(new RoundedBoxGeometry(1.46, 0.98, 0.22, 5, 0.28));
  const visor = new THREE.Mesh(visorGeo, matVisor);
  visor.position.set(0, -0.06, 0.86);
  head.add(visor);

  const eyes: THREE.Mesh[] = [];
  const eyeGeo = track(new THREE.SphereGeometry(0.2, 24, 20));
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, matEye);
    eye.position.set(sx * 0.33, -0.02, 0.96);
    eye.scale.z = 0.55; // flattened onto the visor, not a ball stuck to it
    eye.userData.baseX = eye.position.x;
    eye.userData.baseY = eye.position.y;
    head.add(eye);
    eyes.push(eye);
  }

  // Ear pods. Two amber rings on the sides — the detail that stops the head
  // being a plain box from every angle except the front.
  const podGeo = track(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 24));
  const ringGeo = track(new THREE.TorusGeometry(0.3, 0.06, 12, 28));
  for (const sx of [-1, 1]) {
    const pod = new THREE.Mesh(podGeo, matWhite);
    pod.position.set(sx * 1.02, -0.08, 0);
    pod.rotation.z = Math.PI / 2;
    head.add(pod);

    const ring = new THREE.Mesh(ringGeo, matAmber);
    ring.position.set(sx * 1.13, -0.08, 0);
    ring.rotation.y = Math.PI / 2;
    head.add(ring);
  }

  // Antenna with an amber bead — the silhouette's one asymmetric flourish.
  const antenna = new THREE.Group();
  antenna.position.set(-0.4, 0.86, 0); // the base, on the crown
  antenna.rotation.z = 0.2;

  const stalkGeo = track(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 10));
  const stalk = new THREE.Mesh(stalkGeo, matWhite);
  stalk.position.y = 0.31; // half its length, so the Group pivots at the base
  antenna.add(stalk);

  const beadGeo = track(new THREE.SphereGeometry(0.15, 20, 16));
  const bead = new THREE.Mesh(beadGeo, matAmber);
  bead.position.y = 0.66;
  antenna.add(bead);

  head.add(antenna);

  root.add(head);

  // ── Body ───────────────────────────────────────────────────────────────
  const body = new THREE.Group();
  body.position.y = -0.18;

  const torsoGeo = track(new RoundedBoxGeometry(1.72, 1.66, 1.3, 6, 0.44));
  const torso = new THREE.Mesh(torsoGeo, matWhite);
  body.add(torso);

  // Chest plate in DUYO blue, carrying the logo's node mark.
  const plateGeo = track(new RoundedBoxGeometry(0.9, 0.76, 0.14, 5, 0.2));
  const plate = new THREE.Mesh(plateGeo, matShell);
  plate.position.set(0, 0.08, 0.62);
  body.add(plate);

  const nodeGeo = track(new THREE.SphereGeometry(0.07, 16, 14));
  const hubGeo = track(new THREE.SphereGeometry(0.085, 16, 14));
  const linkGeo = track(new THREE.CylinderGeometry(0.022, 0.022, 1, 8));
  const hub = new THREE.Vector3(0, 0.06, 0.71);
  const spokes: [THREE.Vector3, THREE.Material][] = [
    [new THREE.Vector3(-0.21, 0.25, 0.71), matEye],
    [new THREE.Vector3(0.23, 0.13, 0.71), matViolet],
    [new THREE.Vector3(-0.1, -0.19, 0.71), matShellDeep],
  ];
  for (const [pos, mat] of spokes) {
    const node = new THREE.Mesh(nodeGeo, mat);
    node.position.copy(pos);
    body.add(node);

    // One cylinder per link, scaled and aimed between hub and node — cheaper
    // and crisper than a line, which would be a single pixel wide at any size.
    const link = new THREE.Mesh(linkGeo, matWhite);
    const mid = hub.clone().add(pos).multiplyScalar(0.5);
    link.position.copy(mid);
    link.scale.y = hub.distanceTo(pos);
    link.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      pos.clone().sub(hub).normalize(),
    );
    body.add(link);
  }
  const hubMesh = new THREE.Mesh(hubGeo, matAmber);
  hubMesh.position.copy(hub);
  body.add(hubMesh);

  // Neck — short, so the head reads as sitting ON the body, not floating.
  const neckGeo = track(new THREE.CylinderGeometry(0.34, 0.4, 0.3, 20));
  const neck = new THREE.Mesh(neckGeo, matShellDeep);
  neck.position.y = 0.92;
  body.add(neck);

  root.add(body);

  // ── Arms ───────────────────────────────────────────────────────────────
  // Each arm pivots at the shoulder, so a wave is a rotation and not a
  // re-positioning of every piece in it.
  const arms = new THREE.Group();
  const upperGeo = track(new THREE.CapsuleGeometry(0.2, 0.52, 6, 16));
  const cuffGeo = track(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 18));
  const handGeo = track(new THREE.SphereGeometry(0.25, 20, 16));

  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.98, 0.42, 0);
    // Resting slightly away from the body; arms flat against the torso read
    // as a figure standing to attention.
    arm.rotation.z = sx * 0.22;

    const upper = new THREE.Mesh(upperGeo, matWhite);
    upper.position.y = -0.4;
    arm.add(upper);

    const cuff = new THREE.Mesh(cuffGeo, matShell);
    cuff.position.y = -0.78;
    arm.add(cuff);

    const hand = new THREE.Mesh(handGeo, matShell);
    hand.position.y = -0.98;
    hand.scale.set(1, 0.86, 0.92);
    arm.add(hand);

    arm.name = sx < 0 ? 'armLeft' : 'armRight';
    arms.add(arm);
  }
  root.add(arms);

  // ── Legs ───────────────────────────────────────────────────────────────
  const legs = new THREE.Group();
  const shinGeo = track(new THREE.CapsuleGeometry(0.24, 0.34, 6, 16));
  const footGeo = track(new RoundedBoxGeometry(0.58, 0.26, 0.76, 4, 0.12));

  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.42, -1.04, 0);

    const shin = new THREE.Mesh(shinGeo, matWhite);
    shin.position.y = -0.2;
    leg.add(shin);

    const foot = new THREE.Mesh(footGeo, matAmber);
    foot.position.set(0, -0.58, 0.12);
    leg.add(foot);

    leg.name = sx < 0 ? 'legLeft' : 'legRight';
    legs.add(leg);
  }
  root.add(legs);

  const dispose = () => {
    for (const d of disposables) d.dispose();
  };

  return { root, head, body, arms, legs, antenna, eyes, dispose };
}

/** Where the feet land, so the contact shadow can sit on the floor. */
export const ROBOT_FLOOR_Y = -1.9;
