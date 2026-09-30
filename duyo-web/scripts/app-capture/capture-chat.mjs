// Section 0 — the AI chat: one question, and DUYO working it on the board.
import { APP, newPage, recordMeta, release, setState, settle, shot, toShot } from './browser.mjs';
import { scrollBy, scrollerOf, textRect } from './dom.mjs';
import { BOARD, CLOCK, QUESTION, at } from './mock-data.mjs';

/**
 * The chalkboard's chalk lines, as a phone draws them.
 *
 * ChalkLine measures each line with an invisible absolutely-positioned copy
 * and then widens a clip to that width. On the phone, Yoga measures that copy
 * at its natural width: an absolute child is only held to its parent's width
 * when the parent is a column (AbsoluteLayout.cpp, `!isMainAxisRow`), and the
 * line is a row. react-native-web instead gives a one-line Text
 * `max-width: 100%` and an ellipsis, so on the web the copy is capped by its
 * parent (0 wide for the answer, which is aligned flex-start — so the answer
 * is never written) and a line a subpixel wider than its clip ends in "...".
 * Lifting that cap inside the board, and nowhere else, gives the native
 * result without touching the app's source.
 */
const BOARD_WEB_FIX = `
  [aria-label^="Doska:"] [dir="auto"] { max-width: none !important; text-overflow: clip !important; }
`;

/** Where the question bubble sits once the child has scrolled back up to it: this far below the list's top. */
const QUESTION_MARGIN = 10;

/** Every chalk line, note and the answer box, as the finished board lays them out. */
async function boardGeometry(page) {
  const lines = [];
  const write = [BOARD.problem, ...BOARD.steps.map((s) => s.expr), BOARD.answer];
  for (const [i, text] of write.entries()) {
    // The clip wrapper around the visible copy: exactly the region the chalk writes.
    const r = await page.evaluate((text) => {
      const board = document.querySelector('[aria-label^="Doska:"]');
      const hits = [...board.querySelectorAll('div, span')].filter((e) =>
        (e.textContent ?? '').trim() === text && getComputedStyle(e).opacity !== '0' && e.children.length === 0);
      const el = hits[hits.length - 1];
      const clip = el.parentElement;
      const rc = clip.getBoundingClientRect();
      return { x: rc.x, y: rc.y, width: rc.width, height: rc.height, size: parseFloat(getComputedStyle(el).fontSize) };
    }, text);
    lines.push({ kind: i === write.length - 1 ? 'answer' : 'line', text, rect: toShot(r), size: r.size });
    const note = i > 0 && i <= BOARD.steps.length ? BOARD.steps[i - 1].note : '';
    if (note) lines.push({ kind: 'note', text: note, rect: toShot(await textRect(page, note)) });
  }
  // The answer's box: its yellow rule fades in with it.
  const box = await page.evaluate((text) => {
    const board = document.querySelector('[aria-label^="Doska:"]');
    // Its text is the line twice over: the invisible measurer and the chalk.
    const el = [...board.querySelectorAll('div')].find((e) =>
      (e.textContent ?? '').includes(text) && getComputedStyle(e).borderTopWidth === '2px');
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, BOARD.answer);
  const slate = await page.evaluate(() => {
    const board = document.querySelector('[aria-label^="Doska:"]');
    const slateEl = [...board.querySelectorAll('div')].find((e) => getComputedStyle(e).backgroundColor === 'rgb(32, 55, 46)');
    const r = slateEl.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  return { lines, answerBox: toShot(box), slate: toShot(slate) };
}

export async function captureChat(context, out) {
  await setState({ holdChat: true, holdBoard: true });
  const page = await newPage(context, { at: at(CLOCK.chat) });
  await page.goto(`${APP}/chat`, { waitUntil: 'load' });
  await page.getByText('Onlayn').waitFor();
  await page.addStyleTag({ content: BOARD_WEB_FIX });
  await settle(page, 1200);
  await shot(page, out('chat', 1));
  recordMeta('chat-1', { clock: CLOCK.chat });

  // The child types and sends. (Not captured while typing: the question runs
  // to three lines, the composer grows and the whole column moves with it —
  // there is no moment between the two states that a wipe could stand for.)
  // The mock holds the reply, so the app sits in exactly the state a slow
  // model turn leaves it in: one tick, three dots.
  const input = page.getByLabel('Chat xabari');
  await input.click();
  await input.pressSequentially(QUESTION, { delay: 15 });
  await page.getByLabel('Yuborish').click();
  await page.waitForTimeout(900);
  await settle(page, 300);
  await shot(page, out('chat', 2));
  const band2 = await scrollerOf(page, QUESTION);
  recordMeta('chat-2', {
    clock: CLOCK.chat,
    band: toShot(band2),
    anchor: toShot(await textRect(page, QUESTION, { bubble: true })),
  });

  // The reply lands, the board opens and DUYO writes the whole working.
  await release('chat');
  await page.getByText('diskriminant orqali', { exact: false }).first().waitFor();
  await page.waitForTimeout(700);
  await release('board');
  await page.getByText('KVADRAT TENGLAMA', { exact: false }).first().waitFor().catch(() => {});
  await page.waitForTimeout(10500);
  await settle(page, 400);

  // Finished, the list at its newest end: the answer above the composer.
  await shot(page, out('chat', 4));
  const band4 = await scrollerOf(page, QUESTION);
  recordMeta('chat-4', {
    clock: CLOCK.chat,
    band: toShot(band4),
    anchor: toShot(await textRect(page, QUESTION, { bubble: true })),
    board: await boardGeometry(page),
  });

  // The same finished board with the list scrolled back up until the whole
  // question shows — the view the hero rests on while the board is written.
  const q = await textRect(page, QUESTION, { bubble: true });
  const want = band4.y + QUESTION_MARGIN - q.y;
  await scrollBy(page, QUESTION, want);
  let moved = (await textRect(page, QUESTION, { bubble: true })).y - q.y;
  if (Math.sign(moved) !== Math.sign(want)) {
    await scrollBy(page, QUESTION, -2 * want); // an inverted list scrolls the other way
    moved = (await textRect(page, QUESTION, { bubble: true })).y - q.y;
  }
  process.stdout.write(`[chat] scrolled up ${moved.toFixed(1)} of ${want.toFixed(1)} css px\n`);
  await settle(page, 500);
  await shot(page, out('chat', 3));
  recordMeta('chat-3', {
    clock: CLOCK.chat,
    band: toShot(await scrollerOf(page, QUESTION)),
    anchor: toShot(await textRect(page, QUESTION, { bubble: true })),
  });
  await page.close();
  await setState({ holdChat: false, holdBoard: false });
}
