// Local stand-in for https://api.duyo.uz/v1 while capturing the app's screens.
// Production must receive nothing, so the app is bundled with
// EXPO_PUBLIC_API_BASE_URL pointing here, and every request is logged so the
// capture can prove where traffic went.
//
// Scenario switches (brain level, goal progress, holds) are set by the capture
// script through POST /__state, which only this machine can reach.

import { appendFileSync } from 'node:fs';
import http from 'node:http';

import { buildGraph, extractTags, tagsByUse } from './graph.mjs';
import * as D from './mock-data.mjs';

const PORT = Number(process.env.MOCK_PORT ?? 9911);
const LOG = new URL('./mock-requests.log', import.meta.url).pathname;
// Appended, never truncated: the log is the record of every run, not only the last.
appendFileSync(LOG, `${JSON.stringify({ t: new Date().toISOString(), run: 'mock started' })}\n`);

const state = { brain: 1, goalAt: 10, holdChat: false, holdBoard: false, refuseGroup: false };
const held = { chat: [], board: [] };

const log = (entry) => appendFileSync(LOG, `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`);

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : null); } catch { resolve(raw); }
    });
  });

function chatReply() {
  return {
    conversation_id: 'd1c0ffee-0000-4000-8000-000000000001',
    message_id: 'd1c0ffee-0000-4000-8000-000000000101',
    reply: D.CHAT_REPLY,
    crisis_level: 'GREEN',
    model: 'mock',
    latency_ms: 900,
    source: null,
    quick_replies: [],
    memory_candidate: null,
  };
}

/** api/v1/note.py::list_notes: optionally one #tag, in one of its three orders. */
function listNotes(query) {
  const tag = (query.get('tag') ?? '').replace(/^#/, '').toLowerCase();
  const sort = query.get('sort') ?? 'updated';
  const order = {
    updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
    created: (a, b) => b.created_at.localeCompare(a.created_at),
    title: (a, b) => a.title.localeCompare(b.title),
  }[sort] ?? (() => 0);
  return D.brainNotes(state.brain)
    .filter((n) => !tag || extractTags(n.body).includes(tag))
    .sort(order)
    .map(({ id, title, updated_at }) => ({ id, title, updated_at }));
}

/** Route table: [method, regex on the path after /v1, handler]. */
const C = D.CHILD_ID;
const ROUTES = [
  ['GET', /^\/chat\/children$/, () => [D.CHILD]],
  ['GET', /^\/subscriptions\/plans$/, () => D.PLANS],
  ['GET', /^\/subscriptions\/current$/, () => D.SUBSCRIPTION],
  ['GET', /^\/gamification\/[^/]+\/balls$/, () => D.BALLS],
  ['GET', /^\/gamification\/[^/]+\/achievements$/, () => D.ACHIEVEMENTS],
  ['GET', /^\/gamification\/[^/]+\/streak$/, () => D.STREAK],
  ['POST', /^\/gamification\/[^/]+\/streak\/checkin$/, () => D.STREAK],
  ['GET', /^\/tamagochi\/[^/]+$/, () => D.TAMAGOCHI],
  ['GET', /^\/notifications\/unread-count$/, () => ({ count: 0 })],
  ['GET', /^\/notifications$/, () => []],
  ['GET', /^\/puzzles\/next$/, () => null],
  ['GET', /^\/children\/[^/]+\/conversations$/, () => []],
  ['GET', /^\/children\/[^/]+\/projects$/, () => []],
  ['GET', /^\/children\/[^/]+\/goals$/, () => [D.goal(state.goalAt)]],
  ['GET', /^\/children\/[^/]+\/goal-signal$/, () => D.GOAL_SIGNAL],
  ['GET', /^\/goals\/catalog$/, () => []],
  ['GET', /^\/social\/[^/]+\/settings$/, () => D.SOCIAL_SETTINGS],
  ['GET', /^\/social\/[^/]+\/goal-mates$/, () => D.GOAL_MATES],
  ['GET', /^\/social\/[^/]+\/handle-suggestions$/, () => D.HANDLE_SUGGESTIONS],
  ['GET', /^\/social\/[^/]+\/friends$/, () => []],
  ['GET', /^\/social\/[^/]+\/groups$/, () => D.GROUPS],
  ['GET', /^\/social\/[^/]+\/groups\/[^/]+\/members$/, () => D.GROUP_MEMBERS],
  ['GET', /^\/social\/[^/]+\/groups\/[^/]+\/messages$/, () => D.GROUP_MESSAGES],
  ['GET', /^\/notes\/graph$/, () => buildGraph(D.brainNotes(state.brain))],
  ['GET', /^\/notes\/tags$/, () => tagsByUse(D.brainNotes(state.brain))],
  ['GET', /^\/notes$/, (_path, _body, query) => listNotes(query)],
];

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return send(res, 204);

  if (url.pathname === '/__state' && req.method === 'POST') {
    Object.assign(state, (await readBody(req)) ?? {});
    return send(res, 200, state);
  }
  if (url.pathname === '/__release' && req.method === 'POST') {
    const which = url.searchParams.get('what');
    const queue = held[which] ?? [];
    held[which] = [];
    queue.forEach((fn) => fn());
    return send(res, 200, { released: queue.length });
  }

  const path = url.pathname.replace(/^\/v1/, '');
  const body = req.method === 'GET' ? null : await readBody(req);
  const entry = { method: req.method, path, query: url.search, origin: req.headers.origin ?? null };

  if (req.method === 'POST' && path === '/chat') {
    log({ ...entry, status: 200, body });
    if (state.holdChat) return held.chat.push(() => send(res, 200, chatReply()));
    return send(res, 200, chatReply());
  }
  if (req.method === 'POST' && path === '/chat/board') {
    log({ ...entry, status: 200, body });
    if (state.holdBoard) return held.board.push(() => send(res, 200, D.BOARD));
    return send(res, 200, D.BOARD);
  }
  if (req.method === 'POST' && /^\/social\/[^/]+\/groups\/[^/]+\/messages$/.test(path)) {
    // The backend's screen_peer_message would stop this draft as contact_info
    // and answer 422 with the refusal text; the mock gives the same answer.
    log({ ...entry, status: 422, body });
    return send(res, 422, { detail: D.CONTACT_REFUSAL });
  }

  const route = ROUTES.find(([m, re]) => m === req.method && re.test(path));
  if (!route) {
    log({ ...entry, status: 404, unmocked: true, body });
    return send(res, 404, { detail: 'not mocked' });
  }
  log({ ...entry, status: 200 });
  return send(res, 200, route[2](path, body, url.searchParams));
}

http
  .createServer((req, res) => {
    handle(req, res).catch((err) => {
      log({ error: String(err) });
      send(res, 500, { detail: 'mock error' });
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    process.stdout.write(`mock api on http://127.0.0.1:${PORT}/v1 (child ${C})\n`);
  });
