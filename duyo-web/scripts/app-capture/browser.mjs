// Shared browser setup for capturing the DUYO app: a phone-sized page, the
// app's own persisted stores seeded with a demo child, Android's emoji, and a
// hard wall in front of production.

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { CHILD, USER_ID } from './mock-data.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

export const APP = 'http://localhost:8093';
export const SCREEN_W = 360;
/** The phone face below the status bar, gesture area included: 746 dp. */
export const SCREEN_H = 746;
/** Android's status bar, reported as the top inset and cropped off: the site draws its own. */
export const STATUS_BAR = 24;
/**
 * Android's gesture-navigation area, reported as the bottom inset. The app is
 * edge-to-edge, so its ground runs on under it and it lifts its composer and
 * dock clear of it (chat.tsx, bottom-nav.tsx, group-screen.tsx pad by it). It
 * stays in the capture; the site draws the gesture handle over it.
 */
export const NAV_BAR = 16;
export const SCALE = 2;
export const MOCK = 'http://127.0.0.1:9911';
/** The only hosts the page may reach. Everything else is refused and logged. */
const ALLOWED = new Set(['localhost:8093', '127.0.0.1:9911', 'capture.local']);
const GUARD_LOG = new URL('./guard.log', import.meta.url).pathname;
const HOSTS_LOG = new URL('./hosts.log', import.meta.url).pathname;
const FONTS = new URL('./fonts/', import.meta.url).pathname;

/** Zustand's persist envelope, exactly as createJSONStorage writes it. */
const persisted = (state) => JSON.stringify({ state, version: 0 });

const SEED = {
  'duyo-auth': persisted({
    // Fake, unsigned tokens: only the local mock ever sees them.
    tokens: { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' },
    userId: USER_ID,
    isAuthenticated: true,
  }),
  'duyo-child': persisted({ child: CHILD }),
  'duyo-mascot': persisted({ variant: 'duyo' }),
  'duyo-language': persisted({ language: 'uz' }),
  'duyo-chat': persisted({ childId: CHILD.id, conversationId: null, projectId: null }),
};

/** The app's four text families (duyo-mobile/src/lib/fonts.ts). */
const APP_FAMILIES = ['Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'Inter_700Bold'];

/**
 * A DUYO user's phone draws emoji with Noto Color Emoji; Chrome on a Mac
 * would use Apple's. Google Fonts' Noto Color Emoji subsets (fetched once into
 * fonts/) are added as extra faces of each of the app's own families, limited
 * to emoji code points, so an emoji in any text resolves to Noto before the
 * system fallback is ever asked. Plain text is untouched: the subsets' ASCII
 * and punctuation ranges (keycap digits, arrows, ™) are dropped.
 */
function emojiFaces() {
  const css = readFileSync(`${FONTS}noto.css`, 'utf8');
  const faces = [];
  for (const block of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const file = /url\(([^)]+)\)/.exec(block[1])[1].split('/').pop();
    const ranges = /unicode-range:\s*([^;]+);/.exec(block[1])[1]
      .split(',')
      .map((r) => r.trim())
      .filter((r) => {
        const lo = parseInt(r.slice(2).split('-')[0], 16);
        return lo >= 0x2300 || lo === 0x200d || lo === 0x20e3;
      });
    if (!ranges.length) continue;
    for (const family of APP_FAMILIES) {
      faces.push(`@font-face { font-family: '${family}'; font-display: block; ` +
        `src: url(https://capture.local/fonts/${file}) format('woff2'); unicode-range: ${ranges.join(', ')}; }`);
    }
  }
  return faces.join('\n');
}

const refuse = (what) => appendFileSync(GUARD_LOG, `${new Date().toISOString()} BLOCKED ${what}\n`);

export async function openBrowser() {
  writeFileSync(GUARD_LOG, '', { flag: 'a' });
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    args: ['--use-angle=metal', '--window-position=3000,3000'],
  });
  const context = await browser.newContext({
    // The whole phone face: a 24 dp status bar over the 746 dp the site shows.
    viewport: { width: SCREEN_W, height: STATUS_BAR + SCREEN_H },
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    locale: 'uz-UZ',
    timezoneId: 'Asia/Tashkent',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });

  // The wall. The bundle is checked for the mock's address by start.sh; on
  // top of that, no request and no WebSocket may leave for any host but the
  // app, the mock and the local font route — api.duyo.uz included.
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    appendFileSync(HOSTS_LOG, `${url.protocol}//${url.host}\n`);
    if (url.host === 'capture.local') {
      return route.fulfill({ path: `${FONTS}${url.pathname.split('/').pop()}`, contentType: 'font/woff2' });
    }
    if (ALLOWED.has(url.host)) return route.continue();
    refuse(`${route.request().method()} ${url.href}`);
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket(/.*/, (ws) => {
    const url = new URL(ws.url());
    appendFileSync(HOSTS_LOG, `${url.protocol}//${url.host}\n`);
    if (ALLOWED.has(url.host)) return ws.connectToServer();
    refuse(`WS ${ws.url()}`);
    return ws.close({ code: 1008, reason: 'blocked by capture' });
  });

  const faces = emojiFaces();
  await context.addInitScript(({ seed, faces }) => {
    // Seed once per tab: later navigations must see what the app itself wrote.
    if (!sessionStorage.getItem('__seeded')) {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      sessionStorage.setItem('__seeded', '1');
    }
    const style = document.createElement('style');
    style.id = 'capture-emoji';
    style.textContent = faces;
    // Init scripts run before the document has a root element.
    const add = () => document.documentElement.appendChild(style);
    if (document.documentElement) add();
    else {
      new MutationObserver((_, obs) => {
        if (!document.documentElement) return;
        obs.disconnect();
        add();
      }).observe(document, { childList: true });
    }
  }, { seed: SEED, faces });

  return { browser, context };
}

