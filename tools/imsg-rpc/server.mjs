#!/usr/bin/env node
/**
 * imsg-rpc — HTTP bridge over `imsg rpc` (openclaw/imsg JSON-RPC over stdio).
 *
 * Why this exists: `imsg` spawned inside the long-lived Vite process hangs
 * (documented in src/lib/cortex-agents/debrief.ts). This daemon owns ONE
 * long-lived `imsg rpc` child, speaks JSON-RPC 2.0 to it, and exposes a small
 * HTTP API so the app (and scripts) never spawn imsg themselves:
 *
 *   GET  /health                      → { ok, version, dbReady }
 *   GET  /chats?limit=20              → chats.list
 *   GET  /history?chat_id=30&limit=20 → messages.history
 *   GET  /search?q=...&limit=20       → messages.search
 *   POST /send  { to|chat_id|chat_guid|chat_identifier, text, service? }
 *   GET  /watch                       → SSE stream of inbound `message`
 *                                      notifications (all chats)
 *
 * Env: IMSCG_RPC_PORT (default 8930), IMSCG_RPC_BIN (default
 * /opt/homebrew/bin/imsg), IMSCG_RPC_DB (optional --db path passthrough).
 *
 * Run:  node tools/imsg-rpc/server.mjs
 * Stop: ctrl-c — stdin close drains the imsg child cleanly.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import readline from 'node:readline';

const PORT = Number(process.env.IMSG_RPC_PORT || 8930);
const IMSCG_BIN = process.env.IMSG_RPC_BIN || '/opt/homebrew/bin/imsg';
const IMSCG_DB = process.env.IMSG_RPC_DB || '';

// ── imsg rpc child lifecycle ──────────────────────────────────────────────
let child = null;
let nextId = 1;
const pending = new Map(); // id -> {resolve, reject, timer}
const watchSubscribers = new Set(); // SSE response objects
let watchSubscriptionId = null;
let shuttingDown = false;

function startChild() {
  const args = ['rpc', '--json'];
  if (IMSCG_DB) args.push('--db', IMSCG_DB);
  child = spawn(IMSCG_BIN, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(Object.assign(new Error(msg.error.message || 'rpc error'), { rpc: msg.error }));
      else p.resolve(msg.result);
      return;
    }
    // Notifications: method "message" / "watch.overflow" from watch.subscribe
    if (msg.method === 'message' || msg.method === 'watch.overflow') {
      const payload = `data: ${JSON.stringify(msg)}\n\n`;
      for (const res of watchSubscribers) {
        try { res.write(payload); } catch { watchSubscribers.delete(res); }
      }
    }
  });
  child.on('exit', (code) => {
    child = null;
    for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error(`imsg rpc exited (code ${code})`)); }
    pending.clear();
    watchSubscriptionId = null;
    if (!shuttingDown) {
      console.error(`[imsg-rpc] child exited code=${code} — restarting in 2s`);
      setTimeout(startChild, 2000);
    }
  });
  child.on('error', (e) => {
    console.error(`[imsg-rpc] spawn error: ${e.message}`);
    if (!shuttingDown) setTimeout(startChild, 2000);
  });
}

function rpc(method, params = {}, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!child || child.killed) return reject(new Error('imsg rpc child not running'));
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`rpc timeout: ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

async function ensureWatch() {
  if (watchSubscriptionId != null) return watchSubscriptionId;
  const r = await rpc('watch.subscribe', { debounce_ms: 400 }, 15000);
  watchSubscriptionId = r?.subscription ?? null;
  return watchSubscriptionId;
}

// ── HTTP API ──────────────────────────────────────────────────────────────
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (u.pathname === '/health') {
      // imsg 0.4.0 has no status/initialize methods — chats.list is the
      // cheapest db-backed liveness probe.
      let probe = null, err = null;
      try { probe = await rpc('chats.list', { limit: 1 }, 8000); } catch (e) { err = String(e?.message || e); }
      return sendJson(res, 200, {
        ok: !!child && !child.killed && !err,
        childAlive: !!child && !child.killed,
        chats: probe?.chats?.length ?? null,
        error: err,
      });
    }
    if (u.pathname === '/chats' && req.method === 'GET') {
      const limit = Math.min(Number(u.searchParams.get('limit')) || 20, 100);
      const r = await rpc('chats.list', { limit });
      return sendJson(res, 200, { ok: true, chats: r?.chats ?? [] });
    }
    if (u.pathname === '/history' && req.method === 'GET') {
      const chatId = Number(u.searchParams.get('chat_id'));
      if (!Number.isFinite(chatId)) return sendJson(res, 400, { ok: false, error: 'chat_id required' });
      const limit = Math.min(Number(u.searchParams.get('limit')) || 20, 100);
      const r = await rpc('messages.history', { chat_id: chatId, limit });
      return sendJson(res, 200, { ok: true, messages: r?.messages ?? [] });
    }
    if (u.pathname === '/search' && req.method === 'GET') {
      const q = u.searchParams.get('q') || '';
      if (!q) return sendJson(res, 400, { ok: false, error: 'q required' });
      const limit = Math.min(Number(u.searchParams.get('limit')) || 20, 100);
      const r = await rpc('messages.search', { query: q, limit });
      return sendJson(res, 200, { ok: true, messages: r?.messages ?? [] });
    }
    if (u.pathname === '/send' && req.method === 'POST') {
      const body = await readBody(req);
      const params = {};
      if (body.to) params.to = String(body.to);
      else if (body.chat_id != null) params.chat_id = Number(body.chat_id);
      else if (body.chat_guid) params.chat_guid = String(body.chat_guid);
      else if (body.chat_identifier) params.chat_identifier = String(body.chat_identifier);
      else return sendJson(res, 400, { ok: false, error: 'to | chat_id | chat_guid | chat_identifier required' });
      if (body.text != null) params.text = String(body.text);
      if (body.file) params.file = String(body.file);
      if (body.service) params.service = String(body.service);
      const r = await rpc('send', params, 60000);
      return sendJson(res, 200, { ok: true, result: r });
    }
    if (u.pathname === '/watch' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(`data: ${JSON.stringify({ type: 'ready' })}\n\n`);
      watchSubscribers.add(res);
      try { await ensureWatch(); }
      catch (e) { res.write(`data: ${JSON.stringify({ type: 'watch_error', error: String(e?.message || e) })}\n\n`); }
      req.on('close', () => {
        watchSubscribers.delete(res);
        // Last subscriber gone → release the upstream subscription so the
        // imsg child doesn't buffer forever.
        if (watchSubscribers.size === 0 && watchSubscriptionId != null) {
          const id = watchSubscriptionId;
          watchSubscriptionId = null;
          rpc('watch.unsubscribe', { subscription: id }, 10000).catch(() => {});
        }
      });
      return;
    }
    sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    sendJson(res, 200, { ok: false, error: String(e?.message || e) });
  }
});

startChild();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[imsg-rpc] http://127.0.0.1:${PORT}  (child: ${IMSCG_BIN})`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  try { child?.stdin.end(); } catch { }
  setTimeout(() => { try { child?.kill('SIGKILL'); } catch { } process.exit(0); }, 3000).unref();
}
