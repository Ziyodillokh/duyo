/**
 * DUYO, built from primitives — every vertex authored here.
 *
 * Why not an image: the mascot that shipped before was an AI-generated
 * photoreal render and Google Play rejected the store listing under the
 * Impersonation policy for third-party assets. A character built in a file
 * with git history behind it is one whose authorship can be shown. It is also
 * the only way the page's scroll works — a flat image cannot come apart into
 * a head, a body and a pair of limbs.
 *
 * The first version used MeshStandardMaterial and read as matte toy plastic.
 * Everything here is MeshPhysicalMaterial with a clearcoat now: a second
 * specular lobe over the diffuse, which is literally what moulded plastic has
 * and what the eye reads as "manufactured" rather than "modelled". Paired
 * with the studio environment in stage.ts, the shell finally reflects
 * something.
 *
 * Detail is where a primitive build gives itself away, so the parts that
 * would be bare get a seam, a bezel, a joint — the things a real moulding
 * would need and a box does not have.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const SHELL = 0x2f7bf6; //     helmet, chest plate, cuffs — DUYO blue
const SHELL_DEEP = 0x1b4fd0; // bezel and joints, the blue in shadow
const WHITE = 0xf4f7fd; //      body plastic
const VISOR = 0x090f20; //      the face screen
const EYE = 0x9fd0ff; //        lit glass
const AMBER = 0xffc700; //      brand yellow, sparingly
const VIOLET = 0x8b5cf6; //     the third node on the chest mark

export interface Robot {
  root: THREE.Group;
  head: THREE.Group;
  body: THREE.Group;
  arms: THREE.Group;
  legs: THREE.Group;
  /** Pivots at its base on the crown, so it can trail the head's turn. */
  antenna: THREE.Group;
  eyes: THREE.Mesh[];
  dispose: () => void;
}

/**
 * Moulded plastic: a diffuse base under a clear lacquer. The clearcoat is the
 * whole difference — without it a glossy surface has one specular lobe and
 * reads as painted metal or as nothing at all.
 */
function plastic(color: number, roughness = 0.4) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
  });
}