export async function newPage(context, { at = '2026-09-29T16:40:00+05:00' } = {}) {
  const page = await context.newPage();
  // A real Android phone reports its system bars as safe-area insets and the
  // app pads for them. Chrome on a desktop reports 0.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: STATUS_BAR, topMax: STATUS_BAR, left: 0, leftMax: 0, bottom: NAV_BAR, bottomMax: NAV_BAR, right: 0, rightMax: 0 },
  });
  // Date only — timers and animation frames keep running normally.
  await page.clock.setFixedTime(new Date(at));
  page.on('pageerror', (e) => process.stdout.write(`[pageerror] ${e.message}\n`));
  page.on('websocket', (ws) => appendFileSync(HOSTS_LOG, `ws-open ${ws.url()}\n`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      process.stdout.write(`[console.${m.type()}] ${m.text().slice(0, 300)}\n`);
    }
  });
  return page;
}

export async function setState(patch) {
  const r = await fetch(`${MOCK}/__state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return r.json();
}

export async function release(what) {
  const r = await fetch(`${MOCK}/__release?what=${what}`, { method: 'POST' });
  return r.json();
}

/** Fonts (emoji included), images and two quiet frames. */
export async function settle(page, ms = 600) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  { timeout: 15000 }).catch(() => process.stdout.write('[settle] some image did not load\n'));
  await page.waitForTimeout(ms);
}

/** The screen below the status bar, 720 x 1492 at deviceScaleFactor 2. */
export async function shot(page, path) {
  const opts = {
    path,
    clip: { x: 0, y: STATUS_BAR, width: SCREEN_W, height: SCREEN_H },
    animations: 'allow',
    timeout: 15000,
  };
  try {
    await page.screenshot(opts);
  } catch {
    // An off-screen window can miss a compositor frame; waking it is enough.
    process.stdout.write(`[shot] retry ${path}\n`);
    await page.bringToFront();
    await page.waitForTimeout(500);
    await page.screenshot(opts);
  }
}

/**
 * Geometry for the site, in capture px (the shot's own pixels): a CSS-px
 * DOMRect-like {x, y, width, height} → [x, y, w, h] below the status bar.
 */
export const toShot = (r) => [
  Math.round(r.x * SCALE),
  Math.round((r.y - STATUS_BAR) * SCALE),
  Math.round(r.width * SCALE),
  Math.round(r.height * SCALE),
];

/** Every capture's measurements, written beside the raw shots for finish.py. */
const META = new URL('./raw/meta.json', import.meta.url).pathname;
export function recordMeta(name, data) {
  let all = {};
  try {
    all = JSON.parse(readFileSync(META, 'utf8'));
  } catch {
    all = {};
  }
  all[name] = data;
  writeFileSync(META, `${JSON.stringify(all, null, 2)}\n`);
}
