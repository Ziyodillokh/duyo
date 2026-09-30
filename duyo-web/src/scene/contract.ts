/**
 * The contract every scene module is built against.
 *
 * The site is assembled from independently built pieces — the phone's screen
 * UI, the phone model, the galaxy, the robot — and they only compose if they
 * agree on three things: world units, colours, and the shape of the data that
 * flows into them each frame. This file is those three things and nothing
 * else. No module may redefine a colour or a dimension that lives here.
 *
 * WORLD UNITS. One unit is roughly one "phone-width / 1.5". The robot in
 * three/robot.ts stands ~4.7 units tall at scale 1. The phone is 3.2 tall.
 * The galaxy spans ~60 units across, so the camera can fly through it.
 */

import type * as THREE from 'three';

/** Brand colours. Hex strings for canvas, numbers derived where 3D needs them. */
export const PALETTE = {
  paper: '#f0f0ee', //      the light page ground
  space: '#03050b', //      the ground every section stands on: as near black as the stars allow
  navy: '#102033', //       body text on light
  blue: '#2563eb', //       DUYO blue — primary actions
  blueBright: '#3b82f6', // highlights on dark
  sky: '#9fd0ff', //        the robot's eye glass, soft glows
  violet: '#8b5cf6', //     the second brand hue
  amber: '#ffc700', //      brand yellow — used sparingly, as an accent
  white: '#f4f7fd', //      the robot's body plastic
  danger: '#ef4444', //     a blocked message, and nothing else
} as const;

/** Convert a PALETTE hex string to a three.js colour number. */
export const hex = (s: string): number => parseInt(s.slice(1), 16);

// ─────────────────────────────────────────────────────────────────────────
// Phone screen — a canvas the phone model wears as its display texture.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The app screens the phone shows, one per section: the AI chat, a peer
 * group where a message is stopped, the brain map, goals, and the home
 * screen with DUYO on it for the download section.
 */
export type ScreenId = 'chat' | 'safety' | 'map' | 'goals' | 'home';

/**
 * Everything the screen needs to draw one frame.
 *
 * Two screens can be on the display at once during a transition: `from` is
 * drawn, then `to` over it at opacity `mix`. Each has its OWN local progress,
 * because the page scrubs a screen's animation with the scroll — a message
 * types in as you scroll into the section, not on a timer.
 */
export interface ScreenState {
  from: ScreenId;
  to: ScreenId;
  /** 0 = only `from` visible, 1 = only `to`. */
  mix: number;
  /** Scroll-scrubbed progress of `from`'s own animation, 0..1. */
  pFrom: number;
  /** Scroll-scrubbed progress of `to`'s own animation, 0..1. */
  pTo: number;
  /**
   * Seconds since start, for idle life only — a caret blinking, a pulse.
   * Already multiplied by 0 upstream when the visitor asked for reduced
   * motion, so modules must not read the clock themselves.
   */
  t: number;
}

/** The screen canvas resolution. Matches the phone's display aspect. */
export const SCREEN_PX = { width: 720, height: 1540 } as const;

export interface PhoneScreen {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  /**
   * Draw a frame. Must be cheap to call every animation frame — skip the
   * repaint when nothing visible changed since the last call.
   */
  draw(state: ScreenState): void;
  dispose(): void;
}

// ─────────────────────────────────────────────────────────────────────────
// Phone model
// ─────────────────────────────────────────────────────────────────────────

/** Outer body dimensions in world units, and the display's inset from the edge. */
export const PHONE_DIMS = {
  width: 1.56,
  height: 3.2,
  depth: 0.17,
  radius: 0.24,
  /** Bezel width between body edge and the lit display. */
  screenInset: 0.055,
} as const;

export interface Phone {
  /** Origin at the phone's centre; the display faces +Z. */
  readonly root: THREE.Group;
  /** The lit display mesh, for anything that needs to know where it is. */
  readonly screen: THREE.Mesh;
  dispose(): void;
}

// ─────────────────────────────────────────────────────────────────────────
// Galaxy
// ─────────────────────────────────────────────────────────────────────────

export interface GalaxyInput {
  /** Seconds since start; already 0-scaled for reduced motion upstream. */
  t: number;
  /**
   * 0..1. Knowledge nodes start on the phone's display and stream out to
   * their places in the galaxy — the moment the brain map on the screen
   * becomes the world around it.
   */
  emergence: number;
  /** 0 = on the paper page (galaxy barely there), 1 = deep space (fully lit). */
  darkness: number;
  /** World position of the phone display's centre: where emergence begins. */
  origin: THREE.Vector3;
}

export interface Galaxy {
  /** Centred on the world origin; the camera flies through it. */
  readonly root: THREE.Group;
  update(input: GalaxyInput): void;
  dispose(): void;
}

// ─────────────────────────────────────────────────────────────────────────
// Cosmos — the living space every section happens in
// ─────────────────────────────────────────────────────────────────────────

export interface CosmosInput {
  /** Seconds of idle life; stands still (never runs back) under reduced motion. */
  t: number;
  /** Seconds since the last frame, already clamped; 0 while motion is off. */
  dt: number;
  /** The camera the frame is drawn with: far layers stay centred on it. */
  camera: THREE.PerspectiveCamera;
}

export interface Cosmos {
  /** Add to the scene once; the module positions its own layers. */
  readonly root: THREE.Group;
  update(input: CosmosInput): void;
  dispose(): void;
}
