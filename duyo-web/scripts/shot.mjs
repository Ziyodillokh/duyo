/**
 * Screenshot a page in real Chrome with WebGL (SwiftShader), so a module can
 * be LOOKED at, not just type-checked.
 *
 *   node scripts/shot.mjs <url> <out.png> [width=1440] [height=900] [waitMs=2500] [scrollFraction]
 *
 * Prints console errors and failed requests, so a blank render has a reason.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const [url, out, w = '1440', h = '900', wait = '2500', frac] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/shot.mjs <url> <out.png> [w] [h] [waitMs] [scrollFraction]');
  process.exit(2);
}
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()));
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => problems.push('failed: ' + r.url()));
await page.goto(url, { waitUntil: 'load' });
if (frac !== undefined) {
  await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), +frac);
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
await browser.close();
console.log(problems.length ? problems.join('\n') : 'ok — no console errors');
