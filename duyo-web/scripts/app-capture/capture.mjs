// Capture the real DUYO app's screens for the site's 3D phone.
// usage: node capture.mjs [chat|safety|map|goals|home ...]
import { mkdirSync } from 'node:fs';

import { openBrowser } from './browser.mjs';
import { captureChat } from './capture-chat.mjs';
import { captureGoals, captureHome } from './capture-goals-home.mjs';
import { captureMap } from './capture-map.mjs';
import { captureSafety } from './capture-safety.mjs';

const RAW = new URL('./raw/', import.meta.url).pathname;
mkdirSync(RAW, { recursive: true });
const out = (screen, n) => `${RAW}${screen}-${n}.png`;

const JOBS = {
  chat: captureChat,
  safety: captureSafety,
  map: captureMap,
  goals: captureGoals,
  home: captureHome,
};
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);

const { browser, context } = await openBrowser();
try {
  for (const name of wanted) {
    process.stdout.write(`== ${name}\n`);
    await JOBS[name](context, out);
  }
} finally {
  await browser.close();
}