export function buildRobot(): Robot {
  const bin: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => (bin.push(x), x);

  const mShell = keep(plastic(SHELL, 0.32));
  const mDeep = keep(plastic(SHELL_DEEP, 0.3));
  const mWhite = keep(plastic(WHITE, 0.42));
  const mAmber = keep(plastic(AMBER, 0.3));
  const mViolet = keep(plastic(VIOLET, 0.34));
  const mVisor = keep(
    new THREE.MeshPhysicalMaterial({
      color: VISOR,
      roughness: 0.04, // the one mirror on the model
      metalness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    }),
  );
  const mEye = keep(
    new THREE.MeshPhysicalMaterial({
      color: EYE,
      emissive: new THREE.Color(EYE),
      emissiveIntensity: 0.55,
      roughness: 0.12,
      clearcoat: 1,
    }),
  );

  /** Everything casts and receives — self-shadowing is most of the depth. */
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = true;
    o.receiveShadow = true;
    return o;
  };

  const root = new THREE.Group();

  // ── Head ───────────────────────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.y = 1.32;

  const skull = mesh(keep(new RoundedBoxGeometry(2.04, 1.92, 1.8, 7, 0.5)), mShell);
  head.add(skull);

  // Seam around the crown. A moulded shell is two halves; the parting line is
  // the cheapest detail that says "made" rather than "drawn".
  const seam = mesh(keep(new THREE.TorusGeometry(0.78, 0.022, 10, 48)), mDeep);
  seam.position.y = 0.68;
  seam.rotation.x = Math.PI / 2;
  seam.scale.set(1.24, 1.0, 1.1);
  head.add(seam);

  // Bezel behind the glass, so the visor is set INTO the face instead of
  // stuck onto it.
  const bezel = mesh(keep(new RoundedBoxGeometry(1.5, 1.02, 0.16, 5, 0.28)), mDeep);
  bezel.position.set(0, -0.06, 0.8);
  head.add(bezel);

  const visor = mesh(keep(new RoundedBoxGeometry(1.44, 0.96, 0.2, 6, 0.26)), mVisor);
  visor.position.set(0, -0.06, 0.88);
  head.add(visor);

  const eyes: THREE.Mesh[] = [];
  const eyeGeo = keep(new THREE.SphereGeometry(0.2, 28, 22));
  const ringGeo = keep(new THREE.TorusGeometry(0.21, 0.022, 10, 30));
  for (const sx of [-1, 1]) {
    const eye = mesh(eyeGeo, mEye);
    eye.position.set(sx * 0.33, -0.02, 0.97);
    eye.scale.z = 0.5;
    eye.castShadow = false; // a lit lens casting a shadow reads as a bug
    eye.userData.baseX = eye.position.x;
    eye.userData.baseY = eye.position.y;
    head.add(eye);
    eyes.push(eye);

    const iris = mesh(ringGeo, mDeep);
    iris.position.set(sx * 0.33, -0.02, 0.985);
    iris.castShadow = false;
    head.add(iris);
  }

  // Ear pods — the detail that stops the head being a plain box in profile.
  const podGeo = keep(new THREE.CylinderGeometry(0.31, 0.31, 0.24, 28));
  const podRing = keep(new THREE.TorusGeometry(0.31, 0.062, 12, 32));
  for (const sx of [-1, 1]) {
    const pod = mesh(podGeo, mWhite);
    pod.position.set(sx * 1.02, -0.08, 0);
    pod.rotation.z = Math.PI / 2;
    head.add(pod);

    const ring = mesh(podRing, mAmber);
    ring.position.set(sx * 1.13, -0.08, 0);
    ring.rotation.y = Math.PI / 2;
    head.add(ring);
  }

  // Antenna on its own pivot, so a spring can trail it behind the head.
  const antenna = new THREE.Group();
  antenna.position.set(-0.4, 0.86, 0);
  antenna.rotation.z = 0.2;
  const stalk = mesh(keep(new THREE.CylinderGeometry(0.036, 0.046, 0.62, 12)), mWhite);
  stalk.position.y = 0.31;
  antenna.add(stalk);
  const bead = mesh(keep(new THREE.SphereGeometry(0.15, 24, 18)), mAmber);
  bead.position.y = 0.66;
  antenna.add(bead);
  head.add(antenna);

  // Nape vent — what the back of the head is, now that it can be turned to.
  const ventGeo = keep(new RoundedBoxGeometry(0.86, 0.34, 0.08, 4, 0.08));
  const vent = mesh(ventGeo, mDeep);
  vent.position.set(0, -0.1, -0.88);
  head.add(vent);
  const ribGeo = keep(new RoundedBoxGeometry(0.72, 0.045, 0.06, 3, 0.02));
  for (let i = 0; i < 3; i++) {
    const rib = mesh(ribGeo, mShell);
    rib.position.set(0, -0.02 - i * 0.08, -0.92);
    head.add(rib);
  }

  root.add(head);

  // ── Body ───────────────────────────────────────────────────────────────
  const body = new THREE.Group();
  body.position.y = -0.18;

  const torso = mesh(keep(new RoundedBoxGeometry(1.74, 1.68, 1.32, 7, 0.44)), mWhite);
  body.add(torso);

  // Neck: a collar ring over a short column, so the head meets the body at a
  // joint instead of an intersection.
  const collar = mesh(keep(new THREE.CylinderGeometry(0.42, 0.46, 0.16, 26)), mDeep);
  collar.position.y = 0.86;
  body.add(collar);
  const neck = mesh(keep(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 22)), mShell);
  neck.position.y = 0.96;
  body.add(neck);

  // Chest badge carrying the logo's node mark.
  const plate = mesh(keep(new RoundedBoxGeometry(0.92, 0.78, 0.13, 5, 0.2)), mShell);
  plate.position.set(0, 0.08, 0.63);
  body.add(plate);

  const nodeGeo = keep(new THREE.SphereGeometry(0.072, 18, 14));
  const hubGeo = keep(new THREE.SphereGeometry(0.088, 18, 14));
  const linkGeo = keep(new THREE.CylinderGeometry(0.02, 0.02, 1, 8));
  const hub = new THREE.Vector3(0, 0.06, 0.715);
  const spokes: [THREE.Vector3, THREE.Material][] = [
    [new THREE.Vector3(-0.21, 0.25, 0.715), mEye],
    [new THREE.Vector3(0.23, 0.13, 0.715), mViolet],
    [new THREE.Vector3(-0.1, -0.19, 0.715), mDeep],
  ];
  for (const [pos, mat] of spokes) {
    const node = mesh(nodeGeo, mat);
    node.position.copy(pos);
    body.add(node);

    // A scaled, aimed cylinder — a Line would be one pixel wide at any size.
    const link = mesh(linkGeo, mWhite);
    link.position.copy(hub.clone().add(pos).multiplyScalar(0.5));
    link.scale.y = hub.distanceTo(pos);
    link.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      pos.clone().sub(hub).normalize(),
    );
    body.add(link);
  }
  const hubMesh = mesh(hubGeo, mAmber);
  hubMesh.position.copy(hub);
  body.add(hubMesh);

  // Back plate, so the torso is not a blank slab from behind.
  const backGeo = keep(new RoundedBoxGeometry(1.0, 0.86, 0.1, 5, 0.18));
  const back = mesh(backGeo, mDeep);
  back.position.set(0, 0.06, -0.64);
  body.add(back);

  root.add(body);

  // ── Arms ───────────────────────────────────────────────────────────────
  const arms = new THREE.Group();
  const shoulderGeo = keep(new THREE.SphereGeometry(0.28, 22, 18));
  const upperGeo = keep(new THREE.CapsuleGeometry(0.2, 0.5, 8, 20));
  const cuffGeo = keep(new THREE.CylinderGeometry(0.23, 0.23, 0.16, 22));
  const handGeo = keep(new THREE.SphereGeometry(0.25, 22, 18));

  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.88, 0.46, 0);
    arm.rotation.z = sx * 0.2;

    // A ball where the arm meets the torso, so there is a joint and not a gap.
    const shoulder = mesh(shoulderGeo, mShell);
    arm.add(shoulder);

    const upper = mesh(upperGeo, mWhite);
    upper.position.y = -0.42;
    arm.add(upper);

    const cuff = mesh(cuffGeo, mShell);
    cuff.position.y = -0.79;
    arm.add(cuff);

    const hand = mesh(handGeo, mShell);
    hand.position.y = -1.0;
    hand.scale.set(1, 0.86, 0.92);
    arm.add(hand);

    arms.add(arm);
  }
  root.add(arms);

  // ── Legs ───────────────────────────────────────────────────────────────
  const legs = new THREE.Group();
  const hipGeo = keep(new THREE.SphereGeometry(0.25, 20, 16));
  const shinGeo = keep(new THREE.CapsuleGeometry(0.24, 0.32, 8, 20));
  const footGeo = keep(new RoundedBoxGeometry(0.6, 0.27, 0.8, 5, 0.12));

  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.42, -1.02, 0);

    const hip = mesh(hipGeo, mShell);
    leg.add(hip);

    const shin = mesh(shinGeo, mWhite);
    shin.position.y = -0.24;
    leg.add(shin);

    const foot = mesh(footGeo, mAmber);
    foot.position.set(0, -0.6, 0.13);
    leg.add(foot);

    legs.add(leg);
  }
  root.add(legs);

  const dispose = () => {
    for (const d of bin) d.dispose();
  };

  return { root, head, body, arms, legs, antenna, eyes, dispose };
}
